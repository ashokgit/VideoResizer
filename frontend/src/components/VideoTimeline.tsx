import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Slider,
    Paper,
    IconButton,
    Tooltip,
    TextField,
    InputAdornment,
    Stack,
    Grid,
    LinearProgress,
    Chip,
    Divider
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    SkipPrevious as SkipPreviousIcon,
    SkipNext as SkipNextIcon,
    Fullscreen as FullscreenIcon,
    VolumeUp as VolumeIcon,
    Replay as ReplayIcon
} from '@mui/icons-material';
import { VideoInfo } from '../types';

interface VideoTimelineProps {
    videoInfo: VideoInfo;
    fileId: string;
    startTime: number;
    endTime: number;
    onTimeChange: (startTime: number, endTime: number) => void;
    disabled?: boolean;
}

const VideoTimeline: React.FC<VideoTimelineProps> = ({
    videoInfo,
    fileId,
    startTime,
    endTime,
    onTimeChange,
    disabled = false
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(startTime);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
    const [previewProgress, setPreviewProgress] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const duration = videoInfo.duration;
    const selectedRange: [number, number] = [startTime, endTime];
    const selectionDuration = endTime - startTime;

    // Format time in MM:SS format
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const padZero = (num: number): string => num < 10 ? `0${num}` : `${num}`;
        return `${padZero(mins)}:${padZero(secs)}`;
    };

    // Generate thumbnails for the timeline
    const generateThumbnails = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsGeneratingThumbnails(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const thumbnailCount = 10;
        const interval = duration / thumbnailCount;
        const newThumbnails: string[] = [];

        canvas.width = 120;
        canvas.height = 68;

        try {
            for (let i = 0; i < thumbnailCount; i++) {
                const time = i * interval;
                video.currentTime = time;

                await new Promise((resolve) => {
                    video.addEventListener('seeked', resolve, { once: true });
                });

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataURL = canvas.toDataURL('image/jpeg', 0.7);
                newThumbnails.push(dataURL);
            }

            setThumbnails(newThumbnails);
        } catch (error) {
            console.error('Error generating thumbnails:', error);
        } finally {
            setIsGeneratingThumbnails(false);
        }
    }, [duration]);

    // Handle video load
    const handleVideoLoad = () => {
        generateThumbnails();
    };

    // Handle preview play/pause
    const handlePlayPause = () => {
        if (!previewVideoRef.current) return;

        if (isPlaying) {
            previewVideoRef.current.pause();
        } else {
            previewVideoRef.current.currentTime = startTime;
            previewVideoRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    // Handle replay of selection
    const handleReplay = () => {
        if (!previewVideoRef.current) return;
        previewVideoRef.current.currentTime = startTime;
        previewVideoRef.current.play();
        setIsPlaying(true);
    };

    // Handle range slider change
    const handleRangeChange = (_: Event, newValue: number | number[]) => {
        if (Array.isArray(newValue) && newValue.length === 2) {
            const [newStart, newEnd] = newValue;
            onTimeChange(newStart, newEnd);
            // Update preview video time
            if (previewVideoRef.current && !isPlaying) {
                previewVideoRef.current.currentTime = newStart;
            }
        }
    };

    // Handle manual time input
    const handleStartTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(event.target.value) || 0;
        const clampedValue = Math.max(0, Math.min(value, endTime - 0.1));
        onTimeChange(clampedValue, endTime);
        if (previewVideoRef.current && !isPlaying) {
            previewVideoRef.current.currentTime = clampedValue;
        }
    };

    const handleEndTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(event.target.value) || duration;
        const clampedValue = Math.min(duration, Math.max(value, startTime + 0.1));
        onTimeChange(startTime, clampedValue);
    };

    // Handle timeline click to seek
    const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickRatio = clickX / rect.width;
        const clickTime = startTime + (clickRatio * selectionDuration);

        if (previewVideoRef.current) {
            previewVideoRef.current.currentTime = Math.max(startTime, Math.min(endTime, clickTime));
        }
    };

    // Update current time and preview progress
    useEffect(() => {
        if (!previewVideoRef.current) return;

        const video = previewVideoRef.current;
        const updateTime = () => {
            const time = video.currentTime;
            setCurrentTime(time);

            // Calculate progress within selection
            if (time >= startTime && time <= endTime) {
                const progress = ((time - startTime) / selectionDuration) * 100;
                setPreviewProgress(progress);
            }

            // Stop playing if we've reached the end time
            if (time >= endTime) {
                video.pause();
                setIsPlaying(false);
                setPreviewProgress(100);
            }
        };

        video.addEventListener('timeupdate', updateTime);
        video.addEventListener('play', () => setIsPlaying(true));
        video.addEventListener('pause', () => setIsPlaying(false));
        video.addEventListener('ended', () => setIsPlaying(false));

        return () => {
            video.removeEventListener('timeupdate', updateTime);
            video.removeEventListener('play', () => setIsPlaying(true));
            video.removeEventListener('pause', () => setIsPlaying(false));
            video.removeEventListener('ended', () => setIsPlaying(false));
        };
    }, [startTime, endTime, selectionDuration]);

    return (
        <Paper elevation={3} sx={{ p: 3, backgroundColor: '#fafafa', borderRadius: 2 }}>
            {/* Hidden video element for thumbnail generation */}
            <video
                ref={videoRef}
                src={`/api/preview/${fileId}`}
                style={{ display: 'none' }}
                onLoadedData={handleVideoLoad}
                preload="metadata"
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                🎬 Timeline Editor
                <Chip
                    label={`${formatTime(selectionDuration)} selected`}
                    color="primary"
                    size="small"
                    variant="outlined"
                />
            </Typography>

            <Grid container spacing={3}>
                {/* Preview Player */}
                <Grid item xs={12} md={5}>
                    <Paper elevation={2} sx={{ p: 2, backgroundColor: '#000', borderRadius: 2 }}>
                        <Typography variant="subtitle2" color="white" gutterBottom>
                            Preview Selection
                        </Typography>
                        <Box sx={{ position: 'relative', aspectRatio: '16/9', borderRadius: 1, overflow: 'hidden' }}>
                            <video
                                ref={previewVideoRef}
                                src={`/api/preview/${fileId}`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    backgroundColor: '#000'
                                }}
                                preload="metadata"
                            />

                            {/* Preview Controls Overlay */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                    p: 1
                                }}
                            >
                                <LinearProgress
                                    variant="determinate"
                                    value={previewProgress}
                                    sx={{
                                        mb: 1,
                                        height: 4,
                                        backgroundColor: 'rgba(255,255,255,0.3)',
                                        '& .MuiLinearProgress-bar': {
                                            backgroundColor: '#1976d2'
                                        }
                                    }}
                                />

                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <IconButton
                                        onClick={handlePlayPause}
                                        disabled={disabled}
                                        sx={{ color: 'white' }}
                                        size="small"
                                    >
                                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                    </IconButton>

                                    <IconButton
                                        onClick={handleReplay}
                                        disabled={disabled}
                                        sx={{ color: 'white' }}
                                        size="small"
                                    >
                                        <ReplayIcon />
                                    </IconButton>

                                    <Typography variant="caption" sx={{ color: 'white', ml: 'auto' }}>
                                        {formatTime(currentTime - startTime)} / {formatTime(selectionDuration)}
                                    </Typography>
                                </Stack>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>

                {/* Timeline Controls */}
                <Grid item xs={12} md={7}>
                    {/* Thumbnail Timeline */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Video Timeline
                        </Typography>

                        {isGeneratingThumbnails && (
                            <Box sx={{ mb: 2 }}>
                                <LinearProgress />
                                <Typography variant="caption" color="text.secondary">
                                    Generating timeline preview...
                                </Typography>
                            </Box>
                        )}

                        <Box sx={{ position: 'relative' }}>
                            <Box
                                onClick={handleTimelineClick}
                                sx={{
                                    display: 'flex',
                                    height: 80,
                                    backgroundColor: '#e0e0e0',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    border: '2px solid transparent',
                                    transition: 'border-color 0.2s',
                                    '&:hover': {
                                        borderColor: '#1976d2'
                                    }
                                }}
                            >
                                {thumbnails.map((thumbnail, index) => (
                                    <Box
                                        key={index}
                                        sx={{
                                            flex: 1,
                                            backgroundImage: `url(${thumbnail})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            borderRight: '1px solid #ccc'
                                        }}
                                    />
                                ))}

                                {/* Selection overlay */}
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: `${(startTime / duration) * 100}%`,
                                        width: `${((endTime - startTime) / duration) * 100}%`,
                                        height: '100%',
                                        backgroundColor: 'rgba(25, 118, 210, 0.3)',
                                        border: '2px solid #1976d2',
                                        borderRadius: 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                />

                                {/* Current time indicator */}
                                {currentTime >= startTime && currentTime <= endTime && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: `${(currentTime / duration) * 100}%`,
                                            width: 2,
                                            height: '100%',
                                            backgroundColor: '#ff4444',
                                            zIndex: 10,
                                            boxShadow: '0 0 4px rgba(255,68,68,0.8)'
                                        }}
                                    />
                                )}
                            </Box>

                            {/* Time markers */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 1 }}>
                                {Array.from({ length: 6 }, (_, i) => (
                                    <Typography key={i} variant="caption" color="text.secondary">
                                        {formatTime((duration / 5) * i)}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Range Slider */}
                    <Box sx={{ mb: 3, px: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Selection Range
                        </Typography>
                        <Slider
                            value={selectedRange}
                            onChange={handleRangeChange}
                            valueLabelDisplay="auto"
                            valueLabelFormat={formatTime}
                            min={0}
                            max={duration}
                            step={0.1}
                            disabled={disabled}
                            sx={{
                                '& .MuiSlider-track': {
                                    backgroundColor: '#1976d2',
                                    height: 8
                                },
                                '& .MuiSlider-thumb': {
                                    backgroundColor: '#1976d2',
                                    width: 24,
                                    height: 24,
                                    '&::before': {
                                        boxShadow: '0 2px 12px 0 rgba(25,118,210,0.4)'
                                    },
                                    '&:hover, &.Mui-focusVisible': {
                                        boxShadow: '0 0 0 8px rgba(25,118,210,0.16)'
                                    }
                                },
                                '& .MuiSlider-valueLabel': {
                                    backgroundColor: '#1976d2'
                                }
                            }}
                        />
                    </Box>

                    {/* Controls and Manual Input */}
                    <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        {/* Playback Controls */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip title="Jump to start">
                                <IconButton
                                    onClick={() => {
                                        if (previewVideoRef.current) {
                                            previewVideoRef.current.currentTime = startTime;
                                        }
                                    }}
                                    disabled={disabled}
                                    size="small"
                                    color="primary"
                                >
                                    <SkipPreviousIcon />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title={isPlaying ? "Pause" : "Play selection"}>
                                <IconButton
                                    onClick={handlePlayPause}
                                    disabled={disabled}
                                    color="primary"
                                    sx={{
                                        bgcolor: isPlaying ? 'primary.main' : 'transparent',
                                        color: isPlaying ? 'white' : 'primary.main',
                                        '&:hover': {
                                            bgcolor: isPlaying ? 'primary.dark' : 'primary.light'
                                        }
                                    }}
                                >
                                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Jump to end">
                                <IconButton
                                    onClick={() => {
                                        if (previewVideoRef.current) {
                                            previewVideoRef.current.currentTime = endTime;
                                        }
                                    }}
                                    disabled={disabled}
                                    size="small"
                                    color="primary"
                                >
                                    <SkipNextIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        {/* Manual Time Inputs */}
                        <TextField
                            label="Start"
                            type="number"
                            value={startTime.toFixed(1)}
                            onChange={handleStartTimeChange}
                            disabled={disabled}
                            size="small"
                            inputProps={{ step: 0.1, min: 0, max: duration }}
                            InputProps={{
                                endAdornment: <InputAdornment position="end">s</InputAdornment>,
                            }}
                            sx={{ width: 100 }}
                        />

                        <TextField
                            label="End"
                            type="number"
                            value={endTime.toFixed(1)}
                            onChange={handleEndTimeChange}
                            disabled={disabled}
                            size="small"
                            inputProps={{ step: 0.1, min: 0, max: duration }}
                            InputProps={{
                                endAdornment: <InputAdornment position="end">s</InputAdornment>,
                            }}
                            sx={{ width: 100 }}
                        />

                        {/* Selection Info */}
                        <Box sx={{ ml: 'auto' }}>
                            <Typography variant="body2" color="primary" fontWeight="bold">
                                Selection: {formatTime(selectionDuration)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {formatTime(startTime)} → {formatTime(endTime)}
                            </Typography>
                        </Box>
                    </Stack>
                </Grid>
            </Grid>
        </Paper>
    );
};

export default VideoTimeline; 