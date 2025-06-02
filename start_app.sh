#!/bin/bash

# 🎬 Video Processor Studio - Docker Start Script
# Modern React + Flask Video Processing Application

set -e

echo "🎬 Video Processor Studio - Starting Application..."
echo "======================================================"

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p temp input output

# Set proper permissions
echo "🔐 Setting proper permissions..."
chmod 755 temp input output

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Build and start the application
echo "🚀 Building and starting the application..."
echo "   This may take a few minutes on first run..."

if docker-compose up --build -d; then
    echo ""
    echo "✅ Application started successfully!"
    echo "======================================================"
    echo ""
    echo "🌐 Access your application:"
    echo "   Frontend (React UI): http://localhost:3000"
    echo "   Backend API:         http://localhost:5001/api/health"
    echo ""
    echo "📱 Features available:"
    echo "   • Upload and process videos"
    echo "   • Aspect ratio conversion (9:16, 16:9, 1:1, etc.)"
    echo "   • Time-based video cropping"
    echo "   • CTA video appending"
    echo "   • Quality control (lossless to low)"
    echo ""
    echo "🛠️ Useful commands:"
    echo "   View logs:           docker-compose logs -f"
    echo "   Stop application:    docker-compose down"
    echo "   Restart:             docker-compose restart"
    echo "   Rebuild:             docker-compose up --build"
    echo ""
    echo "📁 Directories:"
    echo "   Upload videos to:    ./input/"
    echo "   Processed videos:    ./output/"
    echo "   Temporary files:     ./temp/"
    echo ""
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 5
    
    # Check if services are running
    if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
        echo "✅ Backend API is ready!"
    else
        echo "⚠️  Backend API might still be starting..."
    fi
    
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend is ready!"
    else
        echo "⚠️  Frontend might still be starting..."
    fi
    
    echo ""
    echo "🎉 Ready to process videos! Open http://localhost:3000 in your browser."
    echo ""
    
    # Option to view logs
    read -p "📋 View live logs? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose logs -f
    fi
    
else
    echo ""
    echo "❌ Failed to start the application."
    echo "🔍 Check the logs for more information:"
    echo "   docker-compose logs"
    echo ""
    echo "🛠️ Troubleshooting:"
    echo "   • Ensure Docker has enough memory (8GB+ recommended)"
    echo "   • Check if ports 3000 and 5001 are available"
    echo "   • Try: docker system prune -a (removes all unused Docker data)"
    echo ""
    exit 1
fi 