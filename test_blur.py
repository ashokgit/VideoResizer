#!/usr/bin/env python3
"""
Test script for the blurred background feature.
"""

from video_processor import VideoProcessor
import os

def test_blur_background():
    """Test the blurred background functionality."""
    processor = VideoProcessor()
    
    # Check if we have any test video files
    test_files = []
    for ext in ['mp4', 'avi', 'mov']:
        for name in ['test', 'sample', 'input']:
            filename = f"{name}.{ext}"
            if os.path.exists(filename):
                test_files.append(filename)
    
    if not test_files:
        print("❌ No test video files found. Please add a test video file (test.mp4, sample.mp4, etc.)")
        return False
    
    input_file = test_files[0]
    print(f"📹 Using test file: {input_file}")
    
    # Get video info first
    info = processor.get_video_info(input_file)
    if info:
        width, height = info['size']
        current_ratio = width / height
        print(f"📊 Video info: {width}x{height}, ratio: {current_ratio:.2f}:1")
    
    # Test 1: Same aspect ratio (should NOT apply blur)
    print(f"\n🧪 Test 1: Converting to same aspect ratio (should not apply blur)")
    if current_ratio > 1:
        # Video is landscape, try converting to 16:9
        same_ratio_test = (16, 9)
    else:
        # Video is portrait, try converting to 9:16  
        same_ratio_test = (9, 16)
        
    output_same = "test_same_ratio.mp4"
    print(f"🔄 Converting to {same_ratio_test[0]}:{same_ratio_test[1]}...")
    
    success = processor.resize_aspect_ratio(
        input_path=input_file,
        output_path=output_same,
        target_ratio=same_ratio_test,
        resize_method='pad',
        blur_background=True
    )
    
    if success:
        print(f"✅ Same ratio test completed: {output_same}")
    
    # Test 2: Different aspect ratio (should apply blur)
    print(f"\n🧪 Test 2: Converting to different aspect ratio (should apply blur)")
    if current_ratio > 1:
        # Video is landscape, convert to portrait for dramatic effect
        different_ratio_test = (9, 16)
    else:
        # Video is portrait, convert to landscape
        different_ratio_test = (16, 9)
        
    output_different = "test_different_ratio.mp4"
    print(f"🔄 Converting to {different_ratio_test[0]}:{different_ratio_test[1]}...")
    
    success = processor.resize_aspect_ratio(
        input_path=input_file,
        output_path=output_different,
        target_ratio=different_ratio_test,
        resize_method='pad',
        blur_background=True
    )
    
    if success:
        print(f"✅ Different ratio test completed: {output_different}")
        
        # Get output video info
        info = processor.get_video_info(output_different)
        if info:
            print(f"📊 Output video info: {info['size']} @ {info['fps']:.1f}fps, {info['duration']:.1f}s")
    
    # Test 3: Square format (great for Instagram)
    print(f"\n🧪 Test 3: Converting to square 1:1 (should apply blur if not already square)")
    output_square = "test_square.mp4"
    print(f"🔄 Converting to 1:1 (square)...")
    
    success = processor.resize_aspect_ratio(
        input_path=input_file,
        output_path=output_square,
        target_ratio=(1, 1),
        resize_method='pad',
        blur_background=True
    )
    
    if success:
        print(f"✅ Square test completed: {output_square}")
    
    print(f"\n🎉 Blur background tests completed!")
    print(f"📁 Output files:")
    for filename in [output_same, output_different, output_square]:
        if os.path.exists(filename):
            print(f"  - {filename}")
    
    return True

if __name__ == "__main__":
    print("🧪 Testing Blurred Background Feature")
    print("=" * 50)
    print("This test will demonstrate when blur background works and when it doesn't")
    print("=" * 50)
    test_blur_background() 