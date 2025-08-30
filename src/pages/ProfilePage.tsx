import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getUserRoles } from '../services/authService';
import { getUserInfo } from '../services/userService';
import {Company, UserRole} from '../types/authTypes';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useApiCall } from '../hooks/useApiCall';
import LoadingSpinner from '../components/LoadingSpinner';

interface EnhancedRole {
    role: string;
    roleName: string;
    company_id?: string;
    company_name?: string;
}

const ProfilePage: React.FC = () => {
    const [roles, setRoles] = useState<EnhancedRole[]>([]);
    const [companiesMap] = useState<Map<string, string>>(new Map());
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingCompanies] = useState(false);
    const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(false);
    const [showRoles, setShowRoles] = useState(false);
    const { token, userId, userInfo, updateUserInfo } = useAuth();
    const { callApi: loadRoles, loading: rolesLoading, error: rolesError } = useApiCall<UserRole[]>();
    const { callApi } = useApi();

    // Мемоизированные функции
    const getRoleName = useCallback((role: string): string => {
        const roleNameMapping: Record<string, string> = {
            'PORTAL_ROLE_SUPER_ADMIN': 'Супер-админ',
            'PORTAL_ROLE_ADMIN': 'Администратор',
            'PORTAL_ROLE_MODERATOR': 'Модератор',
            'PORTAL_ROLE_USER': 'Пользователь'
        };
        return roleNameMapping[role] || role.replace('PORTAL_ROLE_', '').replace(/_/g, ' ');
    }, []);

    const getCompanyName = useCallback((companyId: string): string => {
        return companiesMap.get(companyId) || 'Неизвестная компания';
    }, [companiesMap]);

    useEffect(() => {
        if (!token || !userId || userInfo) return;

        const loadUserInfo = async () => {
            setIsLoadingUserInfo(true);
            try {
                // ИСПРАВЛЕННАЯ СТРОКА - используем callApi вместо api.callApi
                const userData = await callApi(() => {
                    if (!token || !userId) throw new Error('Отсутствует токен или ID пользователя');
                    return getUserInfo(token, userId);
                });
                // ... остальной код ...
            } catch (err: any) {
                console.error('Ошибка загрузки информации о пользователе:', err);
                setError('Не удалось загрузить информацию о пользователе');
            } finally {
                setIsLoadingUserInfo(false);
            }
        };

        loadUserInfo();
    }, [token, userId, userInfo, updateUserInfo, callApi]);

    const hasFetchedUserInfo = useRef(false);

    useEffect(() => {
        // Если уже загружали или нет необходимых данных, выходим
        if (hasFetchedUserInfo.current || !token || !userId || userInfo) return;

        const loadUserInfo = async () => {
            hasFetchedUserInfo.current = true;
            setIsLoadingUserInfo(true);

            try {
                const userData = await callApi(() => {
                    if (!token || !userId) {
                        throw new Error('Отсутствует токен или ID пользователя');
                    }
                    return getUserInfo(token, userId);
                });

                if (userData) {
                    updateUserInfo(userData);
                }
            } catch (err: any) {
                console.error('Ошибка загрузки информации о пользователе:', err);
                setError('Не удалось загрузить информацию о пользователе');
            } finally {
                setIsLoadingUserInfo(false);
            }
        };

        loadUserInfo();
    }, [token, userId, userInfo, updateUserInfo, callApi]);

    // Добавьте очистку при размонтировании компонента
    useEffect(() => {
        return () => {
            hasFetchedUserInfo.current = false;
        };
    }, []);


    // Фильтрация ролей - убираем USER если есть другие роли
    const filteredRoles = useMemo(() => {
        const hasNonUserRoles = roles.some(role => role.role !== 'PORTAL_ROLE_USER');
        return hasNonUserRoles
            ? roles.filter(role => role.role !== 'PORTAL_ROLE_USER')
            : roles;
    }, [roles]);

    const handleToggleRoles = useCallback(async () => {
        if (showRoles) {
            setShowRoles(false);
            return;
        }

        if (!token) {
            setError('Вы не авторизованы');
            return;
        }

        const result = await loadRoles(() => getUserRoles(token));
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
    }, [showRoles, token, getRoleName, getCompanyName, loadRoles]);

    // Форматирование даты
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-coffee-dark mb-8">Ваш профиль</h1>

            {/* Информация о пользователе */}
            {userInfo && (
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold text-amber-800 mb-4">Личная информация</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-gray-600 text-sm">Имя</p>
                            <p className="font-medium text-coffee-dark">{userInfo.name}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Фамилия</p>
                            <p className="font-medium text-coffee-dark">{userInfo.surname}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Телефон</p>
                            <p className="font-medium text-coffee-dark">{userInfo.phone}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Email</p>
                            <p className="font-medium text-coffee-dark">{userInfo.email}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Статус</p>
                            <p className="font-medium text-coffee-dark">
                                {userInfo.is_active ? 'Активен' : 'Неактивен'}
                            </p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Дата создания</p>
                            <p className="font-medium text-coffee-dark">{formatDate(userInfo.time_created)}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">Последнее обновление</p>
                            <p className="font-medium text-coffee-dark">{formatDate(userInfo.time_updated)}</p>
                        </div>

                        <div>
                            <p className="text-gray-600 text-sm">ID пользователя</p>
                            <p className="font-medium text-coffee-dark text-xs">{userInfo.user_id}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Блок управления ролями */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-amber-800 mb-4">Управление ролями</h2>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-coffee-dark">
                            Просмотрите ваши текущие роли в системе
                        </p>
                        {isLoadingCompanies && (
                            <div className="flex justify-center my-2">
                                <LoadingSpinner size="small" text="Загрузка списка компаний..."/>
                            </div>
                        )}
                        {isLoadingUserInfo && (
                            <div className="flex justify-center my-4">
                                <LoadingSpinner size="medium" text="Загрузка информации о пользователе..."/>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleToggleRoles}
                        disabled={isLoading || isLoadingCompanies || isLoadingUserInfo}
                        className="bg-amber-700 hover:bg-amber-800 text-white py-2 px-6 rounded-lg transition disabled:opacity-50 flex items-center justify-center"
                        style={{width: '220px', minWidth: '220px'}}
                    >
                        {isLoading ? (
                            <>
                                <LoadingSpinner size="small" text="" className="text-white"/>
                                <span className="ml-2">Загрузка...</span>
                            </>
                        ) : showRoles ? 'Скрыть мои роли' : 'Показать мои роли'}
                    </button>
                </div>

                {error && (
                    <motion.div
                        initial={{opacity: 0, height: 0}}
                        animate={{opacity: 1, height: 'auto'}}
                        className="mt-4 p-3 bg-red-100 text-red-700 rounded"
                    >
                        {error}
                    </motion.div>
                )}
            </div>

            {/* Отображение ролей */}
            <AnimatePresence>
                {showRoles && filteredRoles.length > 0 && (
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
                                {filteredRoles.map((role, index) => (
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

                                                {/* Показываем заведение только если это не USER роль */}
                                                {role.role !== 'PORTAL_ROLE_USER' && role.company_name && (
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
            </AnimatePresence>
        </div>
    );
};

export default ProfilePage;