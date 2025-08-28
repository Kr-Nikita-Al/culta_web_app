import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { AuthContextType, UserInfo } from '../types/authTypes';
import { validateToken, refreshToken } from '../services/authService';
import { getUserInfo } from '../services/userService';

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

    // Очистка устаревшего кэша при изменении версии приложения
    useEffect(() => {
        const currentVersion = localStorage.getItem('appVersion');
        if (currentVersion !== APP_VERSION) {
            localStorage.clear();
            localStorage.setItem('appVersion', APP_VERSION);
            setToken(null);
            setUserId(null);
            setUserInfo(null);
        }
    }, []);

    // Проверка и обновление токена при загрузке приложения
    useEffect(() => {
        const initializeAuth = async () => {
            const savedToken = getWithVersion('authToken');
            const savedUserId = getWithVersion('userId');

            if (savedToken && savedUserId) {
                try {
                    // Пытаемся обновить токен
                    const newToken = await refreshToken(savedToken);
                    setWithVersion('authToken', newToken);
                    setToken(newToken);

                    // Загружаем актуальные данные пользователя
                    const userData = await getUserInfo(newToken, savedUserId);
                    setUserInfo(userData);
                    setWithVersion('userInfo', JSON.stringify(userData));
                } catch (error) {
                    // Если не удалось обновить, проверяем валидность текущего токена
                    const isValid = await validateToken(savedToken);
                    if (!isValid) {
                        removeWithVersion('authToken');
                        removeWithVersion('userId');
                        removeWithVersion('userInfo');
                        setToken(null);
                        setUserId(null);
                        setUserInfo(null);
                    } else {
                        setToken(savedToken);
                        setUserId(savedUserId);
                    }
                }
            }
        };

        initializeAuth();
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