import streamlit as st
import os
import tempfile
import time
from video_processor import VideoProcessor
from typing import Optional, Tuple
import uuid
import streamlit.components.v1 as components

# Page configuration
st.set_page_config(
    page_title="Video Processor Studio",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .main-header {
        font-size: 3rem;
        font-weight: bold;
        text-align: center;
        color: #1E88E5;
        margin-bottom: 2rem;
    }
    .feature-box {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
    }
    .success-message {
        background-color: #d4edda;
        color: #155724;
        padding: 1rem;
        border-radius: 5px;
        margin: 1rem 0;
    }
    .error-message {
        background-color: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 5px;
        margin: 1rem 0;
    }
    .video-info {
        background-color: #e3f2fd;
        padding: 1rem;
        border-radius: 5px;
        margin: 1rem 0;
    }
    .timeline-container {
        background-color: #ffffff;
        padding: 20px;
        border-radius: 10px;
        border: 1px solid #ddd;
        margin: 10px 0;
    }
    .timeline-controls {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin: 10px 0;
    }
    .timeline-button {
        background-color: #1E88E5;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
    }
    .timeline-button:hover {
        background-color: #1565C0;
    }
    .timeline-info {
        text-align: center;
        margin: 10px 0;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'processor' not in st.session_state:
    st.session_state.processor = VideoProcessor()
if 'processed_video_path' not in st.session_state:
    st.session_state.processed_video_path = None
if 'main_video_info' not in st.session_state:
    st.session_state.main_video_info = None
if 'cta_video_info' not in st.session_state:
    st.session_state.cta_video_info = None

def save_uploaded_file(uploaded_file, directory="temp"):
    """Save uploaded file to temporary directory and return path."""
    if not os.path.exists(directory):
        os.makedirs(directory)
    
    file_path = os.path.join(directory, f"{uuid.uuid4()}_{uploaded_file.name}")
    with open(file_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    return file_path

def format_time(seconds):
    """Format seconds to MM:SS format."""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"

def display_video_info(video_info, title="Video Information"):
    """Display video information in a nice format."""
    if video_info:
        st.markdown(f'<div class="video-info">', unsafe_allow_html=True)
        st.markdown(f"**{title}**")
        col1, col2 = st.columns(2)
        with col1:
            st.write(f"**Duration:** {format_time(video_info['duration'])}")
            st.write(f"**Resolution:** {video_info['size'][0]}x{video_info['size'][1]}")
        with col2:
            st.write(f"**FPS:** {video_info['fps']:.2f}")
            st.write(f"**Aspect Ratio:** {video_info['aspect_ratio']:.2f}")
            st.write(f"**Has Audio:** {'Yes' if video_info['has_audio'] else 'No'}")
        st.markdown('</div>', unsafe_allow_html=True)

def create_interactive_timeline(video_path, video_duration, container_key="timeline"):
    """Create an interactive video timeline with scrubbing capabilities."""
    
    # Encode the video path for URL usage
    import base64
    import urllib.parse
    
    # Read video file and create data URL
    try:
        with open(video_path, 'rb') as video_file:
            video_data = video_file.read()
            video_base64 = base64.b64encode(video_data).decode()
            video_data_url = f"data:video/mp4;base64,{video_base64}"
    except:
        # Fallback to file path
        video_data_url = video_path
    
    # Initialize session state for timeline values
    if f"{container_key}_start" not in st.session_state:
        st.session_state[f"{container_key}_start"] = 0.0
    if f"{container_key}_end" not in st.session_state:
        st.session_state[f"{container_key}_end"] = video_duration
    
    html_component = f"""
    <div class="timeline-container">
        <video id="timelineVideo_{container_key}" width="100%" height="300" controls preload="metadata"
               style="border-radius: 8px; margin-bottom: 15px;">
            <source src="{video_data_url}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
        
        <div class="timeline-controls">
            <button class="timeline-button" onclick="setStartTime_{container_key}()">📍 Set Start Point</button>
            <button class="timeline-button" onclick="setEndTime_{container_key}()">🎯 Set End Point</button>
            <button class="timeline-button" onclick="playSegment_{container_key}()">▶️ Preview Segment</button>
            <button class="timeline-button" onclick="resetSelection_{container_key}()">🔄 Reset</button>
        </div>
        
        <div class="timeline-info">
            <div>Current Time: <span id="currentTime_{container_key}">00:00</span> / {format_time(video_duration)}</div>
            <div style="margin-top: 5px;">
                <span style="color: #28a745;">Start: <span id="startTime_{container_key}">00:00</span></span> | 
                <span style="color: #dc3545;">End: <span id="endTime_{container_key}">{format_time(video_duration)}</span></span> | 
                <span style="color: #007bff;">Duration: <span id="segmentDuration_{container_key}">{format_time(video_duration)}</span></span>
            </div>
        </div>
        
        <!-- Visual Timeline Slider -->
        <div style="margin: 20px 0;">
            <label style="font-weight: bold; color: #28a745;">Start Time:</label>
            <input type="range" id="startSlider_{container_key}" min="0" max="{video_duration}" 
                   value="{st.session_state.get(f'{container_key}_start', 0)}" step="0.1" 
                   style="width: 100%; margin: 5px 0;"
                   oninput="updateStartFromSlider_{container_key}(this.value)">
            
            <label style="font-weight: bold; color: #dc3545;">End Time:</label>
            <input type="range" id="endSlider_{container_key}" min="0" max="{video_duration}" 
                   value="{st.session_state.get(f'{container_key}_end', video_duration)}" step="0.1" 
                   style="width: 100%; margin: 5px 0;"
                   oninput="updateEndFromSlider_{container_key}(this.value)">
        </div>
        
        <div style="text-align: center; margin: 10px 0;">
            <button class="timeline-button" onclick="applySelection_{container_key}()" 
                    style="background-color: #28a745; font-size: 16px; padding: 10px 20px;">
                ✅ Apply Selection
            </button>
        </div>
    </div>
    
    <script>
        (function() {{
            const video = document.getElementById('timelineVideo_{container_key}');
            const currentTimeSpan = document.getElementById('currentTime_{container_key}');
            const startTimeSpan = document.getElementById('startTime_{container_key}');
            const endTimeSpan = document.getElementById('endTime_{container_key}');
            const durationSpan = document.getElementById('segmentDuration_{container_key}');
            const startSlider = document.getElementById('startSlider_{container_key}');
            const endSlider = document.getElementById('endSlider_{container_key}');
            
            let startTime = {st.session_state.get(f'{container_key}_start', 0)};
            let endTime = {st.session_state.get(f'{container_key}_end', video_duration)};
            
            function formatTime(seconds) {{
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
            }}
            
            function updateDisplay() {{
                startTimeSpan.textContent = formatTime(startTime);
                endTimeSpan.textContent = formatTime(endTime);
                const duration = endTime - startTime;
                durationSpan.textContent = duration > 0 ? formatTime(duration) : '--';
                startSlider.value = startTime;
                endSlider.value = endTime;
            }}
            
            video.addEventListener('timeupdate', function() {{
                currentTimeSpan.textContent = formatTime(video.currentTime);
            }});
            
            video.addEventListener('loadedmetadata', function() {{
                updateDisplay();
            }});
            
            window.setStartTime_{container_key} = function() {{
                startTime = video.currentTime;
                if (endTime <= startTime) {{
                    endTime = Math.min(startTime + 1, {video_duration});
                }}
                updateDisplay();
            }};
            
            window.setEndTime_{container_key} = function() {{
                endTime = video.currentTime;
                if (startTime >= endTime) {{
                    startTime = Math.max(endTime - 1, 0);
                }}
                updateDisplay();
            }};
            
            window.updateStartFromSlider_{container_key} = function(value) {{
                startTime = parseFloat(value);
                if (endTime <= startTime) {{
                    endTime = Math.min(startTime + 1, {video_duration});
                }}
                updateDisplay();
                video.currentTime = startTime;
            }};
            
            window.updateEndFromSlider_{container_key} = function(value) {{
                endTime = parseFloat(value);
                if (startTime >= endTime) {{
                    startTime = Math.max(endTime - 1, 0);
                }}
                updateDisplay();
                video.currentTime = endTime;
            }};
            
            window.playSegment_{container_key} = function() {{
                video.currentTime = startTime;
                video.play();
                
                const checkTime = function() {{
                    if (video.currentTime >= endTime) {{
                        video.pause();
                        video.removeEventListener('timeupdate', checkTime);
                    }}
                }};
                video.addEventListener('timeupdate', checkTime);
            }};
            
            window.resetSelection_{container_key} = function() {{
                startTime = 0;
                endTime = {video_duration};
                updateDisplay();
                video.currentTime = 0;
            }};
            
            window.applySelection_{container_key} = function() {{
                // Store values in a way that can be accessed by Streamlit
                const event = new CustomEvent('timelineUpdate', {{
                    detail: {{
                        container: '{container_key}',
                        startTime: startTime,
                        endTime: endTime
                    }}
                }});
                document.dispatchEvent(event);
                
                // Visual feedback
                const button = event.target || document.querySelector('button[onclick="applySelection_{container_key}()"]');
                const originalText = button.textContent;
                button.textContent = '✅ Applied!';
                button.style.backgroundColor = '#28a745';
                setTimeout(() => {{
                    button.textContent = originalText;
                    button.style.backgroundColor = '#28a745';
                }}, 1000);
            }};
            
            // Initialize display
            updateDisplay();
        }})();
    </script>
    """
    
    return html_component

def render_timeline_component(video_path, video_duration, container_key="timeline"):
    """Render a fully Streamlit-native timeline with sliders and buttons."""
    import streamlit as st
    
    # Initialize session state for timeline values
    if f"{container_key}_start" not in st.session_state:
        st.session_state[f"{container_key}_start"] = 0.0
    if f"{container_key}_end" not in st.session_state:
        st.session_state[f"{container_key}_end"] = video_duration
    
    st.markdown("**🎬 Interactive Timeline Control**")
    st.markdown("*Use the video player and timeline sliders below to select your segment. All controls are fully interactive!*\n")
    
    # Video preview
    st.video(video_path)
    
    # Timeline slider
    slider_col = st.container()
    with slider_col:
        start, end = st.slider(
            "Select Start and End Time",
            min_value=0.0,
            max_value=video_duration,
            value=(st.session_state[f"{container_key}_start"], st.session_state[f"{container_key}_end"]),
            step=0.1,
            format="%.1f",
            key=f"{container_key}_slider",
            help="Drag the handles to set start and end times."
        )
        # Update session state for start/end only
        st.session_state[f"{container_key}_start"] = start
        st.session_state[f"{container_key}_end"] = end
    
    # Visual feedback
    st.markdown(f"""
    <div style='background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #28a745;'>
        <div style='font-weight: bold; font-size: 16px; margin-bottom: 8px;'>📝 Current Selection:</div>
        <div style='font-size: 18px;'>
            <span style='color: #28a745; font-weight: bold;'>{format_time(start)}</span> →
            <span style='color: #dc3545; font-weight: bold;'>{format_time(end)}</span>
        </div>
        <div style='font-size: 14px; color: #666; margin-top: 5px;'>
            Duration: <span style='font-weight: bold;'>{format_time(end - start)}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # Timeline control buttons
    col1, col2, col3, col4 = st.columns([1,1,1,1])
    with col1:
        if st.button("📍 Set Start to Current", key=f"{container_key}_set_start"):
            st.session_state[f"{container_key}_start"] = start
            st.success(f"Start set to {format_time(start)}")
            st.experimental_rerun()
    with col2:
        if st.button("🎯 Set End to Current", key=f"{container_key}_set_end"):
            st.session_state[f"{container_key}_end"] = end
            st.success(f"End set to {format_time(end)}")
            st.experimental_rerun()
    with col3:
        if st.button("▶️ Preview Selection", key=f"{container_key}_preview"):
            st.info(f"Previewing: {format_time(start)} → {format_time(end)}")
            # (Optional: Could implement preview logic if using a custom video player)
    with col4:
        if st.button("🔄 Reset", key=f"{container_key}_reset"):
            st.session_state[f"{container_key}_start"] = 0.0
            st.session_state[f"{container_key}_end"] = video_duration
            st.success("Reset to full video.")
            st.experimental_rerun()
    
    # Quick preset buttons
    st.markdown("**⚡ Quick Presets**")
    preset_col1, preset_col2, preset_col3 = st.columns(3)
    with preset_col1:
        if st.button("⏮️ First 30s", key=f"{container_key}_first30"):
            st.session_state[f"{container_key}_start"] = 0.0
            st.session_state[f"{container_key}_end"] = min(30.0, video_duration)
            st.success("Selected first 30 seconds.")
            st.experimental_rerun()
    with preset_col2:
        if st.button("🎯 Middle 30s", key=f"{container_key}_middle30"):
            start_p = max(0, video_duration/2 - 15)
            end_p = min(video_duration, video_duration/2 + 15)
            st.session_state[f"{container_key}_start"] = start_p
            st.session_state[f"{container_key}_end"] = end_p
            st.success("Selected middle 30 seconds.")
            st.experimental_rerun()
    with preset_col3:
        if st.button("⏭️ Last 30s", key=f"{container_key}_last30"):
            st.session_state[f"{container_key}_start"] = max(0, video_duration - 30)
            st.session_state[f"{container_key}_end"] = video_duration
            st.success("Selected last 30 seconds.")
            st.experimental_rerun()
    
    # Return current session state values
    return st.session_state[f"{container_key}_start"], st.session_state[f"{container_key}_end"]

# Main header
st.markdown('<h1 class="main-header">🎬 Video Processor Studio</h1>', unsafe_allow_html=True)

# Sidebar for main video upload
st.sidebar.header("📁 Upload Main Video")
main_video_file = st.sidebar.file_uploader(
    "Choose your main video file",
    type=['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'],
    key="main_video"
)

# Process main video upload
main_video_path = None
if main_video_file is not None:
    main_video_path = save_uploaded_file(main_video_file, "temp")
    st.session_state.main_video_info = st.session_state.processor.get_video_info(main_video_path)
    
    st.sidebar.success(f"✅ Uploaded: {main_video_file.name}")
    
    # Display video info in sidebar
    if st.session_state.main_video_info:
        with st.sidebar.expander("📊 Video Details"):
            st.write(f"Duration: {format_time(st.session_state.main_video_info['duration'])}")
            st.write(f"Size: {st.session_state.main_video_info['size'][0]}x{st.session_state.main_video_info['size'][1]}")
            st.write(f"FPS: {st.session_state.main_video_info['fps']:.1f}")

# Main content area
if main_video_path is None:
    st.markdown("""
    <div class="feature-box">
        <h2>🚀 Welcome to Video Processor Studio!</h2>
        <p>Upload a video file using the sidebar to get started with:</p>
        <ul>
            <li>📱 <strong>Aspect Ratio Conversion</strong> - Convert between different aspect ratios (9:16, 16:9, 1:1, etc.)</li>
            <li>✂️ <strong>Time-based Cropping</strong> - Trim your video to specific time segments</li>
            <li>🎯 <strong>CTA Video Appending</strong> - Add call-to-action clips to the end of your videos</li>
            <li>⬇️ <strong>Easy Download</strong> - Download your processed videos instantly</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
else:
    # Main interface tabs
    tab1, tab2, tab3 = st.tabs(["🎬 Video Preview & Info", "⚙️ Processing Options", "📥 Download Results"])
    
    with tab1:
        col1, col2 = st.columns([2, 1])
        
        with col1:
            st.subheader("📹 Main Video Preview")
            st.video(main_video_path)
        
        with col2:
            display_video_info(st.session_state.main_video_info, "Main Video Information")
    
    with tab2:
        st.subheader("⚙️ Video Processing Options")
        
        # Processing options in columns
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown('<div class="feature-box">', unsafe_allow_html=True)
            st.subheader("✂️ Time Cropping")
            
            # Initialize start_time and end_time with default values or from session state
            # This ensures they have a value even if main_video_info is not initially available
            # or if render_timeline_component is not called immediately.
            initial_start_time = 0.0
            initial_end_time = None # Will be set to max_duration if video info is available
            
            if st.session_state.main_video_info:
                initial_end_time = st.session_state.main_video_info.get('duration', 0.0)

            # These will hold the values from the timeline component
            # and will be used for processing
            timeline_start_time, timeline_end_time = initial_start_time, initial_end_time
            
            if st.session_state.main_video_info:
                max_duration = st.session_state.main_video_info['duration']
                initial_end_time = max_duration # Update initial_end_time if not already set
            
                st.write("**🎬 Interactive Timeline Control**")
                st.write("Use the video player below to scrub through your video and set precise start/end points:")
                
                # Use the new interactive timeline component - always available
                # Assign its return values to timeline_start_time and timeline_end_time
                timeline_start_time, timeline_end_time = render_timeline_component(
                    main_video_path, 
                    max_duration, 
                    "main_timeline"
                )
                
                # Show current selection - ACTUAL values that will be used for processing  
                if timeline_start_time is not None and timeline_end_time is not None and timeline_start_time < timeline_end_time:
                    duration = timeline_end_time - timeline_start_time
                    st.success(f"✅ **Selected Segment:** {format_time(timeline_start_time)} to {format_time(timeline_end_time)} (Duration: {format_time(duration)})")
                    
                    # Add the copy-paste friendly display the user requested
                    st.info(f"📋 **Copy-Paste Values:** Start: {timeline_start_time:.1f}s | End: {timeline_end_time:.1f}s | Duration: {duration:.1f}s")
                    
                    # Add debug information
                    with st.expander("🔍 Debug Information", expanded=False):
                        st.code(f"""
Debug Info for Backend Processing:
- Start Time: {timeline_start_time} seconds
- End Time: {timeline_end_time} seconds  
- Duration: {duration} seconds
- Video Total Duration: {max_duration} seconds
                        """)
                else:
                    st.info("👆 Use the timeline controls above to select your video segment")
                
                # Show a clear warning about the workflow
                st.markdown("---")
                st.markdown("""
                **🔄 How to Use:**
                1. **Play/scrub** the video player to find your desired start time
                2. **Use sliders or buttons** to set start/end points
                3. **Use preset buttons** (First 30s, Middle 30s, Last 30s) for quick selection
                4. **Enable time cropping below** to actually apply these settings during processing
                """)
                
                # Time cropping enable/disable checkbox comes AFTER timeline selection
                st.markdown("---")
                enable_time_crop = st.checkbox(
                    "✂️ **Apply Time Cropping During Processing**", 
                    help="Check this to actually crop the video to your selected time range during processing"
                )
                
                if enable_time_crop:
                    if timeline_start_time is not None and timeline_end_time is not None and timeline_start_time < timeline_end_time:
                        st.success(f"✅ **Will crop video from {timeline_start_time:.1f}s to {timeline_end_time:.1f}s during processing**")
                    else:
                        st.warning("⚠️ Please select a valid time range above to enable time cropping")
                        enable_time_crop = False
                else:
                    st.info("ℹ️ Time cropping is disabled. The full video will be processed (but you can still see your selection above)")
            else:
                enable_time_crop = st.checkbox("Enable time-based cropping", disabled=True)
                st.info("Upload a video first to access timeline controls")
            
            st.markdown('</div>', unsafe_allow_html=True)
        
        with col2:
            st.markdown('<div class="feature-box">', unsafe_allow_html=True)
            st.subheader("📱 Aspect Ratio Conversion")
            
            enable_ratio_change = st.checkbox("Enable aspect ratio conversion")
            target_ratio = None
            resize_method = 'crop'
            pad_color = (0, 0, 0)  # Default black
            
            if enable_ratio_change:
                # Preset ratios
                ratio_options = {
                    "9:16 (Portrait/TikTok/Stories)": (9, 16),
                    "16:9 (Landscape/YouTube)": (16, 9),
                    "1:1 (Square/Instagram)": (1, 1),
                    "4:3 (Traditional TV)": (4, 3),
                    "4:5 (Instagram Portrait)": (4, 5),
                    "Custom": "custom"
                }
                
                selected_ratio = st.selectbox("Choose aspect ratio", list(ratio_options.keys()))
                
                if ratio_options[selected_ratio] == "custom":
                    col_w, col_h = st.columns(2)
                    with col_w:
                        custom_width = st.number_input("Width ratio", min_value=1, max_value=32, value=16)
                    with col_h:
                        custom_height = st.number_input("Height ratio", min_value=1, max_value=32, value=9)
                    target_ratio = (custom_width, custom_height)
                else:
                    target_ratio = ratio_options[selected_ratio]
                
                # Resize method
                resize_method = st.selectbox(
                    "Resize method",
                    ["crop", "pad", "stretch"],
                    help="Crop: May lose content but maintains quality\nPad: Adds letterbox/pillarbox\nStretch: May cause distortion"
                )
                
                # Letterbox options (only for pad method)
                blur_background = False
                
                if resize_method == "pad":
                    st.markdown("**🎬 Letterbox Options**")
                    
                    # Blur background toggle
                    blur_background = st.checkbox(
                        "🌫️ Use blurred background", 
                        value=False,
                        help="Creates a cinematic effect by using a blurred version of your video as background instead of solid color"
                    )
                    
                    if blur_background:
                        st.info("✨ **Blurred background enabled!** This creates a professional cinematic effect perfect for social media platforms.")
                        
                        # Check if current and target aspect ratios match
                        if st.session_state.main_video_info:
                            current_w, current_h = st.session_state.main_video_info['size']
                            current_ratio = current_w / current_h
                            target_ratio_decimal = target_ratio[0] / target_ratio[1] if target_ratio else 1.0
                            
                            st.write("**🔍 Aspect Ratio Check:**")
                            col_curr, col_targ = st.columns(2)
                            with col_curr:
                                st.write(f"**Current:** {current_w}×{current_h} ({current_ratio:.2f}:1)")
                            with col_targ:
                                st.write(f"**Target:** {target_ratio[0]}:{target_ratio[1]} ({target_ratio_decimal:.2f}:1)")
                            
                            if abs(current_ratio - target_ratio_decimal) < 0.01:
                                st.warning("⚠️ **Same Aspect Ratio:** Your video is already in the target aspect ratio. No padding will be added, so the blur effect won't be applied.")
                                st.info("💡 **Try:** Convert to 9:16 (portrait) or 1:1 (square) to see the blur effect!")
                            else:
                                st.success("✅ **Perfect!** Aspect ratios are different. Blur background effect will be applied during letterboxing.")
                    else:
                        # Only show color picker if blur background is disabled
                        pad_color_hex = st.color_picker("Padding color", "#000000")
                        # Convert hex to RGB
                        pad_color = tuple(int(pad_color_hex[i:i+2], 16) for i in (1, 3, 5))
                else:
                    # Ensure variables are defined even when not using pad method
                    blur_background = False
                    pad_color = (0, 0, 0)
            
            st.markdown('</div>', unsafe_allow_html=True)
        
        # CTA Video section
        st.markdown('<div class="feature-box">', unsafe_allow_html=True)
        st.subheader("🎯 Call-to-Action Video")
        
        # Quality Settings section (NEW)
        st.markdown('<div class="feature-box">', unsafe_allow_html=True)
        st.subheader("🎨 Quality Settings")
        
        quality_preset = st.selectbox(
            "Video Quality",
            ["lossless", "high", "medium", "low"],
            index=1,  # Default to 'high'
            help="""
            • **Lossless**: No quality loss (largest file size, slowest processing)
            • **High**: Near-lossless quality (CRF 18, recommended for most use cases)
            • **Medium**: Good quality (CRF 23, smaller file size)  
            • **Low**: Lower quality (CRF 28, smallest file size, fastest processing)
            """
        )
        
        # Show quality details
        quality_details = {
            "lossless": "🔴 No quality loss • CRF 0 • Largest files • Slowest processing",
            "high": "🟡 Near-lossless • CRF 18 • Recommended for most users",
            "medium": "🟠 Good quality • CRF 23 • Balanced size/quality",
            "low": "🟢 Lower quality • CRF 28 • Smallest files • Fastest processing"
        }
        
        st.info(f"**Selected:** {quality_details[quality_preset]}")
        
        if quality_preset == "lossless":
            st.warning("⚠️ Lossless encoding will result in very large files and slow processing times.")
        
        st.markdown('</div>', unsafe_allow_html=True)
        
        enable_cta = st.checkbox("Append CTA video")
        cta_video_path = None
        
        if enable_cta:
            cta_video_file = st.file_uploader(
                "Choose CTA video file",
                type=['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv'],
                key="cta_video"
            )
            
            if cta_video_file is not None:
                cta_video_path = save_uploaded_file(cta_video_file, "temp")
                st.session_state.cta_video_info = st.session_state.processor.get_video_info(cta_video_path)
                
                st.success(f"✅ CTA video uploaded: {cta_video_file.name}")
                
                # Show CTA video info and preview
                col_cta1, col_cta2 = st.columns([1, 1])
                with col_cta1:
                    if st.session_state.cta_video_info:
                        display_video_info(st.session_state.cta_video_info, "CTA Video Information")
                
                with col_cta2:
                    st.write("**CTA Video Preview:**")
                    st.video(cta_video_path)
        
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Process button
        st.markdown("---")
        
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            if st.button("🚀 Process Video", type="primary", use_container_width=True):
                if not any([enable_time_crop, enable_ratio_change, enable_cta]):
                    st.warning("Please enable at least one processing option.")
                else:
                    # Process the video
                    output_filename = f"processed_{int(time.time())}.mp4"
                    output_path = os.path.join("temp", output_filename)
                    
                    # Debug info for processing parameters
                    st.write("🔍 **Processing with these parameters:**")
                    debug_info = {
                        "Enable Time Crop": enable_time_crop,
                        "Start Time": timeline_start_time if enable_time_crop else "Not enabled",
                        "End Time": timeline_end_time if enable_time_crop else "Not enabled", 
                        "Enable Ratio Change": enable_ratio_change,
                        "Target Ratio": target_ratio if enable_ratio_change else "Not enabled",
                        "Resize Method": resize_method if enable_ratio_change else "Not enabled",
                        "Enable CTA": enable_cta,
                        "CTA Path": cta_video_path if enable_cta else "Not enabled",
                        "Quality Preset": quality_preset
                    }
                    
                    for key, value in debug_info.items():
                        st.text(f"• {key}: {value}")
                    
                    with st.spinner("Processing video... This may take a while."):
                        success = st.session_state.processor.process_video_complete(
                            input_path=main_video_path,
                            output_path=output_path,
                            cta_video_path=cta_video_path if enable_cta else None,
                            start_time=timeline_start_time if enable_time_crop else None,
                            end_time=timeline_end_time if enable_time_crop else None,
                            target_ratio=target_ratio if enable_ratio_change else None,
                            resize_method=resize_method,
                            pad_color=pad_color,
                            blur_background=blur_background if enable_ratio_change and resize_method == "pad" else False,
                            quality_preset=quality_preset
                        )
                    
                    if success:
                        st.session_state.processed_video_path = output_path
                        st.markdown('<div class="success-message">✅ Video processed successfully!</div>', unsafe_allow_html=True)
                        st.balloons()
                    else:
                        st.markdown('<div class="error-message">❌ Error processing video. Please check your inputs and try again.</div>', unsafe_allow_html=True)
    
    with tab3:
        st.subheader("📥 Download Processed Video")
        
        if st.session_state.processed_video_path and os.path.exists(st.session_state.processed_video_path):
            col1, col2 = st.columns([2, 1])
            
            with col1:
                st.subheader("🎬 Processed Video Preview")
                st.video(st.session_state.processed_video_path)
            
            with col2:
                # Get processed video info
                processed_info = st.session_state.processor.get_video_info(st.session_state.processed_video_path)
                display_video_info(processed_info, "Processed Video Information")
                
                # Download button
                with open(st.session_state.processed_video_path, "rb") as file:
                    st.download_button(
                        label="📥 Download Processed Video",
                        data=file.read(),
                        file_name=f"processed_video_{int(time.time())}.mp4",
                        mime="video/mp4",
                        type="primary",
                        use_container_width=True
                    )
        else:
            st.info("No processed video available. Process a video first in the 'Processing Options' tab.")

# Footer
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #666; padding: 1rem;">
    🎬 Video Processor Studio - Transform your videos with ease!<br>
    Supports MP4, AVI, MOV, MKV, WMV, FLV formats
</div>
""", unsafe_allow_html=True)

# Cleanup old temporary files on app restart
def cleanup_temp_files():
    """Clean up old temporary files."""
    try:
        temp_dir = "temp"
        if os.path.exists(temp_dir):
            for file in os.listdir(temp_dir):
                file_path = os.path.join(temp_dir, file)
                if os.path.isfile(file_path):
                    # Remove files older than 1 hour
                    if time.time() - os.path.getmtime(file_path) > 3600:
                        os.remove(file_path)
    except Exception as e:
        pass  # Ignore cleanup errors

# Run cleanup
cleanup_temp_files() 