import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    Alert,
    useTheme,
    alpha,
    Button,
    Skeleton,
    Fade
} from '@mui/material';
import {
    Preview as PreviewIcon,
    Refresh as RefreshIcon,
    Image as ImageIcon
} from '@mui/icons-material';
import { generateAspectRatioPreview, getVideoPreviewUrl } from '../api';
import { PreviewRequest } from '../types';

interface AspectRatioPreviewProps {
    mainVideoId: string;
    previewRequest: PreviewRequest;
    enabled: boolean;
}

const AspectRatioPreview: React.FC<AspectRatioPreviewProps> = ({
    mainVideoId,
    previewRequest,
    enabled
}) => {
    const theme = useTheme();
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRequestString, setLastRequestString] = useState<string>('');

    // Debounced preview generation
    const generatePreview = useCallback(async () => {
        if (!enabled || !mainVideoId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await generateAspectRatioPreview(previewRequest);
            setPreviewFileId(response.preview_file_id);
        } catch (err: any) {
            console.error('Error generating preview:', err);
            setError(err.response?.data?.error || 'Failed to generate preview');
        } finally {
            setLoading(false);
        }
    }, [enabled, mainVideoId, previewRequest]);

    // Auto-generate preview when settings change (with debouncing)
    useEffect(() => {
        if (!enabled) return;

        const requestString = JSON.stringify(previewRequest);
        if (requestString === lastRequestString) return;

        setLastRequestString(requestString);

        const timeoutId = setTimeout(() => {
            generatePreview();
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [previewRequest, enabled, generatePreview, lastRequestString]);

    // Manual refresh
    const handleRefresh = () => {
        generatePreview();
    };

    if (!enabled) {
        return (
            <Card elevation={2} sx={{ p: 3, background: alpha(theme.palette.grey[100], 0.5), borderRadius: 2 }}>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <ImageIcon sx={{ fontSize: 48, color: theme.palette.grey[400], mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                        Enable Aspect Ratio Conversion to see preview
                    </Typography>
                </Box>
            </Card>
        );
    }

    const previewUrl = previewFileId ? getVideoPreviewUrl(previewFileId) : null;

    return (
        <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
                <Box sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    color: 'white',
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PreviewIcon />
                        <Typography variant="h6" fontWeight="bold">
                            Live Preview
                        </Typography>
                    </Box>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={handleRefresh}
                        disabled={loading}
                        sx={{
                            color: 'white',
                            borderColor: 'white',
                            '&:hover': {
                                borderColor: 'white',
                                background: alpha('#ffffff', 0.1)
                            }
                        }}
                        startIcon={<RefreshIcon />}
                    >
                        Refresh
                    </Button>
                </Box>

                <Box sx={{ p: 3 }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box
                        sx={{
                            position: 'relative',
                            minHeight: 300,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: alpha(theme.palette.grey[100], 0.5),
                            borderRadius: 1,
                            overflow: 'hidden'
                        }}
                    >
                        {loading && (
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={40} sx={{ mb: 2 }} />
                                <Typography variant="body2" color="text.secondary">
                                    Generating preview...
                                </Typography>
                            </Box>
                        )}

                        {!loading && !previewUrl && !error && (
                            <Box sx={{ textAlign: 'center' }}>
                                <ImageIcon sx={{ fontSize: 48, color: theme.palette.grey[400], mb: 2 }} />
                                <Typography variant="body2" color="text.secondary">
                                    Preview will appear here
                                </Typography>
                            </Box>
                        )}

                        {!loading && previewUrl && (
                            <Fade in={true}>
                                <Box
                                    component="img"
                                    src={previewUrl}
                                    alt="Aspect Ratio Preview"
                                    sx={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'contain',
                                        borderRadius: 1,
                                        boxShadow: `0 4px 12px ${alpha(theme.palette.grey[900], 0.1)}`
                                    }}
                                    onError={() => setError('Failed to load preview image')}
                                />
                            </Fade>
                        )}
                    </Box>

                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                            Preview shows how your video will look with the selected aspect ratio settings
                        </Typography>
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

export default AspectRatioPreview; 