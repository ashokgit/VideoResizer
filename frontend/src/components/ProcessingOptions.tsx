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
    SelectChangeEvent
} from '@mui/material';
import { ChromePicker } from 'react-color';
import VideoUpload from './VideoUpload';
import VideoTimeline from './VideoTimeline';
import { VideoInfo, ProcessRequest } from '../types';

interface ProcessingOptionsProps {
    mainVideo: { fileId: string; info: VideoInfo; filename: string } | null;
    onCtaVideoUpload: (fileId: string, info: VideoInfo, filename: string) => void;
    onChange: (options: Partial<ProcessRequest>) => void;
    disabled: boolean;
}

// Aspect ratio presets
const ASPECT_RATIO_PRESETS = [
    { label: "9:16 (TikTok/Stories)", width: 9, height: 16, description: "Vertical mobile" },
    { label: "16:9 (YouTube)", width: 16, height: 9, description: "Standard widescreen" },
    { label: "1:1 (Instagram Square)", width: 1, height: 1, description: "Perfect square" },
    { label: "4:3 (Traditional TV)", width: 4, height: 3, description: "Classic format" },
    { label: "4:5 (Instagram Portrait)", width: 4, height: 5, description: "Portrait posts" },
    { label: "21:9 (Cinematic)", width: 21, height: 9, description: "Ultra-wide" },
    { label: "Custom", width: 0, height: 0, description: "Define your own" }
];

const RESIZE_METHODS = [
    {
        value: 'crop',
        label: 'Crop',
        description: 'Maintains quality but may lose content from edges',
        icon: '✂️'
    },
    {
        value: 'pad',
        label: 'Pad (Letterbox)',
        description: 'Adds bars to maintain full content',
        icon: '📱'
    },
    {
        value: 'stretch',
        label: 'Stretch',
        description: 'Fits entire video but may distort',
        icon: '📏'
    }
];

const QUALITY_PRESETS = [
    { value: 'lossless', label: 'Lossless' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
];

const WATERMARK_POSITIONS = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
    { value: 'center', label: 'Center' }
];

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({ mainVideo, onCtaVideoUpload, onChange, disabled }) => {
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
        const value = event.target.value as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
        setWatermarkPosition(value);
        updateOptions({ watermark_position: value });
    };

    return (
        <Box>
            {/* Time Cropping Section */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <FormControlLabel
                        control={<Checkbox checked={enableTimeCrop} onChange={(e) => handleTimeCropToggle(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="subtitle1">✂️ Enable Time Cropping</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Trim video to specific time segments
                                </Typography>
                            </Box>
                        }
                        disabled={disabled}
                    />

                    {enableTimeCrop && mainVideo && (
                        <Box mt={2}>
                            <VideoTimeline
                                videoInfo={mainVideo.info}
                                fileId={mainVideo.fileId}
                                startTime={startTime}
                                endTime={endTime || mainVideo.info.duration}
                                onTimeChange={handleTimeChange}
                                disabled={disabled}
                            />
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Aspect Ratio Section */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <FormControlLabel
                        control={<Checkbox checked={enableRatioChange} onChange={(e) => handleRatioChangeToggle(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="subtitle1">📱 Enable Aspect Ratio Change</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Convert between different video formats and platforms
                                </Typography>
                            </Box>
                        }
                        disabled={disabled}
                    />

                    {enableRatioChange && mainVideo && (
                        <Box mt={3}>
                            {/* Current vs Target Ratio Display */}
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={6}>
                                    <Paper elevation={1} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                                        <Typography variant="subtitle2" color="text.secondary">Current</Typography>
                                        <Typography variant="body1" fontWeight="bold">
                                            {getCurrentAspectRatio()}
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid item xs={6}>
                                    <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e3f2fd' }}>
                                        <Typography variant="subtitle2" color="primary">Target</Typography>
                                        <Typography variant="body1" fontWeight="bold" color="primary">
                                            {getTargetAspectRatio()}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>

                            {/* Aspect Ratio Presets */}
                            <Typography variant="subtitle2" gutterBottom>
                                Choose Target Aspect Ratio
                            </Typography>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                {ASPECT_RATIO_PRESETS.map((preset, index) => (
                                    <Grid item xs={6} md={4} key={index}>
                                        <Card
                                            sx={{
                                                cursor: 'pointer',
                                                border: selectedRatioPreset === index ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                                backgroundColor: selectedRatioPreset === index ? '#f3f8ff' : 'white',
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                    borderColor: '#1976d2',
                                                    backgroundColor: '#f8f9fa'
                                                }
                                            }}
                                            onClick={() => handleRatioPresetChange(index)}
                                        >
                                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                <Typography variant="subtitle2" fontWeight="bold">
                                                    {preset.label}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {preset.description}
                                                </Typography>
                                                {preset.width > 0 && (
                                                    <Chip
                                                        label={`${preset.width}:${preset.height}`}
                                                        size="small"
                                                        sx={{ mt: 0.5 }}
                                                        color={selectedRatioPreset === index ? "primary" : "default"}
                                                    />
                                                )}
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>

                            {/* Custom Ratio Inputs */}
                            {selectedRatioPreset === ASPECT_RATIO_PRESETS.length - 1 && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Custom Aspect Ratio
                                    </Typography>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <TextField
                                            label="Width"
                                            type="number"
                                            value={customWidth}
                                            onChange={(e) => {
                                                setCustomWidth(Number(e.target.value));
                                                updateOptions({});
                                            }}
                                            size="small"
                                            inputProps={{ min: 1, max: 100 }}
                                            sx={{ width: 100 }}
                                        />
                                        <Typography variant="h6">:</Typography>
                                        <TextField
                                            label="Height"
                                            type="number"
                                            value={customHeight}
                                            onChange={(e) => {
                                                setCustomHeight(Number(e.target.value));
                                                updateOptions({});
                                            }}
                                            size="small"
                                            inputProps={{ min: 1, max: 100 }}
                                            sx={{ width: 100 }}
                                        />
                                    </Stack>
                                </Box>
                            )}

                            <Divider sx={{ my: 3 }} />

                            {/* Resize Method Selection */}
                            <Typography variant="subtitle2" gutterBottom>
                                Resize Method
                            </Typography>
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                {RESIZE_METHODS.map((method) => (
                                    <Grid item xs={12} md={4} key={method.value}>
                                        <Card
                                            sx={{
                                                cursor: 'pointer',
                                                border: resizeMethod === method.value ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                                backgroundColor: resizeMethod === method.value ? '#f3f8ff' : 'white',
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                    borderColor: '#1976d2',
                                                    backgroundColor: '#f8f9fa'
                                                }
                                            }}
                                            onClick={() => handleResizeMethodChange(method.value as 'crop' | 'pad' | 'stretch')}
                                        >
                                            <CardContent>
                                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                                    <Typography variant="h6">{method.icon}</Typography>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {method.label}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    {method.description}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>

                            {/* Pad Color Picker */}
                            {resizeMethod === 'pad' && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Padding Color
                                    </Typography>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                backgroundColor: `rgb(${padColor[0]}, ${padColor[1]}, ${padColor[2]})`,
                                                border: '2px solid #ddd',
                                                borderRadius: 1,
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setShowColorPicker(!showColorPicker)}
                                        />
                                        <Typography variant="body2">
                                            RGB({padColor[0]}, {padColor[1]}, {padColor[2]})
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => {
                                                setPadColor([0, 0, 0]);
                                                updateOptions({ pad_color: [0, 0, 0] });
                                            }}
                                        >
                                            Black
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => {
                                                setPadColor([255, 255, 255]);
                                                updateOptions({ pad_color: [255, 255, 255] });
                                            }}
                                        >
                                            White
                                        </Button>
                                    </Stack>

                                    {showColorPicker && (
                                        <Box sx={{ mt: 2, position: 'relative' }}>
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
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* CTA Video Section */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <FormControlLabel
                        control={<Checkbox checked={enableCta} onChange={(e) => handleCtaToggle(e.target.checked)} />}
                        label={
                            <Box>
                                <Typography variant="subtitle1">🎯 Enable CTA Video</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Append call-to-action clips automatically
                                </Typography>
                            </Box>
                        }
                        disabled={disabled}
                    />

                    {enableCta && (
                        <Box mt={2}>
                            <VideoUpload
                                onUpload={handleCtaVideoUpload}
                                label="Upload CTA Video"
                            />

                            {ctaVideo && (
                                <Box mt={2}>
                                    <Paper elevation={1} sx={{ p: 2, backgroundColor: '#e8f5e8' }}>
                                        <Typography variant="subtitle2" color="success.main" gutterBottom>
                                            ✅ CTA Video Uploaded
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="body2">
                                                    <strong>File:</strong> {ctaVideo.filename}
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>Duration:</strong> {ctaVideo.info.duration.toFixed(1)}s
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="body2">
                                                    <strong>Resolution:</strong> {ctaVideo.info.size[0]}×{ctaVideo.info.size[1]}
                                                </Typography>
                                                <Typography variant="body2">
                                                    <strong>FPS:</strong> {ctaVideo.info.fps.toFixed(1)}
                                                </Typography>
                                            </Grid>
                                        </Grid>

                                        <Box mt={1}>
                                            <Chip
                                                label={ctaVideo.info.has_audio ? '🔊 Has Audio' : '🔇 No Audio'}
                                                color={ctaVideo.info.has_audio ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </Box>

                                        <Button
                                            variant="outlined"
                                            size="small"
                                            color="error"
                                            onClick={() => {
                                                setCtaVideo(null);
                                                updateOptions({ cta_video_id: undefined });
                                            }}
                                            sx={{ mt: 1 }}
                                        >
                                            Remove CTA Video
                                        </Button>
                                    </Paper>
                                </Box>
                            )}
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Quality and Watermark Section */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Quality Preset</InputLabel>
                        <Select value={qualityPreset} label="Quality Preset" onChange={handleQualityChange} disabled={disabled}>
                            {QUALITY_PRESETS.map((preset) => (
                                <MenuItem key={preset.value} value={preset.value}>{preset.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2">Watermark / Logo</Typography>
                        <input type="file" accept="image/*" onChange={handleWatermarkChange} disabled={disabled} />
                        <FormControl fullWidth sx={{ mt: 1 }}>
                            <InputLabel>Watermark Position</InputLabel>
                            <Select value={watermarkPosition} label="Watermark Position" onChange={handleWatermarkPositionChange} disabled={disabled}>
                                {WATERMARK_POSITIONS.map((pos) => (
                                    <MenuItem key={pos.value} value={pos.value}>{pos.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default ProcessingOptions; 