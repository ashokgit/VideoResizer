import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Button } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { uploadVideo, handleApiError } from '../api';
import { validateVideoFile } from '../utils';
import { VideoInfo } from '../types';

interface VideoUploadProps {
    onUpload: (fileId: string, videoInfo: VideoInfo, filename: string) => void;
    accept?: string;
    label?: string;
    multiple?: boolean;
}

const VideoUpload: React.FC<VideoUploadProps> = ({
    onUpload,
    accept = 'video/*',
    label = 'Upload Video',
    multiple = false
}) => {
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const validationError = validateVideoFile(file);
        if (validationError) {
            alert(validationError);
            return;
        }

        try {
            const response = await uploadVideo(file);
            onUpload(response.file_id, response.video_info, response.filename);
        } catch (error) {
            alert(handleApiError(error));
        }
    }, [onUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { [accept]: [] },
        multiple
    });

    return (
        <Box
            {...getRootProps()}
            sx={{
                border: '2px dashed #ccc',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover'
                }
            }}
        >
            <input {...getInputProps()} />
            <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
                {isDragActive ? 'Drop the video here...' : label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Supports MP4, AVI, MOV, MKV, WMV, FLV (Max 2GB)
            </Typography>
            <Button variant="outlined" sx={{ mt: 2 }}>
                Choose File
            </Button>
        </Box>
    );
};

export default VideoUpload; 