import axios, { AxiosRequestConfig } from 'axios';
import { UploadResponse, ProcessRequest, ProcessResponse, VideoInfo, ApiError } from './types';

declare global {
    interface Window {
        process: {
            env: {
                REACT_APP_API_URL?: string;
            };
        };
    }
}

const API_BASE_URL = window.process?.env?.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 1800000, // 30 minutes for very large files
    // Add streaming support
    responseType: 'json',
    // Increase buffer size for better performance
    maxRedirects: 5
});

// Add request interceptor for large file uploads
api.interceptors.request.use((config) => {
    // If this is a file upload
    if (config.data instanceof FormData) {
        const file = config.data.get('file') as File;
        if (file) {
            // Calculate timeout based on file size (minimum 5 minutes, add 1 minute per 100MB)
            const fileSizeMB = file.size / (1024 * 1024);
            const baseTimeout = 300000; // 5 minutes
            const additionalTimeout = Math.ceil(fileSizeMB / 100) * 60000; // 1 minute per 100MB
            config.timeout = Math.max(baseTimeout, baseTimeout + additionalTimeout);

            // Log upload configuration
            console.log(`Upload configuration for ${fileSizeMB.toFixed(1)}MB file:`);
            console.log(`- Timeout: ${config.timeout / 1000} seconds`);
            console.log(`- Chunk size: 1MB`);
        }
    }
    return config;
});

// Add response interceptor for retry logic
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;

        // If no config or already retried, reject
        if (!config || config.__retryCount >= 3) {
            return Promise.reject(error);
        }

        // Set retry count
        config.__retryCount = config.__retryCount || 0;
        config.__retryCount++;

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Retry the request
        return api(config);
    }
);

export const healthCheck = async (): Promise<{ status: string; message: string }> => {
    const response = await api.get<{ status: string; message: string }>('/health');
    return response.data;
};

export const uploadVideo = async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    // Calculate timeout based on file size (minimum 5 minutes, add 1 minute per 100MB)
    const fileSizeMB = file.size / (1024 * 1024);
    const baseTimeout = 300000; // 5 minutes
    const additionalTimeout = Math.ceil(fileSizeMB / 100) * 60000; // 1 minute per 100MB
    const uploadTimeout = Math.max(baseTimeout, baseTimeout + additionalTimeout);

    console.log(`Upload timeout set to ${uploadTimeout / 1000} seconds for ${fileSizeMB.toFixed(1)}MB file`);

    const response = await api.post<UploadResponse>('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        },
        timeout: uploadTimeout,
        onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                const loadedMB = (progressEvent.loaded / (1024 * 1024)).toFixed(1);
                const totalMB = (progressEvent.total / (1024 * 1024)).toFixed(1);
                const speedMBps = progressEvent.rate ? (progressEvent.rate / (1024 * 1024)).toFixed(1) : 'N/A';
                console.log(`Upload progress: ${percentCompleted}% (${loadedMB}MB/${totalMB}MB) - Speed: ${speedMBps}MB/s`);
            }
        }
    });

    return response.data;
};

export const getVideoInfo = async (fileId: string): Promise<{ success: boolean; video_info: VideoInfo }> => {
    const response = await api.get<{ success: boolean; video_info: VideoInfo }>(`/video-info/${fileId}`);
    return response.data;
};

export const processVideo = async (request: ProcessRequest): Promise<ProcessResponse> => {
    // If watermark_file is present, use FormData
    if (request.watermark_file) {
        const formData = new FormData();
        Object.entries(request).forEach(([key, value]) => {
            if (key === 'watermark_file' && value instanceof File) {
                formData.append('watermark_file', value);
            } else if (value !== undefined && value !== null) {
                formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
        });
        const response = await api.post<ProcessResponse>('/process', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    } else {
        const response = await api.post<ProcessResponse>('/process', request);
        return response.data;
    }
};

export const downloadVideo = async (fileId: string): Promise<Blob> => {
    const response = await api.get<Blob>(`/download/${fileId}`, {
        responseType: 'blob',
    });
    return response.data;
};

export const getVideoPreviewUrl = (fileId: string): string => {
    return `${API_BASE_URL}/preview/${fileId}`;
};

export const cleanupFiles = async (fileIds: string[]): Promise<{ success: boolean; cleaned_files: string[]; message: string }> => {
    const response = await api.post<{ success: boolean; cleaned_files: string[]; message: string }>('/cleanup', { file_ids: fileIds });
    return response.data;
};

// Error handling utility
export const handleApiError = (error: any): string => {
    if (error.response?.data?.error) {
        return error.response.data.error;
    }
    if (error.message) {
        return error.message;
    }
    return 'An unexpected error occurred';
}; 