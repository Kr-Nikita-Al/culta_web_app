import api from './api';
import {storeSession} from './sessionService';
import { LoginData, LoginResponse, UserRole } from '../types/authTypes';
import config from "../config";

export const loginUser = async (data: LoginData, isCurrent: () => boolean = () => true): Promise<LoginResponse | null> => {
    const response = await api.post('/login/session', {email:data.username,password:data.password});
    if (!isCurrent()) return null;
    storeSession(response.data);
    return {
        token: response.data.access_token,
        userId: response.data.user_id,
    };
};

export const startTelegramLogin = async () => {
    const response=await api.post('/login/auth/telegram/start',{}, {withCredentials:true});
    window.location.assign(response.data.url);
};

export const startGoogleLogin = async () => {
    const response=await api.post('/login/auth/google/start',{}, {withCredentials:true});
    window.location.assign(response.data.url);
};

export const oauthLogin = async (provider: string, code: string, state?:string, isCurrent: () => boolean = () => true): Promise<LoginResponse | null> => {
    const response = (provider==='google'||provider==='telegram')?await api.post(`/login/auth/${provider}/callback`,{code,state},{withCredentials:true}):await api.get(`/login/auth/${provider}/callback`, {
        params: { code, state }, withCredentials:true,
    });
    if (!isCurrent()) return null;
    storeSession(response.data);
    return {
        token: response.data.access_token,
        userId: response.data.user_id,
    };
};

export const getOAuthUrl = (provider: string): string => {
    return `${config.apiBaseUrl}/login/auth/${provider}`;
};

export const getUserRoles = async (token: string): Promise<UserRole[]> => {
    const response = await api.get('/user_role/get_user_roles', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
};

export const validateToken = async (token: string): Promise<boolean> => {
    try {
        const response = await api.get('/login/token/status', {
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
    }
];
