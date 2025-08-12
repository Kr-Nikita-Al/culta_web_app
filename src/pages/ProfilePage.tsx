import React, {useState, useEffect, useRef, useCallback} from 'react';
import { useApi } from '../hooks/useApi';
import { getUserRoles } from '../services/authService';
import { getAllCompanies } from '../services/companyService';
import { Company } from '../types/authTypes';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import config from "../config";

interface EnhancedRole {
    role: string;
    roleName: string;
    company_id?: string;
    company_name?: string;
}

const ProfilePage: React.FC = () => {
    const [roles, setRoles] = useState<EnhancedRole[]>([]);
    const [, setAllCompanies] = useState<Company[]>([]);
    const [companiesMap, setCompaniesMap] = useState<Map<string, string>>(new Map());
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
    const [showRoles, setShowRoles] = useState(false);

    const { token } = useAuth();
    const api = useApi();
    const hasFetched = useRef(false);

    // Мемоизированные функции
    const getRoleName = useCallback((role: string): string => {
        // Приводим тип объекта маппинга к Record<string, string>
        const mapping = config.rolesMapping as Record<string, string>;
        return mapping[role] || role.replace('PORTAL_ROLE_', '').replace(/_/g, ' ');
    }, []);

    const updateCompaniesMap = useCallback((companies: Company[]) => {
        const map = new Map();
        companies.forEach(company => {
            map.set(company.company_id, company.company_name);
        });
        setCompaniesMap(map);
    }, []);

    const getCompanyName = useCallback((companyId: string): string => {
        return companiesMap.get(companyId) || 'Неизвестная компания';
    }, [companiesMap]);

    // Загрузка компаний
    useEffect(() => {
        if (!token || hasFetched.current) return;

        const loadCompanies = async () => {
            const cachedCompanies = localStorage.getItem(config.companiesCacheKey);
            if (cachedCompanies) {
                const companies = JSON.parse(cachedCompanies);
                setAllCompanies(companies);
                updateCompaniesMap(companies);
                return;
            }

            hasFetched.current = true;
            setIsLoadingCompanies(true);

            try {
                const response = await api.callApi(() => getAllCompanies(token));
                if (response && response.companies) {
                    setAllCompanies(response.companies);
                    updateCompaniesMap(response.companies);
                    localStorage.setItem(config.companiesCacheKey, JSON.stringify(response.companies));
                }
            } catch (err: any) {
                console.error('Ошибка загрузки компаний:', err);
                setError('Не удалось загрузить список компаний');
            } finally {
                setIsLoadingCompanies(false);
            }
        };

        loadCompanies();
    }, [token, api.callApi, updateCompaniesMap]);

    // Обработчик переключения ролей
    const handleToggleRoles = useCallback(async () => {
        if (showRoles) {
            setShowRoles(false);
            return;
        }

        if (!token) {
            setError('Вы не авторизованы');
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            const result = await api.callApi(() => getUserRoles(token));
            if (result) {
                const enhancedRoles: EnhancedRole[] = result.map(role => {
                    const isSuperAdmin = role.role === 'PORTAL_ROLE_SUPER_ADMIN';

                    return {
                        role: role.role,
                        roleName: getRoleName(role.role),
                        company_id: isSuperAdmin ? undefined : role.company_id,
                        company_name: isSuperAdmin ? 'Все заведения' : getCompanyName(role.company_id)
                    };
                });

                setRoles(enhancedRoles);
                setShowRoles(true);
            }
        } catch (err: any) {
            if (err.response) {
                setError(`Ошибка сервера: ${err.response.status} ${err.response.data?.detail || ''}`);
            } else {
                setError('Сервер недоступен или проблема с сетью');
            }
        } finally {
            setIsLoading(false);
        }
    }, [showRoles, token, api.callApi, getRoleName, getCompanyName]);

    // Функция для получения ширины кнопки в пикселях
    const getButtonWidth = () => {
        // Ширина самой широкой версии кнопки
        return "220px"; // Эмпирически подобранное значение
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-coffee-dark mb-8">Ваш профиль</h1>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-amber-800 mb-4">Управление ролями</h2>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-coffee-dark">
                            Просмотрите ваши текущие роли в системе
                        </p>
                        {isLoadingCompanies && (
                            <p className="text-sm text-amber-600 mt-1">Загрузка списка компаний...</p>
                        )}
                    </div>

                    <button
                        onClick={handleToggleRoles}
                        disabled={isLoading || isLoadingCompanies}
                        className="bg-amber-700 hover:bg-amber-800 text-white py-2 px-6 rounded-lg transition disabled:opacity-50 flex items-center justify-center"
                        style={{
                            width: getButtonWidth(),
                            minWidth: getButtonWidth()
                        }}
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Загрузка...
                            </>
                        ) : showRoles ? 'Скрыть мои роли' : 'Показать мои роли'}
                    </button>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 p-3 bg-red-100 text-red-700 rounded"
                    >
                        {error}
                    </motion.div>
                )}
            </div>

            <AnimatePresence>
                {showRoles && roles.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white rounded-xl shadow-lg p-6"
                    >
                        <h2 className="text-xl font-semibold text-amber-800 mb-4">Ваши роли:</h2>

                        <ul className="space-y-4">
                            <AnimatePresence>
                                {roles.map((role, index) => (
                                    <motion.li
                                        key={`${role.role}-${index}`}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2, delay: index * 0.05 }}
                                        className="p-5 bg-amber-50 rounded-xl border border-amber-100 shadow-sm"
                                    >
                                        <div className="flex items-start">
                                            <div className="flex-1">
                                                <h3 className="font-bold text-xl text-coffee-dark">
                                                    {role.roleName}
                                                </h3>

                                                {role.company_name && (
                                                    <div className="mt-2">
                                                        <p className="text-gray-600 text-sm">Заведение:</p>
                                                        <p className="font-medium text-gray-800">
                                                            {role.company_name}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-amber-200 text-amber-800 rounded-full w-10 h-10 flex items-center justify-center">
                                                {role.role === 'PORTAL_ROLE_SUPER_ADMIN' && '👑'}
                                                {role.role === 'PORTAL_ROLE_ADMIN' && '🔑'}
                                                {role.role === 'PORTAL_ROLE_MODERATOR' && '👀'}
                                                {role.role === 'PORTAL_ROLE_USER' && '👤'}
                                            </div>
                                        </div>

                                        {role.role === 'PORTAL_ROLE_SUPER_ADMIN' && (
                                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <p className="text-yellow-700 text-sm">
                                                    Эта роль предоставляет полный доступ ко всем заведениям системы
                                                </p>
                                            </div>
                                        )}
                                    </motion.li>
                                ))}
                            </AnimatePresence>
                        </ul>
                    </motion.div>
                )}

                {showRoles && roles.length === 0 && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white rounded-xl shadow-lg p-6 text-center"
                    >
                        <p className="text-gray-600">Роли не назначены</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ProfilePage;