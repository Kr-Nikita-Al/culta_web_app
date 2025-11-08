import api from './api';
import { ImageListResponse, ImageUrlResponse, ImageUploadResponse } from '../types/authTypes';
import { Image as ImageType } from '../types/authTypes';

export interface UpdateImageRequest {
    file_path?: string;
    title?: string; // ДОБАВИТЬ: опциональное поле title
}

export interface UpdateImageResponse {
    updated_image_id: string;
}

export const uploadImage = async (token: string, file: File, metadata: object): Promise<ImageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await api.post<ImageUploadResponse>('/image/upload', formData, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const getCompanyImages = async (token: string, companyId: string): Promise<ImageListResponse> => {
    const response = await api.get<ImageListResponse>(`/image/get_images_company_by_id?company_id=${companyId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
};

export const getImageById = async (token: string, imageId: string): Promise<ImageUrlResponse> => {
    const response = await api.get<ImageUrlResponse>(`/image/get_by_id?image_id=${imageId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
};

export const deleteImage = async (token: string, imageId: string): Promise<{ deleted_image_id: string }> => {
    const response = await api.delete<{ deleted_image_id: string }>(`/image/delete?image_id=${imageId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
};

export const updateImage = async (token: string, imageId: string, data: UpdateImageRequest): Promise<UpdateImageResponse> => {
    const response = await api.patch<UpdateImageResponse>(`/image/update_by_id?image_id=${imageId}`, data, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export interface MoveImageRequest {
    file_name: string;
    file_path: string;
}

export const moveImage = async (token: string, imageId: string, data: MoveImageRequest): Promise<UpdateImageResponse> => {
    const response = await api.patch<UpdateImageResponse>(`/image/update_by_id?image_id=${imageId}`, data, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export interface FolderImagesResponse {
    images: ImageType[];
    folder_path: string;
    total_count: number;
    subfolders_count?: number;
}

export interface RefreshUrlsResponse {
    urls: Record<string, string>;
}

// Добавьте эти методы:
export const getFolderImages = async (
    token: string,
    companyId: string,
    folderPath: string,
    includeSubfolders: boolean = false
): Promise<FolderImagesResponse> => {
    const response = await api.get(`/image/get_folder_images`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: {
            company_id: companyId,
            folder_path: folderPath,
            include_subfolders: includeSubfolders
        }
    });
    return response.data;
};

export const refreshFolderUrls = async (
    token: string,
    companyId: string,
    folderPath: string
): Promise<RefreshUrlsResponse> => {
    const response = await api.get(`/image/refresh_folder_urls`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: {
            company_id: companyId,
            folder_path: folderPath
        }
    });
    return response.data;
};
