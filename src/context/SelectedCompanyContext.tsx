import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { UserRole } from '../types/authTypes';
import { Company } from '../types/authTypes';
import {useAuth} from "./AuthContext";

interface SelectedCompanyContextType {
    selectedCompany: string | null;
    selectedRole: UserRole | null;
    setSelectedCompany: (companyId: string | null, role: UserRole | null) => void;
    updateSelectedCompany: (companyData: Partial<Company>) => void;
    availableCompanies: Array<{companyId: string, companyName: string, role: UserRole}>;
    setAvailableCompanies: (companies: Array<{companyId: string, companyName: string, role: UserRole}>) => void;
    resetSelectedCompany: () => void; // Добавляем эту функцию
}

interface CompanyWithName {
    companyId: string;
    companyName: string;
    role: UserRole;
}

const SelectedCompanyContext = createContext<SelectedCompanyContextType | null>(null);

export const useSelectedCompany = () => {
    const context = useContext(SelectedCompanyContext);
    if (!context) {
        throw new Error('useSelectedCompany must be used within a SelectedCompanyProvider');
    }
    return context;
};

export const SelectedCompanyProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const {userId, token} = useAuth();
    return <AccountSelectedCompanyProvider key={token && userId ? userId : 'anonymous'} userId={token ? userId : null}>
        {children}
    </AccountSelectedCompanyProvider>;
};

const AccountSelectedCompanyProvider: React.FC<{children: ReactNode; userId: string | null}> = ({children, userId}) => {
    const [selectedCompany, setSelectedCompanyState] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [availableCompanies, setAvailableCompaniesState] = useState<CompanyWithName[]>([]);

    useEffect(() => {
        const savedCompany = localStorage.getItem('selectedCompany');
        if (savedCompany) {
            try {
                const saved = JSON.parse(savedCompany);
                if (userId && saved.userId === userId && saved.role &&
                    typeof saved.role.role === 'string' &&
                    (saved.companyId === null || typeof saved.companyId === 'string')) {
                    setSelectedCompanyState(saved.companyId);
                    setSelectedRole(saved.role);
                } else localStorage.removeItem('selectedCompany');
            } catch (error) {
                console.error('Error parsing saved company:', error);
                localStorage.removeItem('selectedCompany');
            }
        }
    }, [userId]);

    const resetSelectedCompany = useCallback(() => {
        setSelectedCompanyState(null);
        setSelectedRole(null);
        localStorage.removeItem('selectedCompany');
    }, []);


    const setSelectedCompany = useCallback((companyId: string | null, role: UserRole | null) => {
        setSelectedCompanyState(companyId);
        setSelectedRole(role);


        if (userId && role) {
            localStorage.setItem('selectedCompany', JSON.stringify({userId, companyId, role}));
        } else {
            localStorage.removeItem('selectedCompany');
        }
    }, [userId]);

    const setAvailableCompanies = useCallback((companies: CompanyWithName[]) => {
        setAvailableCompaniesState(companies);
    }, []);

    const updateSelectedCompany = useCallback((companyData: Partial<Company>) => {
        if (!selectedCompany) return;

        // Обновляем информацию о выбранной компании
        setAvailableCompaniesState((prev: CompanyWithName[]) =>
            prev.map((company: CompanyWithName) =>
                company.companyId === selectedCompany
                    ? { ...company, companyName: companyData.company_name || company.companyName }
                    : company
            )
        );
    }, [selectedCompany]);

    return (
        <SelectedCompanyContext.Provider value={{
            selectedCompany,
            selectedRole,
            setSelectedCompany,
            updateSelectedCompany,
            availableCompanies,
            setAvailableCompanies,
            resetSelectedCompany // Добавляем в провайдер
        }}>
            {children}
        </SelectedCompanyContext.Provider>
    );
};