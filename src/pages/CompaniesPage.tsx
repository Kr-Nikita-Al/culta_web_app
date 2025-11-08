import React, {useState, useEffect, useCallback} from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { getCompanyById, updateCompany } from '../services/companyService';
import { Company } from '../types/authTypes';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { useCompanies } from '../context/CompaniesContext';
import LoadingSpinner from '../components/LoadingSpinner';
import successImage from '../assets/success.svg';
import CreateCompanyForm from '../components/CreateCompanyForm';
import api from '../services/api';
import config from "../config";
import axios from "axios";
import { useNotifications } from '../context/NotificationContext';
import { motion } from 'framer-motion';

const CompaniesPage: React.FC = () => {
    const [companyData, setCompanyData] = useState<Company | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedCompany, setEditedCompany] = useState<Partial<Company>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [showSuccess, setShowSuccess] = useState(false);
    const [delegateAction, setDelegateAction] = useState<'grant' | 'revoke'>('grant');
    const [delegateRole, setDelegateRole] = useState('');
    const [delegateUserId, setDelegateUserId] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error' | 'info'>('idle');
    const [superAdminSelectedCompany, setSuperAdminSelectedCompany] = useState<string>('');
    const { addNotification } = useNotifications();
    const { selectedCompany: contextSelectedCompany, selectedRole } = useSelectedCompany();
    const { companies, refreshCompanies } = useCompanies();
    const { token } = useAuth();
    const { callApi } = useApi();
    const { updateSelectedCompany } = useSelectedCompany();
    const [companyCache, setCompanyCache] = useState<Record<string, Company>>({});

    const isSuperAdmin = selectedRole?.role === 'PORTAL_ROLE_SUPER_ADMIN';

    // Регулярные выражения для валидации
    const phoneRegex = /^(\+7|8)[0-9]{10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Получаем название выбранной компании
    const getCompanyName = () => {
        if (!contextSelectedCompany) return 'Неизвестная компания';

        const company = companies.find(c => c.company_id === contextSelectedCompany);
        return company?.company_name || 'Неизвестная компания';
    };


    // Загрузка данных компании при изменении выбранной компании
    useEffect(() => {
        if (isSuperAdmin) {
            setLoading(false);
            return;
        }

        if (contextSelectedCompany && token) {
            // Проверяем кеш
            if (companyCache[contextSelectedCompany]) {
                setCompanyData(companyCache[contextSelectedCompany]);
                setEditedCompany(companyCache[contextSelectedCompany]);
                setLoading(false);
                return;
            }

            const loadCompanyData = async () => {
                setLoading(true);
                try {
                    const data = await callApi(() => getCompanyById(contextSelectedCompany));
                    if (data) {
                        setCompanyData(data);
                        setEditedCompany(data);
                        // Сохраняем в кеш
                        setCompanyCache(prev => ({
                            ...prev,
                            [contextSelectedCompany]: data
                        }));
                    }
                } catch (err) {
                    setError('Ошибка загрузки данных компании');
                } finally {
                    setLoading(false);
                }
            };

            loadCompanyData();
        }
    }, [contextSelectedCompany, token, callApi, isSuperAdmin, companyCache]);

    // Валидация полей
    const validateField = (name: string, value: string): string => {
        switch (name) {
            case 'phone':
                if (!value.trim()) return 'Телефон обязателен для заполнения';
                return phoneRegex.test(value.replace(/\s/g, '')) ? '' : 'Неверный формат телефона';
            case 'email':
                if (!value.trim()) return 'Email обязателен для заполнения';
                return emailRegex.test(value) ? '' : 'Неверный формат email';
            default:
                return '';
        }
    };

    // Проверка всей формы
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Проверяем телефон
        if (editedCompany.phone) {
            const phoneError = validateField('phone', editedCompany.phone);
            if (phoneError) newErrors.phone = phoneError;
        }

        // Проверяем email
        if (editedCompany.email) {
            const emailError = validateField('email', editedCompany.email);
            if (emailError) newErrors.email = emailError;
        }

        setFieldErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const fieldValue = type === 'checkbox' ? checked : value;

        setEditedCompany(prev => ({
            ...prev,
            [name]: fieldValue
        }));

        // Валидация при изменении
        if (name === 'phone' || name === 'email') {
            const error = validateField(name, value);
            setFieldErrors(prev => ({ ...prev, [name]: error }));
        }
    };

    const resetEditingState = () => {
        setIsEditing(false);
        // Восстанавливаем оригинальные данные из companyData
        setEditedCompany(companyData || {});
        setFieldErrors({});
        setSaveStatus('idle');
    };

    const hasChanges = useCallback(() => {
        if (!companyData) return false;

        return Object.keys(editedCompany).some(key => {
            const companyKey = key as keyof Company;
            return editedCompany[companyKey] !== companyData[companyKey];
        });
    }, [companyData, editedCompany]);

    const handleSave = async () => {
        if (!contextSelectedCompany || !token || !validateForm()) return;

        // Проверяем, есть ли изменения
        if (!hasChanges()) {
            addNotification('Нет изменений для сохранения', 'info');
            resetEditingState();
            return;
        }

        setLoading(true);

        try {
            // Оптимистично обновляем UI
            if (companyData) {
                const updatedCompanyData = {
                    ...companyData,
                    ...editedCompany
                };

                setCompanyData(updatedCompanyData);
                setCompanyCache(prev => ({
                    ...prev,
                    [contextSelectedCompany]: updatedCompanyData
                }));
                updateSelectedCompany(updatedCompanyData);
            }

            // Сразу выходим из режима редактирования
            setIsEditing(false);

            // Отправляем запрос в фоне без ожидания
            updateCompany(contextSelectedCompany, editedCompany)
                .then(() => {
                    addNotification('Изменения компании сохранены успешно', 'success');
                })
                .catch((error) => {
                    console.error('Ошибка сохранения:', error);
                    addNotification('Ошибка при сохранении изменений', 'error');

                    // Откатываем изменения в случае ошибки
                    if (companyData) {
                        setCompanyData(companyData);
                        setCompanyCache(prev => ({
                            ...prev,
                            [contextSelectedCompany]: companyData
                        }));
                        updateSelectedCompany(companyData);
                    }
                });

        } catch (err: any) {
            console.error('Ошибка:', err);
            addNotification('Произошла ошибка', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+Enter или Cmd+Enter - сохранить
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            // Enter в любом поле input - сохранить
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            // Escape - отмена
            e.preventDefault();
            resetEditingState();
        }
    }, [handleSave, resetEditingState]);

    const grantAdminPrivilege = async (userId: string, companyId: string) => {
        const response = await axios.post(
            `${config.apiBaseUrl}/user_role/grant_admin_privilege?promo_user_id=${userId}&company_id=${companyId}`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    };

    const revokeAdminPrivilege = async (userId: string, companyId: string) => {
        const response = await axios.post(
            `${config.apiBaseUrl}/user_role/revoke_admin_privilege?demo_user_id=${userId}&company_id=${companyId}`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    };

    const grantModeratorPrivilege = async (userId: string, companyId: string) => {
        const response = await axios.post(
            `${config.apiBaseUrl}/user_role/grant_moderator_privilege?promo_user_id=${userId}&company_id=${companyId}`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    };

    const revokeModeratorPrivilege = async (userId: string, companyId: string) => {
        const response = await axios.post(
            `${config.apiBaseUrl}/user_role/revoke_moderator_privilege?demo_user_id=${userId}&company_id=${companyId}`,
            {},
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    };

    const handleDelegateRights = async () => {
        const targetCompanyId = isSuperAdmin ? superAdminSelectedCompany : contextSelectedCompany;

        if (!targetCompanyId || !delegateRole || !delegateUserId) {
            setError('Заполните все поля');
            return;
        }

        setError(null);

        try {
            let response;
            if (delegateAction === 'grant' && delegateRole === 'PORTAL_ROLE_ADMIN') {
                response = await callApi(() => grantAdminPrivilege(delegateUserId, targetCompanyId));
            } else if (delegateAction === 'revoke' && delegateRole === 'PORTAL_ROLE_ADMIN') {
                response = await callApi(() => revokeAdminPrivilege(delegateUserId, targetCompanyId));
            } else if (delegateAction === 'grant' && delegateRole === 'PORTAL_ROLE_MODERATOR') {
                response = await callApi(() => grantModeratorPrivilege(delegateUserId, targetCompanyId));
            } else if (delegateAction === 'revoke' && delegateRole === 'PORTAL_ROLE_MODERATOR') {
                response = await callApi(() => revokeModeratorPrivilege(delegateUserId, targetCompanyId));
            } else {
                // Остальная логика для других ролей
                response = await callApi(() =>
                    api.post('/role/delegate', {
                        action: delegateAction,
                        role: delegateRole,
                        user_id: delegateUserId,
                        company_id: targetCompanyId
                    }, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    })
                );
            }

            if (response) {
                addNotification('Права доступа успешно обновлены', 'success');
                setDelegateUserId('');
                setDelegateRole('');
            }
        } catch (error: any) {
            console.error('Ошибка делегирования прав:', error);
            setError(error.response?.data?.detail || 'Ошибка при делегировании прав');
            addNotification('Ошибка при делегировании прав', 'error');
        }
    };

    if (loading) {
        return <LoadingSpinner text="Загрузка..." />;
    }

    if (!contextSelectedCompany && !isSuperAdmin) {
        return <div>Компания не выбрана</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <motion.h1
                initial={{opacity: 0, y: -10}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.4}}
                className="text-3xl font-bold text-coffee-dark mb-8"
            >
                {isSuperAdmin ? 'Управление доступом' : 'Информация о компании'}
            </motion.h1>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
                    {success}
                </div>
            )}

            {/* Информация о компании (только для не-суперадминов) */}
            {isSuperAdmin ? (
                <motion.div
                    initial={{opacity: 0, y: 10, scale: 0.98}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                >
                    <CreateCompanyForm/>
                </motion.div>
            ) : companyData && (
                <motion.div
                    initial={{opacity: 0, y: 10, scale: 0.98}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                    className="bg-white rounded-xl shadow-lg p-6 mb-6"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-amber-800">Информация о компании</h2>
                        <div className="flex items-center space-x-4">
                            {!isEditing ? (
                                <motion.button
                                    whileHover={{scale: 1.05}}
                                    whileTap={{scale: 0.95}}
                                    onClick={() => setIsEditing(true)}
                                    className="bg-amber-700 hover:bg-amber-800 text-white py-2 px-4 rounded flex items-center space-x-2"
                                >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                    <span>Редактировать</span>
                                </motion.button>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={resetEditingState}
                                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
                                        disabled={loading}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                        </svg>
                                        <span>Отмена</span>
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={Object.keys(fieldErrors).length > 0 || loading || !hasChanges()}
                                        className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                                            Object.keys(fieldErrors).length > 0 || loading || !hasChanges()
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                    >
                                        {loading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>Сохранение...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                                </svg>
                                                <span>Сохранить</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <form onKeyDown={handleKeyDown} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Название компании */}
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Название компании</label>
                            {isEditing ? (
                                <motion.input
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    type="text"
                                    name="company_name"
                                    value={editedCompany.company_name || ''}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            ) : (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.company_name}
                                </motion.p>
                            )}
                        </div>

                        {/* Адрес */}
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Адрес</label>
                            {isEditing ? (
                                <motion.input
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    type="text"
                                    name="address"
                                    value={editedCompany.address || ''}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            ) : (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.address}
                                </motion.p>
                            )}
                        </div>

                        {/* Телефон */}
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Телефон</label>
                            {isEditing ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <input
                                        type="text"
                                        name="phone"
                                        value={editedCompany.phone || ''}
                                        onChange={handleInputChange}
                                        className={`w-full p-2 border rounded ${
                                            fieldErrors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                                        } focus:outline-none focus:ring-2`}
                                        placeholder="+79991234567"
                                    />
                                    {fieldErrors.phone && (
                                        <motion.p
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-500 text-sm mt-1"
                                        >
                                            {fieldErrors.phone}
                                        </motion.p>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.phone}
                                </motion.p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Email</label>
                            {isEditing ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <input
                                        type="email"
                                        name="email"
                                        value={editedCompany.email || ''}
                                        onChange={handleInputChange}
                                        className={`w-full p-2 border rounded ${
                                            fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                                        } focus:outline-none focus:ring-2`}
                                    />
                                    {fieldErrors.email && (
                                        <motion.p
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-500 text-sm mt-1"
                                        >
                                            {fieldErrors.email}
                                        </motion.p>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.email}
                                </motion.p>
                            )}
                        </div>

                        {/* Возрастное ограничение */}
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Возрастное ограничение</label>
                            {isEditing ? (
                                <motion.label
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center"
                                >
                                    <input
                                        type="checkbox"
                                        name="age_limit"
                                        checked={editedCompany.age_limit || false}
                                        onChange={handleInputChange}
                                        className="mr-2"
                                    />
                                    <span>Включено</span>
                                </motion.label>
                            ) : (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="font-medium"
                                >
                                    {companyData.age_limit ? 'Да' : 'Нет'}
                                </motion.p>
                            )}
                        </div>
                    </form>

                    {/* Подсказка по горячим клавишам */}
                    {isEditing && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 text-xs text-gray-500 flex items-center space-x-4"
                        >
                            <span>💡 Горячие клавиши:</span>
                            <span>Enter — Сохранить</span>
                            <span>Escape — Отмена</span>
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Блок управления доступами для администраторов и суперадминов */}
            {(isSuperAdmin || selectedRole?.role === 'PORTAL_ROLE_ADMIN') && (
                <motion.div
                    initial={{opacity: 0, y: 10, scale: 0.98}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                    className="bg-white rounded-xl shadow-lg p-6"
                >
                    <h2 className="text-xl font-semibold text-amber-800 mb-4">Управление доступами</h2>

                    {isSuperAdmin && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-coffee-dark mb-2">Компания</label>
                                <select
                                    value={superAdminSelectedCompany}
                                    onChange={(e) => setSuperAdminSelectedCompany(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded"
                                >
                                    <option value="">Выберите компанию</option>
                                    {companies.map(company => (
                                        <option key={company.company_id} value={company.company_id}>
                                            {company.company_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block text-coffee-dark mb-2">Действие</label>
                            <select
                                value={delegateAction}
                                onChange={(e) => setDelegateAction(e.target.value as 'grant' | 'revoke')}
                                className="w-full p-2 border border-gray-300 rounded"
                            >
                                <option value="grant">Выдать</option>
                                <option value="revoke">Отозвать</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-coffee-dark mb-2">Роль</label>
                            <select
                                value={delegateRole}
                                onChange={(e) => setDelegateRole(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded"
                            >
                                <option value="">Выберите роль</option>
                                <option value="PORTAL_ROLE_MODERATOR">Модератор</option>
                                <option value="PORTAL_ROLE_ADMIN">Администратор</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-coffee-dark mb-2">ID пользователя</label>
                            <input
                                type="text"
                                value={delegateUserId}
                                onChange={(e) => setDelegateUserId(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded"
                                placeholder="Введите ID пользователя"
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={handleDelegateRights}
                                className="bg-amber-700 hover:bg-amber-800 text-white py-2 px-4 rounded disabled:opacity-50"
                            >
                                {'Применить'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default CompaniesPage;