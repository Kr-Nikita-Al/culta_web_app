import React, {createContext, useContext, useState, useEffect, useRef, useCallback} from 'react';
import { useAuth } from './AuthContext';
import { useApi } from '../hooks/useApi';
import { getAllCompanies } from '../services/companyService';
import { Company, CompaniesListResponse } from '../types/authTypes';

interface CompaniesContextType {
    companies: Company[];
    isLoading: boolean;
    refreshCompanies: () => Promise<void>;
}

const CompaniesContext = createContext<CompaniesContextType | null>(null);

export const CompaniesProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { token } = useAuth();
    const { callApi } = useApi();
    const hasLoaded = useRef(false); // Флаг для отслеживания загрузки

    const loadCompanies = async () => {
        if (!token || hasLoaded.current) return;

        setIsLoading(true);
        try {
            const response = await callApi(() => getAllCompanies(token));
            if (response) {
                setCompanies(response.companies);
                localStorage.setItem('cachedCompanies', JSON.stringify(response.companies));
                hasLoaded.current = true; // Устанавливаем флаг после успешной загрузки
            }
        } catch (error) {
            console.error('Ошибка загрузки компаний:', error);
            // Пытаемся использовать кэшированные данные в случае ошибки
            const cachedCompanies = localStorage.getItem('cachedCompanies');
            if (cachedCompanies) {
                setCompanies(JSON.parse(cachedCompanies));
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Сбрасываем компании при изменении токена
        setCompanies([]);
        hasLoaded.current = false;

        // Пытаемся получить из кэша
        const cachedCompanies = localStorage.getItem('cachedCompanies');
        if (cachedCompanies) {
            setCompanies(JSON.parse(cachedCompanies));
        }

        // Загружаем компании только если есть токен
        if (token) {
            loadCompanies();
        }
    }, [token]); // Зависимость только от token

    const refreshCompanies = async (): Promise<void> => {
        // Сбрасываем флаг для принудительной перезагрузки
        hasLoaded.current = false;
        localStorage.removeItem('cachedCompanies');
        await loadCompanies();
    };

    return (
        <CompaniesContext.Provider value={{ companies, isLoading, refreshCompanies }}>
            {children}
        </CompaniesContext.Provider>
    );
};

export const useCompanies = () => {
    const context = useContext(CompaniesContext);
    if (!context) {
        throw new Error('useCompanies must be used within a CompaniesProvider');
    }
    return context;
};