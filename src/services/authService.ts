import config from '../config';
import {LoginData, LoginResponse, UserRole} from '../types/authTypes';
import axios from "axios";

export interface OAuthResult {
    token: string;
    userId: string;
}

export const loginUser = async (data: LoginData): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('password', data.password);
    formData.append('grant_type', 'password');

    const response = await axios.post(`${config.apiBaseUrl}/login/token`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });

    return {
        token: response.data.access_token,
        userId: response.data.user_id
    };
};

export const oauthLogin = async (provider: string, code: string): Promise<LoginResponse> => {
    const response = await axios.get(`${config.apiBaseUrl}/login/auth/${provider}/callback`, {
        params: { code }
    });

    return {
        token: response.data.access_token,
        userId: response.data.user_id
    };
};

export const getOAuthUrl = (provider: string): string => {
    return `${config.apiBaseUrl}/login/auth/${provider}`;
};


export interface OAuthSuccessResponse {
    access_token: string;
    token_type: string;
    user_id: string;
}

export const getUserRoles = async (token: string): Promise<UserRole[]> => {

    const response = await fetch(`${config.apiBaseUrl}/user_role/get_user_roles`, {
        method: 'GET',
        mode: 'cors', // Явно указываем режим CORS
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    // Проверяем различные форматы ответа
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
};

export const validateToken = async (token: string): Promise<boolean> => {
    try {
        const response = await axios.get(`${config.apiBaseUrl}/validate_token`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            timeout: 5000
        });
        return response.status === 200;
    } catch (error) {
        console.error('Token validation failed:', error);
        return false;
    }
};

export const refreshToken = async (oldToken: string): Promise<string> => {
    try {
        const response = await axios.post(`${config.apiBaseUrl}/refresh_token`, {}, {
            headers: {
                Authorization: `Bearer ${oldToken}`
            }
        });
        return response.data.access_token;
    } catch (error) {
        throw new Error('Failed to refresh token');
    }
};

// В oauthService.ts
export const generateOAuthState = () => {
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('oauth_state', state);
    return state;
};

export const validateOAuthState = (receivedState: string | null) => {
    const storedState = localStorage.getItem('oauth_state');
    localStorage.removeItem('oauth_state');
    return storedState && storedState === receivedState;
};

// Список поддерживаемых OAuth-провайдеров
export const oauthProviders = [
    {
        id: 'yandex',
        name: 'Яндекс',
        icon: '🟡',
        authUrl: getOAuthUrl('yandex')
    },
    {
        id: 'google',
        name: 'Google',
        icon: '🔵',
        authUrl: getOAuthUrl('google')
    },
    {
        id: 'apple',
        name: 'Apple',
        icon: '⚫',
        authUrl: getOAuthUrl('apple')
    },
    {
        id: 'telegram',
        name: 'Telegram',
        icon: '🔵',
        authUrl: getOAuthUrl('telegram')
    }
];