import React, {createContext, useContext, useState, useEffect} from 'react';
import { useAuth } from './AuthContext';
import { useApi } from '../hooks/useApi';
import { getAllCompanies } from '../services/companyService';
import { Company } from '../types/authTypes';

interface CompaniesContextType {
    companies: Company[];
    isLoading: boolean;
    refreshCompanies: () => void;
}

const CompaniesContext = createContext<CompaniesContextType | null>(null);

export const CompaniesProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { token } = useAuth();
    const { callApi } = useApi();

    const loadCompanies = async () => {
        if (!token) return;

        setIsLoading(true);
        try {
            const response = await callApi(() => getAllCompanies(token));
            if (response?.companies) {
                setCompanies(response.companies);
                localStorage.setItem('cachedCompanies', JSON.stringify(response.companies));
            }
        } catch (error) {
            console.error('Ошибка загрузки компаний:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Пытаемся получить из кэша
        const cachedCompanies = localStorage.getItem('cachedCompanies');
        if (cachedCompanies) {
            setCompanies(JSON.parse(cachedCompanies));
        } else {
            loadCompanies();
        }
    }, [token]);

    const refreshCompanies = () => {
        localStorage.removeItem('cachedCompanies');
        loadCompanies();
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