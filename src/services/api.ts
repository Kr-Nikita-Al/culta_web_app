import axios from 'axios';
import config from '../config';
import {refreshSession,clearSession} from './sessionService';

const api = axios.create({
    baseURL: config.apiBaseUrl,
    timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        (config as any)._sessionUserId=localStorage.getItem('userId_v2');
        const token = localStorage.getItem('authToken_v2');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const protectedRequest=!error.config?.url?.startsWith('/login/') || /^\/login\/(accounts|account-suggestions)(\/|$)/.test(error.config?.url||'') || error.config?.accountLinkFlow===true;
        if(error.response?.status===401&&!error.config?._sessionRetry&&protectedRequest){
            const failed=String(error.config?.headers?.Authorization||'').replace(/^Bearer /,'');
            try{const token=await refreshSession(failed,error.config?._sessionUserId);error.config._sessionRetry=true;error.config.headers.Authorization=`Bearer ${token}`;return api.request(error.config);}catch{/* Require a new login, never replay a consumed refresh token. */}
        }
        const accountDenied = error.response?.status === 403 &&
            ['Email confirmation required', 'Account unavailable'].includes(error.response?.data?.detail);
        if ((error.response?.status === 401 || accountDenied) && protectedRequest) {
            if(error.config?._sessionUserId!==localStorage.getItem('userId_v2'))return Promise.reject(error);
            clearSession();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
