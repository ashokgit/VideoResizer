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
    // Theme
    const theme = useTheme();

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ariaLiveRef = useRef<HTMLDivElement>(null);

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(startTime);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
    const [previewProgress, setPreviewProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredThumb, setHoveredThumb] = useState<'start' | 'end' | null>(null);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [ariaAnnouncement, setAriaAnnouncement] = useState('');

    // Computed values
    const duration = videoInfo.duration;
    const selectedRange: [number, number] = [startTime, endTime];
    const selectionDuration = endTime - startTime;

    // Utility functions
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const padZero = (num: number): string => num < 10 ? `0${num}` : `${num}`;
        return `${padZero(mins)}:${padZero(secs)}`;
    };

    const formatTimePrecise = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        const padZero = (num: number): string => num < 10 ? `0${num}` : `${num}`;
        return `${padZero(mins)}:${secs.padStart(4, '0')}`;
    };

    // Thumbnail Generation
    const generateThumbnails = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsGeneratingThumbnails(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const thumbnailCount = 12;
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

    const handleVideoLoad = () => {
        generateThumbnails();
    };

    // Event Handlers
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

    const handleReplay = () => {
        if (!previewVideoRef.current) return;
        previewVideoRef.current.currentTime = startTime;
        previewVideoRef.current.play();
        setIsPlaying(true);
    };

    const handleRangeChange = (_: Event, newValue: number | number[]) => {
        if (Array.isArray(newValue) && newValue.length === 2) {
            const [newStart, newEnd] = newValue;
            onTimeChange(newStart, newEnd);
            if (previewVideoRef.current && !isPlaying) {
                previewVideoRef.current.currentTime = newStart;
            }
        }
    };

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

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        let handled = false;
        if (event.key === ' ') {
            handlePlayPause();
            handled = true;
        } else if (event.key === 'ArrowLeft') {
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

    // Effects
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

    useEffect(() => {
        if (!previewVideoRef.current) return;

        const video = previewVideoRef.current;
        const updateTime = () => {
            const time = video.currentTime;
            setCurrentTime(time);

            if (time >= startTime && time <= endTime) {
                const progress = ((time - startTime) / selectionDuration) * 100;
                setPreviewProgress(progress);
            }

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

    useEffect(() => {
        setAriaAnnouncement(isPlaying ? 'Playing selection' : 'Paused');
    }, [isPlaying]);

    useEffect(() => {
        setAriaAnnouncement(`Current time: ${formatTimePrecise(currentTime)}`);
    }, [currentTime]);

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



                <Grid container spacing={4}>
                    {/* Enhanced Preview Player - Full Width */}
                    <Grid item xs={12}>
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
                                                <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                                                    {formatTimePrecise(currentTime >= startTime ? currentTime - startTime : 0)}
                                                    <Typography component="span" variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', ml: 1 }}>
                                                        / {formatTime(selectionDuration)}
                                                    </Typography>
                                                </Typography>
                                            </Stack>
                                        </Box>
                                    </Fade>
                                </Box>
                            </Box>
                        </Card>
                    </Grid>

                    {/* Timeline and Controls Section - Full Width */}
                    <Grid item xs={12}>
                        <Card
                            elevation={2}
                            sx={{
                                p: 3,
                                borderRadius: 2,
                                background: alpha(theme.palette.grey[50], 0.8)
                            }}
                        >
                            {/* Thumbnails Timeline */}
                            <Box sx={{ mb: 4 }}>
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
                                            }
                                        }}
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
                                                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.4)}, ${alpha(theme.palette.secondary.main, 0.4)})`,
                                                    border: `3px solid ${theme.palette.primary.main}`,
                                                    borderRadius: 1,
                                                }}
                                            />

                                            {/* Current time indicator */}
                                            {currentTime >= startTime && currentTime <= endTime && (
                                                <Box
                                                    onMouseDown={handlePlayheadMouseDown}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: -2,
                                                        left: `${(currentTime / duration) * 100}%`,
                                                        width: 4,
                                                        height: 'calc(100% + 4px)',
                                                        background: theme.palette.error.main,
                                                        zIndex: 10,
                                                        cursor: 'ew-resize',
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    </Card>
                                </Box>

                                {/* Playback Controls */}
                                <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                    <ButtonGroup variant="contained" size="large">
                                        <Tooltip title="Previous Frame">
                                            <IconButton onClick={() => {
                                                if (previewVideoRef.current) {
                                                    previewVideoRef.current.currentTime = Math.max(startTime, currentTime - 1 / 30);
                                                }
                                            }}>
                                                <SkipPreviousIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={isPlaying ? "Pause" : "Play"}>
                                            <IconButton
                                                onClick={handlePlayPause}
                                                sx={{
                                                    bgcolor: isPlaying ? theme.palette.secondary.main : theme.palette.primary.main,
                                                    '&:hover': {
                                                        bgcolor: isPlaying ? theme.palette.secondary.dark : theme.palette.primary.dark,
                                                    }
                                                }}
                                            >
                                                {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Next Frame">
                                            <IconButton onClick={() => {
                                                if (previewVideoRef.current) {
                                                    previewVideoRef.current.currentTime = Math.min(endTime, currentTime + 1 / 30);
                                                }
                                            }}>
                                                <SkipNextIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </ButtonGroup>
                                    <Tooltip title="Replay Selection">
                                        <IconButton onClick={handleReplay}>
                                            <ReplayIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>

                                {/* Time Selection Controls */}
                                {/* Range Slider */}
                                <Box sx={{ mb: 3 }}>
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
                                <Box sx={{ mt: 4, px: 2 }}>
                                    <Grid container spacing={3} alignItems="center">
                                        <Grid item xs={12} sm={6}>
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
                                                                    <IconButton
                                                                        onClick={handleSetStartTime}
                                                                        disabled={disabled}
                                                                        size="small"
                                                                        sx={{ color: theme.palette.primary.main }}
                                                                    >
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
                                                <Typography variant="body2" color="text.secondary">
                                                    to
                                                </Typography>
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
                                                                    <IconButton
                                                                        onClick={handleSetEndTime}
                                                                        disabled={disabled}
                                                                        size="small"
                                                                        sx={{ color: theme.palette.primary.main }}
                                                                    >
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
                                        <Grid item xs={12} sm={6}>
                                            <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
                                                <Chip
                                                    icon={<ScheduleIcon />}
                                                    label={`Duration: ${formatTime(selectionDuration)}`}
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
                                        </Grid>
                                    </Grid>
                                </Box>

                                {/* Time Markers */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                                    {Array.from({ length: 7 }, (_, i) => (
                                        <Typography
                                            key={i}
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontWeight: 'medium' }}
                                        >
                                            {formatTime((duration / 6) * i)}
                                        </Typography>
                                    ))}
                                </Box>
                            </Box>
                        </Card>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

export default VideoTimeline; 