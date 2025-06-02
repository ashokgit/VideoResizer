import React, { useState, useCallback } from 'react';
import {
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    Alert,
    Box,
    LinearProgress,
    Chip,
} from '@mui/material';
import {
    MovieCreation as MovieIcon,
    CloudUpload as UploadIcon,
    Settings as SettingsIcon,
    Download as DownloadIcon,
} from '@mui/icons-material';

import VideoUpload from './VideoUpload';
import VideoPreview from './VideoPreview';
import ProcessingOptions from './ProcessingOptions';
import DownloadSection from './DownloadSection';
import { VideoInfo, ProcessRequest } from '../types';
import { processVideo, handleApiError } from '../api';

const VideoProcessor: React.FC = () => {
    const [mainVideo, setMainVideo] = useState<{ fileId: string; info: VideoInfo; filename: string } | null>(null);
    const [ctaVideo, setCtaVideo] = useState<{ fileId: string; info: VideoInfo; filename: string } | null>(null);
    const [processedVideo, setProcessedVideo] = useState<{ fileId: string; info: VideoInfo } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [processingOptions, setProcessingOptions] = useState<Partial<ProcessRequest>>({});

    const handleMainVideoUpload = useCallback((fileId: string, info: VideoInfo, filename: string) => {
        setMainVideo({ fileId, info, filename });
        setError(null);
        setSuccess(`Successfully uploaded: ${filename}`);
    }, []);

    const handleCtaVideoUpload = useCallback((fileId: string, info: VideoInfo, filename: string) => {
        setCtaVideo({ fileId, info, filename });
        setError(null);
        setSuccess(`Successfully uploaded CTA video: ${filename}`);
    }, []);

    const handleProcessVideo = async () => {
        if (!mainVideo) {
            setError('Please upload a main video first');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
            const request: ProcessRequest = {
                main_video_id: mainVideo.fileId,
                ...processingOptions,
                cta_video_id: ctaVideo?.fileId,
            };

            const response = await processVideo(request);
            setProcessedVideo({
                fileId: response.output_file_id,
                info: response.processed_video_info,
            });
            setSuccess('Video processed successfully!');
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setIsProcessing(false);
        }
    };

    const canProcess = mainVideo && (
        processingOptions.enable_time_crop ||
        processingOptions.enable_ratio_change ||
        processingOptions.enable_cta
    );

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Header */}
            <Box textAlign="center" mb={4}>
                <MovieIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h1" gutterBottom>
                    Video Processor Studio
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
                    Transform your videos with professional-grade processing tools
                </Typography>
            </Box>

            {/* Status Messages */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
                    {success}
                </Alert>
            )}

            {/* Processing Progress */}
            {isProcessing && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Processing Video...
                        </Typography>
                        <LinearProgress sx={{ mb: 2 }} />
                        <Typography variant="body2" color="text.secondary">
                            This may take several minutes depending on video length and processing options.
                        </Typography>
                    </CardContent>
                </Card>
            )}

            <Grid container spacing={4}>
                {/* Left Column - Upload and Preview */}
                <Grid item xs={12} lg={6}>
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" mb={2}>
                                <UploadIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h5">Upload Main Video</Typography>
                            </Box>
                            <VideoUpload
                                onUpload={handleMainVideoUpload}
                                accept="video/*"
                                label="Choose your main video file"
                                multiple={false}
                            />
                            {mainVideo && (
                                <Box mt={2}>
                                    <Chip
                                        label={`Uploaded: ${mainVideo.filename}`}
                                        color="success"
                                        variant="outlined"
                                    />
                                </Box>
                            )}
                        </CardContent>
                    </Card>

                    {mainVideo && (
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Video Preview
                                </Typography>
                                <VideoPreview fileId={mainVideo.fileId} videoInfo={mainVideo.info} />
                            </CardContent>
                        </Card>
                    )}
                </Grid>

                {/* Right Column - Processing Options */}
                <Grid item xs={12} lg={6}>
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" mb={2}>
                                <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h5">Processing Options</Typography>
                            </Box>

                            <ProcessingOptions
                                mainVideo={mainVideo}
                                onCtaVideoUpload={handleCtaVideoUpload}
                                onChange={setProcessingOptions}
                                disabled={isProcessing}
                            />

                            <Box mt={3}>
                                <Button
                                    variant="contained"
                                    size="large"
                                    fullWidth
                                    onClick={handleProcessVideo}
                                    disabled={!canProcess || isProcessing}
                                    sx={{ py: 2 }}
                                >
                                    {isProcessing ? 'Processing...' : '🚀 Process Video'}
                                </Button>
                                {!canProcess && mainVideo && (
                                    <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                                        Please enable at least one processing option
                                    </Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Download Section */}
                {processedVideo && (
                    <Grid item xs={12}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center" mb={2}>
                                    <DownloadIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h5">Download Processed Video</Typography>
                                </Box>
                                <DownloadSection
                                    fileId={processedVideo.fileId}
                                    videoInfo={processedVideo.info}
                                />
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>

            {/* Features Section */}
            {!mainVideo && (
                <Card sx={{ mt: 4, background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' }}>
                    <CardContent>
                        <Typography variant="h4" gutterBottom textAlign="center">
                            🚀 Features
                        </Typography>
                        <Grid container spacing={3} mt={2}>
                            <Grid item xs={12} md={3}>
                                <Box textAlign="center">
                                    <Typography variant="h6">📱 Aspect Ratio</Typography>
                                    <Typography variant="body2">
                                        Convert between 9:16, 16:9, 1:1, and custom ratios
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Box textAlign="center">
                                    <Typography variant="h6">✂️ Time Cropping</Typography>
                                    <Typography variant="body2">
                                        Trim videos to specific time segments
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Box textAlign="center">
                                    <Typography variant="h6">🎯 CTA Videos</Typography>
                                    <Typography variant="body2">
                                        Append call-to-action clips automatically
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Box textAlign="center">
                                    <Typography variant="h6">🎨 Quality Control</Typography>
                                    <Typography variant="body2">
                                        Choose from lossless to optimized compression
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}
        </Container>
    );
};

export default VideoProcessor; 