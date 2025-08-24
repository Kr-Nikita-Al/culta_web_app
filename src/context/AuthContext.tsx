import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo } from 'react';
import { AuthContextType, UserInfo } from '../types/authTypes';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem('authToken');
    });

    const [userId, setUserId] = useState<string | null>(() => {
        return localStorage.getItem('userId');
    });

    const [userInfo, setUserInfo] = useState<UserInfo | null>(() => {
        const savedUserInfo = localStorage.getItem('userInfo');
        return savedUserInfo ? JSON.parse(savedUserInfo) : null;
    });

    const login = useCallback((newToken: string, newUserId: string) => {
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('userId', newUserId);
        setToken(newToken);
        setUserId(newUserId);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userInfo');
        setToken(null);
        setUserId(null);
        setUserInfo(null);
    }, []);

    const updateUserInfo = useCallback((newUserInfo: UserInfo) => {
        localStorage.setItem('userInfo', JSON.stringify(newUserInfo));
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