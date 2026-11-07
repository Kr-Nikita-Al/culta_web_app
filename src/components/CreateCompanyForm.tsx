import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {useScopedOperation} from '../hooks/useScopedOperation';
import api from '../services/api';
import { useNotifications } from '../context/NotificationContext';

const CreateCompanyForm: React.FC = () => {
    const {userId} = useAuth();
    return <CompanyForm key={userId || 'anonymous'}/>;
};
const CompanyForm: React.FC = () => {
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
    const {busy:isSubmitting,begin}=useScopedOperation('create-company');
    const { token } = useAuth();
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
        if(!token)return;
        const operation=begin();
        if(!operation)return;
        setError(null);

        try {
            const response = await api.post('/company/create', formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            if(!operation.isCurrent())return;

            if (response?.data?.company_id) {
                const companyId = response.data.company_id;
                // Показываем уведомление с ID компании
                addNotification(
                    `Компания "${formData.company_name}" успешно создана! ID: ${companyId}`,
                    'success'
                );
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
            else {
                setError('Не удалось подтвердить создание компании. Обновите список перед повторной попыткой.');
            }
        } catch (err: any) {
            if(!operation.isCurrent())return;
            const detail=err.response?.data?.detail;
            const message=typeof detail==='string'?detail:err.response?.status===422?'Проверьте данные компании.':'Не удалось подтвердить создание компании. Обновите список перед повторной попыткой.';
            setError(message);
            addNotification(message, 'error');
        } finally {
            operation.finish();
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

            <form onSubmit={handleSubmit} aria-label="Создание компании">
                <fieldset disabled={isSubmitting} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="create-company-company_name" className="block text-gray-600 text-sm mb-1">Название компании *</label>
                    <input
                        type="text"
                        id="create-company-company_name" name="company_name"
                        value={formData.company_name}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="create-company-address" className="block text-gray-600 text-sm mb-1">Адрес *</label>
                    <input
                        type="text"
                        id="create-company-address" name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="create-company-phone" className="block text-gray-600 text-sm mb-1">Телефон *</label>
                    <input
                        type="tel"
                        id="create-company-phone" name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded"
                        placeholder="+79991234567"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="create-company-email" className="block text-gray-600 text-sm mb-1">Email *</label>
                    <input
                        type="email"
                        id="create-company-email" name="email"
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
                            checked={formData.work_state}
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
                </fieldset>
            </form>
        </div>
    );
};

export default CreateCompanyForm;