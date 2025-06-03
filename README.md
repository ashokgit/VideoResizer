# 🎬 Video Processor Studio

A modern, full-stack video processing application with a React frontend and Flask API backend. Transform your videos with professional-grade tools including aspect ratio conversion, time-based cropping, and CTA video appending.

## ✨ Features

- **📱 Aspect Ratio Conversion**: Convert between 9:16 (TikTok/Stories), 16:9 (YouTube), 1:1 (Instagram), 4:3, 4:5, and custom ratios
- **✂️ Time-based Cropping**: Trim videos to specific time segments with precision
- **🎯 CTA Video Appending**: Automatically append call-to-action clips to your videos
- **🎨 Quality Control**: Choose from lossless to optimized compression (lossless, high, medium, low)
- **🚀 Modern UI**: Beautiful React frontend with Material-UI components
- **⚡ REST API**: Robust Flask backend with proper error handling
- **🐳 Docker Ready**: Complete containerized setup with Docker Compose

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│  React Frontend │    │  Flask Backend  │
│  (Port 3005)    │◄──►│  (Port 5001)    │
│  - Material-UI  │    │  - Video Proc.  │
│  - TypeScript   │    │  - REST API     │
│  - Nginx        │    │  - File Upload  │
└─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed
- 8GB+ RAM (for video processing)
- 10GB+ free disk space

### 1. Clone and Start

```bash
git clone <repository-url>
cd VideoResizer
docker-compose up --build
```

### 2. Access the Application

- **Frontend**: http://localhost:3005
- **Backend API**: http://localhost:5001/api/health

### 3. Start Processing Videos!

1. Upload your main video file (MP4, AVI, MOV, MKV, WMV, FLV)
2. Configure processing options:
   - Enable time cropping and set start/end times
   - Choose aspect ratio conversion
   - Upload CTA video (optional)
   - Select quality preset
3. Click "Process Video"
4. Download your processed video

## 📁 Project Structure

```
VideoResizer/
├── app.py                 # Flask API backend
├── video_processor.py     # Video processing logic
├── requirements.txt       # Python dependencies
├── Dockerfile            # Backend container
├── docker-compose.yml    # Service orchestration
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── types.ts      # TypeScript types
│   │   ├── api.ts        # API service layer
│   │   ├── utils.ts      # Utility functions
│   │   └── App.tsx       # Main app component
│   ├── public/           # Static files
│   ├── package.json      # Node.js dependencies
│   ├── Dockerfile        # Frontend container
│   └── nginx.conf        # Nginx configuration
├── temp/                 # Temporary files
├── input/                # Input videos
└── output/               # Processed videos
```

## 🔧 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/upload` | Upload video file |
| GET | `/api/video-info/<file_id>` | Get video information |
| POST | `/api/process` | Process video |
| GET | `/api/download/<file_id>` | Download processed video |
| GET | `/api/preview/<file_id>` | Stream video preview |
| POST | `/api/cleanup` | Clean up temporary files |

### Upload Video

```bash
curl -X POST http://localhost:5001/api/upload \
  -F "file=@your-video.mp4"
```

### Process Video

```bash
curl -X POST http://localhost:5001/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "main_video_id": "file_id_from_upload",
    "enable_time_crop": true,
    "start_time": 0,
    "end_time": 30,
    "enable_ratio_change": true,
    "target_ratio": {"width": 9, "height": 16},
    "resize_method": "crop",
    "quality_preset": "high"
  }'
```

## ⚙️ Processing Options

### Aspect Ratio Conversion

- **9:16**: Perfect for TikTok, Instagram Stories, YouTube Shorts
- **16:9**: Standard for YouTube, Facebook videos
- **1:1**: Square format for Instagram posts
- **4:3**: Traditional TV format
- **4:5**: Instagram portrait posts
- **Custom**: Define your own width:height ratio

### Resize Methods

- **Crop**: Maintains video quality but may lose some content
- **Pad**: Adds letterbox/pillarbox bars to maintain full content
- **Stretch**: Fits entire video but may cause distortion

### Quality Presets

- **Lossless**: No quality loss (CRF 0, largest files, slowest)
- **High**: Near-lossless quality (CRF 18, recommended)
- **Medium**: Good quality balance (CRF 23)
- **Low**: Smaller files, faster processing (CRF 28)

## 🐳 Docker Configuration

### Backend Service

```yaml
backend:
  build: .
  ports:
    - "5001:5001"
  volumes:
    - ./temp:/app/temp
    - ./input:/app/input  
    - ./output:/app/output
  environment:
    - FLASK_ENV=production
    - PYTHONUNBUFFERED=1
```

### Frontend Service

```yaml
frontend:
  build: ./frontend
  ports:
    - "3005:80"
  depends_on:
    - backend
  environment:
    - REACT_APP_API_URL=http://localhost:5001/api
```

## 🛠️ Development Setup

### Local Development (without Docker)

#### Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start Flask development server
python app.py
```

#### Frontend Setup

```bash
cd frontend

# Install Node.js dependencies
npm install

# Start React development server
npm start
```

### Environment Variables

#### Backend (.env)

```env
FLASK_ENV=development
FLASK_APP=app.py
UPLOAD_FOLDER=temp
MAX_CONTENT_LENGTH=524288000  # 500MB
```

#### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:5001/api
```

## 📊 Supported Formats

### Input Formats
- **Video**: MP4, AVI, MOV, MKV, WMV, FLV
- **Max Size**: 500MB per file

### Output Format
- **Video**: MP4 (H.264 codec)
- **Audio**: AAC codec

## 🔍 Troubleshooting

### Common Issues

#### Container Build Fails
```bash
# Clean rebuild
docker-compose down
docker system prune -a
docker-compose up --build
```

#### Video Processing Errors
- Check video format is supported
- Ensure sufficient disk space (2x video size)
- Verify FFmpeg is properly installed in container

#### Frontend Can't Connect to Backend
- Verify backend is running: `curl http://localhost:5001/api/health`
- Check Docker network connectivity
- Ensure CORS is properly configured

### Performance Optimization

#### For Large Videos
- Use "low" quality preset for faster processing
- Crop time segments before aspect ratio conversion
- Ensure adequate RAM (8GB+ recommended)

#### Storage Management
```bash
# Clean up temporary files
docker-compose exec backend python -c "
import os, time
temp_dir = '/app/temp'
for f in os.listdir(temp_dir):
    file_path = os.path.join(temp_dir, f)
    if time.time() - os.path.getmtime(file_path) > 3600:
        os.remove(file_path)
"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MoviePy**: Python video processing library
- **FFmpeg**: Video processing engine
- **React**: Frontend framework
- **Material-UI**: React component library
- **Flask**: Python web framework
- **Docker**: Containerization platform

## 📞 Support

For support, please:
1. Check the troubleshooting section above
2. Search existing issues
3. Create a new issue with detailed information

---

**Built with ❤️ for the video creator community**