// Script to create environment variables template
import fs from "fs"

const envTemplate = `# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/chatapp

# For production, use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatapp?retryWrites=true&w=majority

# Next.js Configuration
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# File Upload (Optional)
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
`

try {
  fs.writeFileSync(".env.local", envTemplate)
  console.log("✅ .env.local file created successfully!")
  console.log("📝 Please update the environment variables with your actual values.")
  console.log("")
  console.log("🔧 MongoDB Setup Options:")
  console.log("1. Local MongoDB: mongodb://localhost:27017/chatapp")
  console.log("2. MongoDB Atlas: Get connection string from https://cloud.mongodb.com")
  console.log("")
  console.log('🚀 Run "npm run seed" to initialize the database')
} catch (error) {
  console.error("❌ Error creating .env.local:", error)
}
