import api from './api';

export interface CreateDirectoryRequest {
    company_id: string;
    dir_name: string;
    dir_path: string;
}

export interface DeleteDirectoryRequest {
    company_id: string;
    dir_name: string;
    dir_path: string;
}

export interface RenameDirectoryRequest {
    company_id: string;
    old_dir_name: string;
    new_dir_name: string;
    dir_path: string;
}

export interface DirectoryObjects {
    [key: string]: number;
}

export interface DeleteDirectoryResponse {
    "deleted image id": string[];
}

export interface RenameDirectoryResponse {
    "updated image id": string[];
}

export const createDirectory = async (token: string, data: CreateDirectoryRequest): Promise<{ Success: number }> => {
    const response = await api.post<{ Success: number }>('/s3_directory/create', data, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export const deleteDirectory = async (token: string, data: DeleteDirectoryRequest): Promise<DeleteDirectoryResponse> => {
    const response = await api.delete<DeleteDirectoryResponse>('/s3_directory/delete', {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        data: data
    });
    return response.data;
};

export const renameDirectory = async (token: string, data: RenameDirectoryRequest): Promise<RenameDirectoryResponse> => {
    const response = await api.patch<RenameDirectoryResponse>('/s3_directory/rename', data, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export const getDirectoryObjects = async (token: string, companyId: string): Promise<DirectoryObjects> => {
    const response = await api.get<DirectoryObjects>(`/s3_directory/get_objects_by_company_id?company_id=${companyId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
};

export interface FolderStructure {
    path: string;
    name: string;
    children: FolderStructure[];
}

export const getFolderStructure = async (token: string, companyId: string): Promise<FolderStructure> => {
    const response = await api.get<FolderStructure>(`/s3_directory/get_folder_structure?company_id=${companyId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
};