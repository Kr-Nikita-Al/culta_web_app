import React, {useCallback} from 'react';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import {useNavigate} from "react-router-dom";

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    const { selectedRole } = useSelectedCompany();
    const navigate = useNavigate();
    const isUserRole = selectedRole?.role === 'PORTAL_ROLE_USER';

    // Показываем вкладку "Компания" только если роль не пользовательская и есть админские права
    const shouldShowCompaniesTab = !isUserRole && selectedRole && (
        selectedRole.role === 'PORTAL_ROLE_ADMIN' ||
        selectedRole.role === 'PORTAL_ROLE_SUPER_ADMIN'
    );

    // Мемоизируем обработчики для предотвращения лишних рендеров
    const handleProfileClick = useCallback(() => {
        onTabChange('profile');
        navigate('/profile/user_info');
    }, [onTabChange, navigate]);

    const handleCompaniesClick = useCallback(() => {
        onTabChange('companies');
        navigate('/profile/company');
    }, [onTabChange, navigate]);

    return (
        <div className="w-64 mt-8 ml-16">
            <div className="bg-black bg-opacity-10 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white border-opacity-20">
                <h2 className="text-xl font-semibold mb-6 text-white">Меню</h2>
                <nav>
                    <ul className="space-y-3">
                        <li>
                            <button
                                onClick={handleProfileClick}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                                    activeTab === 'profile'
                                        ? 'bg-white bg-opacity-20 text-white shadow-md'
                                        : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100'
                                }`}
                            >
                                Профиль
                            </button>
                        </li>

                        {shouldShowCompaniesTab && (
                            <li>
                                <button
                                    onClick={handleCompaniesClick}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                                        activeTab === 'companies'
                                            ? 'bg-white bg-opacity-20 text-white shadow-md'
                                            : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100'
                                    }`}
                                >
                                    Компания
                                </button>
                            </li>
                        )}
                    </ul>
                </nav>
            </div>
        </div>
    );
};

export default Sidebar;