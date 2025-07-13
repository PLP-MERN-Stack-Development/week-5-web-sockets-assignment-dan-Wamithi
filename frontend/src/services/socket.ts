import { io, type Socket } from "socket.io-client"
import { useAuthStore } from "../store/authStore"

class SocketService {
  private socket: Socket | null = null

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: {
        token,
      },
      transports: ["websocket"],
    })

    this.socket.on("connect", () => {
      console.log("Connected to server")
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server")
    })

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error)
      if (error.message.includes("Authentication error")) {
        useAuthStore.getState().logout()
      }
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket() {
    return this.socket
  }

  // Message events
  sendMessage(data: { content: string; roomId: string; type?: string }) {
    this.socket?.emit("send_message", data)
  }

  sendPrivateMessage(data: { recipientId: string; content: string }) {
    this.socket?.emit("send_private_message", data)
  }

  // Room events
  joinRoom(roomId: string) {
    this.socket?.emit("join_room", roomId)
  }

  // Typing events
  startTyping(roomId: string) {
    this.socket?.emit("typing_start", { roomId })
  }

  stopTyping(roomId: string) {
    this.socket?.emit("typing_stop", { roomId })
  }

  // Reaction events
  addReaction(messageId: string, emoji: string) {
    this.socket?.emit("add_reaction", { messageId, emoji })
  }

  // Event listeners
  onNewMessage(callback: (message: any) => void) {
    this.socket?.on("new_message", callback)
  }

  onUserTyping(callback: (data: any) => void) {
    this.socket?.on("user_typing", callback)
  }

  onUserStatusChange(callback: (data: any) => void) {
    this.socket?.on("user_status_change", callback)
  }

  onOnlineUsers(callback: (users: any[]) => void) {
    this.socket?.on("online_users", callback)
  }

  onReactionUpdated(callback: (data: any) => void) {
    this.socket?.on("reaction_updated", callback)
  }

  onRoomMessages(callback: (data: any) => void) {
    this.socket?.on("room_messages", callback)
  }

  onError(callback: (error: any) => void) {
    this.socket?.on("error", callback)
  }

  // Remove listeners
  off(event: string, callback?: any) {
    this.socket?.off(event, callback)
  }
}

export const socketService = new SocketService()
