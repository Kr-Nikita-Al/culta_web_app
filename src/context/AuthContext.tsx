import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { UserInfo, UserRole } from '../types/authTypes';
import { getUserRoles, validateToken } from '../services/authService';
import { getUserInfo } from '../services/userService';

// Обновим интерфейс контекста
export interface AuthContextType {
    token: string | null;
    userId: string | null;
    userInfo: UserInfo | null;
    roles: UserRole[] | null; // Добавим отдельное поле для ролей
    login: (token: string, userId: string) => void;
    logout: () => void;
    updateUserInfo: (userInfo: UserInfo) => void;
    updateRoles: (roles: UserRole[]) => void; // Добавим функцию для обновления ролей
}

const AuthContext = createContext<AuthContextType | null>(null);

// Константы версий
const CACHE_VERSION = 'v2';

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
    const [roles, setRoles] = useState<UserRole[] | null>(() => {
        const saved = getWithVersion('userRoles');
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        const initializeAuth = async () => {
            const savedToken = getWithVersion('authToken');
            const savedUserId = getWithVersion('userId');

            if (savedToken && savedUserId) {
                try {
                    const [userData, userRoles] = await Promise.all([
                        getUserInfo(savedToken, savedUserId),
                        getUserRoles(savedToken)
                    ]);

                    setUserInfo(userData);
                    setRoles(userRoles);
                    setWithVersion('userInfo', JSON.stringify(userData));
                    setWithVersion('userRoles', JSON.stringify(userRoles));

                    setToken(savedToken);
                    setUserId(savedUserId);
                } catch (error) {
                    console.error('Ошибка инициализации аутентификации:', error);
                    logout();
                }
            }
        };

        initializeAuth();
    }, []);

    const logout = useCallback(() => {
        removeWithVersion('authToken');
        removeWithVersion('userId');
        removeWithVersion('userInfo');
        removeWithVersion('userRoles');
        setToken(null);
        setUserId(null);
        setUserInfo(null);
        setRoles(null);

        // Очищаем выбранную компанию и кеш компаний
        localStorage.removeItem('selectedCompany');
        localStorage.removeItem('cachedCompanies');

        // Принудительно обновляем страницу для полного сброса состояния
        window.location.href = '/login';
    }, []);

    const login = useCallback(async (newToken: string, newUserId: string) => {
        setWithVersion('authToken', newToken);
        setWithVersion('userId', newUserId);
        setToken(newToken);
        setUserId(newUserId);

        try {
            // Загружаем информацию о пользователе и роли параллельно
            const [userData, userRoles] = await Promise.all([
                getUserInfo(newToken, newUserId),
                getUserRoles(newToken)
            ]);

            setUserInfo(userData);
            setRoles(userRoles);
            setWithVersion('userInfo', JSON.stringify(userData));
            setWithVersion('userRoles', JSON.stringify(userRoles));
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
        }
    }, []);

    const updateUserInfo = useCallback((newUserInfo: UserInfo) => {
        setWithVersion('userInfo', JSON.stringify(newUserInfo));
        setUserInfo(newUserInfo);
    }, []);

    const updateRoles = useCallback((newRoles: UserRole[]) => {
        setWithVersion('userRoles', JSON.stringify(newRoles));
        setRoles(newRoles);
    }, []);

    const contextValue = useMemo(() => ({
        token,
        userId,
        userInfo,
        roles,
        login,
        logout,
        updateUserInfo,
        updateRoles
    }), [token, userId, userInfo, roles, login, logout, updateUserInfo, updateRoles]);

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