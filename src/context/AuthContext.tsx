import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { AuthContextType, UserInfo } from '../types/authTypes';
import { validateToken } from '../services/authService';
import { getUserInfo } from '../services/userService';
import api from "../services/api";

const AuthContext = createContext<AuthContextType | null>(null);

// Константы версий
const CACHE_VERSION = 'v2';
const APP_VERSION = '1.0.0';

// Функции для работы с версионированным localStorage
const getWithVersion = (key: string): string | null => {
    return localStorage.getItem(`${key}_${CACHE_VERSION}`);
};

const setWithVersion = (key: string, value: string): void => {
    localStorage.setItem(`${key}_${CACHE_VERSION}`, value);
};

const removeWithVersion = (key: string): void => {
    localStorage.removeItem(`${key}_${CACHE_VERSION}`);
};

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [token, setToken] = useState<string | null>(() => getWithVersion('authToken'));
    const [userId, setUserId] = useState<string | null>(() => getWithVersion('userId'));
    const [userInfo, setUserInfo] = useState<UserInfo | null>(() => {
        const saved = getWithVersion('userInfo');
        return saved ? JSON.parse(saved) : null;
    });
    const refreshAuthToken = async (): Promise<string | null> => {
        try {
            const response = await api.post('/refresh_token');
            return response.data.access_token;
        } catch (error) {
            console.error('Failed to refresh token:', error);
            return null;
        }
    };

    // Очистка устаревшего кэша при изменении версии приложения
    useEffect(() => {
        const checkTokenExpiration = async () => {
            const token = getWithVersion('authToken');
            if (token) {
                const isValid = await validateToken(token);
                if (!isValid) {
                    const newToken = await refreshAuthToken();
                    if (newToken) {
                        setWithVersion('authToken', newToken);
                        setToken(newToken);
                    } else {
                        logout();
                    }
                }
            }
        };

        // Проверяем токен каждые 5 минут
        const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);


    const login = useCallback((newToken: string, newUserId: string) => {
        setWithVersion('authToken', newToken);
        setWithVersion('userId', newUserId);
        setToken(newToken);
        setUserId(newUserId);
    }, []);

    const logout = useCallback(() => {
        removeWithVersion('authToken');
        removeWithVersion('userId');
        removeWithVersion('userInfo');
        setToken(null);
        setUserId(null);
        setUserInfo(null);
    }, []);

    const updateUserInfo = useCallback((newUserInfo: UserInfo) => {
        setWithVersion('userInfo', JSON.stringify(newUserInfo));
        setUserInfo(newUserInfo);
    }, []);

    const contextValue = useMemo(() => ({
        token,
        userId,
        userInfo,
        login,
        logout,
        updateUserInfo
    }), [token, userId, userInfo, login, logout, updateUserInfo]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};