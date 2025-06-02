import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import { downloadVideo, getVideoPreviewUrl, handleApiError } from '../api';
import { downloadBlob } from '../utils';
import VideoPreview from './VideoPreview';
import { VideoInfo } from '../types';

interface DownloadSectionProps {
    fileId: string;
    videoInfo: VideoInfo;
}

const DownloadSection: React.FC<DownloadSectionProps> = ({ fileId, videoInfo }) => {
    const handleDownload = async () => {
        try {
            const blob = await downloadVideo(fileId);
            downloadBlob(blob, `processed_video_${Date.now()}.mp4`);
        } catch (error) {
            alert(handleApiError(error));
        }
    };

    return (
        <Box>
            <VideoPreview fileId={fileId} videoInfo={videoInfo} />

            <Box mt={3} textAlign="center">
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<Download />}
                    onClick={handleDownload}
                    sx={{ px: 4, py: 2 }}
                >
                    Download Processed Video
                </Button>
            </Box>
        </Box>
    );
};

export default DownloadSection; 