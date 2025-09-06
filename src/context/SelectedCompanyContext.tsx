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
    const [selectedCompany, setSelectedCompanyState] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [availableCompanies, setAvailableCompaniesState] = useState<CompanyWithName[]>([]);

    useEffect(() => {
        const savedCompany = localStorage.getItem('selectedCompany');
        if (savedCompany) {
            try {
                const { companyId, role } = JSON.parse(savedCompany);
                setSelectedCompanyState(companyId);
                setSelectedRole(role);
            } catch (error) {
                console.error('Error parsing saved company:', error);
                localStorage.removeItem('selectedCompany');
            }
        }
    }, []);

    const resetSelectedCompany = useCallback(() => {
        setSelectedCompanyState(null);
        setSelectedRole(null);
        localStorage.removeItem('selectedCompany');
    }, []);


    const setSelectedCompany = useCallback((companyId: string | null, role: UserRole | null) => {
        setSelectedCompanyState(companyId);
        setSelectedRole(role);


        if (role && role.role === 'PORTAL_ROLE_SUPER_ADMIN') {
            // Для роли суперадминистратора сохраняем специальный маркер
            localStorage.setItem('selectedCompany', JSON.stringify({
                companyId: 'superadmin',
                role: { company_id: 'superadmin', role: 'PORTAL_ROLE_SUPER_ADMIN' }
            }));
        }
        if (companyId && role) {
            localStorage.setItem('selectedCompany', JSON.stringify({ companyId, role }));
        } else if (role && role.role === 'PORTAL_ROLE_USER') {
            // Для роли пользователя сохраняем специальный маркер
            localStorage.setItem('selectedCompany', JSON.stringify({
                companyId: 'user',
                role: { company_id: 'user', role: 'PORTAL_ROLE_USER' }
            }));
        } else {
            localStorage.removeItem('selectedCompany');
        }
    }, []);

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