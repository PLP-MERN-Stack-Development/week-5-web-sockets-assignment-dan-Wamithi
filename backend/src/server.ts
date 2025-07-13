import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import compression from "compression"
import rateLimit from "express-rate-limit"
import dotenv from "dotenv"
import path from "path"

import { connectDB } from "./config/database"
import authRoutes from "./routes/auth"
import messageRoutes from "./routes/messages"
import roomRoutes from "./routes/rooms"
import uploadRoutes from "./routes/upload"
import { setupSocketHandlers } from "./socket/socketHandlers"
import { errorHandler } from "./middleware/errorHandler"
import { authenticateToken } from "./middleware/auth"

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}

// Socket.io setup
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Middleware
app.use(helmet())
app.use(cors(corsOptions))
app.use(compression())
app.use(morgan("combined"))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use("/api/", limiter)

// Static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")))

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/messages", authenticateToken, messageRoutes)
app.use("/api/rooms", authenticateToken, roomRoutes)
app.use("/api/upload", authenticateToken, uploadRoutes)

// Socket.io handlers
setupSocketHandlers(io)

// Error handling
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 5000

// Start server
const startServer = async () => {
  try {
    await connectDB()
    console.log("✅ Connected to MongoDB")

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📡 Socket.io server ready`)
      console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN}`)
    })
  } catch (error) {
    console.error("❌ Failed to start server:", error)
    process.exit(1)
  }
}

startServer()

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Process terminated")
  })
})

export { app, io }
