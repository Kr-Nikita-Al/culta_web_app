import {endSession} from '../services/sessionService';
import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect, useRef } from 'react';
import { UserInfo, UserRole } from '../types/authTypes';
import { getUserRoles } from '../services/authService';
import { getUserInfo } from '../services/userService';

// Обновим интерфейс контекста
export interface AuthContextType {
    token: string | null;
    userId: string | null;
    userInfo: UserInfo | null;
    roles: UserRole[] | null; // Добавим отдельное поле для ролей
    sessionError: string | null;
    retrySession: () => void;
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

function readCached<T>(key: string): T | null {
    try {return JSON.parse(getWithVersion(key) || 'null');}
    catch {removeWithVersion(key); return null;}
}

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [token, setToken] = useState<string | null>(() => getWithVersion('authToken'));
    const [userId, setUserId] = useState<string | null>(() => getWithVersion('userId'));
    const [userInfo, setUserInfo] = useState<UserInfo | null>(() => {
        return readCached<UserInfo>('userInfo');
    });
    const [roles, setRoles] = useState<UserRole[] | null>(() => {
        const saved = readCached<UserRole[]>('userRoles');
        return Array.isArray(saved) ? saved : null;
    });
    const generation = useRef(0);
    const account = useRef(userId);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const retrySession = useCallback(() => setRetry(value => value + 1), []);

    const logout = useCallback(async () => {
        generation.current++;
        await endSession();
        // A new sign-in may finish while the old session is being revoked.
        if (getWithVersion('authToken')) return;
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

    useEffect(() => {
        let active = true;
        const requestGeneration = generation.current;
        const initializeAuth = async () => {
            const savedToken = getWithVersion('authToken');
            const savedUserId = getWithVersion('userId');

            if (savedToken && savedUserId) {
                setSessionError(null);
                try {
                    const [userData, userRoles] = await Promise.all([
                        getUserInfo(savedToken, savedUserId),
                        getUserRoles(savedToken)
                    ]);
                    if (!active || generation.current !== requestGeneration ||
                        getWithVersion('userId') !== savedUserId || !getWithVersion('authToken')) return;

                    setUserInfo(userData);
                    setRoles(userRoles);
                    setWithVersion('userInfo', JSON.stringify(userData));
                    setWithVersion('userRoles', JSON.stringify(userRoles));

                    setToken(getWithVersion('authToken'));
                    setUserId(savedUserId);
                } catch (error: any) {
                    if (!active || generation.current !== requestGeneration || getWithVersion('userId') !== savedUserId) return;
                    console.error('Ошибка инициализации аутентификации:', error);
                    const status = error.response?.status;
                    const detail = error.response?.data?.detail;
                    if (status === 401 || (status === 403 &&
                        ['Email confirmation required', 'Account unavailable'].includes(detail))) {
                        void logout();
                    } else {
                        setSessionError('Не удалось обновить профиль. Проверьте соединение и повторите.');
                    }
                }
            }
        };

        initializeAuth();
        return () => {active = false;};
    }, [retry, logout]);

    useEffect(()=>{
        const sync=()=>{
            const next = getWithVersion('userId');
            if (account.current !== next || !getWithVersion('authToken')) {
                generation.current++;
                account.current = next;
                setUserInfo(null); setRoles(null);
                setSessionError(null);
            }
            setToken(getWithVersion('authToken'));setUserId(next);
        };
        window.addEventListener('storage',sync);window.addEventListener('culta-session',sync);
        return()=>{window.removeEventListener('storage',sync);window.removeEventListener('culta-session',sync);};
    },[]);

    const login = useCallback(async (newToken: string, newUserId: string) => {
        setSessionError(null);
        const requestGeneration = ++generation.current;
        account.current = newUserId;
        setUserInfo(null); setRoles(null);
        removeWithVersion('userInfo'); removeWithVersion('userRoles');
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
            if (generation.current !== requestGeneration || getWithVersion('userId') !== newUserId ||
                !getWithVersion('authToken')) return;

            setUserInfo(userData);
            setRoles(userRoles);
            setWithVersion('userInfo', JSON.stringify(userData));
            setWithVersion('userRoles', JSON.stringify(userRoles));
        } catch {
            if (generation.current !== requestGeneration || getWithVersion('userId') !== newUserId ||
                !getWithVersion('authToken')) return;
            setSessionError('Не удалось загрузить данные аккаунта. Проверьте соединение и повторите попытку.');
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
        sessionError,
        retrySession,
        login,
        logout,
        updateUserInfo,
        updateRoles
    }), [token, userId, userInfo, roles, sessionError, retrySession, login, logout, updateUserInfo, updateRoles]);

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
