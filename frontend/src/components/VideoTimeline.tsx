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
    Divider,
    Card,
    CardContent,
    ButtonGroup,
    Fade,
    useTheme,
    alpha,
    Button
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    SkipPrevious as SkipPreviousIcon,
    SkipNext as SkipNextIcon,
    Fullscreen as FullscreenIcon,
    VolumeUp as VolumeIcon,
    Replay as ReplayIcon,
    ContentCut as CutIcon,
    Schedule as ScheduleIcon,
    VerticalAlignBottom as SetStartIcon,
    VerticalAlignTop as SetEndIcon
} from '@mui/icons-material';
import { VideoInfo } from '../types';

interface VideoTimelineProps {
    videoInfo: VideoInfo;
    fileId: string;
    startTime: number;
    endTime: number;
    onTimeChange: (startTime: number, endTime: number) => void;
    disabled?: boolean;
    fullWidth?: boolean;
}

const VideoTimeline: React.FC<VideoTimelineProps> = ({
    videoInfo,
    fileId,
    startTime,
    endTime,
    onTimeChange,
    disabled = false,
    fullWidth = false
}) => {
    const theme = useTheme();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(startTime);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
    const [previewProgress, setPreviewProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredThumb, setHoveredThumb] = useState<'start' | 'end' | null>(null);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ariaAnnouncement, setAriaAnnouncement] = useState('');
    const ariaLiveRef = useRef<HTMLDivElement>(null);

    const duration = videoInfo.duration;
    const selectedRange: [number, number] = [startTime, endTime];
    const selectionDuration = endTime - startTime;

    // Format time in MM:SS format with enhanced formatting
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const padZero = (num: number): string => num < 10 ? `0${num}` : `${num}`;
        return `${padZero(mins)}:${padZero(secs)}`;
    };

    // Format time with milliseconds for precise display
    const formatTimePrecise = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        const padZero = (num: number): string => num < 10 ? `0${num}` : `${num}`;
        return `${padZero(mins)}:${secs.padStart(4, '0')}`;
    };

    // Enhanced thumbnail generation with better error handling
    const generateThumbnails = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsGeneratingThumbnails(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const thumbnailCount = 12; // Increased for better timeline resolution
        const interval = duration / thumbnailCount;
        const newThumbnails: string[] = [];

        canvas.width = 120;
        canvas.height = 68;

        try {
            for (let i = 0; i < thumbnailCount; i++) {
                const time = i * interval;
                video.currentTime = time;

                await new Promise((resolve) => {
                    const handleSeeked = () => {
                        video.removeEventListener('seeked', handleSeeked);
                        resolve(void 0);
                    };
                    video.addEventListener('seeked', handleSeeked);

                    // Timeout fallback
                    setTimeout(resolve, 100);
                });

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataURL = canvas.toDataURL('image/jpeg', 0.8);
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

    // Enhanced preview play/pause with better state management
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

    // Enhanced range slider change with drag feedback
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

    // Enhanced manual time input with validation
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

    const handleSetStartTime = () => {
        if (previewVideoRef.current) {
            const newStartTime = previewVideoRef.current.currentTime;
            if (newStartTime < endTime) {
                onTimeChange(newStartTime, endTime);
            }
        }
    };

    const handleSetEndTime = () => {
        if (previewVideoRef.current) {
            const newEndTime = previewVideoRef.current.currentTime;
            if (newEndTime > startTime) {
                onTimeChange(startTime, newEndTime);
            }
        }
    };

    // Enhanced timeline click with better precision
    const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickRatio = clickX / rect.width;
        const clickTime = clickRatio * duration;

        if (previewVideoRef.current && !isDraggingPlayhead) {
            previewVideoRef.current.currentTime = Math.max(0, Math.min(duration, clickTime));
            setCurrentTime(previewVideoRef.current.currentTime);
        }
    };

    const handlePlayheadMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        setIsDraggingPlayhead(true);
    };

    const handlePlayheadMouseMove = useCallback((event: MouseEvent) => {
        if (isDraggingPlayhead && previewVideoRef.current) {
            const timelineElement = event.currentTarget as HTMLElement;
            const timelineBar = document.getElementById('timeline-bar');
            if (!timelineBar) return;

            const rect = timelineBar.getBoundingClientRect();
            let moveX = event.clientX - rect.left;
            moveX = Math.max(0, Math.min(moveX, rect.width));
            const moveRatio = moveX / rect.width;
            const newTime = moveRatio * duration;

            previewVideoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    }, [isDraggingPlayhead, duration]);

    const handlePlayheadMouseUp = useCallback(() => {
        if (isDraggingPlayhead) {
            setIsDraggingPlayhead(false);
        }
    }, [isDraggingPlayhead]);

    useEffect(() => {
        if (isDraggingPlayhead) {
            document.addEventListener('mousemove', handlePlayheadMouseMove);
            document.addEventListener('mouseup', handlePlayheadMouseUp);
        } else {
            document.removeEventListener('mousemove', handlePlayheadMouseMove);
            document.removeEventListener('mouseup', handlePlayheadMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handlePlayheadMouseMove);
            document.removeEventListener('mouseup', handlePlayheadMouseUp);
        };
    }, [isDraggingPlayhead, handlePlayheadMouseMove, handlePlayheadMouseUp]);

    // Update current time and preview progress with enhanced logic
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
            if (time >= endTime && isPlaying) {
                video.pause();
                setIsPlaying(false);
                setPreviewProgress(100);
            }
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

        video.addEventListener('timeupdate', updateTime);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', updateTime);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
        };
    }, [startTime, endTime, selectionDuration, isPlaying]);

    // Announce play/pause and time changes
    useEffect(() => {
        setAriaAnnouncement(isPlaying ? 'Playing selection' : 'Paused');
    }, [isPlaying]);

    useEffect(() => {
        setAriaAnnouncement(`Current time: ${formatTimePrecise(currentTime)}`);
    }, [currentTime]);

    // Keyboard navigation for timeline and controls
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        let handled = false;
        if (event.key === ' ') {
            handlePlayPause();
            handled = true;
        } else if (event.key === 'ArrowLeft') {
            // Move playhead or selection left
            if (previewVideoRef.current) {
                previewVideoRef.current.currentTime = Math.max(0, previewVideoRef.current.currentTime - 1);
            }
            handled = true;
        } else if (event.key === 'ArrowRight') {
            if (previewVideoRef.current) {
                previewVideoRef.current.currentTime = Math.min(duration, previewVideoRef.current.currentTime + 1);
            }
            handled = true;
        } else if (event.key === 'Home') {
            if (previewVideoRef.current) {
                previewVideoRef.current.currentTime = startTime;
            }
            handled = true;
        } else if (event.key === 'End') {
            if (previewVideoRef.current) {
                previewVideoRef.current.currentTime = endTime;
            }
            handled = true;
        }
        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    return (
        <Card
            elevation={8}
            sx={{
                background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.04)}, ${alpha(theme.palette.secondary.main, 0.04)})`,
                borderRadius: 3,
                overflow: 'visible',
                position: 'relative',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    borderRadius: '12px 12px 0 0'
                }
            }}
            tabIndex={0}
            aria-label="Video timeline editor"
            onKeyDown={handleKeyDown}
        >
            {/* ARIA live region for announcements */}
            <Box ref={ariaLiveRef} sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} aria-live="polite">
                {ariaAnnouncement}
            </Box>
            <CardContent sx={{ p: 4 }}>
                {/* Hidden video element for thumbnail generation */}
                <video
                    ref={videoRef}
                    src={`/api/preview/${fileId}`}
                    style={{ display: 'none' }}
                    onLoadedData={handleVideoLoad}
                    preload="metadata"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Enhanced Header */}
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{
                            p: 1.5,
                            borderRadius: 2,
                            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                            color: 'white'
                        }}>
                            <CutIcon />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight="bold" color="text.primary">
                                Timeline Editor
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Trim and preview your video selection
                            </Typography>
                        </Box>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                            icon={<ScheduleIcon />}
                            label={`${formatTime(selectionDuration)} selected`}
                            color="primary"
                            variant="outlined"
                            sx={{
                                fontWeight: 'bold',
                                background: alpha(theme.palette.primary.main, 0.1)
                            }}
                        />
                        <Chip
                            label={`${Math.round((selectionDuration / duration) * 100)}% of video`}
                            size="small"
                            variant="outlined"
                            color="secondary"
                        />
                    </Stack>
                </Box>

                <Grid container spacing={4}>
                    {/* Enhanced Preview Player */}
                    <Grid item xs={12} lg={7}>
                        <Card
                            elevation={4}
                            sx={{
                                background: '#000',
                                borderRadius: 2,
                                overflow: 'hidden',
                                position: 'relative'
                            }}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        position: 'absolute',
                                        top: 16,
                                        left: 16,
                                        color: 'white',
                                        zIndex: 10,
                                        background: 'rgba(0,0,0,0.7)',
                                        px: 2,
                                        py: 0.5,
                                        borderRadius: 1,
                                        backdropFilter: 'blur(4px)'
                                    }}
                                >
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

                                    {/* Enhanced Preview Controls Overlay */}
                                    <Fade in={true}>
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                                p: 2,
                                                backdropFilter: 'blur(8px)'
                                            }}
                                        >
                                            <LinearProgress
                                                variant="determinate"
                                                value={previewProgress}
                                                sx={{
                                                    mb: 2,
                                                    height: 6,
                                                    borderRadius: 3,
                                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                                    '& .MuiLinearProgress-bar': {
                                                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                                        borderRadius: 3
                                                    }
                                                }}
                                            />

                                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                <ButtonGroup variant="contained" size="small">
                                                    <Tooltip title="Play/Pause selection">
                                                        <IconButton
                                                            onClick={handlePlayPause}
                                                            disabled={disabled}
                                                            sx={{
                                                                bgcolor: isPlaying ? theme.palette.secondary.main : theme.palette.primary.main,
                                                                color: 'white',
                                                                transform: 'scale(1.1)',
                                                                '&:hover': {
                                                                    bgcolor: isPlaying ? theme.palette.secondary.dark : theme.palette.primary.dark
                                                                }
                                                            }}
                                                        >
                                                            {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                                        </IconButton>
                                                    </Tooltip>

                                                    <Tooltip title="Replay selection">
                                                        <IconButton
                                                            onClick={handleReplay}
                                                            disabled={disabled}
                                                            sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }}
                                                        >
                                                            <ReplayIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </ButtonGroup>

                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                                                        {formatTimePrecise(currentTime >= startTime ? currentTime - startTime : 0)}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                                        / {formatTime(selectionDuration)}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Box>
                                    </Fade>
                                </Box>
                            </Box>
                        </Card>
                    </Grid>

                    {/* Enhanced Timeline Controls */}
                    <Grid item xs={12} lg={5}>
                        {/* Enhanced Thumbnail Timeline */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                                Video Timeline
                            </Typography>

                            {isGeneratingThumbnails && (
                                <Fade in={isGeneratingThumbnails}>
                                    <Box sx={{ mb: 3 }}>
                                        <LinearProgress
                                            sx={{
                                                height: 6,
                                                borderRadius: 3,
                                                '& .MuiLinearProgress-bar': {
                                                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
                                                }
                                            }}
                                        />
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                            Generating timeline preview...
                                        </Typography>
                                    </Box>
                                </Fade>
                            )}

                            <Box sx={{ position: 'relative' }}>
                                <Card
                                    elevation={2}
                                    onClick={handleTimelineClick}
                                    sx={{
                                        cursor: 'pointer',
                                        border: '2px solid transparent',
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                                        '&:hover': {
                                            borderColor: theme.palette.primary.main,
                                            boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
                                            transform: 'scale(1.01)',
                                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                        },
                                        outline: 'none',
                                        '&:focus': {
                                            borderColor: theme.palette.secondary.main,
                                            boxShadow: `0 0 0 3px ${alpha(theme.palette.secondary.main, 0.3)}`,
                                        }
                                    }}
                                    tabIndex={0}
                                    aria-label="Video timeline, use left/right arrows to scrub, space to play/pause"
                                    onKeyDown={handleKeyDown}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            height: 90,
                                            backgroundColor: '#f5f5f5',
                                            position: 'relative',
                                        }}
                                        id="timeline-bar"
                                    >
                                        {thumbnails.map((thumbnail, index) => (
                                            <Box
                                                key={index}
                                                sx={{
                                                    flex: 1,
                                                    backgroundImage: `url(${thumbnail})`,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                    borderRight: index < thumbnails.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                                                    transition: 'filter 0.2s ease',
                                                    filter: 'brightness(0.9)'
                                                }}
                                            />
                                        ))}

                                        {/* Enhanced Selection overlay */}
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: 0,
                                                left: `${(startTime / duration) * 100}%`,
                                                width: `${((endTime - startTime) / duration) * 100}%`,
                                                height: '100%',
                                                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.4)}, ${alpha(theme.palette.secondary.main, 0.4)})`,
                                                border: `3px solid ${theme.palette.primary.main}`,
                                                borderRadius: 1,
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                backdropFilter: 'brightness(1.2)',
                                                '&::before': {
                                                    content: '""',
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    width: 32,
                                                    height: 32,
                                                    background: alpha(theme.palette.primary.main, 0.9),
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }
                                            }}
                                        />

                                        {/* Enhanced Current time indicator */}
                                        {currentTime >= startTime && currentTime <= endTime && (
                                            <Box
                                                onMouseDown={handlePlayheadMouseDown}
                                                sx={{
                                                    position: 'absolute',
                                                    top: -2,
                                                    left: `${(currentTime / duration) * 100}%`,
                                                    width: 4,
                                                    height: 'calc(100% + 4px)',
                                                    background: `linear-gradient(180deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`,
                                                    zIndex: 10,
                                                    borderRadius: 2,
                                                    boxShadow: `0 0 12px ${alpha(theme.palette.error.main, 0.6)}`,
                                                    '&::before': {
                                                        content: '""',
                                                        position: 'absolute',
                                                        top: -8,
                                                        left: '50%',
                                                        transform: 'translateX(-50%)',
                                                        width: 12,
                                                        height: 12,
                                                        background: theme.palette.error.main,
                                                        borderRadius: '50%',
                                                        border: `2px solid white`,
                                                        boxShadow: `0 2px 8px ${alpha(theme.palette.error.main, 0.4)}`
                                                    }
                                                }}
                                            />
                                        )}
                                    </Box>
                                    <Box sx={{ px: 3, pt: 2, pb: 1 }}>
                                        <Slider
                                            value={selectedRange}
                                            onChange={handleRangeChange}
                                            onChangeCommitted={() => setIsDragging(false)}
                                            valueLabelDisplay="auto"
                                            valueLabelFormat={formatTimePrecise}
                                            min={0}
                                            max={duration}
                                            step={0.1}
                                            disabled={disabled}
                                            sx={{
                                                height: 16,
                                                '& .MuiSlider-track': {
                                                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                                    height: 16,
                                                    border: 'none',
                                                    borderRadius: 8
                                                },
                                                '& .MuiSlider-rail': {
                                                    backgroundColor: alpha(theme.palette.grey[700], 0.5),
                                                    height: 16,
                                                    borderRadius: 8
                                                },
                                                '& .MuiSlider-thumb': {
                                                    backgroundColor: theme.palette.background.paper,
                                                    width: 36,
                                                    height: 36,
                                                    border: `4px solid ${theme.palette.primary.main}`,
                                                    boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                                                    '&::before': {
                                                        boxShadow: 'none'
                                                    },
                                                    '&:hover, &.Mui-focusVisible': {
                                                        boxShadow: `0 0 0 16px ${alpha(theme.palette.primary.main, 0.16)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                                                    },
                                                    '&.Mui-active': {
                                                        boxShadow: `0 0 0 24px ${alpha(theme.palette.primary.main, 0.2)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                                                    }
                                                },
                                                '& .MuiSlider-valueLabel': {
                                                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                                    borderRadius: 2,
                                                    fontWeight: 'bold',
                                                    fontSize: '0.875rem',
                                                    '&::before': {
                                                        borderTopColor: theme.palette.primary.dark
                                                    }
                                                }
                                            }}
                                            aria-label="Select time range for trimming"
                                        />
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 1 }}>
                                        {Array.from({ length: 7 }, (_, i) => (
                                            <Typography
                                                key={i}
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{
                                                    fontWeight: 'medium',
                                                    background: alpha(theme.palette.background.paper, 0.8),
                                                    px: 1,
                                                    py: 0.5,
                                                    borderRadius: 1
                                                }}
                                            >
                                                {formatTime((duration / 6) * i)}
                                            </Typography>
                                        ))}
                                    </Box>
                                </Card>
                            </Box>
                        </Box>

                        <Box sx={{ mb: 4, px: 2 }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                                Selection Range
                            </Typography>
                            <Slider
                                value={selectedRange}
                                onChange={handleRangeChange}
                                onChangeCommitted={() => setIsDragging(false)}
                                valueLabelDisplay="auto"
                                valueLabelFormat={formatTimePrecise}
                                min={0}
                                max={duration}
                                step={0.1}
                                disabled={disabled}
                                sx={{
                                    height: 16,
                                    '& .MuiSlider-track': {
                                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                        height: 16,
                                        border: 'none',
                                        borderRadius: 8
                                    },
                                    '& .MuiSlider-rail': {
                                        backgroundColor: alpha(theme.palette.grey[700], 0.5),
                                        height: 16,
                                        borderRadius: 8
                                    },
                                    '& .MuiSlider-thumb': {
                                        backgroundColor: theme.palette.background.paper,
                                        width: 36,
                                        height: 36,
                                        border: `4px solid ${theme.palette.primary.main}`,
                                        boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                                        '&::before': {
                                            boxShadow: 'none'
                                        },
                                        '&:hover, &.Mui-focusVisible': {
                                            boxShadow: `0 0 0 16px ${alpha(theme.palette.primary.main, 0.16)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                                        },
                                        '&.Mui-active': {
                                            boxShadow: `0 0 0 24px ${alpha(theme.palette.primary.main, 0.2)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                                        }
                                    },
                                    '& .MuiSlider-valueLabel': {
                                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                        borderRadius: 2,
                                        fontWeight: 'bold',
                                        fontSize: '0.875rem',
                                        '&::before': {
                                            borderTopColor: theme.palette.primary.dark
                                        }
                                    }
                                }}
                                aria-label="Select time range for trimming"
                            />
                        </Box>

                        {/* Enhanced Controls */}
                        <Card elevation={2} sx={{ p: 3, borderRadius: 2, background: alpha(theme.palette.grey[50], 0.8) }}>
                            <Grid container spacing={3} alignItems="center">
                                {/* Enhanced Playback Controls */}
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                                        Playback Controls
                                    </Typography>
                                    <ButtonGroup variant="outlined" size="large">
                                        <Tooltip title="Jump to start">
                                            <IconButton
                                                onClick={() => {
                                                    if (previewVideoRef.current) {
                                                        previewVideoRef.current.currentTime = startTime;
                                                    }
                                                }}
                                                disabled={disabled}
                                                sx={{ borderColor: theme.palette.primary.main, color: theme.palette.primary.main }}
                                            >
                                                <SkipPreviousIcon />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title={isPlaying ? "Pause" : "Play selection"}>
                                            <IconButton
                                                onClick={handlePlayPause}
                                                disabled={disabled}
                                                sx={{
                                                    bgcolor: isPlaying ? theme.palette.primary.main : 'transparent',
                                                    color: isPlaying ? 'white' : theme.palette.primary.main,
                                                    borderColor: theme.palette.primary.main,
                                                    transform: 'scale(1.1)',
                                                    '&:hover': {
                                                        bgcolor: isPlaying ? theme.palette.primary.dark : alpha(theme.palette.primary.main, 0.1)
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
                                                sx={{ borderColor: theme.palette.primary.main, color: theme.palette.primary.main }}
                                            >
                                                <SkipNextIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </ButtonGroup>
                                </Grid>

                                {/* Enhanced Manual Time Inputs */}
                                <Grid item xs={12} sm={6}>
                                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                                        Precise Timing
                                    </Typography>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <TextField
                                            label="Start Time"
                                            type="number"
                                            value={startTime.toFixed(1)}
                                            onChange={handleStartTimeChange}
                                            disabled={disabled}
                                            size="small"
                                            inputProps={{ step: 0.1, min: 0, max: duration }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <Tooltip title="Set start to current time">
                                                            <IconButton onClick={handleSetStartTime} disabled={disabled} size="small">
                                                                <SetStartIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </InputAdornment>
                                                )
                                            }}
                                            sx={{
                                                minWidth: 120,
                                                '& .MuiOutlinedInput-root': {
                                                    '&:hover fieldset': {
                                                        borderColor: theme.palette.primary.main,
                                                    },
                                                    '&.Mui-focused fieldset': {
                                                        borderColor: theme.palette.primary.main,
                                                    }
                                                }
                                            }}
                                        />

                                        <TextField
                                            label="End Time"
                                            type="number"
                                            value={endTime.toFixed(1)}
                                            onChange={handleEndTimeChange}
                                            disabled={disabled}
                                            size="small"
                                            inputProps={{ step: 0.1, min: 0, max: duration }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <Tooltip title="Set end to current time">
                                                            <IconButton onClick={handleSetEndTime} disabled={disabled} size="small">
                                                                <SetEndIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </InputAdornment>
                                                )
                                            }}
                                            sx={{
                                                minWidth: 120,
                                                '& .MuiOutlinedInput-root': {
                                                    '&:hover fieldset': {
                                                        borderColor: theme.palette.primary.main,
                                                    },
                                                    '&.Mui-focused fieldset': {
                                                        borderColor: theme.palette.primary.main,
                                                    }
                                                }
                                            }}
                                        />
                                    </Stack>
                                </Grid>
                            </Grid>

                            {/* Enhanced Selection Info */}
                            <Divider sx={{ my: 2 }} />
                            <Grid container spacing={2}>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary">
                                        Selection Duration
                                    </Typography>
                                    <Typography variant="h6" color="primary" fontWeight="bold">
                                        {formatTime(selectionDuration)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary">
                                        Time Range
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium">
                                        {formatTime(startTime)} → {formatTime(endTime)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary">
                                        Video Coverage
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium" color="secondary">
                                        {Math.round((selectionDuration / duration) * 100)}%
                                    </Typography>
                                </Grid>
                                <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary">
                                        Total Duration
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium">
                                        {formatTime(duration)}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Card>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

export default VideoTimeline; 