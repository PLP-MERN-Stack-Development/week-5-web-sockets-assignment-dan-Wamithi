// MongoDB seeding script
import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/chatapp"

async function seedDatabase() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log("Connected to MongoDB")

    // Clear existing data (optional - remove in production)
    await mongoose.connection.db.dropDatabase()
    console.log("Database cleared")

    // Create collections with proper indexes
    const db = mongoose.connection.db

    // Users collection
    await db.createCollection("users")
    await db.collection("users").createIndex({ username: 1 }, { unique: true })
    await db.collection("users").createIndex({ isOnline: 1 })
    await db.collection("users").createIndex({ socketId: 1 })

    // Messages collection
    await db.createCollection("messages")
    await db.collection("messages").createIndex({ room: 1, createdAt: -1 })
    await db.collection("messages").createIndex({ sender: 1, createdAt: -1 })
    await db.collection("messages").createIndex({ recipient: 1, createdAt: -1 })
    await db.collection("messages").createIndex({ isPrivate: 1, createdAt: -1 })

    // Rooms collection
    await db.createCollection("rooms")
    await db.collection("rooms").createIndex({ type: 1, isActive: 1 })
    await db.collection("rooms").createIndex({ participants: 1 })
    await db.collection("rooms").createIndex({ name: 1 })

    console.log("Database seeded successfully!")
    console.log("Collections created:")
    console.log("- users (with indexes on username, isOnline, socketId)")
    console.log("- messages (with indexes on room, sender, recipient, isPrivate)")
    console.log("- rooms (with indexes on type, participants, name)")
  } catch (error) {
    console.error("Error seeding database:", error)
  } finally {
    await mongoose.disconnect()
    console.log("Disconnected from MongoDB")
  }
}

seedDatabase()
