#!/bin/bash

# Enhanced P2P Delivery Platform Setup Script

echo "🚀 Setting up Enhanced P2P Delivery Platform..."

# Create databases
echo "📊 Creating databases..."
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE IF NOT EXISTS notification_db;"
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE IF NOT EXISTS qr_db;"
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE IF NOT EXISTS admin_db;"

# Run database initialization
echo "🔧 Initializing database schemas..."
docker-compose exec notification-service npm run db:init
docker-compose exec qr-code-service npm run db:init  
docker-compose exec admin-service npm run db:init

# Install dependencies for all services
echo "📦 Installing dependencies..."
for service in notification-service qr-code-service admin-service; do
  echo "Installing dependencies for $service..."
  cd $service && npm install && cd ..
done

# Run tests
echo "🧪 Running test suites..."
for service in notification-service qr-code-service admin-service; do
  echo "Testing $service..."
  cd $service && npm test && cd ..
done

echo "✅ Enhanced P2P Delivery Platform setup completed!"
echo ""
echo "🌐 Service URLs:"
echo "- Notification Service: http://localhost:3005"
echo "- QR Code Service: http://localhost:3006"
echo "- Admin Service: http://localhost:3007"
echo ""
echo "📚 API Documentation:"
echo "- Notification API: http://localhost:3005/api-docs"
echo "- QR Code API: http://localhost:3006/api-docs"
echo "- Admin API: http://localhost:3007/api-docs"
