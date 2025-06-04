from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
import tempfile
import time
import uuid
from werkzeug.utils import secure_filename
from video_processor import VideoProcessor
from typing import Optional, Tuple
import json
import logging
import traceback
import threading

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Suppress noisy watchdog logs
logging.getLogger('watchdog.observers.inotify_buffer').setLevel(logging.WARNING)
logging.getLogger('watchdog').setLevel(logging.WARNING)

# Also suppress other potentially noisy logs
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('requests').setLevel(logging.WARNING)

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Configuration
UPLOAD_FOLDER = 'temp'
OUTPUT_FOLDER = 'output'
MAX_CONTENT_LENGTH = 2 * 1024 * 1024 * 1024  # 2GB max file size
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Optimize Flask for very large file uploads (up to 2GB)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable caching for uploads
app.config['MAX_FORM_MEMORY_SIZE'] = 32 * 1024 * 1024  # 32MB max form memory
app.config['MAX_FORM_PARTS'] = 2000  # Allow more form parts for large uploads
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024  # 2GB max file size
app.config['UPLOAD_BUFFER_SIZE'] = 1024 * 1024  # 1MB buffer size for uploads
app.config['REQUEST_TIMEOUT'] = 1800  # 30 minutes for very large uploads
app.config['UPLOAD_TIMEOUT'] = 1800   # 30 minutes upload timeout

# Add streaming configurations for very large file uploads
UPLOAD_TIMEOUT = 1800  # 30 minutes for 2GB files
LARGE_FILE_THRESHOLD = 100 * 1024 * 1024  # 100MB threshold
VERY_LARGE_FILE_THRESHOLD = 500 * 1024 * 1024  # 500MB threshold

# Frontend form parsing timeout (in seconds)
FRONTEND_FORM_PARSING_TIMEOUT = 300  # 5 minutes for form parsing

# Ensure upload and output directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_uploaded_file(file, directory="temp"):
    """Save uploaded file to temporary directory with optimized streaming for very large files (up to 2GB)."""
    logging.debug(f"save_uploaded_file called with directory: {directory}")
    
    if not os.path.exists(directory):
        logging.debug(f"Creating directory: {directory}")
        os.makedirs(directory)
    else:
        logging.debug(f"Directory already exists: {directory}")
    
    logging.debug(f"Securing filename: {file.filename}")
    filename = secure_filename(file.filename)
    logging.debug(f"Secured filename: {filename}")
    
    logging.debug("Generating unique filename...")
    unique_filename = f"{uuid.uuid4()}_{filename}"
    logging.debug(f"Unique filename: {unique_filename}")
    
    logging.debug("Creating file path...")
    file_path = os.path.join(directory, unique_filename)
    logging.debug(f"File path: {file_path}")
    
    logging.debug(f"About to save file with optimized streaming for large files...")
    save_start_time = time.time()
    
    # Use optimized streaming approach for very large files
    try:
        # Use larger chunks for better performance with big files
        chunk_size = 1024 * 1024  # 1MB chunks for better throughput
        total_bytes = 0
        chunk_count = 0
        
        logging.debug(f"Starting streaming with {chunk_size:,} byte chunks...")
        
        with open(file_path, 'wb') as f:
            while True:
                chunk_start_time = time.time()
                chunk = file.stream.read(chunk_size)
                if not chunk:
                    break
                    
                f.write(chunk)
                total_bytes += len(chunk)
                chunk_count += 1
                
                # Log progress for large files (every 50MB)
                if total_bytes % (50 * 1024 * 1024) == 0:
                    elapsed = time.time() - save_start_time
                    speed_mbps = (total_bytes / (1024 * 1024)) / elapsed if elapsed > 0 else 0
                    logging.debug(f"Streamed {total_bytes:,} bytes ({total_bytes/(1024*1024):.1f}MB) - Speed: {speed_mbps:.1f} MB/s")
                
                # Force flush every 100MB to manage memory
                if chunk_count % 100 == 0:
                    f.flush()
                    
        logging.debug(f"Streaming completed successfully!")
        logging.debug(f"Total bytes written: {total_bytes:,} ({total_bytes/(1024*1024):.1f}MB)")
        
    except Exception as e:
        logging.error(f"Error during streaming save: {e}")
        # Fallback to regular save if streaming fails
        logging.debug("Falling back to regular file.save()...")
        try:
            file.save(file_path)
            logging.debug("Fallback save completed successfully")
        except Exception as fallback_error:
            logging.error(f"Fallback save also failed: {fallback_error}")
            raise
    
    save_duration = time.time() - save_start_time
    logging.debug(f"File save completed in {save_duration:.4f} seconds")
    
    # Calculate and log performance metrics
    if os.path.exists(file_path):
        file_size = os.path.getsize(file_path)
        if save_duration > 0:
            speed_mbps = (file_size / (1024 * 1024)) / save_duration
            logging.debug(f"File saved successfully!")
            logging.debug(f"  Size: {file_size:,} bytes ({file_size/(1024*1024):.1f}MB)")
            logging.debug(f"  Time: {save_duration:.4f} seconds")
            logging.debug(f"  Speed: {speed_mbps:.1f} MB/s")
        else:
            logging.debug(f"File saved successfully, size: {file_size:,} bytes")
    else:
        logging.error(f"File was not saved: {file_path}")
    
    return file_path

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "message": "Video Processing API is running"})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload a video file and return basic file information. Optimized for very large files (up to 2GB)."""
    try:
        logging.debug("=== UPLOAD START ===")
        overall_start_time = time.time()
        logging.debug(f"Overall start time recorded: {overall_start_time}")

        # Log request info before touching anything
        logging.debug(f"Request method: {request.method}")
        logging.debug(f"Request content type: {request.content_type}")
        logging.debug(f"Request content length: {request.content_length}")
        
        # Log request headers for debugging frontend vs curl differences
        logging.debug(f"Request headers: {dict(request.headers)}")
        
        # Check file size before processing
        content_length = request.content_length
        if content_length and content_length > MAX_CONTENT_LENGTH:
            logging.error(f"File too large: {content_length} bytes (max: {MAX_CONTENT_LENGTH})")
            return jsonify({"error": f"File too large. Maximum size is {MAX_CONTENT_LENGTH // (1024*1024*1024)}GB"}), 413
        
        # Log file size category for optimization tracking
        if content_length:
            size_mb = content_length / (1024 * 1024)
            size_gb = content_length / (1024 * 1024 * 1024)
            if content_length > VERY_LARGE_FILE_THRESHOLD:
                logging.debug(f"VERY LARGE file detected: {size_gb:.2f}GB ({content_length:,} bytes)")
            elif content_length > LARGE_FILE_THRESHOLD:
                logging.debug(f"LARGE file detected: {size_mb:.1f}MB ({content_length:,} bytes)")
            else:
                logging.debug(f"Regular file: {size_mb:.1f}MB ({content_length:,} bytes)")
        
        # Check if file is in request.files
        if 'file' not in request.files:
            logging.error("No file part in request")
            return jsonify({"error": "No file part in request"}), 400
            
        file = request.files['file']
        if file.filename == '':
            logging.error("No selected file")
            return jsonify({"error": "No selected file"}), 400
            
        if not allowed_file(file.filename):
            logging.error(f"File type not allowed: {file.filename}")
            return jsonify({"error": "File type not allowed"}), 400
            
        # Save the file using the existing save_uploaded_file function
        try:
            file_path = save_uploaded_file(file)
            
            # Get file info
            file_size = os.path.getsize(file_path)
            file_id = os.path.basename(file_path)

            # Get video info
            processor = VideoProcessor()
            video_info = processor.get_video_info(file_path)
            
            overall_duration = time.time() - overall_start_time
            overall_speed_mbps = (file_size / (1024 * 1024)) / overall_duration if overall_duration > 0 else 0
            
            logging.debug(f"Upload successful for file: {file.filename}")
            logging.debug(f"Total time in /api/upload: {overall_duration:.4f} seconds")
            logging.debug(f"Overall upload speed: {overall_speed_mbps:.1f} MB/s")
            
            return jsonify({
                "success": True,
                "file_id": file_id,
                "file_path": file_path,
                "filename": file.filename,
                "file_size": file_size,
                "video_info": video_info,
                "upload_time": overall_duration,
                "upload_speed_mbps": round(overall_speed_mbps, 2),
                "message": "File uploaded successfully. Use /api/video-info/{file_id} to get video metadata."
            })
            
        except Exception as e:
            logging.error(f"Error during file save: {e}")
            return jsonify({"error": f"Upload failed: {str(e)}"}), 500
            
    except Exception as e:
        logging.exception("An error occurred during file upload:")
        return jsonify({"error": str(e)}), 500

@app.route('/api/video-info/<file_id>', methods=['GET'])
def get_video_info(file_id):
    """Get video information for a specific file with performance tracking."""
    try:
        overall_start_time = time.time()
        logging.debug(f"Video info request received for file_id: {file_id}")
        
        # File lookup timing
        file_lookup_start_time = time.time()
        file_path = os.path.join(UPLOAD_FOLDER, file_id)
        if not os.path.exists(file_path):
            logging.error(f"File not found: {file_path}")
            return jsonify({"error": "File not found"}), 404
        file_lookup_duration = time.time() - file_lookup_start_time
        logging.debug(f"File lookup took {file_lookup_duration:.4f} seconds.")
        
        # Get file size for context
        file_size = os.path.getsize(file_path)
        logging.debug(f"Processing video info for file: {file_path} (size: {file_size:,} bytes)")
        
        # VideoProcessor instantiation timing
        processor_start_time = time.time()
        processor = VideoProcessor()
        processor_duration = time.time() - processor_start_time
        logging.debug(f"VideoProcessor instantiation took {processor_duration:.4f} seconds.")
        
        # Video info retrieval timing
        video_info_start_time = time.time()
        video_info = processor.get_video_info(file_path)
        video_info_duration = time.time() - video_info_start_time
        logging.debug(f"Video info retrieval took {video_info_duration:.4f} seconds.")
        
        if not video_info:
            logging.error(f"Unable to process video file: {file_path}")
            return jsonify({"error": "Unable to process video file"}), 400
        
        overall_duration = time.time() - overall_start_time
        logging.debug(f"Video info request completed in {overall_duration:.4f} seconds for {file_id}")
        
        # Log performance breakdown
        logging.debug(f"VIDEO INFO TIMING BREAKDOWN:")
        logging.debug(f"  File lookup: {file_lookup_duration:.4f}s")
        logging.debug(f"  Processor instantiation: {processor_duration:.4f}s")
        logging.debug(f"  Video info retrieval: {video_info_duration:.4f}s")
        logging.debug(f"  TOTAL VIDEO INFO TIME: {overall_duration:.4f}s")
        
        return jsonify({
            "success": True,
            "video_info": video_info,
            "file_size": file_size,
            "processing_time": overall_duration
        })
        
    except Exception as e:
        logging.exception(f"Error getting video info for {file_id}:")
        return jsonify({"error": str(e)}), 500

def get_system_memory_info():
    """Get current system memory usage information using simple file system checks."""
    try:
        # Try to read /proc/meminfo on Linux systems
        if os.path.exists('/proc/meminfo'):
            with open('/proc/meminfo', 'r') as f:
                meminfo = f.read()
                lines = meminfo.split('\n')
                
                mem_total = 0
                mem_available = 0
                
                for line in lines:
                    if line.startswith('MemTotal:'):
                        mem_total = int(line.split()[1]) * 1024  # Convert KB to bytes
                    elif line.startswith('MemAvailable:'):
                        mem_available = int(line.split()[1]) * 1024  # Convert KB to bytes
                
                if mem_total > 0:
                    used = mem_total - mem_available
                    percent = (used / mem_total) * 100
                    return {
                        'total': mem_total,
                        'available': mem_available,
                        'percent': percent,
                        'used': used
                    }
        
        # Fallback: assume reasonable defaults
        return {
            'total': 8 * 1024**3,  # 8GB
            'available': 4 * 1024**3,  # 4GB available
            'percent': 50.0,
            'used': 4 * 1024**3
        }
    except Exception:
        return None

def check_memory_availability(required_gb=2):
    """Check if enough memory is available for video processing."""
    try:
        memory_info = get_system_memory_info()
        if memory_info:
            available_gb = memory_info['available'] / (1024**3)
            return available_gb >= required_gb, available_gb
        else:
            # If we can't check, assume it's okay but return 0 to indicate uncertainty
            return True, 0
    except Exception:
        return True, 0  # Assume OK if can't check

class ProcessingTimeoutHandler:
    """Handle processing timeouts and cleanup."""
    
    def __init__(self, timeout_seconds=600):  # 10 minutes default
        self.timeout_seconds = timeout_seconds
        self.is_processing = False
        self.start_time = None
        
    def start_processing(self):
        self.is_processing = True
        self.start_time = time.time()
        
    def stop_processing(self):
        self.is_processing = False
        self.start_time = None
        
    def check_timeout(self):
        if self.is_processing and self.start_time:
            elapsed = time.time() - self.start_time
            return elapsed > self.timeout_seconds
        return False
        
    def get_elapsed_time(self):
        if self.start_time:
            return time.time() - self.start_time
        return 0

timeout_handler = ProcessingTimeoutHandler()

@app.route('/api/process', methods=['POST'])
def process_video():
    """Process video with aspect ratio conversion, time cropping, and CTA appending."""
    try:
        timeout_handler.start_processing()
        
        # Check memory before starting
        memory_ok, available_gb = check_memory_availability(required_gb=2)
        if not memory_ok:
            return jsonify({
                'error': f'Insufficient memory for video processing. Available: {available_gb:.1f}GB, Required: 2GB minimum'
            }), 400
        
        logging.info("=== PROCESSING REQUEST START ===")
        
        # Get system memory info for debugging
        memory_info = get_system_memory_info()
        if memory_info:
            logging.info(f"System memory: {memory_info['available']/(1024**3):.1f}GB available ({memory_info['percent']:.1f}% used)")
        
        # Accept both JSON and multipart/form-data
        if request.content_type and request.content_type.startswith('multipart/form-data'):
            data = request.form.to_dict()
            # Parse JSON fields if needed
            for k, v in data.items():
                try:
                    data[k] = json.loads(v)
                except Exception:
                    pass
            watermark_file = request.files.get('watermark_file')
            watermark_path = None
            if watermark_file:
                watermark_path = os.path.join(UPLOAD_FOLDER, f"watermark_{uuid.uuid4().hex[:8]}_{secure_filename(watermark_file.filename)}")
                watermark_file.save(watermark_path)
            watermark_position = data.get('watermark_position')
        else:
            data = request.get_json()
            watermark_path = None
            watermark_position = None
        
        # Log the full request for debugging
        logging.info(f"Request data: {json.dumps(data, indent=2)}")
        
        # Extract parameters with detailed logging
        main_video_id = data.get('main_video_id')
        logging.info(f"Main video ID: {main_video_id}")
        
        if not main_video_id:
            return jsonify({'error': 'main_video_id is required'}), 400
        
        # Get main video file path
        main_video_path = os.path.join(UPLOAD_FOLDER, main_video_id)
        if not main_video_path or not os.path.exists(main_video_path):
            return jsonify({'error': 'Main video file not found'}), 404
        
        logging.info(f"Main video path: {main_video_path}")
        
        # Check video file size and resolution
        try:
            processor = VideoProcessor()
            video_info = processor.get_video_info(main_video_path)
            if video_info:
                width, height = video_info['size']
                total_pixels = width * height
                logging.info(f"Main video resolution: {width}x{height} ({total_pixels:,} pixels)")
                
                # Warn about high resolution videos
                if total_pixels > 8294400:  # > 4K
                    logging.warning(f"Ultra-high resolution main video detected: {width}x{height}")
                    logging.warning("This may cause memory issues during processing")
        except Exception as e:
            logging.warning(f"Could not get main video info: {e}")
        
        # Extract processing options
        enable_time_crop = data.get('enable_time_crop', False)
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        enable_ratio_change = data.get('enable_ratio_change', False)
        target_ratio_data = data.get('target_ratio')
        resize_method = data.get('resize_method', 'crop')
        pad_color_hex = data.get('pad_color', '#000000')
        blur_background = data.get('blur_background', False)
        blur_strength = data.get('blur_strength', 25)
        gradient_blend = data.get('gradient_blend', 0.3)
        enable_cta = data.get('enable_cta', False)
        cta_video_id = data.get('cta_video_id')
        quality_preset = data.get('quality_preset', 'high')
        
        logging.info(f"Enable time crop: {enable_time_crop}")
        logging.info(f"Start time: {start_time} (type: {type(start_time)})")
        logging.info(f"End time: {end_time} (type: {type(end_time)})")
        logging.info(f"Enable ratio change: {enable_ratio_change}")
        logging.info(f"Target ratio data: {target_ratio_data}")
        logging.info(f"Resize method: {resize_method}")
        logging.info(f"Blur background: {blur_background}")
        logging.info(f"Blur strength: {blur_strength}")
        logging.info(f"Gradient blend: {gradient_blend}")
        logging.info(f"Enable CTA: {enable_cta}")
        logging.info(f"CTA video ID: {cta_video_id}")
        logging.info(f"Quality preset: {quality_preset}")
        
        # Process parameters
        actual_start_time = None
        actual_end_time = None
        if enable_time_crop and start_time is not None and end_time is not None:
            try:
                actual_start_time = float(start_time)
                actual_end_time = float(end_time)
                logging.info(f"Parsed times - Start: {actual_start_time}, End: {actual_end_time}")
            except (ValueError, TypeError) as e:
                logging.error(f"Error parsing time values: {e}")
                return jsonify({'error': f'Invalid time values: {e}'}), 400
        
        target_ratio = None
        if enable_ratio_change and target_ratio_data:
            try:
                target_ratio = (int(target_ratio_data['width']), int(target_ratio_data['height']))
                logging.info(f"Parsed target ratio: {target_ratio}")
            except (KeyError, ValueError, TypeError) as e:
                logging.error(f"Error parsing target ratio: {e}")
                return jsonify({'error': f'Invalid target ratio: {e}'}), 400
        
        # Convert hex color to RGB
        pad_color = (0, 0, 0)  # Default black
        try:
            if pad_color_hex.startswith('#'):
                hex_color = pad_color_hex[1:]
                pad_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                logging.info(f"Parsed pad color: {pad_color}")
        except Exception as e:
            logging.warning(f"Error parsing pad color, using black: {e}")
        
        # Get CTA video path if enabled
        cta_video_path = None
        if enable_cta and cta_video_id:
            cta_video_path = os.path.join(UPLOAD_FOLDER, cta_video_id)
            if not cta_video_path or not os.path.exists(cta_video_path):
                logging.warning("CTA video file not found, proceeding without CTA")
            else:
                logging.info(f"CTA video path: {cta_video_path}")
                
                # Check CTA video resolution
                try:
                    cta_info = processor.get_video_info(cta_video_path)
                    if cta_info:
                        width, height = cta_info['size']
                        total_pixels = width * height
                        logging.info(f"CTA video resolution: {width}x{height} ({total_pixels:,} pixels)")
                        
                        if total_pixels > 8294400:  # > 4K
                            logging.warning(f"Ultra-high resolution CTA video detected: {width}x{height}")
                            logging.warning("This may cause memory issues during processing")
                            
                            # Check if we have enough memory for high-res processing
                            memory_ok, available_gb = check_memory_availability(required_gb=8)
                            if not available_gb:
                                logging.error(f"Insufficient memory for high-resolution CTA video. Available: {available_gb:.1f}GB")
                                return jsonify({
                                    'error': f'CTA video resolution too high for available memory. Available: {available_gb:.1f}GB, Required: 8GB+ for 4K+ videos'
                                }), 400
                except Exception as e:
                    logging.warning(f"Could not get CTA video info: {e}")
        
        # Generate output filename
        output_filename = f"processed_{uuid.uuid4().hex[:8]}.mp4"
        output_path = os.path.join(OUTPUT_FOLDER, output_filename)
        
        logging.info(f"Output path: {output_path}")
        logging.info("Starting video processing...")
        
        # Process video with timeout monitoring
        def process_with_timeout():
            try:
                return processor.process_video_complete(
                    input_path=main_video_path,
                    output_path=output_path,
                    cta_video_path=cta_video_path,
                    start_time=actual_start_time,
                    end_time=actual_end_time,
                    target_ratio=target_ratio,
                    resize_method=resize_method,
                    pad_color=pad_color,
                    blur_background=blur_background,
                    blur_strength=blur_strength,
                    gradient_blend=gradient_blend,
                    quality_preset=quality_preset,
                    watermark_path=watermark_path,
                    watermark_position=watermark_position
                )
            except Exception as e:
                logging.error(f"Processing error: {e}")
                traceback.print_exc()
                return False
        
        # Start processing in a separate thread to allow timeout checking
        result_container = []
        processing_thread = threading.Thread(target=lambda: result_container.append(process_with_timeout()))
        processing_thread.start()
        
        # Monitor processing with timeout
        while processing_thread.is_alive():
            if timeout_handler.check_timeout():
                logging.error(f"Processing timeout after {timeout_handler.get_elapsed_time():.1f} seconds")
                timeout_handler.stop_processing()
                return jsonify({
                    'error': 'Video processing timeout. Try using lower resolution videos or shorter clips.'
                }), 408  # Request Timeout
            
            time.sleep(1)  # Check every second
        
        processing_thread.join()
        timeout_handler.stop_processing()
        
        # Get processing result
        if not result_container:
            return jsonify({'error': 'Video processing failed - no result'}), 500
        
        success = result_container[0]
        
        if not success:
            logging.error("Video processing failed")
            return jsonify({'error': 'Video processing failed. Check logs for details.'}), 500
        
        if not os.path.exists(output_path):
            logging.error(f"Output file not created: {output_path}")
            return jsonify({'error': 'Output file was not created'}), 500
        
        logging.info(f"Processing completed successfully. File ID: {output_filename}")
        logging.info(f"Processing time: {timeout_handler.get_elapsed_time():.1f} seconds")
        logging.info("=== PROCESSING REQUEST END ===")
        
        return jsonify({
            'success': True,
            'output_file_id': output_filename,
            'processed_video_info': processor.get_video_info(output_path),
            'message': 'Video processed successfully'
        })
        
    except MemoryError:
        timeout_handler.stop_processing()
        logging.error("Memory error during video processing")
        return jsonify({
            'error': 'Insufficient memory for video processing. Try using lower resolution videos.'
        }), 507  # Insufficient Storage
    except Exception as e:
        timeout_handler.stop_processing()
        logging.error(f"Unexpected error during processing: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500

@app.route('/api/download/<file_id>', methods=['GET'])
def download_file(file_id):
    """Download a processed video file."""
    try:
        file_path = os.path.join(OUTPUT_FOLDER, file_id)
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=f"processed_video_{int(time.time())}.mp4",
            mimetype='video/mp4'
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/preview/<file_id>', methods=['GET'])
def preview_file(file_id):
    """Stream a video file for preview. Checks both output and upload folders."""
    try:
        # Check output folder first
        output_file_path = os.path.join(OUTPUT_FOLDER, file_id)
        if os.path.exists(output_file_path):
            logging.debug(f"Previewing processed file from: {output_file_path}")
            return send_file(output_file_path, mimetype='video/mp4')

        # If not in output, check upload folder
        upload_file_path = os.path.join(UPLOAD_FOLDER, file_id)
        if os.path.exists(upload_file_path):
            logging.debug(f"Previewing original uploaded file from: {upload_file_path}")
            return send_file(upload_file_path, mimetype='video/mp4')
        
        # If not found in either
        logging.error(f"Preview file not found in OUTPUT_FOLDER or UPLOAD_FOLDER: {file_id}")
        return jsonify({"error": "Preview file not found"}), 404
        
    except Exception as e:
        logging.exception(f"Error during preview for file_id {file_id}:")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cleanup', methods=['POST'])
def cleanup_files():
    """Clean up old temporary files."""
    try:
        data = request.get_json()
        file_ids = data.get('file_ids', [])
        
        cleaned_files = []
        for file_id in file_ids:
            file_path = os.path.join(UPLOAD_FOLDER, file_id)
            if os.path.exists(file_path):
                os.remove(file_path)
                cleaned_files.append(file_id)
        
        return jsonify({
            "success": True,
            "cleaned_files": cleaned_files,
            "message": f"Cleaned up {len(cleaned_files)} files"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/aspect-ratio-preview', methods=['POST'])
def generate_aspect_ratio_preview():
    """Generate a preview image showing what the aspect ratio conversion will look like."""
    try:
        logging.info("=== ASPECT RATIO PREVIEW REQUEST START ===")
        
        # Get request data
        data = request.get_json()
        logging.info(f"Preview request data: {json.dumps(data, indent=2)}")
        
        # Extract required parameters
        main_video_id = data.get('main_video_id')
        if not main_video_id:
            return jsonify({'error': 'main_video_id is required'}), 400
        
        # Get main video file path
        main_video_path = os.path.join(UPLOAD_FOLDER, main_video_id)
        if not main_video_path or not os.path.exists(main_video_path):
            return jsonify({'error': 'Main video file not found'}), 404
        
        logging.info(f"Main video path: {main_video_path}")
        
        # Extract aspect ratio parameters
        target_ratio_data = data.get('target_ratio')
        if not target_ratio_data:
            return jsonify({'error': 'target_ratio is required'}), 400
        
        target_ratio = (target_ratio_data.get('width', 9), target_ratio_data.get('height', 16))
        resize_method = data.get('resize_method', 'crop')
        pad_color = data.get('pad_color', [0, 0, 0])
        blur_background = data.get('blur_background', False)
        blur_strength = data.get('blur_strength', 25)
        gradient_blend = data.get('gradient_blend', 0.3)
        
        # Handle time cropping for frame selection
        enable_time_crop = data.get('enable_time_crop', False)
        start_time = data.get('start_time')
        frame_time = None
        
        if enable_time_crop and start_time is not None:
            # Use start time of crop if time cropping is enabled
            frame_time = float(start_time)
            logging.info(f"Using start frame from time crop: {frame_time}s")
        else:
            # Use middle of video if no time cropping
            logging.info("Using middle frame (no time cropping specified)")
        
        logging.info(f"Preview parameters:")
        logging.info(f"  Target ratio: {target_ratio}")
        logging.info(f"  Resize method: {resize_method}")
        logging.info(f"  Blur background: {blur_background}")
        if blur_background:
            logging.info(f"  Blur strength: {blur_strength}")
            logging.info(f"  Gradient blend: {gradient_blend}")
        logging.info(f"  Frame time: {frame_time}")
        
        # Generate preview filename
        preview_filename = f"preview_{uuid.uuid4().hex[:8]}.png"
        preview_path = os.path.join(OUTPUT_FOLDER, preview_filename)
        
        logging.info(f"Preview output path: {preview_path}")
        
        # Initialize processor and generate preview
        processor = VideoProcessor()
        
        success = processor.generate_aspect_ratio_preview(
            input_path=main_video_path,
            output_path=preview_path,
            target_ratio=target_ratio,
            resize_method=resize_method,
            pad_color=tuple(pad_color),
            blur_background=blur_background,
            blur_strength=blur_strength,
            gradient_blend=gradient_blend,
            frame_time=frame_time
        )
        
        if not success:
            logging.error("Preview generation failed")
            return jsonify({'error': 'Preview generation failed'}), 500
        
        if not os.path.exists(preview_path):
            logging.error(f"Preview file not created: {preview_path}")
            return jsonify({'error': 'Preview file was not created'}), 500
        
        logging.info(f"Preview generated successfully: {preview_filename}")
        logging.info("=== ASPECT RATIO PREVIEW REQUEST END ===")
        
        return jsonify({
            'success': True,
            'preview_file_id': preview_filename,
            'message': 'Preview generated successfully'
        })
        
    except Exception as e:
        logging.error(f"Error generating aspect ratio preview: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Preview generation failed: {str(e)}'}), 500

# Error handlers
@app.errorhandler(413)
def file_too_large(e):
    return jsonify({"error": "File too large. Maximum size is 2GB."}), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    # Cleanup old files on startup
    try:
        temp_dir = UPLOAD_FOLDER
        if os.path.exists(temp_dir):
            for file in os.listdir(temp_dir):
                file_path = os.path.join(temp_dir, file)
                if os.path.isfile(file_path):
                    # Remove files older than 1 hour
                    if time.time() - os.path.getmtime(file_path) > 3600:
                        os.remove(file_path)
    except Exception as e:
        print(f"Cleanup error: {e}")
    
    app.run(host='0.0.0.0', port=5001, debug=True) 