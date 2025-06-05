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
import uuid

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
    
    def get_encoding_params(self, 
                           quality_preset: Optional[str] = None, 
                           custom_params: Optional[Dict[str, Any]] = None,
                           is_intermediate_for_concat: bool = False) -> Dict[str, Any]:
        """
        Get encoding parameters based on quality preset with improved defaults for concatenation.
        
        Args:
            quality_preset: Override the instance quality preset. 
                            Can be 'lossless', 'high', 'medium', 'low', or 'intermediate_lossless'.
            custom_params: Custom encoding parameters to override defaults
            is_intermediate_for_concat: If True and quality_preset is 'lossless', uses parameters
                                         optimized for intermediate files meant for fast concatenation.
        
        Returns:
            Dictionary of encoding parameters for MoviePy
        """
        preset_to_use = quality_preset or self.quality_preset
        
        if is_intermediate_for_concat and preset_to_use == 'lossless':
            # Special parameters for intermediate lossless files for fast concatenation
            # Using -qp 0 for true lossless, and a faster preset.
            # Audio codec PCM for better concat compatibility.
            # MKV container is often more flexible for concatenation.
            intermediate_params = {
                'codec': 'libx264',
                'audio_codec': 'aac', # Changed from pcm_s16le to aac for better stability
                'ffmpeg_params': ['-qp', '0', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p'],
                'audio_bitrate': '320k', # High bitrate AAC
                'container': '.mkv' # MKV is flexible for concat
            }
            # Apply common parameters
            intermediate_params.update({
                'temp_audiofile': 'temp-audio.m4a', # Use .m4a for AAC
                'remove_temp': True,
                'verbose': False,
                'logger': None,
                'write_logfile': False,
            })
            if custom_params:
                intermediate_params.update(custom_params)
            return intermediate_params

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
        if preset_to_use in presets:
            params = presets[preset_to_use].copy()
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
                           blur_background: bool = False,
                           blur_strength: int = 25,
                           gradient_blend: float = 0.3,
                           quality_preset: Optional[str] = None,
                           is_intermediate_for_concat: bool = False) -> bool:
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
            pad_color: RGB color for padding (default: black) - only used if blur_background is False
            blur_background: If True and resize_method is 'pad', use blurred video as background instead of solid color
            blur_strength: Strength of blur effect (1-50, default: 25) - higher values = more blur
            gradient_blend: Gradient blending factor (0.0-1.0, default: 0.3) - controls bleeding effect transparency
            quality_preset: Override quality preset ('lossless', 'high', 'medium', 'low')
            is_intermediate_for_concat: If True and quality is lossless, it will get appropriate encoding parameters and save the output as .mkv
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Validate input file
            if not self._validate_input(input_path):
                return False
            
            print(f"🎬 Starting video processing...")
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
            print(f"🔄 Processing video using {resize_method} method...")
            if resize_method == 'crop':
                processed_clip = self._crop_to_ratio(clip, target_ratio)
            elif resize_method == 'pad':
                processed_clip = self._pad_to_ratio(clip, target_ratio, pad_color, blur_background, blur_strength, gradient_blend)
            elif resize_method == 'stretch':
                processed_clip = self._stretch_to_ratio(clip, target_ratio)
            else:
                raise ValueError(f"Unsupported resize method: {resize_method}")
            
            print(f"✅ Video processing completed. Starting video export...")
            
            # Get encoding parameters
            encoding_params = self.get_encoding_params(
                quality_preset=(quality_preset or self.quality_preset),
                is_intermediate_for_concat=is_intermediate_for_concat
            )
            
            # Determine the actual output path, potentially changing extension for intermediate mkv
            actual_output_path = output_path
            if is_intermediate_for_concat and (quality_preset or self.quality_preset) == 'lossless':
                base, _ = os.path.splitext(output_path)
                actual_output_path = base + ".mkv"
                logging.info(f"Intermediate lossless resize: saving as {actual_output_path}")
            
            # Add progress callback for debugging
            def progress_callback(t):
                if hasattr(progress_callback, 'last_print') and t - progress_callback.last_print < 5:
                    return  # Only print every 5 seconds
                progress_callback.last_print = t
                print(f"⏳ Encoding progress: {t:.1f}s processed...")
            
            progress_callback.last_print = 0
            
            # Write output with quality settings and progress tracking
            print(f"💾 Writing video file: {actual_output_path}")
            print(f"📝 Encoding parameters: {encoding_params}")
            
            # Remove conflicting parameters and set our preferred values
            params_for_write = encoding_params.copy() # Use a new variable for clarity
            params_for_write['verbose'] = True     # Enable verbose output for debugging
            params_for_write['logger'] = 'bar'     # Use bar logger for progress
            params_for_write.pop('container', None) # Remove 'container' key if it exists
            
            try:
                processed_clip.write_videofile(
                    actual_output_path, 
                    **params_for_write # Use the cleaned parameters
                )
                print(f"✅ Video file written successfully!")
            except Exception as write_error:
                print(f"❌ Error during video writing: {str(write_error)}")
                print(f"🔍 Write error type: {type(write_error).__name__}")
                import traceback
                traceback.print_exc()
                raise write_error
            
            # Clean up
            print(f"🧹 Cleaning up video clips...")
            clip.close()
            processed_clip.close()
            
            print(f"Video successfully processed and saved to: {actual_output_path}")
            return True
            
        except Exception as e:
            print(f"Error processing video: {str(e)}")
            print(f"🔍 Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            return False

    def crop_video_by_time(self, 
                          input_path: str, 
                          output_path: str,
                          start_time: float, 
                          end_time: float,
                          quality_preset: Optional[str] = None,
                          is_intermediate_for_concat: bool = False) -> bool:
        """
        Crop video by time (trim video).
        
        Args:
            input_path: Path to input video file
            output_path: Path for output video file
            start_time: Start time in seconds
            end_time: End time in seconds
            quality_preset: Override quality preset ('lossless', 'high', 'medium', 'low')
            is_intermediate_for_concat: If True and quality is lossless, it will get appropriate encoding parameters and save the output as .mkv
        
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
            
            # Get encoding parameters, considering if it's an intermediate lossless file
            encoding_params = self.get_encoding_params(
                quality_preset=(quality_preset or self.quality_preset),
                is_intermediate_for_concat=is_intermediate_for_concat
            )
            
            # Determine the actual output path, potentially changing extension for intermediate mkv
            actual_output_path = output_path
            if is_intermediate_for_concat and (quality_preset or self.quality_preset) == 'lossless':
                # Ensure .mkv extension for intermediate lossless files
                base, _ = os.path.splitext(output_path)
                actual_output_path = base + ".mkv"
                logging.info(f"Intermediate lossless crop: saving as {actual_output_path}")
            
            # Clean params for write_videofile by removing 'container' key if it exists
            params_for_write = encoding_params.copy()
            params_for_write.pop('container', None)
            
            # Write output with quality settings
            cropped_clip.write_videofile(actual_output_path, **params_for_write)
            
            # Clean up
            clip.close()
            cropped_clip.close()
            
            print(f"Video cropped from {start_time}s to {end_time}s and saved to: {actual_output_path}")
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
            
            # Attempt direct FFmpeg stream copy for lossless concatenation if applicable
            if (quality_preset or self.quality_preset) == 'lossless':
                # Check if all input files are .mkv (our intermediate lossless format)
                # This is a heuristic; ideally, we'd have more robust tracking of intermediate formats.
                are_all_mkv = all(path.lower().endswith('.mkv') for path in video_paths)
                if are_all_mkv:
                    logging.info("All inputs are MKV, attempting FFmpeg direct lossless concatenation.")
                    if self._concatenate_videos_ffmpeg_lossless(video_paths, output_path):
                        # If FFmpeg direct concat is successful, we might need to handle audio separately
                        # if MoviePy was expecting to manage it. For now, assume it's fine.
                        logging.info(f"✅ FFmpeg direct lossless concatenation successful for: {output_path}")
                        return True
                    else:
                        logging.warning("FFmpeg direct lossless concatenation failed. Falling back to MoviePy method.")
                else:
                    logging.warning("Not all inputs are MKV for lossless preset. Using MoviePy for concatenation. This might be slow.")

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
            # Ensure final_clip is closed if it was created
            if 'final_clip' in locals() and final_clip:
                final_clip.close()
            # Ensure all clips in the list are closed
            for clip_obj in clips: # Changed variable name to avoid conflict
                if clip_obj: # Check if clip_obj is not None
                    clip_obj.close()
            
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
                             blur_background: bool = False,
                             blur_strength: int = 25,
                             gradient_blend: float = 0.3,
                             quality_preset: Optional[str] = None,
                             watermark_path: Optional[str] = None,
                             watermark_position: Optional[str] = None) -> bool:
        """
        Complete video processing pipeline with improved CTA video handling and memory optimization.
        Now supports watermark overlay, blurred background with controllable blur strength and gradient bleeding effect.
        
        Args:
            input_path: Path to input video file
            output_path: Path for output video file
            cta_video_path: Optional path to call-to-action video to append
            start_time: Optional start time for cropping (in seconds)
            end_time: Optional end time for cropping (in seconds)
            target_ratio: Optional target aspect ratio as (width, height) tuple
            resize_method: Method for aspect ratio change
            pad_color: RGB color for padding (only used if blur_background is False)
            blur_background: If True and resize_method is 'pad', use blurred video as background
            blur_strength: Strength of blur effect (1-50, default: 25) - higher values = more blur
            gradient_blend: Gradient blending factor (0.0-1.0, default: 0.3) - controls bleeding effect transparency
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
            print(f"Blur background: {blur_background}")
            print(f"Quality preset: {quality_preset or self.quality_preset}")
            print(f"Time cropping enabled: {start_time is not None and end_time is not None}")
            print(f"Watermark path: {watermark_path}")
            print(f"Watermark position: {watermark_position}")
            print(f"Blur strength: {blur_strength}")
            print(f"Gradient blend: {gradient_blend}")
            
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
                
                # Determine if we are using intermediate lossless mkv files
                use_intermediate_mkv = (quality_preset or self.quality_preset) == 'lossless'

                # Step 1: Time cropping if specified
                if start_time is not None and end_time is not None:
                    print(f"📽️ STEP 1: Time cropping from {start_time}s to {end_time}s")
                    temp_cropped_ext = ".mkv" if use_intermediate_mkv else ".mp4"
                    temp_cropped = os.path.join(temp_dir, f"temp_cropped{temp_cropped_ext}")
                    if not self.crop_video_by_time(current_file, temp_cropped, start_time, end_time, quality_preset, is_intermediate_for_concat=use_intermediate_mkv):
                        return False
                    current_file = temp_cropped
                else:
                    print(f"⏭️ STEP 1: Skipping time cropping (start_time={start_time}, end_time={end_time})")

                # Step 2: Aspect ratio change if specified
                if target_ratio is not None:
                    print(f"📐 STEP 2: Changing aspect ratio to {target_ratio[0]}:{target_ratio[1]} using {resize_method}")
                    if blur_background and resize_method == 'pad':
                        print(f"🌫️ Using blurred background for letterboxing")
                    
                    temp_resized_ext = ".mkv" if use_intermediate_mkv else ".mp4"
                    temp_resized = os.path.join(temp_dir, f"temp_resized{temp_resized_ext}")
                    if not self.resize_aspect_ratio(current_file, temp_resized, target_ratio, resize_method, pad_color, blur_background, blur_strength, gradient_blend, quality_preset, is_intermediate_for_concat=use_intermediate_mkv):
                        return False
                    current_file = temp_resized

                    # Also resize CTA video to match if it exists
                    if processed_cta_path and os.path.exists(processed_cta_path):
                        print(f"📐 STEP 2b: Resizing CTA video to match aspect ratio {target_ratio[0]}:{target_ratio[1]}")
                        temp_cta_resized_ext = ".mkv" if use_intermediate_mkv else ".mp4"
                        temp_cta_resized = os.path.join(temp_dir, f"temp_cta_resized{temp_cta_resized_ext}")
                        try:
                            cta_resize_quality = 'high' # Always use 'high' for CTA intermediate resizing for speed
                            if use_intermediate_mkv: # but if main is lossless, output CTA intermediate as mkv too
                                print(f"ℹ️ Using '{cta_resize_quality}' quality for CTA video resizing (main preset: {quality_preset}), outputting as .mkv intermediate.")
                            else:
                                print(f"ℹ️ Using '{cta_resize_quality}' quality for CTA video resizing (main preset: {quality_preset}).")

                            if self.resize_aspect_ratio(processed_cta_path, temp_cta_resized, target_ratio, resize_method, pad_color, blur_background, blur_strength, gradient_blend, cta_resize_quality, is_intermediate_for_concat=use_intermediate_mkv):
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

                    main_info = self.get_video_info(current_file)
                    cta_info = self.get_video_info(processed_cta_path)

                    if main_info and cta_info:
                        print(f"Main video info: {main_info['size']} @ {main_info['fps']:.1f}fps, Duration: {main_info.get('duration', 'N/A')}s")
                        print(f"CTA video info: {cta_info['size']} @ {cta_info['fps']:.1f}fps, Duration: {cta_info.get('duration', 'N/A')}s")
                    
                    temp_concat_ext = ".mkv" if use_intermediate_mkv else ".mp4" # Output of concat should also be mkv if inputs were
                    temp_concatenated = os.path.join(temp_dir, f"temp_concatenated{temp_concat_ext}")
                    
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

                # Step 4: After all processing steps, overlay watermark if provided
                # The output_path (final destination) is usually .mp4
                # If current_file is .mkv (from lossless concat) and watermark is applied, add_watermark will re-encode to .mp4
                if watermark_path and os.path.exists(watermark_path):
                    print(f"🖼️ Adding watermark: {watermark_path} at {watermark_position}")
                    # Ensure temp_watermarked uses the final output_path's extension (typically .mp4)
                    # or a specific temp .mp4 if output_path is not .mp4 for some reason.
                    # For now, assume output_path from Flask app is .mp4, so add_watermark writes to a temp .mp4
                    temp_watermarked = os.path.join(temp_dir, f"temp_watermarked{os.path.splitext(output_path)[1] or '.mp4'}")
                    
                    # Watermarking re-encodes, so it doesn't need is_intermediate_for_concat.
                    # It should use the final quality_preset.
                    if not self.add_watermark(current_file, temp_watermarked, watermark_path, watermark_position, quality_preset_override=quality_preset):
                        print("❌ Failed to add watermark")
                        return False
                    current_file = temp_watermarked

                # Final step: Ensure current_file is moved to output_path with the correct container
                # If current_file is .mkv (from lossless direct concat without watermark) and output_path is .mp4, convert.
                final_output_is_mp4 = output_path.lower().endswith('.mp4')
                current_file_is_mkv = current_file.lower().endswith('.mkv')

                if current_file_is_mkv and final_output_is_mp4 and current_file != output_path:
                    if (quality_preset or self.quality_preset) == 'lossless':
                        logging.info(f"Lossless MKV to MP4 conversion needed for final output: {current_file} -> {output_path}")
                        try:
                            # Attempt direct stream copy if codecs are compatible (H.264 in MKV to H.264 in MP4)
                            # PCM audio in MKV needs re-encoding to AAC for MP4
                            ffmpeg_cmd = [
                                'ffmpeg', '-y', '-i', current_file,
                                '-c:v', 'copy', # Copy video stream
                                '-c:a', 'aac', '-b:a', '320k', # Re-encode audio to AAC for MP4 compatibility
                                '-movflags', '+faststart',
                                output_path
                            ]
                            logging.info(f"Executing FFmpeg for MKV to MP4 (lossless video, AAC audio): {' '.join(ffmpeg_cmd)}")
                            process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                            stdout, stderr = process.communicate()
                            if process.returncode != 0:
                                logging.error(f"FFmpeg MKV to MP4 conversion failed (video copy, audio AAC). StdErr: {stderr.decode(errors='ignore')}")
                                logging.info("Falling back to MoviePy re-encode for MKV to MP4 (lossless).")
                                clip = VideoFileClip(current_file)
                                clip.write_videofile(output_path, **self.get_encoding_params(quality_preset='lossless'))
                                clip.close()
                            else:
                                logging.info("FFmpeg MKV to MP4 conversion (video copy, audio AAC) successful.")
                        except Exception as e_conv:
                            logging.error(f"Error during MKV to MP4 conversion for {current_file}: {e_conv}. Falling back to MoviePy re-encode.")
                            traceback.print_exc()
                            clip = VideoFileClip(current_file)
                            clip.write_videofile(output_path, **self.get_encoding_params(quality_preset='lossless')) # Full lossless re-encode
                            clip.close()
                    else: # Should not happen if current_file_is_mkv was due to lossless path
                        logging.info(f"Copying non-lossless MKV {current_file} to MP4 {output_path} (may involve re-encode by MoviePy if add_watermark wasn't called)")
                        # This scenario is less likely if .mkv is only for lossless intermediates.
                        # If it occurs, just use MoviePy to handle it.
                        clip = VideoFileClip(current_file)
                        clip.write_videofile(output_path, **self.get_encoding_params(quality_preset=(quality_preset or self.quality_preset)))
                        clip.close()
                elif current_file != output_path:
                    import shutil
                    shutil.copy2(current_file, output_path)
                
                print(f"✅ Complete video processing finished. Output saved to: {output_path}")
                print(f"🎉 PROCESS_VIDEO_COMPLETE RETURNING TRUE - SUCCESS!")
                return True
                
        except MemoryError:
            print("❌ Memory error: Videos too large for available RAM")
            print("💡 Try using lower resolution videos or increase system memory")
            print(f"🔴 PROCESS_VIDEO_COMPLETE RETURNING FALSE - MEMORY ERROR!")
            return False
        except Exception as e:
            print(f"❌ Error in complete video processing: {str(e)}")
            print(f"🔍 Exception type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            print(f"🔴 PROCESS_VIDEO_COMPLETE RETURNING FALSE - EXCEPTION!")
            return False
    
    def generate_aspect_ratio_preview(self,
                                    input_path: str,
                                    output_path: str,
                                    target_ratio: Tuple[int, int] = (9, 16),
                                    resize_method: Literal['crop', 'pad', 'stretch'] = 'crop',
                                    pad_color: Tuple[int, int, int] = (0, 0, 0),
                                    blur_background: bool = False,
                                    blur_strength: int = 25,
                                    gradient_blend: float = 0.3,
                                    frame_time: Optional[float] = None) -> bool:
        """
        Generate a preview image showing what the aspect ratio conversion will look like.
        
        Args:
            input_path: Path to input video file
            output_path: Path for output preview image (PNG/JPG)
            target_ratio: Target aspect ratio as (width, height) tuple
            resize_method: Method to handle aspect ratio change ('crop', 'pad', 'stretch')
            pad_color: RGB color for padding (only used if blur_background is False)
            blur_background: If True and resize_method is 'pad', use blurred video as background
            blur_strength: Strength of blur effect (1-50, default: 25)
            gradient_blend: Gradient blending factor (0.0-1.0, default: 0.3)
            frame_time: Specific time to extract frame from (seconds). If None, uses middle of video.
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            from moviepy.editor import VideoFileClip
            import os
            
            print(f"🖼️ Generating aspect ratio preview...")
            print(f"📁 Input: {input_path}")
            print(f"📐 Target ratio: {target_ratio[0]}:{target_ratio[1]}")
            print(f"🔧 Method: {resize_method}")
            print(f"🌫️ Blur background: {blur_background}")
            if blur_background:
                print(f"💫 Blur strength: {blur_strength}, Gradient blend: {gradient_blend}")
            
            # Validate input file
            if not self._validate_input(input_path):
                return False
            
            # Load video
            clip = VideoFileClip(input_path)
            
            # Determine frame time
            if frame_time is None:
                # Use middle of video for preview
                frame_time = clip.duration / 2
                print(f"⏰ Using middle frame at {frame_time:.1f}s")
            else:
                # Clamp frame_time to valid range
                frame_time = max(0, min(frame_time, clip.duration))
                print(f"⏰ Using specified frame at {frame_time:.1f}s")
            
            # Extract single frame as ImageClip
            frame_clip = clip.subclip(frame_time, frame_time + 0.1).to_ImageClip(duration=1)
            original_width, original_height = frame_clip.size
            original_ratio = original_width / original_height
            target_ratio_decimal = target_ratio[0] / target_ratio[1]
            
            print(f"📏 Original dimensions: {original_width}x{original_height}")
            print(f"📊 Original ratio: {original_ratio:.2f}, Target ratio: {target_ratio_decimal:.2f}")
            
            # Process frame based on resize method (reuse existing logic)
            if resize_method == 'crop':
                print(f"✂️ Applying crop preview...")
                processed_frame = self._crop_to_ratio(frame_clip, target_ratio)
            elif resize_method == 'pad':
                print(f"📦 Applying pad preview...")
                processed_frame = self._pad_to_ratio(frame_clip, target_ratio, pad_color, blur_background, blur_strength, gradient_blend)
            elif resize_method == 'stretch':
                print(f"↔️ Applying stretch preview...")
                processed_frame = self._stretch_to_ratio(frame_clip, target_ratio)
            else:
                raise ValueError(f"Unsupported resize method: {resize_method}")
            
            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Save the preview image
            print(f"💾 Saving preview to: {output_path}")
            
            # Handle image format based on file extension
            _, ext = os.path.splitext(output_path)
            if ext.lower() in ['.jpg', '.jpeg']:
                # Convert RGBA to RGB for JPEG compatibility
                processed_frame.save_frame(output_path, t=0, logger=None)
            else:
                # PNG supports RGBA, save directly
                processed_frame.save_frame(output_path, t=0)
            
            # Clean up
            clip.close()
            frame_clip.close()
            processed_frame.close()
            
            print(f"✅ Preview generated successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Error generating preview: {str(e)}")
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
    
    def _pad_to_ratio(self, clip, target_ratio: Tuple[int, int], pad_color: Tuple[int, int, int], blur_background: bool, blur_strength: int = 25, gradient_blend: float = 0.3):
        """Add padding to video to achieve target aspect ratio."""
        from moviepy.editor import ColorClip, CompositeVideoClip
        
        width, height = clip.size
        target_ratio_decimal = target_ratio[0] / target_ratio[1]
        current_ratio = width / height
        
        # Check if aspect ratios are already very close (within 0.01 tolerance)
        if abs(current_ratio - target_ratio_decimal) < 0.01:
            print(f"ℹ️ Aspect ratios already match (current: {current_ratio:.2f}, target: {target_ratio_decimal:.2f})")
            if blur_background:
                print(f"🌫️ Blur background requested but no padding needed - aspect ratios are already the same!")
                print(f"💡 Tip: Try converting to a different aspect ratio to see the blur effect (e.g., 9:16 for portrait)")
            print(f"✅ Returning original video without changes")
            return clip
        
        if current_ratio > target_ratio_decimal:
            # Video is wider, add top/bottom padding
            new_height = int(width / target_ratio_decimal)
            # Ensure new_height is even
            if new_height % 2 != 0:
                new_height += 1
            pad_height = (new_height - height) // 2
            print(f"📐 Adding top/bottom padding: {pad_height}px each side (final size: {width}x{new_height})")
            if blur_background:
                print(f"🌫️ Creating blurred background for letterboxing (blur: {blur_strength}, gradient: {gradient_blend})")
                background = self._create_blurred_background(clip, (width, new_height), blur_strength, gradient_blend)
            else:
                background = ColorClip(
                    size=(width, new_height),
                    color=pad_color,
                    duration=clip.duration
                )
            return CompositeVideoClip([background, clip.set_position(('center', pad_height))])
        else:
            # Video is taller, add left/right padding
            new_width = int(height * target_ratio_decimal)
            # Ensure new_width is even
            if new_width % 2 != 0:
                new_width += 1
            pad_width = (new_width - width) // 2
            print(f"📐 Adding left/right padding: {pad_width}px each side (final size: {new_width}x{height})")
            if blur_background:
                print(f"🌫️ Creating blurred background for pillarboxing (blur: {blur_strength}, gradient: {gradient_blend})")
                background = self._create_blurred_background(clip, (new_width, height), blur_strength, gradient_blend)
            else:
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

    def add_watermark(self, input_path: str, output_path: str, watermark_path: str, position: Optional[str] = 'bottom-right', quality_preset_override: Optional[str] = None):
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
            final.write_videofile(output_path, **self.get_encoding_params(quality_preset=quality_preset_override))
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

    def _apply_blur(self, clip, blur_radius):
        """
        Apply blur effect using a robust downscale-upscale method.
        Optimized for performance with automatic scaling based on resolution.
        
        Args:
            clip: Video clip to blur
            blur_radius: Blur radius (higher = more blur)
            
        Returns:
            Blurred video clip
        """
        try:
            original_size = clip.size
            width, height = original_size
            total_pixels = width * height
            
            # Performance optimization: Adjust blur quality based on resolution
            if total_pixels > 8294400:  # > 4K (3840x2160)
                print(f"🚀 Ultra-high resolution detected ({width}x{height}) - using aggressive blur optimization")
                blur_factor = max(4, blur_radius // 2)  # More aggressive downscaling for 4K+
            elif total_pixels > 2073600:  # > 1920x1080
                print(f"🚀 High resolution detected ({width}x{height}) - using optimized blur")
                blur_factor = max(3, blur_radius // 3)  # Moderate optimization for high-res
            else:
                print(f"📐 Standard resolution ({width}x{height}) - using standard blur")
                blur_factor = max(2, blur_radius // 4)  # Original algorithm for standard res
            
            # Calculate new size for blur effect
            new_width = max(16, original_size[0] // blur_factor)  # Minimum 16 pixels wide
            new_height = max(16, original_size[1] // blur_factor)  # Minimum 16 pixels tall
            
            # Ensure dimensions are even
            new_width = new_width if new_width % 2 == 0 else new_width + 1
            new_height = new_height if new_height % 2 == 0 else new_height + 1
            
            print(f"🔧 Blur optimization: {width}x{height} → {new_width}x{new_height} → {width}x{height} (factor: {blur_factor})")
            
            # Apply blur by downscaling then upscaling
            blurred_clip = clip.resize((new_width, new_height)).resize(original_size)
            
            return blurred_clip
            
        except Exception as e:
            print(f"Warning: Error applying blur effect: {str(e)}")
            # Return original clip if blur fails
            return clip

    def _create_blurred_background(self, clip, target_size: Tuple[int, int], blur_strength: int = 25, gradient_blend: float = 0.3):
        """
        Create a blurred background from the original video that fills the target dimensions.
        Now supports gradient blending for a bleeding effect.
        
        Args:
            clip: Original video clip
            target_size: Target dimensions (width, height) for the background
            blur_strength: Strength of blur effect (1-50, higher = more blur)
            gradient_blend: Gradient blending factor (0.0-1.0) - controls bleeding effect transparency
            
        Returns:
            A blurred video clip that fills the target dimensions with optional gradient blend
        """
        try:
            # Validate parameters
            blur_strength = max(1, min(50, blur_strength))  # Clamp between 1-50
            gradient_blend = max(0.0, min(1.0, gradient_blend))  # Clamp between 0.0-1.0
            
            print(f"🎨 Creating background with blur strength: {blur_strength}, gradient blend: {gradient_blend}")
            
            # Ensure target dimensions are even
            target_width, target_height = target_size
            if target_width % 2 != 0:
                target_width += 1
            if target_height % 2 != 0:
                target_height += 1
            target_size = (target_width, target_height)
            
            original_width, original_height = clip.size
            
            # Calculate scaling to fill the target dimensions completely
            scale_x = target_width / original_width
            scale_y = target_height / original_height
            scale = max(scale_x, scale_y)  # Use the larger scale to ensure complete fill
            
            # Calculate new dimensions after scaling
            scaled_width = int(original_width * scale)
            scaled_height = int(original_height * scale)
            
            # Ensure scaled dimensions are even
            if scaled_width % 2 != 0:
                scaled_width += 1
            if scaled_height % 2 != 0:
                scaled_height += 1
            
            print(f"🔧 Blur background: scaling from {original_width}x{original_height} to {scaled_width}x{scaled_height}, target: {target_width}x{target_height}")
            
            # Resize the clip to fill the background
            scaled_clip = clip.resize((scaled_width, scaled_height))
            
            # If the scaled clip is larger than target, crop it to center
            if scaled_width > target_width or scaled_height > target_height:
                x_center = scaled_width // 2
                y_center = scaled_height // 2
                x1 = x_center - target_width // 2
                y1 = y_center - target_height // 2
                x2 = x1 + target_width
                y2 = y1 + target_height
                
                # Ensure coordinates are within bounds
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(scaled_width, x2)
                y2 = min(scaled_height, y2)
                
                print(f"🔧 Cropping scaled background: ({x1}, {y1}) to ({x2}, {y2})")
                scaled_clip = scaled_clip.crop(x1=x1, y1=y1, x2=x2, y2=y2)
            
            # Apply blur effect with user-controlled strength
            blurred_clip = self._apply_blur(scaled_clip, blur_strength)
            
            # Apply gradient blend effect if requested
            if gradient_blend > 0.0:
                print(f"🌈 Applying gradient blend effect (strength: {gradient_blend})")
                blurred_clip = self._apply_gradient_blend(blurred_clip, gradient_blend)
            
            # Try to apply a subtle dim effect to make the main content stand out more
            try:
                # Reduce brightness slightly for better contrast with main video
                dimmed_clip = blurred_clip.fl_image(lambda image: (image * 0.8).astype('uint8'))
                print(f"✅ Blur background created successfully with dimming effect")
                return dimmed_clip
            except Exception as dim_error:
                print(f"⚠️ Dimming effect failed, using regular blur: {dim_error}")
                # If color multiplication doesn't work, use the regular blurred clip
                print(f"✅ Blur background created successfully without dimming")
                return blurred_clip
            
        except Exception as e:
            print(f"❌ Error creating blurred background: {str(e)}")
            # Fallback to a simple dark background that should work
            from moviepy.editor import ColorClip
            print(f"🔄 Falling back to solid dark background")
            return ColorClip(size=target_size, color=(32, 32, 32), duration=clip.duration)

    def _apply_gradient_blend(self, clip, gradient_strength: float):
        """
        Apply a gradient blend effect to create a bleeding/vignette effect.
        Optimized for performance with automatic quality scaling based on resolution.
        
        Args:
            clip: Video clip to apply gradient to
            gradient_strength: Strength of gradient effect (0.0-1.0)
            
        Returns:
            Video clip with gradient blend applied
        """
        try:
            width, height = clip.size
            total_pixels = width * height
            
            # Performance optimization: Skip gradient for very high resolutions or very low strength
            if gradient_strength < 0.05:
                print(f"⏭️ Skipping gradient blend (strength too low: {gradient_strength})")
                return clip
                
            # Automatic quality scaling based on resolution
            if total_pixels > 2073600:  # > 1920x1080
                print(f"🚀 High resolution detected ({width}x{height}) - using fast gradient mode")
                return self._apply_fast_gradient_blend(clip, gradient_strength)
            else:
                print(f"🎨 Standard resolution ({width}x{height}) - using full quality gradient")
                return self._apply_standard_gradient_blend(clip, gradient_strength)
            
        except Exception as e:
            print(f"⚠️ Error applying gradient blend: {str(e)}")
            # Return original clip if gradient fails
            return clip

    def _apply_fast_gradient_blend(self, clip, gradient_strength: float):
        """
        Fast gradient blend for high-resolution videos using downscaling technique.
        """
        try:
            width, height = clip.size
            
            # Use a simplified radial gradient that's much faster
            import numpy as np
            
            # Create a smaller gradient mask for performance (max 720p equivalent)
            mask_width = min(width, 1280)
            mask_height = min(height, 720)
            
            # Calculate center coordinates for the mask
            center_x, center_y = mask_width // 2, mask_height // 2
            max_distance = np.sqrt((mask_width/2)**2 + (mask_height/2)**2)
            
            # Create coordinate grids for the mask
            y, x = np.ogrid[:mask_height, :mask_width]
            distance_from_center = np.sqrt((x - center_x)**2 + (y - center_y)**2)
            normalized_distance = distance_from_center / max_distance
            
            # Create a simple radial gradient (faster than sigmoid)
            gradient_mask = np.clip(gradient_strength * normalized_distance, 0.0, gradient_strength)
            
            # If mask size is different from video size, we'll scale it during application
            def apply_fast_gradient_to_frame(frame):
                """Apply fast gradient mask to a single frame"""
                frame_float = frame.astype(np.float32)
                
                # If mask size doesn't match frame size, resize the mask
                if gradient_mask.shape != (frame.shape[0], frame.shape[1]):
                    try:
                        from scipy.ndimage import zoom
                        scale_y = frame.shape[0] / gradient_mask.shape[0]
                        scale_x = frame.shape[1] / gradient_mask.shape[1]
                        resized_mask = zoom(gradient_mask, (scale_y, scale_x), order=1)  # Linear interpolation
                    except ImportError:
                        # Fallback: use simple numpy resize (less precise but faster)
                        print(f"⚠️ SciPy not available, using numpy resize fallback")
                        from numpy import interp
                        # Simple linear interpolation fallback
                        h_ratio = frame.shape[0] / gradient_mask.shape[0]
                        w_ratio = frame.shape[1] / gradient_mask.shape[1]
                        if h_ratio != 1.0 or w_ratio != 1.0:
                            # For performance, just use the smaller mask and tile it
                            resized_mask = np.tile(gradient_mask, (int(h_ratio) + 1, int(w_ratio) + 1))[:frame.shape[0], :frame.shape[1]]
                        else:
                            resized_mask = gradient_mask
                else:
                    resized_mask = gradient_mask
                
                # Convert to 3-channel mask
                gradient_mask_3d = np.stack([resized_mask] * 3, axis=-1)
                
                # Apply gradient: simple multiplication (faster than complex blending)
                modified_frame = frame_float * (1.0 - gradient_mask_3d * 0.5)  # Less aggressive for speed
                
                return np.clip(modified_frame, 0, 255).astype(np.uint8)
            
            print(f"🚀 Fast gradient applied: {mask_width}x{mask_height} mask → {width}x{height} video")
            return clip.fl_image(apply_fast_gradient_to_frame)
            
        except Exception as e:
            print(f"⚠️ Fast gradient failed, using no gradient: {str(e)}")
            return clip

    def _apply_standard_gradient_blend(self, clip, gradient_strength: float):
        """
        Standard quality gradient blend for normal resolution videos.
        """
        try:
            width, height = clip.size
            
            # Create a gradient mask using numpy
            import numpy as np
            
            # Pre-compute the gradient mask once (major performance improvement)
            y, x = np.ogrid[:height, :width]
            center_x, center_y = width // 2, height // 2
            max_distance = np.sqrt((width/2)**2 + (height/2)**2)
            distance_from_center = np.sqrt((x - center_x)**2 + (y - center_y)**2)
            normalized_distance = distance_from_center / max_distance
            
            # Use a simpler gradient function (faster than sigmoid)
            gradient_mask = np.clip(gradient_strength * normalized_distance**1.5, 0.0, gradient_strength)
            gradient_mask_3d = np.stack([gradient_mask] * 3, axis=-1)
            
            def apply_standard_gradient_to_frame(frame):
                """Apply standard gradient mask to a single frame"""
                frame_float = frame.astype(np.float32)
                
                # Apply gradient with optimized calculation
                modified_frame = frame_float * (1.0 - gradient_mask_3d * 0.7)
                
                return np.clip(modified_frame, 0, 255).astype(np.uint8)
            
            print(f"🎨 Standard gradient applied: {width}x{height} (strength: {gradient_strength})")
            return clip.fl_image(apply_standard_gradient_to_frame)
            
        except Exception as e:
            print(f"⚠️ Standard gradient failed, using no gradient: {str(e)}")
            return clip

    def _concatenate_videos_ffmpeg_lossless(self, video_paths: List[str], output_path: str) -> bool:
        """
        Concatenate videos using FFmpeg direct command with concat demuxer for lossless stream copying.
        Assumes input videos are in a compatible format (e.g., intermediate lossless MKV).

        Args:
            video_paths: List of paths to video files to concatenate.
            output_path: Path for the output concatenated video file.

        Returns:
            bool: True if successful, False otherwise.
        """
        logging.info(f"Attempting FFmpeg direct lossless concatenation for {len(video_paths)} videos to {output_path}")
        if len(video_paths) < 1:
            logging.error("No videos provided for FFmpeg concatenation.")
            return False

        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Create a temporary file list for FFmpeg's concat demuxer
        list_file_path = ""
        try:
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as tmp_list_file:
                for path in video_paths:
                    # FFmpeg concat demuxer requires 'file' directive and quoted paths
                    # Paths need to be absolute or relative to where ffmpeg is run (safer with absolute)
                    abs_path = os.path.abspath(path)
                    tmp_list_file.write(f"file '{abs_path}'\n")
                list_file_path = tmp_list_file.name
            logging.debug(f"FFmpeg concat list file created: {list_file_path}")

            # Construct FFmpeg command
            # -f concat: Use the concat demuxer
            # -safe 0: Allow unsafe file paths (needed if paths are complex, though we use abs paths)
            # -i list_file_path: Input file list
            # -c copy: Stream copy video and audio codecs (lossless and fast)
            command = [
                'ffmpeg',
                '-y',  # Overwrite output file if it exists
                '-f', 'concat',
                '-safe', '0', 
                '-i', list_file_path,
                '-c', 'copy',
                output_path
            ]
            
            logging.info(f"Executing FFmpeg command: {' '.join(command)}")
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()

            if process.returncode == 0:
                logging.info(f"FFmpeg direct concatenation successful: {output_path}")
                return True
            else:
                logging.error(f"FFmpeg direct concatenation failed. Return code: {process.returncode}")
                logging.error(f"FFmpeg stdout: {stdout.decode(errors='ignore')}")
                logging.error(f"FFmpeg stderr: {stderr.decode(errors='ignore')}")
                return False

        except Exception as e:
            logging.error(f"Exception during FFmpeg direct concatenation: {str(e)}")
            traceback.print_exc()
            return False
        finally:
            if list_file_path and os.path.exists(list_file_path):
                try:
                    os.remove(list_file_path)
                    logging.debug(f"Removed temp list file: {list_file_path}")
                except Exception as e_remove:
                    logging.warning(f"Failed to remove temp list file {list_file_path}: {e_remove}")


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
        pad_color=(255, 255, 255),  # White padding
        blur_background=False
    )
    
    # Method 3: Add padding with blurred background (cinematic effect)
    output_file_blurred = "output_video_9_16_blurred.mp4"
    success = processor.resize_aspect_ratio(
        input_path=input_file,
        output_path=output_file_blurred,
        target_ratio=(9, 16),
        resize_method='pad',
        blur_background=True,  # Use blurred background instead of solid color
        blur_strength=30,      # Strong blur effect (1-50)
        gradient_blend=0.4     # Moderate gradient bleeding effect (0.0-1.0)
    )
    
    # Method 4: Add padding with custom blur and gradient settings
    output_file_custom = "output_video_9_16_custom.mp4"
    success = processor.resize_aspect_ratio(
        input_path=input_file,
        output_path=output_file_custom,
        target_ratio=(9, 16),
        resize_method='pad',
        blur_background=True,
        blur_strength=15,      # Lighter blur effect
        gradient_blend=0.6     # Strong gradient bleeding effect for artistic look
    )
    
    # Get video information
    info = processor.get_video_info(input_file)
    if info:
        print(f"Video info: {info}")