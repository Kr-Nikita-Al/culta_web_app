import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { checkEmailExists, createUser } from '../services/userService';
import { motion } from 'framer-motion';
import successImage from '../assets/success.svg';
import errorImage from '../assets/error.svg'; // Добавим картинку для ошибок

interface RegistrationFormProps {
    onSuccess: () => void;
    onSwitchToLogin: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSuccess, onSwitchToLogin }) => {
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        phone: '',
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [registrationError, setRegistrationError] = useState<string | null>(null);
    const { callApi } = useApi();

    // Регулярные выражения для валидации
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(\+7|8)[0-9]{10}$/;

    const validateField = (name: string, value: string): string => {
        switch (name) {
            case 'name':
                return value.trim() ? '' : 'Имя обязательно для заполнения';
            case 'surname':
                return value.trim() ? '' : 'Фамилия обязательна для заполнения';
            case 'phone':
                if (!value.trim()) return 'Телефон обязателен для заполнения';
                return phoneRegex.test(value.replace(/\s/g, '')) ? '' : 'Неверный формат телефона';
            case 'email':
                if (!value.trim()) return 'Email обязателен для заполнения';
                return emailRegex.test(value) ? '' : 'Неверный формат email';
            case 'password':
                return value.length >= 6 ? '' : 'Пароль должен содержать минимум 6 символов';
            default:
                return '';
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Сбрасываем статус проверки email при изменении
        if (name === 'email') {
            setEmailAvailable(null);
        }

        // Валидация при изменении
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleEmailBlur = async () => {
        if (!formData.email || errors.email) return;

        setIsCheckingEmail(true);
        try {
            const isAvailable = await callApi(() => checkEmailExists(formData.email));

            if (isAvailable === true) {
                setEmailAvailable(true);
                setErrors(prev => ({ ...prev, email: '' }));
            } else if (isAvailable === false) {
                setEmailAvailable(false);
                setErrors(prev => ({ ...prev, email: 'Пользователь с таким email уже существует' }));
            }
        } catch (error: any) {
            console.error('Ошибка проверки email:', error);
            setErrors(prev => ({
                ...prev,
                email: 'Ошибка проверки email. Попробуйте позже.'
            }));
        } finally {
            setIsCheckingEmail(false);
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        Object.keys(formData).forEach(key => {
            const error = validateField(key, formData[key as keyof typeof formData]);
            if (error) newErrors[key] = error;
        });

        // Проверяем, что email доступен
        if (emailAvailable === false) {
            newErrors.email = 'Пользователь с таким email уже существует';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsSubmitting(true);
        setRegistrationError(null);
        try {
            const result = await callApi(() => createUser(formData));
            if (result) {
                setRegistrationSuccess(true);
                setTimeout(onSuccess, 3000);
            } else  {
                // Если callApi вернул null (из-за ошибки), но не сгенерировал исключение
                setRegistrationError('Произошла ошибка при регистрации. Попробуйте позже.');
            }
        } catch (error: any) {
            console.error('Ошибка регистрации:', error);

            try {
                // Пытаемся распарсить ошибку, если она в формате JSON
                const errorData = JSON.parse(error.message);
                if (errorData.status === 404) {
                    setRegistrationError(errorData.data?.detail || 'Пользователь с таким email уже существует');
                } else if (errorData.status === 422) {
                    setRegistrationError('Некорректные данные. Проверьте правильность заполнения полей.');
                } else {
                    setRegistrationError('Произошла ошибка при регистрации. Попробуйте позже.');
                }
            } catch (parseError) {
                // Если не удалось распарсить, обрабатываем как обычную ошибку
                if (error.response?.status === 422) {
                    setRegistrationError('Некорректные данные. Проверьте правильность заполнения полей.');
                } else if (error.response?.status === 404) {
                    setRegistrationError(error.response.data?.detail || 'Пользователь с таким email уже существует');
                } else {
                    setRegistrationError('Произошла ошибка при регистрации. Попробуйте позже.');
                }
            }
    } finally {
            setIsSubmitting(false);
        }
    };

    const canSubmit = Object.values(formData).every(value => value.trim()) &&
        emailAvailable === true &&
        Object.values(errors).every(error => !error);

    if (registrationSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
            >
                <img src={successImage} alt="Успешная регистрация" className="w-32 h-32 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-green-600 mb-4">Регистрация прошла успешно!</h3>
                <p className="text-gray-600">Теперь вы можете войти в систему используя свои учетные данные.</p>
            </motion.div>
        );
    }

    if (registrationError) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
            >
                <img src={errorImage} alt="Ошибка регистрации" className="w-32 h-32 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-red-600 mb-4">Ошибка регистрации</h3>
                <p className="text-gray-600 mb-4">{registrationError}</p>
                <button
                    onClick={() => setRegistrationError(null)}
                    className="bg-amber-700 hover:bg-amber-800 text-white py-2 px-4 rounded"
                >
                    Попробовать снова
                </button>
            </motion.div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-coffee-dark mb-2">Имя *</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                            errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                        }`}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                    <label className="block text-coffee-dark mb-2">Фамилия *</label>
                    <input
                        type="text"
                        name="surname"
                        value={formData.surname}
                        onChange={handleInputChange}
                        className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                            errors.surname ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                        }`}
                    />
                    {errors.surname && <p className="text-red-500 text-sm mt-1">{errors.surname}</p>}
                </div>
            </div>

            <div>
                <label className="block text-coffee-dark mb-2">Телефон *</label>
                <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+79991234567"
                    className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                        errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                    }`}
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            <div>
                <label className="block text-coffee-dark mb-2">Email *</label>
                <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleEmailBlur}
                    className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                        errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                    }`}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                {isCheckingEmail && (
                    <p className="text-amber-600 text-sm mt-1">Проверка email...</p>
                )}
                {emailAvailable === true && (
                    <p className="text-green-600 text-sm mt-1">Email доступен для регистрации</p>
                )}
            </div>

            <div>
                <label className="block text-coffee-dark mb-2">Пароль *</label>
                <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                        errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                    }`}
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            </div>

            <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>

            <div className="text-center mt-4">
                <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="text-amber-700 hover:text-amber-800 underline"
                >
                    Уже есть аккаунт? Войти
                </button>
            </div>
        </form>
    );
};

export default RegistrationForm;