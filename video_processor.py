import cv2
import numpy as np
from moviepy.editor import VideoFileClip, concatenate_videoclips
import os
from typing import Tuple, Optional, Literal, List, Dict, Any
import tempfile
import subprocess
import json
import time
import logging

class VideoProcessor:
    """
    A flexible video processing class that can resize videos and be extended 
    with additional functionalities.
    """
    
    def __init__(self, quality_preset: str = 'high'):
        """
        Initialize VideoProcessor with quality settings.
        
        Args:
            quality_preset: Quality preset ('lossless', 'high', 'medium', 'low', 'custom')
        """
        self.supported_formats = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv']
        self.quality_preset = quality_preset
    
    def get_encoding_params(self, quality_preset: Optional[str] = None, custom_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get encoding parameters based on quality preset with improved defaults for concatenation.
        
        Args:
            quality_preset: Override the instance quality preset
            custom_params: Custom encoding parameters to override defaults
        
        Returns:
            Dictionary of encoding parameters for MoviePy
        """
        preset = quality_preset or self.quality_preset
        
        # Define quality presets with better concatenation support
        presets = {
            'lossless': {
                'codec': 'libx264',
                'audio_codec': 'aac',
                'bitrate': None,  # Use original bitrate
                'ffmpeg_params': ['-crf', '0', '-preset', 'veryslow', '-pix_fmt', 'yuv420p'],  # Lossless + compatibility
                'audio_bitrate': '320k'
            },
            'high': {
                'codec': 'libx264', 
                'audio_codec': 'aac',
                'bitrate': None,  # Use original or auto-detect
                'ffmpeg_params': ['-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p'],  # Near-lossless + compatibility
                'audio_bitrate': '192k'
            },
            'medium': {
                'codec': 'libx264',
                'audio_codec': 'aac', 
                'bitrate': '5000k',
                'ffmpeg_params': ['-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p'],
                'audio_bitrate': '128k'
            },
            'low': {
                'codec': 'libx264',
                'audio_codec': 'aac',
                'bitrate': '2000k', 
                'ffmpeg_params': ['-crf', '28', '-preset', 'fast', '-pix_fmt', 'yuv420p'],
                'audio_bitrate': '96k'
            }
        }
        
        # Get base parameters
        if preset in presets:
            params = presets[preset].copy()
        else:
            # Default to high quality
            params = presets['high'].copy()
        
        # Add common parameters for better compatibility
        params.update({
            'temp_audiofile': 'temp-audio.m4a',
            'remove_temp': True,
            'verbose': False,
            'logger': None,
            'write_logfile': False,  # Disable log file creation
        })
        
        # Apply custom overrides
        if custom_params:
            params.update(custom_params)
            
        return params
    
    def resize_aspect_ratio(self, 
                           input_path: str, 
                           output_path: str,
                           target_ratio: Tuple[int, int] = (9, 16),
                           resize_method: Literal['crop', 'pad', 'stretch'] = 'crop',
                           pad_color: Tuple[int, int, int] = (0, 0, 0),
                           quality_preset: Optional[str] = None) -> bool:
        """
        Resize video from one aspect ratio to another.
        
        Args:
            input_path: Path to input video file
            output_path: Path for output video file
            target_ratio: Target aspect ratio as (width, height) tuple
            resize_method: Method to handle aspect ratio change
                - 'crop': Crop the video to fit new ratio
                - 'pad': Add padding (letterbox/pillarbox) to fit new ratio
                - 'stretch': Stretch video to new ratio (may distort)
            pad_color: RGB color for padding (default: black)
            quality_preset: Override quality preset ('lossless', 'high', 'medium', 'low')
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Validate input file
            if not self._validate_input(input_path):
                return False
            
            # Load video
            clip = VideoFileClip(input_path)
            original_width, original_height = clip.size
            original_ratio = original_width / original_height
            target_ratio_decimal = target_ratio[0] / target_ratio[1]
            
            print(f"Original dimensions: {original_width}x{original_height}")
            print(f"Original ratio: {original_ratio:.2f}")
            print(f"Target ratio: {target_ratio_decimal:.2f}")
            print(f"Quality preset: {quality_preset or self.quality_preset}")
            
            # Process based on resize method
            if resize_method == 'crop':
                processed_clip = self._crop_to_ratio(clip, target_ratio)
            elif resize_method == 'pad':
                processed_clip = self._pad_to_ratio(clip, target_ratio, pad_color)
            elif resize_method == 'stretch':
                processed_clip = self._stretch_to_ratio(clip, target_ratio)
            else:
                raise ValueError(f"Unsupported resize method: {resize_method}")
            
            # Get encoding parameters
            encoding_params = self.get_encoding_params(quality_preset)
            
            # Write output with quality settings
            processed_clip.write_videofile(output_path, **encoding_params)
            
            # Clean up
            clip.close()
            processed_clip.close()
            
            print(f"Video successfully processed and saved to: {output_path}")
            return True
            
        except Exception as e:
            print(f"Error processing video: {str(e)}")
            return False

    def crop_video_by_time(self, 
                          input_path: str, 
                          output_path: str,
                          start_time: float, 
                          end_time: float,
                          quality_preset: Optional[str] = None) -> bool:
        """
        Crop video by time (trim video).
        
        Args:
            input_path: Path to input video file
            output_path: Path for output video file
            start_time: Start time in seconds
            end_time: End time in seconds
            quality_preset: Override quality preset ('lossless', 'high', 'medium', 'low')
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if not self._validate_input(input_path):
                return False
            
            clip = VideoFileClip(input_path)
            
            # Validate time range
            if start_time < 0:
                start_time = 0
            if end_time > clip.duration:
                end_time = clip.duration
            if start_time >= end_time:
                print("Error: Start time must be less than end time")
                clip.close()
                return False
            
            print(f"Cropping video from {start_time}s to {end_time}s")
            print(f"Quality preset: {quality_preset or self.quality_preset}")
            
            # Crop the video
            cropped_clip = clip.subclip(start_time, end_time)
            
            # Get encoding parameters
            encoding_params = self.get_encoding_params(quality_preset)
            
            # Write output with quality settings
            cropped_clip.write_videofile(output_path, **encoding_params)
            
            # Clean up
            clip.close()
            cropped_clip.close()
            
            print(f"Video cropped from {start_time}s to {end_time}s and saved to: {output_path}")
            return True
            
        except Exception as e:
            print(f"Error cropping video: {str(e)}")
            return False

    def _optimize_video_for_processing(self, clip, max_dimension: int = 1920):
        """
        Optimize video for processing by downscaling if necessary to prevent memory issues.
        
        Args:
            clip: VideoFileClip to optimize
            max_dimension: Maximum dimension (width or height) allowed
            
        Returns:
            Optimized VideoFileClip
        """
        width, height = clip.size
        max_current = max(width, height)
        
        if max_current > max_dimension:
            scale_factor = max_dimension / max_current
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            # Ensure dimensions are even numbers (required for some codecs)
            new_width = new_width if new_width % 2 == 0 else new_width - 1
            new_height = new_height if new_height % 2 == 0 else new_height - 1
            
            print(f"🔧 Optimizing video: {width}x{height} → {new_width}x{new_height} (scale: {scale_factor:.2f})")
            return clip.resize(newsize=(new_width, new_height))
        
        return clip

    def concatenate_videos(self, 
                          video_paths: List[str], 
                          output_path: str,
                          quality_preset: Optional[str] = None) -> bool:
        """
        Concatenate multiple videos into one with improved handling for different formats and memory optimization.
        
        Args:
            video_paths: List of paths to video files to concatenate
            output_path: Path for output video file
            quality_preset: Override quality preset ('lossless', 'high', 'medium', 'low')
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            if len(video_paths) < 2:
                print("Error: Need at least 2 videos to concatenate")
                return False
            
            # Validate all input files
            for path in video_paths:
                if not self._validate_input(path):
                    return False
            
            print(f"Concatenating {len(video_paths)} videos")
            print(f"Quality preset: {quality_preset or self.quality_preset}")
            
            # Load all video clips with memory optimization
            clips = []
            main_clip = None
            target_size = None
            
            for i, path in enumerate(video_paths):
                print(f"Loading video {i+1}: {path}")
                clip = VideoFileClip(path)
                
                # Check for high resolution and warn
                width, height = clip.size
                total_pixels = width * height
                if total_pixels > 2073600:  # > 1920x1080
                    print(f"⚠️ High resolution video detected: {width}x{height} ({total_pixels:,} pixels)")
                    
                    # Optimize for memory if very high resolution
                    if total_pixels > 8294400:  # > 4K (3840x2160)
                        print("🔧 Applying memory optimization for ultra-high resolution video")
                        clip = self._optimize_video_for_processing(clip, max_dimension=2160)
                
                # Use first video as reference for standardization
                if i == 0:
                    main_clip = clip
                    target_size = clip.size
                    clips.append(clip)
                    print(f"Main video - Size: {clip.size}, FPS: {clip.fps}, Duration: {clip.duration:.1f}s")
                else:
                    # Standardize subsequent videos to match main video
                    print(f"CTA video - Original Size: {clip.size}, FPS: {clip.fps}, Duration: {clip.duration:.1f}s")
                    
                    # Resize CTA video to match main video dimensions efficiently
                    if clip.size != target_size:
                        print(f"🔄 Resizing CTA video from {clip.size} to {target_size}")
                        # Use a more memory-efficient resize method
                        clip = clip.resize(newsize=target_size)
                        print(f"✅ CTA video resized successfully")
                    
                    # Standardize frame rate to match main video
                    if abs(clip.fps - main_clip.fps) > 0.1:  # Small tolerance for FPS differences
                        print(f"🔄 Adjusting CTA video FPS from {clip.fps} to {main_clip.fps}")
                        clip = clip.set_fps(main_clip.fps)
                        print(f"✅ CTA video FPS adjusted successfully")
                    
                    clips.append(clip)
                    print(f"CTA video standardized - Size: {clip.size}, FPS: {clip.fps}")
            
            # Concatenate clips with method='compose' for better compatibility
            print("🔗 Concatenating standardized clips...")
            try:
                final_clip = concatenate_videoclips(clips, method="compose")
                print("✅ Clips concatenated successfully")
            except Exception as concat_error:
                print(f"❌ Error during concatenation: {concat_error}")
                # Try fallback method
                print("🔄 Trying fallback concatenation method...")
                final_clip = concatenate_videoclips(clips, method="chain")
            
            # Get encoding parameters
            encoding_params = self.get_encoding_params(quality_preset)
            
            # Add specific parameters for better concatenation quality and memory efficiency
            encoding_params.update({
                'fps': main_clip.fps,  # Ensure consistent frame rate
                'preset': 'medium',    # Balance between speed and quality
                'threads': 4,          # Limit threads to prevent memory overload
            })
            
            print(f"💾 Writing final video with FPS: {main_clip.fps}")
            # Write output with quality settings
            final_clip.write_videofile(output_path, **encoding_params)
            
            # Clean up memory
            print("🧹 Cleaning up memory...")
            for clip in clips:
                clip.close()
            final_clip.close()
            
            print(f"✅ Videos concatenated and saved to: {output_path}")
            return True
            
        except MemoryError:
            print("❌ Memory error: Video resolution too high for available RAM")
            print("💡 Try using a lower resolution CTA video or increase system memory")
            return False
        except Exception as e:
            print(f"❌ Error concatenating videos: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def process_video_complete(self,
                             input_path: str,
                             output_path: str,
                             cta_video_path: Optional[str] = None,
                             start_time: Optional[float] = None,
                             end_time: Optional[float] = None,
                             target_ratio: Optional[Tuple[int, int]] = None,
                             resize_method: Literal['crop', 'pad', 'stretch'] = 'crop',
                             pad_color: Tuple[int, int, int] = (0, 0, 0),
                             quality_preset: Optional[str] = None,
                             watermark_path: Optional[str] = None,
                             watermark_position: Optional[str] = None) -> bool:
        """
        Complete video processing pipeline with improved CTA video handling and memory optimization.
        Now supports watermark overlay.
        
        Args:
            input_path: Path to input video file
            output_path: Path for output video file
            cta_video_path: Optional path to call-to-action video to append
            start_time: Optional start time for cropping (in seconds)
            end_time: Optional end time for cropping (in seconds)
            target_ratio: Optional target aspect ratio as (width, height) tuple
            resize_method: Method for aspect ratio change
            pad_color: RGB color for padding
            quality_preset: Override quality preset ('lossless', 'high', 'medium', 'low')
            watermark_path: Optional path to watermark image
            watermark_position: Optional position for watermark overlay
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            print(f"=== COMPLETE VIDEO PROCESSING DEBUG ===")
            print(f"Input path: {input_path}")
            print(f"Output path: {output_path}")
            print(f"CTA video path: {cta_video_path}")
            print(f"Start time received: {start_time} (type: {type(start_time)})")
            print(f"End time received: {end_time} (type: {type(end_time)})")
            print(f"Target ratio: {target_ratio}")
            print(f"Resize method: {resize_method}")
            print(f"Quality preset: {quality_preset or self.quality_preset}")
            print(f"Time cropping enabled: {start_time is not None and end_time is not None}")
            print(f"Watermark path: {watermark_path}")
            print(f"Watermark position: {watermark_position}")
            
            # Check video resolutions early for memory planning
            if cta_video_path:
                cta_info = self.get_video_info(cta_video_path)
                if cta_info:
                    width, height = cta_info['size']
                    total_pixels = width * height
                    print(f"📊 CTA video resolution: {width}x{height} ({total_pixels:,} pixels)")
                    if total_pixels > 8294400:  # > 4K
                        print("⚠️ WARNING: Ultra-high resolution CTA video detected!")
                        print("💡 This may cause memory issues. Consider using a lower resolution CTA video.")
            
            print(f"========================================")
            
            with tempfile.TemporaryDirectory() as temp_dir:
                current_file = input_path
                processed_cta_path = cta_video_path

                # Step 1: Time cropping if specified
                if start_time is not None and end_time is not None:
                    print(f"📽️ STEP 1: Time cropping from {start_time}s to {end_time}s")
                    temp_cropped = os.path.join(temp_dir, "temp_cropped.mp4")
                    if not self.crop_video_by_time(current_file, temp_cropped, start_time, end_time, quality_preset):
                        return False
                    current_file = temp_cropped
                else:
                    print(f"⏭️ STEP 1: Skipping time cropping (start_time={start_time}, end_time={end_time})")

                # Step 2: Aspect ratio change if specified
                if target_ratio is not None:
                    print(f"📐 STEP 2: Changing aspect ratio to {target_ratio[0]}:{target_ratio[1]} using {resize_method}")
                    temp_resized = os.path.join(temp_dir, "temp_resized.mp4")
                    if not self.resize_aspect_ratio(current_file, temp_resized, target_ratio, resize_method, pad_color, quality_preset):
                        return False
                    current_file = temp_resized

                    # Also resize CTA video to match if it exists
                    if processed_cta_path and os.path.exists(processed_cta_path):
                        print(f"📐 STEP 2b: Resizing CTA video to match aspect ratio {target_ratio[0]}:{target_ratio[1]}")
                        temp_cta_resized = os.path.join(temp_dir, "temp_cta_resized.mp4")
                        try:
                            if self.resize_aspect_ratio(processed_cta_path, temp_cta_resized, target_ratio, resize_method, pad_color, quality_preset):
                                processed_cta_path = temp_cta_resized
                                print("✅ CTA video successfully resized")
                            else:
                                print("⚠️ Warning: Could not resize CTA video, will attempt standardization during concatenation")
                        except MemoryError:
                            print("❌ Memory error during CTA video resize - CTA video resolution too high")
                            print("💡 Skipping CTA video due to memory constraints")
                            processed_cta_path = None
                else:
                    print(f"⏭️ STEP 2: Skipping aspect ratio change")

                # Step 3: Append CTA video if specified
                if processed_cta_path and os.path.exists(processed_cta_path):
                    print(f"🎯 STEP 3: Appending CTA video")
                    print(f"Main video: {current_file}")
                    print(f"CTA video: {processed_cta_path}")

                    # Get video info for debugging
                    main_info = self.get_video_info(current_file)
                    cta_info = self.get_video_info(processed_cta_path)

                    if main_info and cta_info:
                        print(f"Main video info: {main_info['size']} @ {main_info['fps']:.1f}fps")
                        print(f"CTA video info: {cta_info['size']} @ {cta_info['fps']:.1f}fps")

                    temp_concatenated = os.path.join(temp_dir, "temp_concatenated.mp4")
                    try:
                        if not self.concatenate_videos([current_file, processed_cta_path], temp_concatenated, quality_preset):
                            print("❌ Failed to concatenate videos")
                            return False
                        print("✅ CTA video successfully appended")
                        current_file = temp_concatenated
                    except MemoryError:
                        print("❌ Memory error during concatenation - videos too large for available RAM")
                        print("💡 Try using lower resolution videos or increase system memory")
                        return False
                else:
                    print(f"⏭️ STEP 3: No CTA video to append")
                    # current_file is already the correct file

                # Step 4: After all processing steps, overlay watermark if provided
                if watermark_path and os.path.exists(watermark_path):
                    print(f"🖼️ Adding watermark: {watermark_path} at {watermark_position}")
                    temp_watermarked = os.path.join(temp_dir, "temp_watermarked.mp4")
                    if not self.add_watermark(current_file, temp_watermarked, watermark_path, watermark_position):
                        print("❌ Failed to add watermark")
                        return False
                    current_file = temp_watermarked

                # Save final output
                import shutil
                shutil.copy2(current_file, output_path)
                print(f"✅ Complete video processing finished. Output saved to: {output_path}")
                return True
                
        except MemoryError:
            print("❌ Memory error: Videos too large for available RAM")
            print("💡 Try using lower resolution videos or increase system memory")
            return False
        except Exception as e:
            print(f"❌ Error in complete video processing: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def _crop_to_ratio(self, clip, target_ratio: Tuple[int, int]):
        """Crop video to target aspect ratio."""
        width, height = clip.size
        target_ratio_decimal = target_ratio[0] / target_ratio[1]
        current_ratio = width / height
        
        if current_ratio > target_ratio_decimal:
            # Video is wider than target, crop width
            new_width = int(height * target_ratio_decimal)
            x_center = width // 2
            x1 = x_center - new_width // 2
            x2 = x_center + new_width // 2
            return clip.crop(x1=x1, x2=x2)
        else:
            # Video is taller than target, crop height
            new_height = int(width / target_ratio_decimal)
            y_center = height // 2
            y1 = y_center - new_height // 2
            y2 = y_center + new_height // 2
            return clip.crop(y1=y1, y2=y2)
    
    def _pad_to_ratio(self, clip, target_ratio: Tuple[int, int], pad_color: Tuple[int, int, int]):
        """Add padding to video to achieve target aspect ratio."""
        from moviepy.editor import ColorClip, CompositeVideoClip
        
        width, height = clip.size
        target_ratio_decimal = target_ratio[0] / target_ratio[1]
        current_ratio = width / height
        
        if current_ratio > target_ratio_decimal:
            # Video is wider, add top/bottom padding
            new_height = int(width / target_ratio_decimal)
            pad_height = (new_height - height) // 2
            background = ColorClip(
                size=(width, new_height),
                color=pad_color,
                duration=clip.duration
            )
            return CompositeVideoClip([background, clip.set_position(('center', pad_height))])
        else:
            # Video is taller, add left/right padding
            new_width = int(height * target_ratio_decimal)
            pad_width = (new_width - width) // 2
            background = ColorClip(
                size=(new_width, height),
                color=pad_color,
                duration=clip.duration
            )
            return CompositeVideoClip([background, clip.set_position((pad_width, 'center'))])
    
    def _stretch_to_ratio(self, clip, target_ratio: Tuple[int, int]):
        """Stretch video to target aspect ratio."""
        width, height = clip.size
        target_width = max(width, height)  # Use larger dimension as base
        target_height = int(target_width / (target_ratio[0] / target_ratio[1]))
        
        return clip.resize(newsize=(target_width, target_height))
    
    def _validate_input(self, file_path: str) -> bool:
        """Validate input file path and format."""
        if not os.path.exists(file_path):
            print(f"Error: Input file not found - {file_path}")
            return False
        
        _, ext = os.path.splitext(file_path)
        if ext.lower() not in self.supported_formats:
            print(f"Error: Unsupported file format - {ext}")
            return False
            
        return True

    def _get_video_info_ffprobe(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Get video information using ffprobe for faster metadata extraction.
        
        Args:
            file_path: Path to the video file.
            
        Returns:
            A dictionary containing video information (duration, fps, size, aspect_ratio, has_audio)
            or None if information cannot be retrieved.
        """
        import time
        import logging
        
        method_start_time = time.time()
        logging.debug(f"_get_video_info_ffprobe started for: {file_path}")
        
        try:
            # Time the command construction
            cmd_start_time = time.time()
            command = [
                'ffprobe',
                '-v', 'quiet',                    # Suppress verbose output
                '-print_format', 'json',          # JSON output format
                '-show_streams',                  # Show stream information
                '-show_format',                   # Show format information for duration fallback
                '-select_streams', 'v:0',         # Only analyze first video stream for speed
                '-probesize', '1048576',          # Limit probe size for faster analysis (1MB)
                '-analyzeduration', '1000000',    # Limit analysis duration (1 second)
                file_path
            ]
            cmd_duration = time.time() - cmd_start_time
            logging.debug(f"Optimized command construction took {cmd_duration:.4f} seconds")
            
            # Time the subprocess execution
            subprocess_start_time = time.time()
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, text=True, timeout=10)
            subprocess_duration = time.time() - subprocess_start_time
            logging.debug(f"Optimized ffprobe subprocess execution took {subprocess_duration:.4f} seconds")
            
            # Time JSON parsing
            json_start_time = time.time()
            data = json.loads(result.stdout)
            json_duration = time.time() - json_start_time
            logging.debug(f"JSON parsing took {json_duration:.4f} seconds")
            
            # Time stream processing
            stream_start_time = time.time()
            video_stream = None
            audio_stream = None
            
            for stream in data.get('streams', []):
                if stream.get('codec_type') == 'video':
                    video_stream = stream
                elif stream.get('codec_type') == 'audio':
                    audio_stream = stream
            
            if not video_stream:
                logging.error(f"Error: No video stream found in {file_path}")
                return None

            # Duration - try stream first, then format
            duration_str = video_stream.get('duration')
            if not duration_str:
                # Fallback to container format duration if stream duration is missing
                format_info = data.get('format', {})
                duration_str = format_info.get('duration')

            if duration_str:
                duration = float(duration_str)
            else:
                # If still no duration, log warning and use 0
                logging.warning(f"Warning: Duration not found by ffprobe for {file_path}. Defaulting to 0.")
                duration = 0.0

            # FPS
            avg_frame_rate = video_stream.get('avg_frame_rate', "0/0")
            if '/' in avg_frame_rate:
                num, den = map(int, avg_frame_rate.split('/'))
                fps = float(num) / float(den) if den != 0 else 0.0
            else:
                fps = float(avg_frame_rate)

            # Size and Aspect Ratio
            width = int(video_stream.get('width', 0))
            height = int(video_stream.get('height', 0))
            
            aspect_ratio = float(width) / float(height) if height != 0 else 1.0

            has_audio = audio_stream is not None
            
            stream_duration = time.time() - stream_start_time
            logging.debug(f"Stream data processing took {stream_duration:.4f} seconds")
            
            method_duration = time.time() - method_start_time
            logging.debug(f"_get_video_info_ffprobe TOTAL TIME: {method_duration:.4f} seconds")
            logging.debug(f"OPTIMIZED FFPROBE BREAKDOWN: cmd={cmd_duration:.4f}s, subprocess={subprocess_duration:.4f}s, json={json_duration:.4f}s, stream={stream_duration:.4f}s")
            
            return {
                'duration': duration,
                'fps': fps,
                'size': [width, height],
                'aspect_ratio': aspect_ratio,
                'has_audio': has_audio
            }

        except subprocess.TimeoutExpired:
            logging.error(f"ffprobe timeout for {file_path}")
            return None
        except subprocess.CalledProcessError as e:
            logging.error(f"Error running ffprobe: {e}\nStderr: {e.stderr}")
            return None
        except json.JSONDecodeError:
            logging.error(f"Error parsing ffprobe JSON output for {file_path}")
            return None
        except Exception as e:
            logging.error(f"An unexpected error occurred in _get_video_info_ffprobe: {str(e)}")
            return None

    def get_video_info(self, file_path: str) -> Optional[dict]:
        """
        Get video information (duration, fps, size, aspect_ratio, has_audio).
        Uses ffprobe for speed.
        
        Args:
            file_path: Path to the video file.
            
        Returns:
            A dictionary containing video information or None if info cannot be retrieved.
        """
        method_start_time = time.time()
        logging.debug(f"get_video_info started for: {file_path}")
        
        # Time input validation
        validation_start_time = time.time()
        if not self._validate_input(file_path):
            return None
        validation_duration = time.time() - validation_start_time
        logging.debug(f"Input validation took {validation_duration:.4f} seconds")
        
        # Time the ffprobe method call
        ffprobe_start_time = time.time()
        info = self._get_video_info_ffprobe(file_path)
        ffprobe_duration = time.time() - ffprobe_start_time
        logging.debug(f"_get_video_info_ffprobe call took {ffprobe_duration:.4f} seconds")
        
        if not info: # Fallback or additional logging if ffprobe fails
            logging.error(f"ffprobe failed to get info for {file_path}. MoviePy fallback NOT implemented yet.")
            # As a potential future improvement, could fallback to MoviePy here if ffprobe fails for some edge cases
            # For now, just returning None as per ffprobe's result.
            # clip = VideoFileClip(file_path)
            # info = {
            #     'duration': clip.duration,
            #     'fps': clip.fps,
            #     'size': list(clip.size),
            #     'aspect_ratio': clip.aspect_ratio,
            #     'has_audio': clip.audio is not None
            # }
            # clip.close()
        
        method_duration = time.time() - method_start_time
        logging.debug(f"get_video_info TOTAL TIME: {method_duration:.4f} seconds")
        
        return info

    def add_watermark(self, input_path: str, output_path: str, watermark_path: str, position: Optional[str] = 'bottom-right'):
        """Overlay watermark image at the specified position using MoviePy."""
        from moviepy.editor import VideoFileClip, ImageClip, CompositeVideoClip
        try:
            video = VideoFileClip(input_path)
            watermark = ImageClip(watermark_path).set_duration(video.duration).resize(height=int(video.h * 0.15))
            # Default margin
            margin = 20
            pos = (margin, margin)
            if position == 'top-left':
                pos = (margin, margin)
            elif position == 'top-right':
                pos = (video.w - watermark.w - margin, margin)
            elif position == 'bottom-left':
                pos = (margin, video.h - watermark.h - margin)
            elif position == 'bottom-right':
                pos = (video.w - watermark.w - margin, video.h - watermark.h - margin)
            elif position == 'center':
                pos = ('center', 'center')
            watermark = watermark.set_pos(pos)
            final = CompositeVideoClip([video, watermark])
            final.write_videofile(output_path, **self.get_encoding_params())
            video.close()
            watermark.close()
            final.close()
            return True
        except Exception as e:
            print(f"Error adding watermark: {e}")
            return False
    
    def adjust_brightness(self, input_path: str, output_path: str, brightness_factor: float):
        """Placeholder for brightness adjustment functionality."""
        pass
    
    def extract_frames(self, input_path: str, output_dir: str, frame_rate: int = 1):
        """Placeholder for frame extraction functionality."""
        pass


# Example usage
if __name__ == "__main__":
    processor = VideoProcessor()
    
    # Example: Convert 16:9 video to 9:16 (portrait)
    input_file = "input_video.mp4"
    output_file = "output_video_9_16.mp4"
    
    # Method 1: Crop to fit (may lose content from sides/top/bottom)
    success = processor.resize_aspect_ratio(
        input_path=input_file,
        output_path=output_file,
        target_ratio=(9, 16),
        resize_method='crop'
    )
    
    # Method 2: Add padding (letterbox/pillarbox)
    output_file_padded = "output_video_9_16_padded.mp4"
    success = processor.resize_aspect_ratio(
        input_path=input_file,
        output_path=output_file_padded,
        target_ratio=(9, 16),
        resize_method='pad',
        pad_color=(255, 255, 255)  # White padding
    )
    
    # Get video information
    info = processor.get_video_info(input_file)
    if info:
        print(f"Video info: {info}")