import {useAuth} from '../context/AuthContext';
import React, {useCallback} from 'react';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { useNavigate } from 'react-router-dom';
import {useCompanyModules} from './CompanyModuleGate';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    const { selectedRole } = useSelectedCompany();
    const navigate = useNavigate();
    const {roles}=useAuth();
    const modules = useCompanyModules();

    // Проверяем, является ли выбранная роль пользовательской
    const isUserRole = selectedRole?.role === 'PORTAL_ROLE_USER';

    // Показываем вкладку "Компания" только если роль не пользовательская и есть админские права
    const shouldShowCompaniesTab = !isUserRole && selectedRole && (
        selectedRole.role === 'PORTAL_ROLE_ADMIN' ||
        selectedRole.role === 'PORTAL_ROLE_OWNER' ||
        selectedRole.role === 'PORTAL_ROLE_SUPER_ADMIN'
    );

    // Показываем вкладку "Изображения" для администраторов и модераторов
    const shouldShowImagesTab = !isUserRole && selectedRole && (
        selectedRole.role === 'PORTAL_ROLE_OWNER' ||
        selectedRole.role === 'PORTAL_ROLE_ADMIN' ||
        selectedRole.role === 'PORTAL_ROLE_MODERATOR'
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

    const handleImagesClick = useCallback(() => {
        onTabChange('images');
        navigate('/profile/images');
    }, [onTabChange, navigate]);

    return (
        <div className="app-sidebar w-64 mt-8 ml-16">
            <div className="bg-black bg-opacity-10 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white border-opacity-20">
                <h2 className="text-xl font-semibold mb-6 text-white">Оглавление</h2>
                <nav>
                    <ul>
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

                        {modules.orders && <li>
                            <button onClick={() => onTabChange('orders')}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${activeTab === 'orders' ? 'bg-white bg-opacity-20 text-white shadow-md' : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10'}`}>
                                Заказы
                            </button>
                        </li>}

                        {modules.reservations && selectedRole && ['PORTAL_ROLE_OWNER', 'PORTAL_ROLE_ADMIN', 'PORTAL_ROLE_HOSTESS', 'PORTAL_ROLE_WAITER'].includes(selectedRole.role) && <li>
                            <button onClick={() => onTabChange('reservations')}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${activeTab === 'reservations' ? 'bg-white bg-opacity-20 text-white shadow-md' : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10'}`}>
                                Бронирования
                            </button>
                        </li>}

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

                        {modules.images && shouldShowImagesTab && (
                            <li>
                                <button
                                    onClick={handleImagesClick}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                                        activeTab === 'images'
                                            ? 'bg-white bg-opacity-20 text-white shadow-md'
                                            : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100'
                                    }`}
                                >
                                    Изображения
                                </button>
                            </li>
                        )}
                        {shouldShowImagesTab && <li><button onClick={()=>onTabChange('screens')}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${activeTab==='screens'?'bg-white bg-opacity-20 text-white shadow-md':'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10'}`}>Меню</button></li>}
                        {roles?.some(r=>r.role==='PORTAL_ROLE_SUPER_ADMIN')&&<li><button
                            aria-current={activeTab==='statistics'?'page':undefined}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${activeTab==='statistics'?'bg-white bg-opacity-20 text-white shadow-md':'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100'}`}
                            onClick={()=>{onTabChange('statistics');navigate('/profile/statistics');}}>Статистика заведений</button></li>}
                    </ul>
                </nav>
            </div>
        </div>
    );
};

export default Sidebar;
