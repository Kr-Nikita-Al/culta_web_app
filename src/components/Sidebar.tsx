import React from 'react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    const { roles } = useAuth(); // Используем отдельное состояние ролей

    // Проверяем, есть ли у пользователя административные роли
    const isAdmin = roles?.some(role =>
        role.role === 'PORTAL_ROLE_ADMIN' || role.role === 'PORTAL_ROLE_SUPER_ADMIN'
    );

    return (
        <div className="w-64 mt-8 ml-16">
            <div className="bg-black bg-opacity-10 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white border-opacity-20">
                <h2 className="text-xl font-semibold mb-6 text-white">Меню</h2>
                <nav>
                    <ul className="space-y-3">
                        <li>
                            <button
                                onClick={() => onTabChange('profile')}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                                    activeTab === 'profile'
                                        ? 'bg-white bg-opacity-20 text-white shadow-md'
                                        : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100'
                                }`}
                            >
                                Профиль
                            </button>
                        </li>

                        {isAdmin && (
                            <li>
                                <button
                                    onClick={() => onTabChange('companies')}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                                        activeTab === 'companies'
                                            ? 'bg-white bg-opacity-20 text-white shadow-md'
                                            : 'text-white text-opacity-80 hover:bg-white hover:bg-opacity-10 hover:text-opacity-100'
                                    }`}
                                >
                                    Компании
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