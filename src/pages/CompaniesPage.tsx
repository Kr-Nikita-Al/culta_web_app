import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { getUserRoles } from '../services/authService';
import { getCompanyById, updateCompany } from '../services/companyService';
import { UserRole, Company } from '../types/authTypes';
import LoadingSpinner from '../components/LoadingSpinner';
import successImage from '../assets/success.svg';
import { motion } from 'framer-motion';

const CompaniesPage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [userRoles, setUserRoles] = useState<UserRole[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editedCompany, setEditedCompany] = useState<Partial<Company>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [showSuccess, setShowSuccess] = useState(false);

    const { token } = useAuth();
    const { callApi } = useApi();

    // Регулярные выражения для валидации
    const phoneRegex = /^(\+7|8)[0-9]{10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const refreshCompanyData = async (companyId: string) => {
        if (!token) return;

        try {
            const companyData = await callApi(() => getCompanyById(companyId));
            if (companyData) {
                // Обновляем список компаний
                const updatedCompanies = companies.map(company =>
                    company.company_id === companyData.company_id ? companyData : company
                );
                setCompanies(updatedCompanies);

                // Обновляем выбранную компанию
                if (selectedCompany?.company_id === companyData.company_id) {
                    setSelectedCompany(companyData);
                    setEditedCompany(companyData);
                }
            }
        } catch (error) {
            console.error('Ошибка обновления данных компании:', error);
        }
    };

    // Загрузка ролей пользователя и компаний
    useEffect(() => {
        if (!token) return;

        const loadUserRolesAndCompanies = async () => {
            setLoading(true);
            try {
                const roles = await callApi(() => getUserRoles(token));
                if (roles) {
                    setUserRoles(roles);

                    // Загружаем информацию о каждой компании администратора
                    const adminRoles = roles.filter(role =>
                        role.role === 'PORTAL_ROLE_ADMIN' || role.role === 'PORTAL_ROLE_SUPER_ADMIN'
                    );

                    const companiesData: Company[] = [];
                    for (const role of adminRoles) {
                        const company = await callApi(() => getCompanyById(role.company_id));
                        if (company) {
                            companiesData.push(company);
                        }
                    }

                    setCompanies(companiesData);

                    // Выбираем первую компанию для отображения
                    if (companiesData.length > 0) {
                        setSelectedCompany(companiesData[0]);
                        setEditedCompany(companiesData[0]);
                    }
                }
            } catch (err) {
                setError('Ошибка загрузки данных');
            } finally {
                setLoading(false);
            }
        };

        loadUserRolesAndCompanies();
    }, [token, callApi]);

    // Обработчик изменения компании в выпадающем списке
    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const companyId = e.target.value;
        const company = companies.find(c => c.company_id === companyId);
        if (company) {
            setSelectedCompany(company);
            setEditedCompany(company);
            setIsEditing(false);
            setFieldErrors({});
        }
    };

    // Обработчик изменения полей формы
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
        if (!selectedCompany || !token || !validateForm()) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const updatedCompany = await callApi(() =>
                updateCompany(selectedCompany.company_id, editedCompany)
            );

            if (updatedCompany) {
                await refreshCompanyData(selectedCompany.company_id);
                setIsEditing(false);

                // Показываем иконку успеха
                setShowSuccess(true);

                // Скрываем через 3 секунды
                setTimeout(() => {
                    setShowSuccess(false);
                }, 3000);
            }
        } catch (err: any) {
            console.error('Ошибка сохранения:', err);

            if (err.response?.status === 404) {
                setError('Компания не найдена или была удалена');
            } else if (err.response?.status === 422) {
                setError('Все поля пустые');
            } else if (err.response?.status === 403) {
                setError('Нет прав для редактирования компании');
            } else if (err.response?.status === 503) {
                setError('Внутренняя ошибка сервера');
            } else {
                setError('Произошла ошибка при сохранении изменений');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSpinner text="Загрузка..." />;
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-coffee-dark mb-8">Управление компаниями</h1>

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

            {/* Выпадающий список компаний */}
            <div className="mb-6">
                <label className="block text-coffee-dark mb-2">Выберите компанию:</label>
                <select
                    value={selectedCompany?.company_id || ''}
                    onChange={handleCompanyChange}
                    className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                    {companies.map(company => (
                        <option key={company.company_id} value={company.company_id}>
                            {company.company_name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Информация о компании */}
            {selectedCompany && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-amber-800">Информация о компании</h2>
                        <div className="flex items-center space-x-4">
                            {showSuccess && (
                                <div className="flex items-center">
                                    <img src={successImage} alt="Успех" className="w-6 h-6 mr-2" />
                                    <span className="text-green-600 font-medium">Изменено!</span>
                                </div>
                            )}
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
                                        disabled={Object.keys(fieldErrors).length > 0}
                                        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Сохранить
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditedCompany(selectedCompany);
                                            setFieldErrors({});
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
                                <p className="font-medium">{selectedCompany.company_name}</p>
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
                                <p className="font-medium">{selectedCompany.address}</p>
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
                                <p className="font-medium">{selectedCompany.phone}</p>
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
                                <p className="font-medium">{selectedCompany.email}</p>
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
                                <p className="font-medium">{selectedCompany.age_limit ? 'Да' : 'Нет'}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompaniesPage;