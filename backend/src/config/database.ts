import mongoose from "mongoose"

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/chatapp"

    const options = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    }

    const conn = await mongoose.connect(mongoURI, options)

    console.log(`MongoDB Connected: ${conn.connection.host}`)

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err)
    })

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected")
    })

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected")
    })
  } catch (error) {
    console.error("Database connection failed:", error)
    process.exit(1)
  }
}

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close()
    console.log("MongoDB connection closed")
  } catch (error) {
    console.error("Error closing database connection:", error)
  }
}
