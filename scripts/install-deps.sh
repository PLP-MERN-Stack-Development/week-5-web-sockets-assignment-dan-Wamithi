#!/bin/bash

echo "🚀 Installing Real-time Chat App Dependencies with pnpm"
echo "======================================================="

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
    echo "✅ pnpm installed successfully!"
fi

echo "📦 Installing project dependencies..."

# Install core dependencies
echo "Installing core framework..."
pnpm add next@14.0.0 react@^18 react-dom@^18

echo "Installing real-time and database packages..."
pnpm add socket.io@^4.7.4 socket.io-client@^4.7.4 mongoose@^8.0.0

echo "Installing UI components..."
pnpm add @radix-ui/react-avatar@^1.0.4
pnpm add @radix-ui/react-dialog@^1.0.5
pnpm add @radix-ui/react-scroll-area@^1.0.5
pnpm add @radix-ui/react-separator@^1.0.3
pnpm add @radix-ui/react-tabs@^1.0.4

echo "Installing styling and utilities..."
pnpm add class-variance-authority@^0.7.0
pnpm add clsx@^2.0.0
pnpm add lucide-react@^0.294.0
pnpm add tailwind-merge@^2.0.0
pnpm add tailwindcss-animate@^1.0.7

echo "Installing development dependencies..."
pnpm add -D typescript@^5
pnpm add -D @types/node@^20
pnpm add -D @types/react@^18
pnpm add -D @types/react-dom@^18
pnpm add -D autoprefixer@^10.0.1
pnpm add -D postcss@^8
pnpm add -D tailwindcss@^3.3.0
pnpm add -D eslint@^8
pnpm add -D eslint-config-next@14.0.0

echo "✅ All dependencies installed successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Run: pnpm run setup (to create environment file)"
echo "2. Edit .env.local with your MongoDB URI"
echo "3. Run: pnpm run seed (to initialize database)"
echo "4. Run: pnpm dev (to start development server)"
echo ""
echo "🌐 Your app will be available at: http://localhost:3000"
