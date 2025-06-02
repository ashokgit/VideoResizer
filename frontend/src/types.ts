export interface VideoInfo {
    duration: number;
    size: [number, number];
    fps: number;
    aspect_ratio: number;
    has_audio: boolean;
    file_size?: number;
}

export interface UploadResponse {
    success: boolean;
    file_id: string;
    file_path: string;
    video_info: VideoInfo;
    filename: string;
}

export interface ProcessRequest {
    main_video_id: string;
    enable_time_crop?: boolean;
    start_time?: number;
    end_time?: number;
    enable_ratio_change?: boolean;
    target_ratio?: {
        width: number;
        height: number;
    };
    resize_method?: 'crop' | 'pad' | 'stretch';
    pad_color?: [number, number, number];
    enable_cta?: boolean;
    cta_video_id?: string;
    quality_preset?: 'lossless' | 'high' | 'medium' | 'low';
    watermark_file?: File;
    watermark_position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

export interface ProcessResponse {
    success: boolean;
    output_file_id: string;
    processed_video_info: VideoInfo;
    message: string;
}

export interface ApiError {
    error: string;
}

export interface AspectRatioOption {
    label: string;
    value: [number, number] | 'custom';
} 