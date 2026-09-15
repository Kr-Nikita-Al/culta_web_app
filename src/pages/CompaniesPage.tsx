import React, {useState, useEffect, useCallback} from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { getCompanyById, updateCompany } from '../services/companyService';
import { Company } from '../types/authTypes';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { useCompanies } from '../context/CompaniesContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { grantStaffPrivilege, revokeStaffPrivilege, ROLE_TYPES, ROLE_DISPLAY_NAMES } from '../services/roleService';
import { motion } from 'framer-motion';
import CreateCompanyForm from '../components/CreateCompanyForm';
import { useNotifications } from '../context/NotificationContext';

type StaffRole = 'PORTAL_ROLE_OWNER' | 'PORTAL_ROLE_ADMIN' | 'PORTAL_ROLE_MODERATOR' | 'PORTAL_ROLE_WAITER' | 'PORTAL_ROLE_COOK';


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
    const [selectedRoleForDelegate, setSelectedRoleForDelegate] = useState<keyof typeof ROLE_TYPES>('PORTAL_ROLE_ADMIN');
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
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [selectedCompanyName, setSelectedCompanyName] = useState('');
    const isSuperAdmin = selectedRole?.role === 'PORTAL_ROLE_SUPER_ADMIN';
    const [delegateRole, setDelegateRole] = useState<StaffRole>(() => {
        // Устанавливаем начальную роль в зависимости от прав пользователя
        if (isSuperAdmin) return 'PORTAL_ROLE_ADMIN';
        if (selectedRole?.role === 'PORTAL_ROLE_ADMIN') return 'PORTAL_ROLE_ADMIN';
        if (selectedRole?.role === 'PORTAL_ROLE_OWNER') return 'PORTAL_ROLE_ADMIN';
        return 'PORTAL_ROLE_ADMIN';
    });
    // Регулярные выражения для валидации
    const phoneRegex = /^(\+7|8)[0-9]{10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const getAvailableRoles = () => {
        if (isSuperAdmin) {
            return ['PORTAL_ROLE_OWNER', 'PORTAL_ROLE_ADMIN'] as StaffRole[];
        } else if (selectedRole?.role === 'PORTAL_ROLE_ADMIN') {
            // Админ может только выдавать права, но не отзывать админские
            if (delegateAction === 'revoke') {
                return ['PORTAL_ROLE_MODERATOR', 'PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK'] as StaffRole[];
            } else {
                return ['PORTAL_ROLE_ADMIN', 'PORTAL_ROLE_MODERATOR', 'PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK'] as StaffRole[];
            }
        } else if (selectedRole?.role === 'PORTAL_ROLE_OWNER') {
            return ['PORTAL_ROLE_ADMIN', 'PORTAL_ROLE_MODERATOR', 'PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK'] as StaffRole[];
        }
        return [] as StaffRole[];
    };

    // Определим, может ли пользователь отзывать права
    const canRevokeRole = (role: StaffRole): boolean => {
        if (isSuperAdmin) return true; // Суперадмин может все

        if (selectedRole?.role === 'PORTAL_ROLE_OWNER') {
            // Владелец может отозвать любые роли, кроме своей
            return role !== 'PORTAL_ROLE_OWNER';
        }

        if (selectedRole?.role === 'PORTAL_ROLE_ADMIN') {
            // Админ может отозвать только не-админские роли
            return role !== 'PORTAL_ROLE_ADMIN' && role !== 'PORTAL_ROLE_OWNER';
        }

        return false;
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

    const handleDelegateRights = async () => {
        const targetCompanyId = isSuperAdmin ? superAdminSelectedCompany : contextSelectedCompany;

        if (!targetCompanyId || !delegateRole || !delegateUserId) {
            setError('Заполните все поля');
            addNotification('Заполните все поля', 'error');
            return;
        }

        // Проверка прав на выполнение действия
        if (delegateAction === 'revoke' && !canRevokeRole(delegateRole)) {
            setError('У вас нет прав для отзыва этой роли');
            addNotification('У вас нет прав для отзыва этой роли', 'error');
            return;
        }

        setError(null);

        try {
            let response;
            if (delegateAction === 'grant') {
                response = await callApi(() => grantStaffPrivilege(token!, {
                    promo_user_id: delegateUserId,
                    company_id: targetCompanyId,
                    role: delegateRole
                }));
            } else {
                response = await callApi(() => revokeStaffPrivilege(token!, {
                    demo_user_id: delegateUserId,
                    company_id: targetCompanyId,
                    role: delegateRole
                }));
            }

            if (response) {
                const actionText = delegateAction === 'grant' ? 'выданы' : 'отозваны';
                addNotification(`Права ${ROLE_DISPLAY_NAMES[delegateRole]} успешно ${actionText}`, 'success');
                setDelegateUserId('');
            }
        } catch (error: any) {
            console.error('Ошибка делегирования прав:', error);

            let errorMessage = 'Ошибка при делегировании прав';

            if (error.response?.status === 400) {
                errorMessage = error.response?.data?.detail || 'Некорректный запрос';
            } else if (error.response?.status === 403) {
                errorMessage = 'Недостаточно прав для выполнения действия';
            } else if (error.response?.status === 404) {
                errorMessage = 'Пользователь или компания не найдены';
            } else if (error.response?.status === 405) {
                errorMessage = 'Метод не разрешен';
            } else if (error.response?.status === 500) {
                errorMessage = 'Внутренняя ошибка сервера';
            }

            setError(errorMessage);
            addNotification(errorMessage, 'error');
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
            {(isSuperAdmin || selectedRole?.role === 'PORTAL_ROLE_ADMIN' || selectedRole?.role === 'PORTAL_ROLE_OWNER') && (
                <motion.div
                    initial={{opacity: 0, y: 10, scale: 0.98}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    transition={{duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94]}}
                    className="bg-white rounded-xl shadow-lg p-6"
                >
                    <h2 className="text-xl font-semibold text-amber-800 mb-4">Управление доступом</h2>
                    {/* Блок выбора компании только для суперадмина */}
                    {isSuperAdmin && (
                        <div className="mb-4">
                            <label className="block text-gray-600 mb-2">Выберите компанию:</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={selectedCompanyName}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSelectedCompanyName(value);
                                        setShowCompanyDropdown(true);
                                        // Сбрасываем ID если название изменилось
                                        const foundCompany = companies.find(c =>
                                            c.company_name.toLowerCase() === value.toLowerCase()
                                        );
                                        if (!foundCompany) {
                                            setSuperAdminSelectedCompany('');
                                        }
                                    }}
                                    onFocus={() => {
                                        setShowCompanyDropdown(true);
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => setShowCompanyDropdown(false), 200);
                                    }}
                                    placeholder="Начните вводить название компании..."
                                    className="w-full p-2 pl-3 pr-10 border border-gray-300 rounded"
                                />

                                {/* Кнопка очистки */}
                                {selectedCompanyName && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCompanyName('');
                                            setSuperAdminSelectedCompany('');
                                            setShowCompanyDropdown(false);
                                        }}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}

                                {/* Выпадающий список */}
                                {showCompanyDropdown && companies.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {companies
                                            .filter(company => {
                                                if (!selectedCompanyName) return true;
                                                const searchTerm = selectedCompanyName.toLowerCase();
                                                return company.company_name.toLowerCase().includes(searchTerm);
                                            })
                                            .map(company => (
                                                <div
                                                    key={company.company_id}
                                                    onClick={() => {
                                                        setSuperAdminSelectedCompany(company.company_id);
                                                        setSelectedCompanyName(company.company_name);
                                                        setShowCompanyDropdown(false);
                                                    }}
                                                    className="p-2 hover:bg-gray-100 cursor-pointer transition-colors"
                                                >
                                                    <div className="font-medium">{company.company_name}</div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-600 mb-2">Действие:</label>
                            <select
                                value={delegateAction}
                                onChange={(e) => setDelegateAction(e.target.value as 'grant' | 'revoke')}
                                className="w-full p-2 border border-gray-300 rounded"
                            >
                                <option value="grant">Выдать права</option>
                                <option value="revoke">Забрать права</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-600 mb-2">Роль:</label>
                            <select
                                value={delegateRole}
                                onChange={(e) => setDelegateRole(e.target.value as StaffRole)}
                                disabled={loading}
                                className="w-full p-2 border border-gray-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                <option value="">-- Выберите роль --</option>
                                {getAvailableRoles().map(role => (
                                    <option
                                        key={role}
                                        value={role}
                                        disabled={delegateAction === 'revoke' && !canRevokeRole(role)}
                                    >
                                        {ROLE_DISPLAY_NAMES[role]}
                                        {delegateAction === 'revoke' && !canRevokeRole(role) ? ' (недоступно для отзыва)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-gray-600 mb-2">ID пользователя:</label>
                            <input
                                type="text"
                                value={delegateUserId}
                                onChange={(e) => setDelegateUserId(e.target.value)}
                                placeholder="Введите ID пользователя"
                                className="w-full p-2 border border-gray-300 rounded"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <button
                                onClick={handleDelegateRights}
                                disabled={!superAdminSelectedCompany || !delegateUserId || loading}
                                className={`px-4 py-2 rounded-lg transition-colors ${
                                    !superAdminSelectedCompany || !delegateUserId || loading
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-amber-600 text-white hover:bg-amber-700'
                                }`}
                            >
                                {delegateAction === 'grant' ? 'Выдать права' : 'Забрать права'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default CompaniesPage;