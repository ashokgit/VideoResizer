#!/usr/bin/env python3
"""
Main entry point for the video processing application.
Can be run interactively or with command line arguments.
"""

import os
import sys
import argparse
from video_processor import VideoProcessor

def main():
    parser = argparse.ArgumentParser(description='Video Aspect Ratio Processor')
    parser.add_argument('--input', '-i', required=True, help='Input video file path')
    parser.add_argument('--output', '-o', required=True, help='Output video file path')
    parser.add_argument('--ratio', '-r', default='9:16', help='Target aspect ratio (e.g., 9:16, 16:9)')
    parser.add_argument('--method', '-m', choices=['crop', 'pad', 'stretch'], 
                       default='crop', help='Resize method')
    parser.add_argument('--pad-color', default='0,0,0', 
                       help='Padding color as R,G,B (e.g., 0,0,0 for black)')
    parser.add_argument('--blur-background', action='store_true',
                       help='Use blurred video background instead of solid color (only for pad method)')
    parser.add_argument('--quality', '-q', choices=['lossless', 'high', 'medium', 'low'],
                       default='high', help='Video quality preset')
    parser.add_argument('--info', action='store_true', help='Show video info only')
    
    args = parser.parse_args()
    
    # Initialize processor with quality preset
    processor = VideoProcessor(quality_preset=args.quality)
    
    # Show video info if requested
    if args.info:
        info = processor.get_video_info(args.input)
        if info:
            print(f"\nVideo Information for: {args.input}")
            print(f"Duration: {info['duration']:.2f} seconds")
            print(f"FPS: {info['fps']}")
            print(f"Size: {info['size'][0]}x{info['size'][1]}")
            print(f"Aspect Ratio: {info['aspect_ratio']:.2f}")
            print(f"Has Audio: {info['has_audio']}")
        return
    
    # Parse target ratio
    try:
        ratio_parts = args.ratio.split(':')
        target_ratio = (int(ratio_parts[0]), int(ratio_parts[1]))
    except (ValueError, IndexError):
        print(f"Error: Invalid ratio format '{args.ratio}'. Use format like '9:16'")
        return
    
    # Parse padding color
    try:
        pad_color = tuple(map(int, args.pad_color.split(',')))
        if len(pad_color) != 3:
            raise ValueError
    except ValueError:
        print(f"Error: Invalid color format '{args.pad_color}'. Use format like '255,255,255'")
        return
    
    print(f"Processing video...")
    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    print(f"Target Ratio: {target_ratio[0]}:{target_ratio[1]}")
    print(f"Method: {args.method}")
    print(f"Quality: {args.quality}")
    
    # Process video
    success = processor.resize_aspect_ratio(
        input_path=args.input,
        output_path=args.output,
        target_ratio=target_ratio,
        resize_method=args.method,
        pad_color=pad_color,
        blur_background=args.blur_background,
        quality_preset=args.quality
    )
    
    if success:
        print(f"\n✅ Video processing completed successfully!")
        print(f"Output saved to: {args.output}")
    else:
        print(f"\n❌ Video processing failed!")
        sys.exit(1)

def interactive_mode():
    """Interactive mode for easier use."""
    print("🎬 Video Processor - Interactive Mode")
    print("=" * 40)
    
    while True:
        print("\nOptions:")
        print("1. Process video (resize aspect ratio)")
        print("2. Get video information")
        print("3. Exit")
        
        choice = input("\nSelect option (1-3): ").strip()
        
        if choice == '1':
            input_path = input("Enter input video path: ").strip()
            output_path = input("Enter output video path: ").strip()
            
            print("\nAvailable ratios:")
            print("1. 9:16 (Portrait/Mobile)")
            print("2. 16:9 (Landscape/Desktop)")
            print("3. 1:1 (Square)")
            print("4. Custom")
            
            ratio_choice = input("Select ratio (1-4): ").strip()
            
            if ratio_choice == '1':
                target_ratio = (9, 16)
            elif ratio_choice == '2':
                target_ratio = (16, 9)
            elif ratio_choice == '3':
                target_ratio = (1, 1)
            elif ratio_choice == '4':
                custom_ratio = input("Enter custom ratio (e.g., 4:3): ").strip()
                try:
                    parts = custom_ratio.split(':')
                    target_ratio = (int(parts[0]), int(parts[1]))
                except:
                    print("Invalid ratio format!")
                    continue
            else:
                print("Invalid choice!")
                continue
            
            print("\nResize methods:")
            print("1. Crop (may lose content)")
            print("2. Pad (add borders)")
            print("3. Stretch (may distort)")
            
            method_choice = input("Select method (1-3): ").strip()
            method_map = {'1': 'crop', '2': 'pad', '3': 'stretch'}
            resize_method = method_map.get(method_choice, 'crop')
            
            print("\nQuality presets:")
            print("1. Lossless (no quality loss, largest files)")
            print("2. High (near-lossless, recommended)")
            print("3. Medium (good quality, smaller files)")
            print("4. Low (lower quality, smallest files)")
            
            quality_choice = input("Select quality (1-4, default 2): ").strip() or '2'
            quality_map = {'1': 'lossless', '2': 'high', '3': 'medium', '4': 'low'}
            quality_preset = quality_map.get(quality_choice, 'high')
            
            # Initialize processor with selected quality
            processor = VideoProcessor(quality_preset=quality_preset)
            
            print(f"\nProcessing video with {quality_preset} quality...")
            success = processor.resize_aspect_ratio(
                input_path=input_path,
                output_path=output_path,
                target_ratio=target_ratio,
                resize_method=resize_method,
                quality_preset=quality_preset
            )
            
            if success:
                print("✅ Processing completed!")
            else:
                print("❌ Processing failed!")
        
        elif choice == '2':
            file_path = input("Enter video file path: ").strip()
            # Use default quality for info checking
            processor = VideoProcessor()
            info = processor.get_video_info(file_path)
            if info:
                print(f"\n📹 Video Information:")
                print(f"Duration: {info['duration']:.2f} seconds")
                print(f"FPS: {info['fps']}")
                print(f"Size: {info['size'][0]}x{info['size'][1]}")
                print(f"Aspect Ratio: {info['aspect_ratio']:.2f}")
                print(f"Has Audio: {info['has_audio']}")
        
        elif choice == '3':
            print("Goodbye! 👋")
            break
        
        else:
            print("Invalid choice! Please select 1-3.")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        # No arguments provided, run interactive mode
        interactive_mode()
    else:
        # Arguments provided, run CLI mode
        main()