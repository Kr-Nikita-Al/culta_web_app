import React, { useState, useEffect } from 'react';
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
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [applyStatus, setApplyStatus] = useState<'idle' | 'success' | 'error'>('idle');
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

    const handleSave = async () => {
        if (!contextSelectedCompany || !token || !validateForm()) return;

        setLoading(true);
        setError(null);
        setSuccess(null);
        setSaveStatus('idle');

        try {
            await callApi(() => updateCompany(contextSelectedCompany, editedCompany));

            // Затем запрашиваем обновленные данные
            const updatedCompanyData = await callApi(() => getCompanyById(contextSelectedCompany));
            addNotification('Изменения компании сохранены успешно', 'success');

            if (updatedCompanyData) {
                setCompanyData(updatedCompanyData);
                setIsEditing(false);
                setShowSuccess(true);
                setSaveStatus('success');

                await refreshCompanies();
                updateSelectedCompany(updatedCompanyData);
                setEditedCompany(updatedCompanyData);

            }
        } catch (err: any) {
            console.error('Ошибка сохранения:', err);
            addNotification('Ошибка при сохранении изменений', 'error');
        } finally {
            setLoading(false);
        }
    };

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

    const handleDelegateRights = async () => {
        const targetCompanyId = isSuperAdmin ? superAdminSelectedCompany : contextSelectedCompany;

        if (!targetCompanyId || !delegateRole || !delegateUserId) {
            setError('Заполните все поля');
            return;
        }

        setApplyStatus('idle');
        setError(null);

        try {
            let response;
            if (delegateAction === 'grant' && delegateRole === 'PORTAL_ROLE_ADMIN') {
                response = await callApi(() => grantAdminPrivilege(delegateUserId, targetCompanyId));
            } else if (delegateAction === 'revoke' && delegateRole === 'PORTAL_ROLE_ADMIN') {
                response = await callApi(() => revokeAdminPrivilege(delegateUserId, targetCompanyId));
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
                setApplyStatus('success');
                setTimeout(() => {
                    setApplyStatus('idle');
                    setSuccess(null);
                }, 2000);
            }
        } catch (error: any) {
            console.error('Ошибка делегирования прав:', error);
            setError(error.response?.data?.detail || 'Ошибка при делегировании прав');
            setApplyStatus('error');
            setTimeout(() => setApplyStatus('idle'), 2000);
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
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-coffee-dark mb-8">
                Компания: {isSuperAdmin ? 'Управление доступом' : getCompanyName()}
            </h1>

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
                <CreateCompanyForm />
            ) : companyData && (
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-amber-800">Информация о компании</h2>
                        <div className="flex items-center space-x-4">
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="bg-amber-700 hover:bg-amber-800 text-white py-2 px-4 rounded"
                                >
                                    Редактировать
                                </button>
                            ) : (
                                <div className="space-x-2">
                                    <button
                                        onClick={handleSave}
                                        disabled={Object.keys(fieldErrors).length > 0 || saveStatus !== 'idle'}
                                        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saveStatus === 'success' ? 'Успешно' : saveStatus === 'error' ? 'Неуспех(' : 'Сохранить'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditedCompany(companyData);
                                            setFieldErrors({});
                                            setSaveStatus('idle');
                                        }}
                                        className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded"
                                    >
                                        Отмена
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Название компании</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    name="company_name"
                                    value={editedCompany.company_name || ''}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded"
                                />
                            ) : (
                                <p className="font-medium">{companyData.company_name}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Адрес</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    name="address"
                                    value={editedCompany.address || ''}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border border-gray-300 rounded"
                                />
                            ) : (
                                <p className="font-medium">{companyData.address}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Телефон</label>
                            {isEditing ? (
                                <div>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={editedCompany.phone || ''}
                                        onChange={handleInputChange}
                                        className={`w-full p-2 border rounded ${
                                            fieldErrors.phone ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                        placeholder="+79991234567"
                                    />
                                    {fieldErrors.phone && (
                                        <p className="text-red-500 text-sm mt-1">{fieldErrors.phone}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="font-medium">{companyData.phone}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Email</label>
                            {isEditing ? (
                                <div>
                                    <input
                                        type="email"
                                        name="email"
                                        value={editedCompany.email || ''}
                                        onChange={handleInputChange}
                                        className={`w-full p-2 border rounded ${
                                            fieldErrors.email ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {fieldErrors.email && (
                                        <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="font-medium">{companyData.email}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm mb-1">Возрастное ограничение</label>
                            {isEditing ? (
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="age_limit"
                                        checked={editedCompany.age_limit || false}
                                        onChange={handleInputChange}
                                        className="mr-2"
                                    />
                                    <span>Включено</span>
                                </label>
                            ) : (
                                <p className="font-medium">{companyData.age_limit ? 'Да' : 'Нет'}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Блок управления доступами для администраторов и суперадминов */}
            {(isSuperAdmin || selectedRole?.role === 'PORTAL_ROLE_ADMIN') && (
                <div className="bg-white rounded-xl shadow-lg p-6">
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
                                disabled={applyStatus !== 'idle'}
                                className="bg-amber-700 hover:bg-amber-800 text-white py-2 px-4 rounded disabled:opacity-50"
                            >
                                {applyStatus === 'success' ? 'Успешно' : applyStatus === 'error' ? 'Неуспех(' : 'Применить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompaniesPage;