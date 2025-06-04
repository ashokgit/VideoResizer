import React, { useState } from 'react';
import {
    Box,
    FormControlLabel,
    Checkbox,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Typography,
    Grid,
    Paper,
    Chip,
    Button,
    Divider,
    Stack,
    Card,
    CardContent,
    SelectChangeEvent,
    Switch,
    IconButton,
    Tooltip,
    Fade,
    useTheme,
    alpha,
    Badge,
    Alert,
    Slider
} from '@mui/material';
import {
    Settings as SettingsIcon,
    VideoSettings as VideoSettingsIcon,
    Crop as CropIcon,
    AspectRatio as AspectRatioIcon,
    HighQuality as QualityIcon,
    Image as WatermarkIcon,
    PlaylistAdd as CtaIcon,
    Info as InfoIcon,
    Check as CheckIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { ChromePicker } from 'react-color';
import VideoUpload from './VideoUpload';
import VideoTimeline from './VideoTimeline';
import AspectRatioPreview from './AspectRatioPreview';
import { VideoInfo, ProcessRequest, PreviewRequest } from '../types';

interface ProcessingOptionsProps {
    mainVideo: { fileId: string; info: VideoInfo; filename: string } | null;
    onCtaVideoUpload: (fileId: string, info: VideoInfo, filename: string) => void;
    onChange: (options: Partial<ProcessRequest>) => void;
    disabled: boolean;
}

// Aspect ratio presets with enhanced information
const ASPECT_RATIO_PRESETS = [
    { label: "9:16 (TikTok/Stories)", width: 9, height: 16, description: "Vertical mobile", icon: "📱", popular: true },
    { label: "16:9 (YouTube)", width: 16, height: 9, description: "Standard widescreen", icon: "🎬", popular: true },
    { label: "1:1 (Instagram Square)", width: 1, height: 1, description: "Perfect square", icon: "📷", popular: true },
    { label: "4:3 (Traditional TV)", width: 4, height: 3, description: "Classic format", icon: "📺", popular: false },
    { label: "4:5 (Instagram Portrait)", width: 4, height: 5, description: "Portrait posts", icon: "📸", popular: true },
    { label: "21:9 (Cinematic)", width: 21, height: 9, description: "Ultra-wide", icon: "🎭", popular: false },
    { label: "Custom", width: 0, height: 0, description: "Define your own", icon: "⚙️", popular: false }
];

const RESIZE_METHODS = [
    {
        value: 'crop',
        label: 'Smart Crop',
        description: 'Intelligently crops to maintain the most important content',
        icon: '✂️',
        recommended: true
    },
    {
        value: 'pad',
        label: 'Letterbox',
        description: 'Adds padding to preserve all content',
        icon: '📱',
        recommended: false
    },
    {
        value: 'stretch',
        label: 'Stretch',
        description: 'Stretches to fit - may cause distortion',
        icon: '📏',
        recommended: false
    }
];

const QUALITY_PRESETS = [
    { value: 'lossless', label: 'Lossless', description: 'Maximum quality, larger file size', icon: '💎' },
    { value: 'high', label: 'High Quality', description: 'Excellent quality, balanced size', icon: '⭐' },
    { value: 'medium', label: 'Medium', description: 'Good quality, smaller size', icon: '👍' },
    { value: 'low', label: 'Low', description: 'Basic quality, smallest size', icon: '📦' }
];

const WATERMARK_POSITIONS = [
    { value: 'top-left', label: 'Top Left', icon: '↖️' },
    { value: 'top-right', label: 'Top Right', icon: '↗️' },
    { value: 'bottom-left', label: 'Bottom Left', icon: '↙️' },
    { value: 'bottom-right', label: 'Bottom Right', icon: '↘️' },
    { value: 'center', label: 'Center', icon: '🎯' }
];

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({ mainVideo, onCtaVideoUpload, onChange, disabled }) => {
    const theme = useTheme();
    const [enableTimeCrop, setEnableTimeCrop] = useState(false);
    const [enableRatioChange, setEnableRatioChange] = useState(false);
    const [enableCta, setEnableCta] = useState(false);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);

    // Aspect ratio states
    const [selectedRatioPreset, setSelectedRatioPreset] = useState(0); // 9:16 by default
    const [customWidth, setCustomWidth] = useState(16);
    const [customHeight, setCustomHeight] = useState(9);
    const [resizeMethod, setResizeMethod] = useState<'crop' | 'pad' | 'stretch'>('crop');
    const [padColor, setPadColor] = useState<[number, number, number]>([0, 0, 0]);
    const [blurBackground, setBlurBackground] = useState(false);
    const [blurStrength, setBlurStrength] = useState(25);
    const [gradientBlend, setGradientBlend] = useState(0.3);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [ctaVideo, setCtaVideo] = useState<{ fileId: string; info: VideoInfo; filename: string } | null>(null);

    const [qualityPreset, setQualityPreset] = useState<'lossless' | 'high' | 'medium' | 'low'>('high');
    const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
    const [watermarkPosition, setWatermarkPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>('bottom-right');

    const updateOptions = (updates: Partial<ProcessRequest>) => {
        // Get current aspect ratio
        const currentPreset = ASPECT_RATIO_PRESETS[selectedRatioPreset];
        const targetRatio = currentPreset.label === "Custom"
            ? { width: customWidth, height: customHeight }
            : { width: currentPreset.width, height: currentPreset.height };

        onChange({
            enable_time_crop: enableTimeCrop,
            enable_ratio_change: enableRatioChange,
            enable_cta: enableCta,
            start_time: startTime,
            end_time: endTime,
            target_ratio: enableRatioChange ? targetRatio : undefined,
            resize_method: resizeMethod,
            pad_color: padColor,
            blur_background: blurBackground,
            blur_strength: blurStrength,
            gradient_blend: gradientBlend,
            cta_video_id: ctaVideo?.fileId,
            quality_preset: qualityPreset,
            watermark_file: watermarkFile,
            watermark_position: watermarkPosition,
            ...updates
        });
    };

    const handleTimeChange = (newStartTime: number, newEndTime: number) => {
        setStartTime(newStartTime);
        setEndTime(newEndTime);
        updateOptions({
            start_time: newStartTime,
            end_time: newEndTime
        });
    };

    const handleTimeCropToggle = (checked: boolean) => {
        setEnableTimeCrop(checked);
        if (checked && mainVideo) {
            setEndTime(mainVideo.info.duration);
            updateOptions({
                enable_time_crop: checked,
                end_time: mainVideo.info.duration
            });
        } else {
            updateOptions({ enable_time_crop: checked });
        }
    };

    const handleRatioChangeToggle = (checked: boolean) => {
        setEnableRatioChange(checked);
        updateOptions({ enable_ratio_change: checked });
    };

    const handleRatioPresetChange = (presetIndex: number) => {
        setSelectedRatioPreset(presetIndex);
        updateOptions({});
    };

    const handleResizeMethodChange = (method: 'crop' | 'pad' | 'stretch') => {
        setResizeMethod(method);
        // Reset blur background when not using pad method
        if (method !== 'pad') {
            setBlurBackground(false);
        }
        updateOptions({ resize_method: method });
    };

    const handleCtaToggle = (checked: boolean) => {
        setEnableCta(checked);
        updateOptions({ enable_cta: checked });
    };

    const handleCtaVideoUpload = (fileId: string, info: VideoInfo, filename: string) => {
        setCtaVideo({ fileId, info, filename });
        onCtaVideoUpload(fileId, info, filename);
        updateOptions({ cta_video_id: fileId });
    };

    const getCurrentAspectRatio = () => {
        if (!mainVideo) return "Unknown";
        const [width, height] = mainVideo.info.size;
        const ratio = width / height;
        return `${width}×${height} (${ratio.toFixed(2)}:1)`;
    };

    const getTargetAspectRatio = () => {
        const preset = ASPECT_RATIO_PRESETS[selectedRatioPreset];
        if (preset.label === "Custom") {
            return `${customWidth}×${customHeight} (${(customWidth / customHeight).toFixed(2)}:1)`;
        }
        return `${preset.width}:${preset.height} (${(preset.width / preset.height).toFixed(2)}:1)`;
    };

    const handleQualityChange = (event: SelectChangeEvent<'lossless' | 'high' | 'medium' | 'low'>) => {
        const value = event.target.value as 'lossless' | 'high' | 'medium' | 'low';
        setQualityPreset(value);
        updateOptions({ quality_preset: value });
    };

    const handleWatermarkChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setWatermarkFile(event.target.files[0]);
            updateOptions({ watermark_file: event.target.files[0] });
        }
    };

    const handleWatermarkPositionChange = (event: SelectChangeEvent<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'>) => {
        setWatermarkPosition(event.target.value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center');
        updateOptions({ watermark_position: event.target.value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' });
    };

    // Helper function to create preview request
    const createPreviewRequest = (): PreviewRequest => {
        const currentPreset = ASPECT_RATIO_PRESETS[selectedRatioPreset];
        const targetRatio = currentPreset.label === "Custom"
            ? { width: customWidth, height: customHeight }
            : { width: currentPreset.width, height: currentPreset.height };

        return {
            main_video_id: mainVideo?.fileId || '',
            target_ratio: targetRatio,
            resize_method: resizeMethod,
            pad_color: padColor,
            blur_background: blurBackground,
            blur_strength: blurStrength,
            gradient_blend: gradientBlend,
            enable_time_crop: enableTimeCrop,
            start_time: startTime
        };
    };

    return (
        <Box sx={{ mb: 4 }}>
            {/* Main Header */}
            <Card
                elevation={6}
                sx={{
                    mb: 4,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
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
            >

            </Card>

            {/* Time Cropping Section */}
            <Card
                elevation={4}
                sx={{
                    mb: 4,
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    border: enableTimeCrop ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                    '&:hover': {
                        borderColor: theme.palette.primary.main,
                        boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.2)}`
                    }
                }}
            >
                <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{
                                p: 1.5,
                                borderRadius: 2,
                                background: enableTimeCrop
                                    ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                                    : alpha(theme.palette.grey[400], 0.2),
                                color: enableTimeCrop ? 'white' : theme.palette.grey[600],
                                transition: 'all 0.3s ease'
                            }}>
                                <CropIcon />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight="bold" color="text.primary">
                                    Time Cropping
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Trim your video to specific time segments
                                </Typography>
                            </Box>
                        </Box>

                        <Switch
                            checked={enableTimeCrop}
                            onChange={(e) => handleTimeCropToggle(e.target.checked)}
                            disabled={disabled}
                            size="medium"
                            sx={{
                                '& .MuiSwitch-track': {
                                    backgroundColor: enableTimeCrop ? theme.palette.primary.main : alpha(theme.palette.grey[400], 0.3)
                                }
                            }}
                        />
                    </Box>

                    <Fade in={enableTimeCrop}>
                        <Box>
                            {enableTimeCrop && mainVideo && (
                                <>
                                    <VideoTimeline
                                        videoInfo={mainVideo.info}
                                        fileId={mainVideo.fileId}
                                        startTime={startTime}
                                        endTime={endTime || mainVideo.info.duration}
                                        onTimeChange={handleTimeChange}
                                        disabled={disabled}
                                        fullWidth={true}
                                    />
                                    <Box sx={{ mt: 4 }}>
                                        {/* Place controls and timing info here, using the freed-up space */}
                                    </Box>
                                </>
                            )}
                        </Box>
                    </Fade>
                </CardContent>
            </Card>

            {/* Aspect Ratio Section */}
            <Card
                elevation={4}
                sx={{
                    mb: 4,
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    border: enableRatioChange ? `2px solid ${theme.palette.secondary.main}` : '2px solid transparent',
                    '&:hover': {
                        borderColor: theme.palette.secondary.main,
                        boxShadow: `0 8px 32px ${alpha(theme.palette.secondary.main, 0.2)}`
                    }
                }}
            >
                <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{
                                p: 1.5,
                                borderRadius: 2,
                                background: enableRatioChange
                                    ? `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`
                                    : alpha(theme.palette.grey[400], 0.2),
                                color: enableRatioChange ? 'white' : theme.palette.grey[600],
                                transition: 'all 0.3s ease'
                            }}>
                                <AspectRatioIcon />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight="bold" color="text.primary">
                                    Aspect Ratio Conversion
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Optimize your video for different platforms and formats
                                </Typography>
                            </Box>
                        </Box>

                        <Switch
                            checked={enableRatioChange}
                            onChange={(e) => handleRatioChangeToggle(e.target.checked)}
                            disabled={disabled}
                            size="medium"
                            sx={{
                                '& .MuiSwitch-track': {
                                    backgroundColor: enableRatioChange ? theme.palette.secondary.main : alpha(theme.palette.grey[400], 0.3)
                                }
                            }}
                        />
                    </Box>

                    <Fade in={enableRatioChange}>
                        <Box>
                            {enableRatioChange && mainVideo && (
                                <Box>
                                    {/* Current vs Target Ratio Display */}
                                    <Grid container spacing={3} sx={{ mb: 4 }}>
                                        <Grid item xs={12} md={6}>
                                            <Card elevation={2} sx={{ p: 3, background: alpha(theme.palette.grey[100], 0.8), borderRadius: 2 }}>
                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                    Current Format
                                                </Typography>
                                                <Typography variant="h6" fontWeight="bold" color="text.primary">
                                                    {getCurrentAspectRatio()}
                                                </Typography>
                                                <Chip
                                                    label="Source"
                                                    size="small"
                                                    sx={{ mt: 1, background: alpha(theme.palette.grey[400], 0.2) }}
                                                />
                                            </Card>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Card elevation={2} sx={{ p: 3, background: alpha(theme.palette.secondary.main, 0.1), borderRadius: 2 }}>
                                                <Typography variant="subtitle2" color="secondary" gutterBottom>
                                                    Target Format
                                                </Typography>
                                                <Typography variant="h6" fontWeight="bold" color="secondary">
                                                    {getTargetAspectRatio()}
                                                </Typography>
                                                <Chip
                                                    label="Output"
                                                    size="small"
                                                    color="secondary"
                                                    sx={{ mt: 1 }}
                                                />
                                            </Card>
                                        </Grid>
                                    </Grid>

                                    {/* Enhanced Aspect Ratio Presets */}
                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                                        Choose Target Aspect Ratio
                                    </Typography>
                                    <Grid container spacing={2} sx={{ mb: 4 }}>
                                        {ASPECT_RATIO_PRESETS.map((preset, index) => (
                                            <Grid item xs={12} sm={6} md={4} key={index}>
                                                <Card
                                                    sx={{
                                                        cursor: 'pointer',
                                                        border: selectedRatioPreset === index
                                                            ? `3px solid ${theme.palette.secondary.main}`
                                                            : '2px solid transparent',
                                                        background: selectedRatioPreset === index
                                                            ? alpha(theme.palette.secondary.main, 0.1)
                                                            : 'white',
                                                        borderRadius: 2,
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        transform: selectedRatioPreset === index ? 'scale(1.02)' : 'scale(1)',
                                                        '&:hover': {
                                                            borderColor: theme.palette.secondary.main,
                                                            background: alpha(theme.palette.secondary.main, 0.05),
                                                            transform: 'scale(1.02)',
                                                            boxShadow: `0 8px 24px ${alpha(theme.palette.secondary.main, 0.2)}`
                                                        }
                                                    }}
                                                    onClick={() => handleRatioPresetChange(index)}
                                                >
                                                    <CardContent sx={{ p: 3 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                                                            <Typography variant="h6" sx={{ fontSize: '1.5rem' }}>
                                                                {preset.icon}
                                                            </Typography>
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                                                                    {preset.label}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {preset.description}
                                                                </Typography>
                                                            </Box>
                                                            {selectedRatioPreset === index && (
                                                                <CheckIcon
                                                                    sx={{
                                                                        color: theme.palette.secondary.main,
                                                                        background: 'white',
                                                                        borderRadius: '50%',
                                                                        p: 0.25
                                                                    }}
                                                                />
                                                            )}
                                                        </Box>

                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            {preset.width > 0 && (
                                                                <Chip
                                                                    label={`${preset.width}:${preset.height}`}
                                                                    size="small"
                                                                    color={selectedRatioPreset === index ? "secondary" : "default"}
                                                                    sx={{ fontWeight: 'bold' }}
                                                                />
                                                            )}
                                                            {preset.popular && (
                                                                <Chip
                                                                    label="Popular"
                                                                    size="small"
                                                                    color="primary"
                                                                    variant="outlined"
                                                                />
                                                            )}
                                                        </Stack>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>

                                    {/* Custom Ratio Inputs */}
                                    {selectedRatioPreset === ASPECT_RATIO_PRESETS.length - 1 && (
                                        <Fade in={true}>
                                            <Card elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2, background: alpha(theme.palette.warning.main, 0.05) }}>
                                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                                                    Custom Aspect Ratio
                                                </Typography>
                                                <Stack direction="row" spacing={3} alignItems="center">
                                                    <TextField
                                                        label="Width"
                                                        type="number"
                                                        value={customWidth}
                                                        onChange={(e) => {
                                                            setCustomWidth(Number(e.target.value));
                                                            updateOptions({});
                                                        }}
                                                        size="medium"
                                                        inputProps={{ min: 1, max: 100 }}
                                                        sx={{ minWidth: 120 }}
                                                    />
                                                    <Typography variant="h4" color="text.secondary" fontWeight="bold">:</Typography>
                                                    <TextField
                                                        label="Height"
                                                        type="number"
                                                        value={customHeight}
                                                        onChange={(e) => {
                                                            setCustomHeight(Number(e.target.value));
                                                            updateOptions({});
                                                        }}
                                                        size="medium"
                                                        inputProps={{ min: 1, max: 100 }}
                                                        sx={{ minWidth: 120 }}
                                                    />
                                                    <Chip
                                                        label={`Ratio: ${(customWidth / customHeight).toFixed(2)}:1`}
                                                        color="warning"
                                                        sx={{ fontWeight: 'bold' }}
                                                    />
                                                </Stack>
                                            </Card>
                                        </Fade>
                                    )}

                                    <Divider sx={{ my: 4 }} />

                                    {/* Enhanced Resize Method Selection */}
                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                                        Resize Method
                                    </Typography>
                                    <Grid container spacing={3} sx={{ mb: 4 }}>
                                        {RESIZE_METHODS.map((method) => (
                                            <Grid item xs={12} md={4} key={method.value}>
                                                <Card
                                                    sx={{
                                                        cursor: 'pointer',
                                                        border: resizeMethod === method.value
                                                            ? `3px solid ${theme.palette.primary.main}`
                                                            : '2px solid transparent',
                                                        background: resizeMethod === method.value
                                                            ? alpha(theme.palette.primary.main, 0.1)
                                                            : 'white',
                                                        borderRadius: 2,
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        position: 'relative',
                                                        '&:hover': {
                                                            borderColor: theme.palette.primary.main,
                                                            background: alpha(theme.palette.primary.main, 0.05),
                                                            transform: 'translateY(-4px)',
                                                            boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.2)}`
                                                        }
                                                    }}
                                                    onClick={() => handleResizeMethodChange(method.value as 'crop' | 'pad' | 'stretch')}
                                                >
                                                    {method.recommended && (
                                                        <Chip
                                                            label="Recommended"
                                                            color="success"
                                                            size="small"
                                                            sx={{
                                                                position: 'absolute',
                                                                top: 12,
                                                                right: 12,
                                                                fontWeight: 'bold',
                                                                zIndex: 1
                                                            }}
                                                        />
                                                    )}
                                                    <CardContent sx={{ p: 3 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                                            <Typography variant="h4">{method.icon}</Typography>
                                                            <Box>
                                                                <Typography variant="h6" fontWeight="bold" color="text.primary">
                                                                    {method.label}
                                                                </Typography>
                                                            </Box>
                                                            {resizeMethod === method.value && (
                                                                <CheckIcon
                                                                    sx={{
                                                                        color: theme.palette.primary.main,
                                                                        ml: 'auto'
                                                                    }}
                                                                />
                                                            )}
                                                        </Box>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {method.description}
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Grid>
                                        ))}
                                    </Grid>

                                    {/* Enhanced Pad Options */}
                                    {resizeMethod === 'pad' && (
                                        <Fade in={true}>
                                            <Card elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2, background: alpha(theme.palette.info.main, 0.05) }}>
                                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                                                    Letterbox Options
                                                </Typography>

                                                {/* Blur Background Toggle */}
                                                <Box sx={{ mb: 3 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                        <Box>
                                                            <Typography variant="subtitle1" fontWeight="bold">
                                                                🌫️ Blurred Background
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Use a blurred version of your video as background instead of solid color
                                                            </Typography>
                                                        </Box>
                                                        <Switch
                                                            checked={blurBackground}
                                                            onChange={(e) => {
                                                                setBlurBackground(e.target.checked);
                                                                updateOptions({ blur_background: e.target.checked });
                                                            }}
                                                            disabled={disabled}
                                                            size="medium"
                                                            sx={{
                                                                '& .MuiSwitch-track': {
                                                                    backgroundColor: blurBackground ? theme.palette.info.main : alpha(theme.palette.grey[400], 0.3)
                                                                }
                                                            }}
                                                        />
                                                    </Box>
                                                    {blurBackground && (
                                                        <Alert severity="info" sx={{ mt: 2 }}>
                                                            <Typography variant="body2">
                                                                <strong>Tip:</strong> The blurred background creates a professional cinematic effect,
                                                                perfect for social media platforms like TikTok and Instagram Stories!
                                                                <br /><br />
                                                                <strong>Note:</strong> Blurred background only works when the source and target aspect ratios are different,
                                                                requiring letterbox/pillarbox padding. If your video is already the target ratio, no padding will be added.
                                                            </Typography>
                                                        </Alert>
                                                    )}

                                                    {/* Blur Controls */}
                                                    {blurBackground && (
                                                        <Box sx={{ mt: 3, p: 3, backgroundColor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
                                                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                                                🎨 Blur & Effect Controls
                                                            </Typography>

                                                            {/* Blur Strength Slider */}
                                                            <Box sx={{ mb: 3 }}>
                                                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                                                    Blur Strength: {blurStrength} (1-50)
                                                                </Typography>
                                                                <Slider
                                                                    value={blurStrength}
                                                                    onChange={(_, value) => {
                                                                        setBlurStrength(value as number);
                                                                        updateOptions({ blur_strength: value as number });
                                                                    }}
                                                                    min={1}
                                                                    max={50}
                                                                    step={1}
                                                                    disabled={disabled}
                                                                    sx={{
                                                                        color: theme.palette.primary.main,
                                                                        '& .MuiSlider-thumb': {
                                                                            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`
                                                                        }
                                                                    }}
                                                                />
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Higher values = more blur effect
                                                                </Typography>
                                                            </Box>

                                                            {/* Gradient Blend Slider */}
                                                            <Box>
                                                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                                                    Gradient Blend: {(gradientBlend * 100).toFixed(0)}% (0-100%)
                                                                </Typography>
                                                                <Slider
                                                                    value={gradientBlend}
                                                                    onChange={(_, value) => {
                                                                        setGradientBlend(value as number);
                                                                        updateOptions({ gradient_blend: value as number });
                                                                    }}
                                                                    min={0.0}
                                                                    max={1.0}
                                                                    step={0.05}
                                                                    disabled={disabled}
                                                                    sx={{
                                                                        color: theme.palette.secondary.main,
                                                                        '& .MuiSlider-thumb': {
                                                                            boxShadow: `0 2px 8px ${alpha(theme.palette.secondary.main, 0.3)}`
                                                                        }
                                                                    }}
                                                                />
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Controls gradient bleeding effect - higher values create more artistic blending
                                                                </Typography>
                                                            </Box>

                                                            {/* Show current vs target ratio comparison for blur background */}
                                                            {blurBackground && mainVideo && (
                                                                <Box sx={{ mt: 2, p: 2, backgroundColor: alpha(theme.palette.info.main, 0.05), borderRadius: 1 }}>
                                                                    <Typography variant="caption" color="text.secondary" gutterBottom>
                                                                        <strong>Aspect Ratio Check:</strong>
                                                                    </Typography>
                                                                    <Grid container spacing={2}>
                                                                        <Grid item xs={6}>
                                                                            <Typography variant="body2">
                                                                                <strong>Current:</strong> {getCurrentAspectRatio()}
                                                                            </Typography>
                                                                        </Grid>
                                                                        <Grid item xs={6}>
                                                                            <Typography variant="body2">
                                                                                <strong>Target:</strong> {getTargetAspectRatio()}
                                                                            </Typography>
                                                                        </Grid>
                                                                    </Grid>
                                                                    {(() => {
                                                                        const [currentW, currentH] = mainVideo.info.size;
                                                                        const currentRatio = currentW / currentH;
                                                                        const preset = ASPECT_RATIO_PRESETS[selectedRatioPreset];
                                                                        const targetRatio = preset.label === "Custom"
                                                                            ? customWidth / customHeight
                                                                            : preset.width / preset.height;
                                                                        const ratiosMatch = Math.abs(currentRatio - targetRatio) < 0.01;

                                                                        return ratiosMatch ? (
                                                                            <Alert severity="warning" sx={{ mt: 1, fontSize: '0.85rem' }}>
                                                                                <strong>⚠️ Same Aspect Ratio:</strong> Your video is already in the target aspect ratio.
                                                                                No padding will be added, so the blur effect won't be applied.
                                                                                <br />
                                                                                <strong>💡 Try:</strong> Convert to 9:16 (portrait) or 1:1 (square) to see the blur effect!
                                                                            </Alert>
                                                                        ) : (
                                                                            <Alert severity="success" sx={{ mt: 1, fontSize: '0.85rem' }}>
                                                                                <strong>✅ Perfect!</strong> Aspect ratios are different. Blur background effect will be applied during letterboxing.
                                                                            </Alert>
                                                                        );
                                                                    })()}
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    )}
                                                </Box>

                                                {/* Padding Color (only shown when blur background is off) */}
                                                {!blurBackground && (
                                                    <Box>
                                                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                                                            Padding Color
                                                        </Typography>
                                                        <Stack direction="row" spacing={3} alignItems="center">
                                                            <Box
                                                                onClick={() => setShowColorPicker(!showColorPicker)}
                                                                sx={{
                                                                    width: 60,
                                                                    height: 60,
                                                                    backgroundColor: `rgb(${padColor[0]}, ${padColor[1]}, ${padColor[2]})`,
                                                                    border: '3px solid white',
                                                                    borderRadius: 2,
                                                                    cursor: 'pointer',
                                                                    boxShadow: `0 4px 16px ${alpha(theme.palette.grey[900], 0.2)}`,
                                                                    transition: 'all 0.3s ease',
                                                                    '&:hover': {
                                                                        transform: 'scale(1.1)',
                                                                        boxShadow: `0 8px 24px ${alpha(theme.palette.grey[900], 0.3)}`
                                                                    }
                                                                }}
                                                            />
                                                            <Box>
                                                                <Typography variant="body1" fontWeight="bold">
                                                                    Click to change color
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    RGB: {padColor[0]}, {padColor[1]}, {padColor[2]}
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                        {showColorPicker && (
                                                            <Box sx={{ mt: 3 }}>
                                                                <ChromePicker
                                                                    color={{ r: padColor[0], g: padColor[1], b: padColor[2] }}
                                                                    onChange={(color) => {
                                                                        const newColor: [number, number, number] = [color.rgb.r, color.rgb.g, color.rgb.b];
                                                                        setPadColor(newColor);
                                                                        updateOptions({ pad_color: newColor });
                                                                    }}
                                                                />
                                                            </Box>
                                                        )}
                                                    </Box>
                                                )}
                                            </Card>
                                        </Fade>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Fade>
                </CardContent>
            </Card>

            {/* Aspect Ratio Preview Section */}
            {mainVideo && (
                <Box sx={{ mb: 4 }}>
                    <AspectRatioPreview
                        mainVideoId={mainVideo.fileId}
                        previewRequest={createPreviewRequest()}
                        enabled={enableRatioChange}
                    />
                </Box>
            )}

            {/* CTA Video Section */}
            <Card
                elevation={4}
                sx={{
                    mb: 4,
                    borderRadius: 3,
                    transition: 'all 0.3s ease',
                    border: enableCta ? `2px solid ${theme.palette.warning.main}` : '2px solid transparent',
                    '&:hover': {
                        borderColor: theme.palette.warning.main,
                        boxShadow: `0 8px 32px ${alpha(theme.palette.warning.main, 0.2)}`
                    }
                }}
            >
                <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{
                                p: 1.5,
                                borderRadius: 2,
                                background: enableCta
                                    ? `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`
                                    : alpha(theme.palette.grey[400], 0.2),
                                color: enableCta ? 'white' : theme.palette.grey[600],
                                transition: 'all 0.3s ease'
                            }}>
                                <CtaIcon />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight="bold" color="text.primary">
                                    Call-to-Action Video
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Add a promotional video at the end
                                </Typography>
                            </Box>
                        </Box>

                        <Switch
                            checked={enableCta}
                            onChange={(e) => handleCtaToggle(e.target.checked)}
                            disabled={disabled}
                            size="medium"
                            sx={{
                                '& .MuiSwitch-track': {
                                    backgroundColor: enableCta ? theme.palette.warning.main : alpha(theme.palette.grey[400], 0.3)
                                }
                            }}
                        />
                    </Box>

                    <Fade in={enableCta}>
                        <Box>
                            {enableCta && (
                                <Card elevation={2} sx={{ p: 3, borderRadius: 2, background: alpha(theme.palette.warning.main, 0.05) }}>
                                    <VideoUpload
                                        onUpload={handleCtaVideoUpload}
                                        accept="video/*"
                                    />
                                    {ctaVideo && (
                                        <Box sx={{ mt: 2 }}>
                                            <Chip
                                                label={`CTA Video: ${ctaVideo.filename}`}
                                                color="warning"
                                                onDelete={() => {
                                                    setCtaVideo(null);
                                                    updateOptions({ cta_video_id: undefined });
                                                }}
                                                sx={{ fontWeight: 'bold' }}
                                            />
                                        </Box>
                                    )}
                                </Card>
                            )}
                        </Box>
                    </Fade>
                </CardContent>
            </Card>

            {/* Additional Options */}
            <Grid container spacing={4}>
                {/* Quality Settings */}
                <Grid item xs={12} md={6}>
                    <Card elevation={4} sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                <Box sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                                    color: 'white'
                                }}>
                                    <QualityIcon />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight="bold" color="text.primary">
                                        Quality Settings
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Choose your output quality
                                    </Typography>
                                </Box>
                            </Box>

                            <Grid container spacing={2}>
                                {QUALITY_PRESETS.map((quality) => (
                                    <Grid item xs={12} key={quality.value}>
                                        <Card
                                            sx={{
                                                cursor: 'pointer',
                                                border: qualityPreset === quality.value
                                                    ? `2px solid ${theme.palette.success.main}`
                                                    : '1px solid transparent',
                                                background: qualityPreset === quality.value
                                                    ? alpha(theme.palette.success.main, 0.1)
                                                    : 'white',
                                                borderRadius: 1,
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                    borderColor: theme.palette.success.main,
                                                    background: alpha(theme.palette.success.main, 0.05)
                                                }
                                            }}
                                            onClick={() => setQualityPreset(quality.value as 'lossless' | 'high' | 'medium' | 'low')}
                                        >
                                            <CardContent sx={{ p: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <Typography variant="h6">{quality.icon}</Typography>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                            {quality.label}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {quality.description}
                                                        </Typography>
                                                    </Box>
                                                    {qualityPreset === quality.value && (
                                                        <CheckIcon sx={{ color: theme.palette.success.main }} />
                                                    )}
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Watermark Settings */}
                <Grid item xs={12} md={6}>
                    <Card elevation={4} sx={{ borderRadius: 3, height: '100%' }}>
                        <CardContent sx={{ p: 4 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                                <Box sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
                                    color: 'white'
                                }}>
                                    <WatermarkIcon />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight="bold" color="text.primary">
                                        Watermark
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Add your brand logo
                                    </Typography>
                                </Box>
                            </Box>

                            <Stack spacing={3}>
                                <TextField
                                    fullWidth
                                    type="file"
                                    label="Upload Watermark"
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ accept: "image/*" }}
                                    onChange={handleWatermarkChange}
                                    disabled={disabled}
                                />

                                {watermarkFile && (
                                    <Box>
                                        <Chip
                                            label={`Watermark: ${watermarkFile.name}`}
                                            color="info"
                                            onDelete={() => {
                                                setWatermarkFile(null);
                                                updateOptions({ watermark_file: null });
                                            }}
                                            sx={{ fontWeight: 'bold' }}
                                        />
                                    </Box>
                                )}

                                <FormControl fullWidth>
                                    <InputLabel>Position</InputLabel>
                                    <Select
                                        value={watermarkPosition}
                                        label="Position"
                                        onChange={handleWatermarkPositionChange}
                                        disabled={disabled}
                                    >
                                        {WATERMARK_POSITIONS.map((position) => (
                                            <MenuItem key={position.value} value={position.value}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography>{position.icon}</Typography>
                                                    <Typography>{position.label}</Typography>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ProcessingOptions; 