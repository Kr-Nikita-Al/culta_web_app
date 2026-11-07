import React, {createContext, useContext, useState, useEffect, useRef, useCallback} from 'react';
import { useAuth } from './AuthContext';
import { getAllCompanies } from '../services/companyService';
import { Company } from '../types/authTypes';
import {imageSessionScope} from '../utils/imageSessionScope';

interface CompaniesContextType {
    companies: Company[];
    isLoading: boolean;
    error: string | null;
    refreshCompanies: () => Promise<void>;
}

const CompaniesContext = createContext<CompaniesContextType | null>(null);

export const CompaniesProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const {token, userId} = useAuth();
    return <AccountCompaniesProvider key={imageSessionScope(userId, token)}>{children}</AccountCompaniesProvider>;
};

const AccountCompaniesProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { token } = useAuth();
    const currentToken = useRef(token);
    currentToken.current = token;
    const hasLoaded = useRef(false); // Флаг для отслеживания загрузки
    const pending = useRef<Promise<void> | null>(null);
    const generation = useRef(0);

    const loadCompanies = useCallback((force = false): Promise<void> => {
        if (!currentToken.current) return Promise.resolve();
        if (pending.current) return pending.current;
        if (!force && hasLoaded.current) return Promise.resolve();
        const requestGeneration = generation.current;

        setIsLoading(true);
        setError(null);
        const request = (async () => {
        try {
            const response = await getAllCompanies(currentToken.current!);
            if (requestGeneration !== generation.current) return;
            if (!response || !Array.isArray(response.companies) ||
                response.companies.some(company => !company || typeof company.company_name !== 'string')) {
                throw new Error('Invalid company list');
            }
            setCompanies(response.companies);
                localStorage.setItem('cachedCompanies', JSON.stringify(response.companies));
                hasLoaded.current = true; // Устанавливаем флаг после успешной загрузки
        } catch (error) {
            if (requestGeneration !== generation.current) return;
            setError('Не удалось обновить список компаний. Попробуйте ещё раз.');
            // Keep the currently displayed list on a transient failure.
        } finally {
            if (requestGeneration === generation.current) {
                pending.current = null;
                setIsLoading(false);
            }
        }
        })();
        pending.current = request;
        return request;
    }, []);

    useEffect(() => {
        // Сбрасываем компании при изменении токена
        setCompanies([]);
        hasLoaded.current = false;
        pending.current = null;
        setIsLoading(false);
        // Never restore another account's company list from the shared cache.
        localStorage.removeItem('cachedCompanies');

        // Загружаем компании только если есть токен
        if (currentToken.current) {
            loadCompanies();
        }
        const requests=generation;
        return () => {requests.current++; pending.current = null;};
    }, [loadCompanies]);

    const refreshCompanies = useCallback(() => loadCompanies(true), [loadCompanies]);

    return (
        <CompaniesContext.Provider value={{ companies, isLoading, error, refreshCompanies }}>
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
