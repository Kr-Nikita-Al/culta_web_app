import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo } from 'react';
import { AuthContextType } from '../types/authTypes';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem('authToken');
    });

    const login = useCallback((newToken: string) => {
        localStorage.setItem('authToken', newToken);
        setToken(newToken);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        setToken(null);
    }, []);

    // Мемоизированное значение контекста
    const contextValue = useMemo(() => ({
        token,
        login,
        logout
    }), [token, login, logout]);

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