import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { useCompanies } from '../context/CompaniesContext';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import logo from '../assets/logo.svg';
import Button from './Button';
import {ROLE_DISPLAY_NAMES} from '../services/roleService';

const Header: React.FC = () => {
    const { token, roles, sessionError, retrySession, logout } = useAuth();
    const { selectedCompany, selectedRole, availableCompanies, setSelectedCompany } = useSelectedCompany();
    const { companies, refreshCompanies, isLoading, error: companiesError } = useCompanies();
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Проверяем, является ли пользователь суперадминистратором
    const isSuperAdmin = roles?.some(role => role.role === 'PORTAL_ROLE_SUPER_ADMIN');
// Проверяем, есть ли у пользователя только роль пользователя
    const hasOnlyUserRole = roles &&
        roles.length === 1 &&
        roles[0].role === 'PORTAL_ROLE_USER';

    const hasUserRole = roles?.some(role => role.role === 'PORTAL_ROLE_USER');

    const getRoleName = (role: string): string => ROLE_DISPLAY_NAMES[role] || role;

    const getSelectedCompanyName = () => {
        if (!selectedCompany) {
            if (selectedRole?.role === 'PORTAL_ROLE_USER') {
                return 'Пользователь';
            }
            if (selectedRole?.role === 'PORTAL_ROLE_SUPER_ADMIN') {
                return 'Супер администратор';
            }
            return 'Неизвестная компания';
        }

        const company = companies.find(c => c.company_id === selectedCompany);
        return company?.company_name || 'Неизвестная компания';
    };

    const handleCompanyChange = (companyId: string | null, role: any) => {
        setSelectedCompany(companyId, role);
        setShowCompanyDropdown(false);
        navigate('/profile/user_info');
    };

    const handleLogout = async () => {
        await logout();
    };

    const getDropdownOptions = () => {
        const options = [];

        if (isSuperAdmin) {
            options.push({
                id: 'superadmin',
                name: 'Супер администратор',
                role: { company_id: 'superadmin', role: 'PORTAL_ROLE_SUPER_ADMIN' }
            });
        }

        availableCompanies.forEach(company => {
            // Проверяем, что это не дублирующая запись суперадминистратора
            if (company.role.role !== 'PORTAL_ROLE_SUPER_ADMIN') {
                options.push({
                    id: company.companyId,
                    name: `${company.companyName} (${getRoleName(company.role.role)})`,
                    role: company.role
                });
            }
        });

        if (hasUserRole) {
            options.push({
                id: 'user',
                name: 'Пользователь',
                role: { company_id: 'user', role: 'PORTAL_ROLE_USER' }
            });
        }

        return options;
    };

    // Условие отображения селектора компаний
    const shouldShowCompanySelector = token &&
        getDropdownOptions().length > 0 && // Используем функцию получения опций
        !hasOnlyUserRole && // Не показываем если только роль пользователя
        location.pathname !== '/login' &&
        !location.pathname.startsWith('/auth/');

    return (
        <header className="app-header bg-coffee-dark text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
            <Link to="/" className="flex items-center">
                <img src={logo} alt="Cafe Logo" className="h-10 mr-3" />
                <span className="text-xl font-semibold">CoffeeStaff</span>
            </Link>

            <div className="flex items-center space-x-4">
                {sessionError && <div role="alert" className="text-sm max-w-xs">
                    {sessionError}
                    <button type="button" className="underline ml-2" onClick={retrySession}>Повторить</button>
                </div>}
                {shouldShowCompanySelector && (
                    <div className="relative">
                        <Button
                            variant="ghost"
                            aria-expanded={showCompanyDropdown}
                            onClick={() => {
                                if (!showCompanyDropdown && isSuperAdmin) void refreshCompanies();
                                setShowCompanyDropdown(!showCompanyDropdown);
                            }}
                            className="company-trigger"
                        >
                            <span>
                                {getSelectedCompanyName()}
                                {selectedRole && selectedRole.role !== 'PORTAL_ROLE_USER' && selectedRole.role !== 'PORTAL_ROLE_SUPER_ADMIN' && ` (${getRoleName(selectedRole.role)})`}
                            </span>
                            <span aria-hidden="true" className="company-chevron">⌄</span>
                        </Button>

                        {showCompanyDropdown && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10">
                                <div className="py-1">
                                    {isLoading && <p role="status" className="px-4 py-2 text-sm text-gray-500">Обновление компаний…</p>}
                                    {companiesError && <div className="px-4 py-2 text-sm text-red-700" role="alert">
                                        {companiesError}
                                        <button type="button" disabled={isLoading} className="block underline mt-1"
                                            onClick={() => void refreshCompanies()}>Повторить</button>
                                    </div>}
                                    {getDropdownOptions().map(option => (
                                        <button
                                            key={`${option.id}:${option.role.role}`}
                                            onClick={() => handleCompanyChange(option.id === 'user' || option.id === 'superadmin' ? null : option.id, option.role)}
                                            className="block w-full text-left px-4 py-2 text-sm text-coffee-dark hover:bg-coffee-cream"
                                        >
                                            {option.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {token && (
                    <Button variant="ghost"
                        onClick={handleLogout}
                        className="logout-button"
                    >
                        Выйти
                    </Button>
                )}
            </div>
        </header>
    );
};

export default Header;
