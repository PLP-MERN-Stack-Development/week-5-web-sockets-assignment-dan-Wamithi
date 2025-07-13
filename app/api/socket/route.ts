import type { NextRequest } from "next/server"
import type { Server as NetServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import type { NextApiResponse } from "next"
import connectDB from "@/lib/mongodb"
import User from "@/lib/models/User"
import Message from "@/lib/models/Message"
import Room from "@/lib/models/Room"

interface NextApiResponseServerIO extends NextApiResponse {
  socket: {
    server: NetServer & {
      io?: SocketIOServer
    }
  }
}

interface SocketUser {
  id: string
  username: string
  isOnline: boolean
}

interface ClientMessage {
  id: string
  content: string
  sender: string
  timestamp: Date
  type: "text" | "file" | "image"
  fileName?: string
  fileUrl?: string
  reactions: { [emoji: string]: string[] }
  isPrivate?: boolean
  recipient?: string
}

// In-memory storage for active socket connections
const activeConnections = new Map<string, { userId: string; username: string }>()

export async function GET(req: NextRequest) {
  return new Response("Socket.IO server is running", { status: 200 })
}

export async function POST(req: NextRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    console.log("Setting up Socket.IO server with MongoDB...")

    // Connect to MongoDB
    await connectDB()

    // Initialize default general room if it doesn't exist
    try {
      const generalRoom = await Room.findOne({ name: "General", type: "public" })
      if (!generalRoom) {
        // Create a system user for room creation
        let systemUser = await User.findOne({ username: "system" })
        if (!systemUser) {
          systemUser = await User.create({
            username: "system",
            isOnline: false,
          })
        }

        await Room.create({
          name: "General",
          description: "General chat room for everyone",
          type: "public",
          participants: [],
          participantUsernames: [],
          admins: [systemUser._id],
          createdBy: systemUser._id,
        })
        console.log("Created default General room")
      }
    } catch (error) {
      console.error("Error initializing default room:", error)
    }

    const io = new SocketIOServer(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id)

      socket.on("join", async (username: string) => {
        try {
          await connectDB()

          // Find or create user
          let user = await User.findOne({ username })
          if (!user) {
            user = await User.create({
              username,
              socketId: socket.id,
              isOnline: true,
              lastSeen: new Date(),
            })
          } else {
            // Update user's socket and online status
            user.socketId = socket.id
            user.isOnline = true
            user.lastSeen = new Date()
            await user.save()
          }

          // Store connection info
          activeConnections.set(socket.id, { userId: user._id.toString(), username })
          socket.data.userId = user._id.toString()
          socket.data.username = username

          // Join general room by default
          socket.join("general")

          // Add user to general room participants if not already there
          const generalRoom = await Room.findOne({ name: "General", type: "public" })
          if (generalRoom && !generalRoom.participantUsernames.includes(username)) {
            generalRoom.participants.push(user._id)
            generalRoom.participantUsernames.push(username)
            await generalRoom.save()
          }

          // Send current online users
          const onlineUsers = await User.find({ isOnline: true }).select("username isOnline")
          const userList: SocketUser[] = onlineUsers.map((u) => ({
            id: u._id.toString(),
            username: u.username,
            isOnline: u.isOnline,
          }))
          io.emit("users", userList)

          // Send available rooms
          const rooms = await Room.find({
            $or: [{ type: "public" }, { participants: user._id }],
            isActive: true,
          }).select("name type participants participantUsernames")

          const roomList = rooms.map((room) => ({
            id: room._id.toString(),
            name: room.name,
            type: room.type,
            participants: room.participantUsernames,
            unreadCount: 0, // TODO: Implement unread count logic
          }))
          socket.emit("rooms", roomList)

          // Send recent messages from general room
          const recentMessages = await Message.find({
            roomName: "General",
            deletedAt: null,
          })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()

          const clientMessages: ClientMessage[] = recentMessages.reverse().map((msg) => ({
            id: msg._id.toString(),
            content: msg.content,
            sender: msg.senderUsername,
            timestamp: msg.createdAt,
            type: msg.type as "text" | "file" | "image",
            fileName: msg.fileName,
            fileUrl: msg.fileUrl,
            reactions: msg.reactions.reduce(
              (acc, reaction) => {
                acc[reaction.emoji] = reaction.users.map((u) => u.toString())
                return acc
              },
              {} as { [emoji: string]: string[] },
            ),
            isPrivate: msg.isPrivate,
            recipient: msg.recipientUsername,
          }))

          socket.emit("messages", clientMessages)

          console.log(`${username} joined the chat`)
        } catch (error) {
          console.error("Error in join event:", error)
          socket.emit("error", "Failed to join chat")
        }
      })

      socket.on("message", async (messageData: Partial<ClientMessage> & { room?: string }) => {
        try {
          await connectDB()

          const connectionInfo = activeConnections.get(socket.id)
          if (!connectionInfo) return

          const user = await User.findById(connectionInfo.userId)
          if (!user) return

          const room = messageData.room || "General"
          const roomDoc = await Room.findOne({ name: room })

          // Create message in database
          const message = await Message.create({
            content: messageData.content || "",
            sender: user._id,
            senderUsername: user.username,
            room: roomDoc?._id,
            roomName: room,
            type: messageData.type || "text",
            fileName: messageData.fileName,
            fileUrl: messageData.fileUrl,
            isPrivate: false,
            reactions: [],
          })

          // Update room's last activity
          if (roomDoc) {
            roomDoc.lastMessage = message._id
            roomDoc.lastActivity = new Date()
            await roomDoc.save()
          }

          // Convert to client format
          const clientMessage: ClientMessage = {
            id: message._id.toString(),
            content: message.content,
            sender: message.senderUsername,
            timestamp: message.createdAt,
            type: message.type as "text" | "file" | "image",
            fileName: message.fileName,
            fileUrl: message.fileUrl,
            reactions: {},
            isPrivate: false,
          }

          // Broadcast to room
          io.to(room.toLowerCase()).emit("message", clientMessage)

          console.log(`Message from ${user.username} in ${room}: ${message.content}`)
        } catch (error) {
          console.error("Error in message event:", error)
          socket.emit("error", "Failed to send message")
        }
      })

      socket.on("privateMessage", async (messageData: Partial<ClientMessage>) => {
        try {
          await connectDB()

          const connectionInfo = activeConnections.get(socket.id)
          if (!connectionInfo) return

          const sender = await User.findById(connectionInfo.userId)
          const recipient = await User.findOne({ username: messageData.recipient })

          if (!sender || !recipient) return

          // Create private message in database
          const message = await Message.create({
            content: messageData.content || "",
            sender: sender._id,
            senderUsername: sender.username,
            recipient: recipient._id,
            recipientUsername: recipient.username,
            type: messageData.type || "text",
            fileName: messageData.fileName,
            fileUrl: messageData.fileUrl,
            isPrivate: true,
            reactions: [],
          })

          // Convert to client format
          const clientMessage: ClientMessage = {
            id: message._id.toString(),
            content: message.content,
            sender: message.senderUsername,
            timestamp: message.createdAt,
            type: message.type as "text" | "file" | "image",
            fileName: message.fileName,
            fileUrl: message.fileUrl,
            reactions: {},
            isPrivate: true,
            recipient: message.recipientUsername,
          }

          // Send to sender and recipient
          socket.emit("message", clientMessage)

          // Find recipient socket
          const recipientSocket = Array.from(io.sockets.sockets.values()).find(
            (s) => s.data.username === recipient.username,
          )

          if (recipientSocket) {
            recipientSocket.emit("message", clientMessage)
          }

          console.log(`Private message from ${sender.username} to ${recipient.username}`)
        } catch (error) {
          console.error("Error in privateMessage event:", error)
          socket.emit("error", "Failed to send private message")
        }
      })

      socket.on("typing", ({ isTyping }: { isTyping: boolean }) => {
        const connectionInfo = activeConnections.get(socket.id)
        if (connectionInfo) {
          socket.broadcast.emit("typing", {
            user: connectionInfo.username,
            isTyping,
          })
        }
      })

      socket.on(
        "reaction",
        async ({ messageId, emoji, userId }: { messageId: string; emoji: string; userId: string }) => {
          try {
            await connectDB()

            const user = await User.findOne({ username: userId })
            if (!user) return

            const message = await Message.findById(messageId)
            if (!message) return

            // Find existing reaction
            const existingReactionIndex = message.reactions.findIndex((r) => r.emoji === emoji)

            if (existingReactionIndex !== -1) {
              const reaction = message.reactions[existingReactionIndex]
              const userIndex = reaction.users.findIndex((u) => u.toString() === user._id.toString())

              if (userIndex !== -1) {
                // Remove user from reaction
                reaction.users.splice(userIndex, 1)
                if (reaction.users.length === 0) {
                  message.reactions.splice(existingReactionIndex, 1)
                }
              } else {
                // Add user to reaction
                reaction.users.push(user._id)
              }
            } else {
              // Create new reaction
              message.reactions.push({
                emoji,
                users: [user._id],
              })
            }

            await message.save()

            io.emit("messageReaction", { messageId, emoji, userId })
          } catch (error) {
            console.error("Error in reaction event:", error)
          }
        },
      )

      socket.on("joinRoom", async (roomId: string) => {
        try {
          const connectionInfo = activeConnections.get(socket.id)
          if (!connectionInfo) return

          socket.join(roomId.toLowerCase())

          // Load messages for this room if it's a private room
          if (roomId !== "general") {
            const messages = await Message.find({
              $or: [
                { roomName: roomId },
                {
                  isPrivate: true,
                  $or: [
                    {
                      senderUsername: connectionInfo.username,
                      recipientUsername: roomId
                        .replace(`${connectionInfo.username}-`, "")
                        .replace(`-${connectionInfo.username}`, ""),
                    },
                    {
                      recipientUsername: connectionInfo.username,
                      senderUsername: roomId
                        .replace(`${connectionInfo.username}-`, "")
                        .replace(`-${connectionInfo.username}`, ""),
                    },
                  ],
                },
              ],
              deletedAt: null,
            })
              .sort({ createdAt: -1 })
              .limit(50)
              .lean()

            const clientMessages: ClientMessage[] = messages.reverse().map((msg) => ({
              id: msg._id.toString(),
              content: msg.content,
              sender: msg.senderUsername,
              timestamp: msg.createdAt,
              type: msg.type as "text" | "file" | "image",
              fileName: msg.fileName,
              fileUrl: msg.fileUrl,
              reactions: msg.reactions.reduce(
                (acc, reaction) => {
                  acc[reaction.emoji] = reaction.users.map((u) => u.toString())
                  return acc
                },
                {} as { [emoji: string]: string[] },
              ),
              isPrivate: msg.isPrivate,
              recipient: msg.recipientUsername,
            }))

            socket.emit("roomMessages", { roomId, messages: clientMessages })
          }

          console.log(`${connectionInfo.username} joined room: ${roomId}`)
        } catch (error) {
          console.error("Error in joinRoom event:", error)
        }
      })

      socket.on("createPrivateRoom", async ({ roomId, participants }: { roomId: string; participants: string[] }) => {
        try {
          await connectDB()

          const connectionInfo = activeConnections.get(socket.id)
          if (!connectionInfo) return

          const user = await User.findById(connectionInfo.userId)
          if (!user) return

          // Check if room already exists
          let room = await Room.findOne({
            name: roomId,
            type: "private",
          })

          if (!room) {
            // Get participant user IDs
            const participantUsers = await User.find({ username: { $in: participants } })

            room = await Room.create({
              name: roomId,
              type: "private",
              participants: participantUsers.map((u) => u._id),
              participantUsernames: participants,
              admins: [user._id],
              createdBy: user._id,
            })
          }

          // Add all participants to the room
          participants.forEach((username) => {
            const userSocket = Array.from(io.sockets.sockets.values()).find((s) => s.data.username === username)
            if (userSocket) {
              userSocket.join(roomId)
            }
          })

          // Send updated rooms list
          const rooms = await Room.find({
            $or: [{ type: "public" }, { participants: user._id }],
            isActive: true,
          }).select("name type participants participantUsernames")

          const roomList = rooms.map((room) => ({
            id: room._id.toString(),
            name: room.name,
            type: room.type,
            participants: room.participantUsernames,
            unreadCount: 0,
          }))

          participants.forEach((username) => {
            const userSocket = Array.from(io.sockets.sockets.values()).find((s) => s.data.username === username)
            if (userSocket) {
              userSocket.emit("rooms", roomList)
            }
          })

          console.log(`Private room created: ${roomId}`)
        } catch (error) {
          console.error("Error in createPrivateRoom event:", error)
        }
      })

      socket.on("disconnect", async () => {
        try {
          await connectDB()

          const connectionInfo = activeConnections.get(socket.id)
          if (connectionInfo) {
            // Update user's online status
            await User.findByIdAndUpdate(connectionInfo.userId, {
              isOnline: false,
              lastSeen: new Date(),
              socketId: null,
            })

            activeConnections.delete(socket.id)

            // Send updated users list
            const onlineUsers = await User.find({ isOnline: true }).select("username isOnline")
            const userList: SocketUser[] = onlineUsers.map((u) => ({
              id: u._id.toString(),
              username: u.username,
              isOnline: u.isOnline,
            }))
            io.emit("users", userList)

            console.log(`${connectionInfo.username} disconnected`)
          }
        } catch (error) {
          console.error("Error in disconnect event:", error)
        }
      })
    })

    res.socket.server.io = io
  }

  return new Response("Socket.IO server initialized with MongoDB", { status: 200 })
}
