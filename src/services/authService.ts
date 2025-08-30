import api from './api';
import { LoginData, LoginResponse, UserRole } from '../types/authTypes';
import config from "../config";

export const loginUser = async (data: LoginData): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('password', data.password);
    formData.append('grant_type', 'password');

    const response = await api.post('/login/token', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return {
        token: response.data.access_token,
        userId: response.data.user_id,
    };
};

export const oauthLogin = async (provider: string, code: string): Promise<LoginResponse> => {
    const response = await api.get(`/login/auth/${provider}/callback`, {
        params: { code },
    });

    return {
        token: response.data.access_token,
        userId: response.data.user_id,
    };
};

export const getOAuthUrl = (provider: string): string => {
    return `${config.apiBaseUrl}/login/auth/${provider}`;
};

export const getUserRoles = async (token: string): Promise<UserRole[]> => {
    const response = await api.get('/user_role/get_user_roles');
    return response.data;
};

export const validateToken = async (token: string): Promise<boolean> => {
    try {
        const response = await api.get('/validate_token', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.status === 200;
    } catch (error) {
        console.error('Token validation failed:', error);
        return false;
    }
};

export const getOAuthProviderById = (id: string) => {
    return oauthProviders.find(provider => provider.id === id);
};

// Список поддерживаемых OAuth-провайдеров
export const oauthProviders = [
    {
        id: 'yandex',
        name: 'Яндекс',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Yandex_icon.svg',
        authUrl: getOAuthUrl('yandex')
    },
    {
        id: 'google',
        name: 'Google',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
        authUrl: getOAuthUrl('google')
    },
    {
        id: 'apple',
        name: 'Apple',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Apple_logo_grey.svg',
        authUrl: getOAuthUrl('apple')
    },
    {
        id: 'telegram',
        name: 'Telegram',
        icon: 'https://telegram.org/img/t_logo.png',
        authUrl: getOAuthUrl('telegram')
    }
];