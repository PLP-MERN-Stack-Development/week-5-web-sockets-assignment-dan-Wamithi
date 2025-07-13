"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Heart, Smile, ThumbsUp, Send, Users, MessageCircle, Upload, Bell, BellOff } from "lucide-react"

interface User {
  id: string
  username: string
  isOnline: boolean
}

interface Message {
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

interface Room {
  id: string
  name: string
  type: "public" | "private"
  participants: string[]
  unreadCount: number
}

export default function ChatApp() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [username, setUsername] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<string>("general")
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [notifications, setNotifications] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [privateMessageTarget, setPrivateMessageTarget] = useState("")
  const [showPrivateDialog, setShowPrivateDialog] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const newSocket = io()
      setSocket(newSocket)

      newSocket.on("connect", () => {
        setIsConnected(true)
      })

      newSocket.on("disconnect", () => {
        setIsConnected(false)
      })

      newSocket.on("message", (message: Message) => {
        setMessages((prev) => [...prev, message])

        // Show notification if enabled and not in current room
        if (notifications && message.sender !== username) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`New message from ${message.sender}`, {
              body: message.content,
              icon: "/favicon.ico",
            })
          }
        }
      })

      newSocket.on("users", (userList: User[]) => {
        setUsers(userList)
      })

      newSocket.on("rooms", (roomList: Room[]) => {
        setRooms(roomList)
      })

      newSocket.on("typing", ({ user, isTyping: typing }: { user: string; isTyping: boolean }) => {
        setTypingUsers((prev) => {
          if (typing) {
            return prev.includes(user) ? prev : [...prev, user]
          } else {
            return prev.filter((u) => u !== user)
          }
        })
      })

      newSocket.on(
        "messageReaction",
        ({ messageId, emoji, userId }: { messageId: string; emoji: string; userId: string }) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === messageId) {
                const reactions = { ...msg.reactions }
                if (!reactions[emoji]) reactions[emoji] = []

                if (reactions[emoji].includes(userId)) {
                  reactions[emoji] = reactions[emoji].filter((id) => id !== userId)
                  if (reactions[emoji].length === 0) delete reactions[emoji]
                } else {
                  reactions[emoji].push(userId)
                }

                return { ...msg, reactions }
              }
              return msg
            }),
          )
        },
      )

      newSocket.on("roomMessages", ({ roomId, messages }: { roomId: string; messages: Message[] }) => {
        if (roomId === currentRoom) {
          setMessages(messages)
        }
      })

      return () => {
        newSocket.close()
      }
    }
  }, [username, notifications])

  const joinChat = () => {
    if (username.trim() && socket) {
      socket.emit("join", username)

      // Request notification permission
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission()
      }
    }
  }

  const sendMessage = () => {
    if (newMessage.trim() && socket && username) {
      const message: Partial<Message> = {
        content: newMessage,
        sender: username,
        timestamp: new Date(),
        type: "text",
        reactions: {},
      }

      if (privateMessageTarget) {
        message.isPrivate = true
        message.recipient = privateMessageTarget
        socket.emit("privateMessage", message)
        setPrivateMessageTarget("")
        setShowPrivateDialog(false)
      } else {
        socket.emit("message", { ...message, room: currentRoom })
      }

      setNewMessage("")
      setIsTyping(false)
      socket.emit("typing", { isTyping: false })
    }
  }

  const handleTyping = (value: string) => {
    setNewMessage(value)

    if (socket && username) {
      if (value.length > 0 && !isTyping) {
        setIsTyping(true)
        socket.emit("typing", { isTyping: true })
      } else if (value.length === 0 && isTyping) {
        setIsTyping(false)
        socket.emit("typing", { isTyping: false })
      }
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && socket && username) {
      const reader = new FileReader()
      reader.onload = () => {
        const message: Partial<Message> = {
          content: `Shared a file: ${file.name}`,
          sender: username,
          timestamp: new Date(),
          type: file.type.startsWith("image/") ? "image" : "file",
          fileName: file.name,
          fileUrl: reader.result as string,
          reactions: {},
        }

        socket.emit("message", { ...message, room: currentRoom })
      }
      reader.readAsDataURL(file)
    }
  }

  const addReaction = (messageId: string, emoji: string) => {
    if (socket && username) {
      socket.emit("reaction", { messageId, emoji, userId: username })
    }
  }

  const joinRoom = (roomId: string) => {
    if (socket) {
      socket.emit("joinRoom", roomId)
      setCurrentRoom(roomId)
    }
  }

  const createPrivateRoom = (targetUser: string) => {
    if (socket && username) {
      const roomId = [username, targetUser].sort().join("-")
      socket.emit("createPrivateRoom", { roomId, participants: [username, targetUser] })
      setCurrentRoom(roomId)
    }
  }

  if (!isConnected || !username) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Join Chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                onKeyPress={(e) => e.key === "Enter" && joinChat()}
              />
            </div>
            <Button onClick={joinChat} className="w-full">
              Join Chat
            </Button>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
              <span>{isConnected ? "Connected" : "Connecting..."}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentRoomMessages = messages.filter((msg) =>
    msg.isPrivate
      ? (msg.sender === username &&
          msg.recipient === currentRoom.replace(`${username}-`, "").replace(`-${username}`, "")) ||
        (msg.recipient === username &&
          msg.sender === currentRoom.replace(`${username}-`, "").replace(`-${username}`, ""))
      : !msg.isPrivate,
  )

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Chat Rooms</h2>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => setNotifications(!notifications)}>
                {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="rooms" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 m-2">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="rooms" className="flex-1 px-2">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                <Button
                  variant={currentRoom === "general" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => joinRoom("general")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  General
                </Button>
                {rooms
                  .filter((room) => room.type === "private" && room.participants.includes(username))
                  .map((room) => (
                    <Button
                      key={room.id}
                      variant={currentRoom === room.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => joinRoom(room.id)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {room.name}
                      {room.unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {room.unreadCount}
                        </Badge>
                      )}
                    </Button>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="users" className="flex-1 px-2">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {users
                  .filter((user) => user.username !== username)
                  .map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{user.username}</span>
                        <div className={`w-2 h-2 rounded-full ${user.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => createPrivateRoom(user.username)}>
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{currentRoom === "general" ? "General Chat" : `Private Chat`}</h1>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">{users.filter((u) => u.isOnline).length} online</Badge>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {currentRoomMessages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === username ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender === username ? "bg-blue-500 text-white" : "bg-white border border-gray-200"
                  }`}
                >
                  {message.sender !== username && (
                    <div className="text-xs font-medium mb-1 text-gray-600">{message.sender}</div>
                  )}

                  {message.type === "image" && message.fileUrl && (
                    <img
                      src={message.fileUrl || "/placeholder.svg"}
                      alt={message.fileName}
                      className="max-w-full h-auto rounded mb-2"
                    />
                  )}

                  {message.type === "file" && (
                    <div className="flex items-center space-x-2 mb-2 p-2 bg-gray-100 rounded">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">{message.fileName}</span>
                    </div>
                  )}

                  <div>{message.content}</div>

                  {Object.keys(message.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(message.reactions).map(([emoji, users]) => (
                        <Button
                          key={emoji}
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => addReaction(message.id, emoji)}
                        >
                          {emoji} {users.length}
                        </Button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs opacity-70">{new Date(message.timestamp).toLocaleTimeString()}</div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => addReaction(message.id, "👍")}
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => addReaction(message.id, "❤️")}
                      >
                        <Heart className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => addReaction(message.id, "😊")}
                      >
                        <Smile className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {typingUsers.length > 0 && (
              <div className="text-sm text-gray-500 italic">
                {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1"
            />

            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <Button variant="outline" size="sm" onClick={() => document.getElementById("file-upload")?.click()}>
              <Upload className="w-4 h-4" />
            </Button>

            <Dialog open={showPrivateDialog} onOpenChange={setShowPrivateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Private Message</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="target-user">To:</Label>
                    <Input
                      id="target-user"
                      value={privateMessageTarget}
                      onChange={(e) => setPrivateMessageTarget(e.target.value)}
                      placeholder="Username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="private-message">Message:</Label>
                    <Textarea
                      id="private-message"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your private message..."
                    />
                  </div>
                  <Button onClick={sendMessage} className="w-full">
                    Send Private Message
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button onClick={sendMessage}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
