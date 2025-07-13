#!/bin/bash

echo "🚀 Setting up Real-time Chat Application"
echo "========================================"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
    echo "✅ pnpm installed successfully!"
fi

# Create project structure
echo "📁 Creating project structure..."
mkdir -p realtime-chat-app/{backend,frontend,docs,scripts}
cd realtime-chat-app

# Setup backend
echo "🔧 Setting up backend..."
cd backend
pnpm init -y

# Install backend dependencies
echo "📦 Installing backend dependencies..."
pnpm add express socket.io mongoose cors dotenv bcryptjs jsonwebtoken multer helmet morgan express-rate-limit express-validator compression uuid
pnpm add -D nodemon @types/node typescript ts-node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/multer @types/morgan @types/compression @types/uuid eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser jest @types/jest

# Create backend structure
mkdir -p src/{config,middleware,models,routes,controllers,utils,socket,scripts} uploads logs

# Setup frontend
echo "🎨 Setting up frontend..."
cd ../frontend
pnpm create vite . --template react-ts
pnpm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
pnpm add socket.io-client axios react-router-dom @emotion/react @emotion/styled @mui/material @mui/icons-material @mui/lab date-fns react-hot-toast react-dropzone zustand

# Create environment files
echo "⚙️ Creating environment files..."
cd ../backend
cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
EOF

cd ../frontend
cat > .env << EOF
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
EOF

# Create TypeScript config for backend
cd ../backend
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

echo "✅ Project setup complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Start MongoDB: mongod"
echo "2. Backend: cd backend && pnpm run dev"
echo "3. Frontend: cd frontend && pnpm run dev"
echo "4. Open http://localhost:3000"
echo ""
echo "📚 Check PROJECT_SETUP_GUIDE.txt for detailed instructions"
