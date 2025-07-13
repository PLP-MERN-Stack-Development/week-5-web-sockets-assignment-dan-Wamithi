import type { Server, Socket } from "socket.io"
import jwt from "jsonwebtoken"
import User, { type IUser } from "../models/User"
import Message from "../models/Message"
import Room from "../models/Room"

interface AuthenticatedSocket extends Socket {
  userId?: string
  user?: IUser
}

interface TypingData {
  roomId: string
  isTyping: boolean
}

interface MessageData {
  content: string
  roomId: string
  type?: "text" | "image" | "file"
  fileName?: string
  fileUrl?: string
  replyTo?: string
}

interface ReactionData {
  messageId: string
  emoji: string
}

// Store active users and their socket connections
const activeUsers = new Map<string, string>() // userId -> socketId
const userSockets = new Map<string, string>() // socketId -> userId

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error("Authentication error: No token provided"))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      const user = await User.findById(decoded.userId)

      if (!user) {
        return next(new Error("Authentication error: User not found"))
      }

      socket.userId = user._id.toString()
      socket.user = user
      next()
    } catch (error) {
      next(new Error("Authentication error: Invalid token"))
    }
  })

  io.on("connection", async (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.user?.username} connected: ${socket.id}`)

    if (!socket.userId || !socket.user) return

    // Update user status and socket ID
    await User.findByIdAndUpdate(socket.userId, {
      status: "online",
      socketId: socket.id,
      lastSeen: new Date(),
    })

    // Store user connection
    activeUsers.set(socket.userId, socket.id)
    userSockets.set(socket.id, socket.userId)

    // Join user's rooms
    const userRooms = await Room.find({ participants: socket.userId })
    userRooms.forEach((room) => {
      socket.join(room._id.toString())
    })

    // Broadcast user online status
    socket.broadcast.emit("user_status_change", {
      userId: socket.userId,
      username: socket.user.username,
      status: "online",
    })

    // Send online users to the connected user
    const onlineUsers = await User.find({ status: "online" }).select("username status lastSeen")
    socket.emit("online_users", onlineUsers)

    // Handle joining a room
    socket.on("join_room", async (roomId: string) => {
      try {
        const room = await Room.findById(roomId)
        if (!room || !room.participants.includes(socket.userId!)) {
          socket.emit("error", { message: "Access denied to this room" })
          return
        }

        socket.join(roomId)

        // Load recent messages
        const messages = await Message.find({ room: roomId, isDeleted: false })
          .populate("sender", "username avatar")
          .populate("replyTo")
          .sort({ createdAt: -1 })
          .limit(50)

        socket.emit("room_messages", {
          roomId,
          messages: messages.reverse(),
        })

        // Notify room that user joined
        socket.to(roomId).emit("user_joined_room", {
          userId: socket.userId,
          username: socket.user!.username,
          roomId,
        })
      } catch (error) {
        socket.emit("error", { message: "Failed to join room" })
      }
    })

    // Handle sending messages
    socket.on("send_message", async (data: MessageData) => {
      try {
        const { content, roomId, type = "text", fileName, fileUrl, replyTo } = data

        // Validate room access
        const room = await Room.findById(roomId)
        if (!room || !room.participants.includes(socket.userId!)) {
          socket.emit("error", { message: "Access denied to this room" })
          return
        }

        // Create message
        const message = new Message({
          content,
          sender: socket.userId,
          room: roomId,
          type,
          fileName,
          fileUrl,
          replyTo: replyTo || null,
        })

        await message.save()
        await message.populate("sender", "username avatar")

        if (replyTo) {
          await message.populate("replyTo")
        }

        // Update room's last message and activity
        await Room.findByIdAndUpdate(roomId, {
          lastMessage: message._id,
          lastActivity: new Date(),
        })

        // Broadcast message to room
        io.to(roomId).emit("new_message", message)

        // Send push notification to offline users
        const offlineParticipants = await User.find({
          _id: { $in: room.participants },
          status: "offline",
        })

        // Here you would implement push notifications
        // For now, we'll just log it
        if (offlineParticipants.length > 0) {
          console.log(`Sending notifications to ${offlineParticipants.length} offline users`)
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to send message" })
      }
    })

    // Handle typing indicators
    socket.on("typing_start", (data: TypingData) => {
      socket.to(data.roomId).emit("user_typing", {
        userId: socket.userId,
        username: socket.user!.username,
        roomId: data.roomId,
        isTyping: true,
      })
    })

    socket.on("typing_stop", (data: TypingData) => {
      socket.to(data.roomId).emit("user_typing", {
        userId: socket.userId,
        username: socket.user!.username,
        roomId: data.roomId,
        isTyping: false,
      })
    })

    // Handle message reactions
    socket.on("add_reaction", async (data: ReactionData) => {
      try {
        const { messageId, emoji } = data
        const message = await Message.findById(messageId)

        if (!message) {
          socket.emit("error", { message: "Message not found" })
          return
        }

        // Check if user already reacted with this emoji
        const existingReaction = message.reactions.find((r) => r.emoji === emoji)

        if (existingReaction) {
          const userIndex = existingReaction.users.findIndex((userId) => userId.toString() === socket.userId)

          if (userIndex > -1) {
            // Remove reaction
            existingReaction.users.splice(userIndex, 1)
            if (existingReaction.users.length === 0) {
              message.reactions = message.reactions.filter((r) => r.emoji !== emoji)
            }
          } else {
            // Add reaction
            existingReaction.users.push(socket.userId!)
          }
        } else {
          // Create new reaction
          message.reactions.push({
            emoji,
            users: [socket.userId!],
          })
        }

        await message.save()

        // Broadcast reaction update
        io.to(message.room.toString()).emit("reaction_updated", {
          messageId,
          reactions: message.reactions,
        })
      } catch (error) {
        socket.emit("error", { message: "Failed to add reaction" })
      }
    })

    // Handle private messaging
    socket.on("send_private_message", async (data: { recipientId: string; content: string }) => {
      try {
        const { recipientId, content } = data

        // Find or create direct message room
        let room = await Room.findOne({
          type: "direct",
          participants: { $all: [socket.userId, recipientId], $size: 2 },
        })

        if (!room) {
          room = new Room({
            name: `${socket.user!.username}-${recipientId}`,
            type: "direct",
            participants: [socket.userId, recipientId],
            owner: socket.userId,
            admins: [socket.userId],
          })
          await room.save()
        }

        // Create message
        const message = new Message({
          content,
          sender: socket.userId,
          room: room._id,
          type: "text",
        })

        await message.save()
        await message.populate("sender", "username avatar")

        // Send to both users
        const recipientSocketId = activeUsers.get(recipientId)
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("new_private_message", {
            message,
            roomId: room._id,
          })
        }

        socket.emit("new_private_message", {
          message,
          roomId: room._id,
        })
      } catch (error) {
        socket.emit("error", { message: "Failed to send private message" })
      }
    })

    // Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`User ${socket.user?.username} disconnected: ${socket.id}`)

      if (socket.userId) {
        // Update user status
        await User.findByIdAndUpdate(socket.userId, {
          status: "offline",
          lastSeen: new Date(),
          socketId: null,
        })

        // Remove from active users
        activeUsers.delete(socket.userId)
        userSockets.delete(socket.id)

        // Broadcast user offline status
        socket.broadcast.emit("user_status_change", {
          userId: socket.userId,
          username: socket.user!.username,
          status: "offline",
        })
      }
    })

    // Handle errors
    socket.on("error", (error) => {
      console.error("Socket error:", error)
    })
  })
}
