import React from 'react';
import { Box, Typography, Grid, Chip } from '@mui/material';
import { getVideoPreviewUrl } from '../api';
import { formatTime } from '../utils';
import { VideoInfo } from '../types';

interface VideoPreviewProps {
    fileId: string;
    videoInfo: VideoInfo;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ fileId, videoInfo }) => {
    if (!videoInfo) {
        return <Typography color="error">No video info available.</Typography>;
    }
    return (
        <Box>
            <video
                src={getVideoPreviewUrl(fileId)}
                controls
                style={{ width: '100%', maxHeight: '400px', borderRadius: '8px' }}
            />

            <Box mt={2}>
                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                            Duration: <strong>{videoInfo.duration !== undefined ? formatTime(videoInfo.duration) : 'N/A'}</strong>
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                            Resolution: <strong>{videoInfo.size ? `${videoInfo.size[0]}x${videoInfo.size[1]}` : 'N/A'}</strong>
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                            FPS: <strong>{videoInfo.fps !== undefined ? videoInfo.fps.toFixed(1) : 'N/A'}</strong>
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                            Aspect Ratio: <strong>{videoInfo.aspect_ratio !== undefined ? videoInfo.aspect_ratio.toFixed(2) : 'N/A'}</strong>
                        </Typography>
                    </Grid>
                </Grid>

                <Box mt={1}>
                    <Chip
                        label={videoInfo.has_audio ? 'Has Audio' : 'No Audio'}
                        color={videoInfo.has_audio ? 'success' : 'default'}
                        size="small"
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default VideoPreview; 