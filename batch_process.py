#!/usr/bin/env python3
"""
Batch processing script for Docker environment variables.
"""

import os
from video_processor import VideoProcessor

def main():
    # Get environment variables
    input_file = os.getenv('INPUT_FILE', 'input/sample.mp4')
    output_file = os.getenv('OUTPUT_FILE', 'output/processed.mp4')
    target_ratio_w = int(os.getenv('TARGET_RATIO_W', '9'))
    target_ratio_h = int(os.getenv('TARGET_RATIO_H', '16'))
    resize_method = os.getenv('RESIZE_METHOD', 'crop')
    
    print(f"🎬 Batch Video Processing")
    print(f"Input: {input_file}")
    print(f"Output: {output_file}")
    print(f"Target Ratio: {target_ratio_w}:{target_ratio_h}")
    print(f"Method: {resize_method}")
    print("-" * 50)
    
    # Initialize processor
    processor = VideoProcessor()
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"❌ Error: Input file not found: {input_file}")
        print("Make sure to mount your video file to the container.")
        return
    
    # Process video
    success = processor.resize_aspect_ratio(
        input_path=input_file,
        output_path=output_file,
        target_ratio=(target_ratio_w, target_ratio_h),
        resize_method=resize_method
    )
    
    if success:
        print(f"\n✅ Batch processing completed successfully!")
        print(f"Output saved to: {output_file}")
    else:
        print(f"\n❌ Batch processing failed!")

if __name__ == "__main__":
    main()