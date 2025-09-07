import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import api from '../services/api';
import config from '../config';
import { useNotifications } from '../context/NotificationContext';

const CreateCompanyForm: React.FC = () => {
    const [formData, setFormData] = useState({
        company_name: '',
        address: '',
        phone: '',
        email: '',
        age_limit: false,
        work_state: false,
        start_time: '09:00:00',
        over_time: '21:00:00',
        order_number: 0
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { token } = useAuth();
    const { callApi } = useApi();
    const { addNotification } = useNotifications();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const fieldValue = type === 'checkbox' ? checked : value;

        setFormData(prev => ({
            ...prev,
            [name]: fieldValue
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await callApi(() =>
                api.post(`${config.apiBaseUrl}/company/create`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })
            );

            if (response) {
                addNotification('Компания успешно создана', 'success');
                setFormData({
                    company_name: '',
                    address: '',
                    phone: '',
                    email: '',
                    age_limit: false,
                    work_state: false,
                    start_time: '09:00:00',
                    over_time: '21:00:00',
                    order_number: 0
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ошибка при создании компании');
            addNotification(err.response?.data?.detail || 'Ошибка при создании компании', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-amber-800 mb-4">Создать компанию</h2>

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

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-gray-600 text-sm mb-1">Название компании *</label>
                    <input
                        type="text"
                        name="company_name"
                        value={formData.company_name}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-600 text-sm mb-1">Адрес *</label>
                    <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-600 text-sm mb-1">Телефон *</label>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        placeholder="+79991234567"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-600 text-sm mb-1">Email *</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                    />
                </div>

                <div>
                    <label className="block text-gray-600 text-sm mb-1">Возрастное ограничение</label>
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            name="age_limit"
                            checked={formData.age_limit}
                            onChange={handleInputChange}
                            className="mr-2"
                        />
                        <span>Включено</span>
                    </label>
                </div>

                <div>
                    <label className="block text-gray-600 text-sm mb-1">Статус работы</label>
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            name="work_state"
                            onChange={handleInputChange}
                            className="mr-2"
                        />
                        <span>Активно</span>
                    </label>
                </div>

                <div className="md:col-span-2">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded disabled:opacity-50"
                    >
                        {isSubmitting ? 'Создание...' : 'Создать компанию'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateCompanyForm;