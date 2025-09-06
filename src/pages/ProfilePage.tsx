import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { getUserRoles } from '../services/authService';
import { getUserInfo } from '../services/userService';
import {Company, UserRole} from '../types/authTypes';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useApiCall } from '../hooks/useApiCall';
import LoadingSpinner from '../components/LoadingSpinner';
import {useCompanies} from "../context/CompaniesContext";
import { useSelectedCompany } from '../context/SelectedCompanyContext';

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
    const { callApi: loadRoles, loading: rolesLoading, error: rolesError } = useApiCall<UserRole[]>();
    const { callApi } = useApi();
    const { companies, refreshCompanies } = useCompanies();
    const { token, userId, userInfo, updateUserInfo } = useAuth();
    const { selectedCompany: selectedCompanyId, selectedRole } = useSelectedCompany();
    const selectedCompany = companies.find(c => c.company_id === selectedCompanyId);


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


    useEffect(() => {
        const loadUserData = async () => {
            if (!token || !userId || userInfo) return;

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

        loadUserData();
    }, [token, userId, userInfo, updateUserInfo, callApi]);

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
                        {selectedRole && (
                            <div>
                                <p className="text-gray-600 text-sm">Роль в системе</p>
                                <p className="font-medium text-coffee-dark">
                                    {
                                        selectedRole.role === 'PORTAL_ROLE_SUPER_ADMIN'
                                        ? 'Супер администратор'
                                            : selectedRole.role === 'PORTAL_ROLE_USER'
                                                ? 'Пользователь'
                                                : `${getRoleName(selectedRole.role)} в ${selectedCompany ? selectedCompany.company_name : 'Неизвестная компания'}`
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;