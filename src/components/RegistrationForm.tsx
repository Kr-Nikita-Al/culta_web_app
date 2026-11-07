import React, { useState, useEffect } from 'react';
import EmailConfirmation from './EmailConfirmation';
import {passwordValidation} from '../utils/passwordValidation';
import PasswordInput from './PasswordInput';
import { useScopedOperation } from '../hooks/useScopedOperation';
import { checkEmailExists, createUser } from '../services/userService';
import { motion } from 'framer-motion';
import successImage from '../assets/success.svg';
import errorImage from '../assets/error.svg'; // Добавим картинку для ошибок

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const {busy: isSubmitting, begin} = useScopedOperation('registration');
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [awaitingCode, setAwaitingCode] = useState(false);
    const [channel, setChannel] = useState<'email'|'telegram'>('email');
    const [registrationError, setRegistrationError] = useState<string | null>(null);


    // Регулярные выражения для валидации

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
                return passwordValidation(value, 6);
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

    useEffect(() => {
        let current = true;
        setEmailAvailable(null);
        if (awaitingCode || registrationSuccess || !emailRegex.test(formData.email)) {setIsCheckingEmail(false);return;}
        setIsCheckingEmail(true);
        const timer=setTimeout(async()=>{
            try {
                const available=await checkEmailExists(formData.email);
                if(current){setEmailAvailable(available);setErrors(e=>({...e,email:available?'':'Пользователь с таким email уже существует'}));}
            } catch {if(current)setErrors(e=>({...e,email:'Не удалось проверить email. Измените адрес и повторите.'}));}
            finally{if(current)setIsCheckingEmail(false);}
        },350);
        return()=>{current=false;clearTimeout(timer);};
    },[formData.email,awaitingCode,registrationSuccess]);

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

        if (!validateForm() || channel !== 'email' || emailAvailable !== true || isCheckingEmail) return;

        const operation = begin();
        if (!operation) return;
        setRegistrationError(null);
        try {
            const result = await createUser(formData);
            if (!operation.isCurrent()) return;
            if (result) {
                setAwaitingCode(true);
            } else  {
                // Если callApi вернул null (из-за ошибки), но не сгенерировал исключение
                setRegistrationError('Произошла ошибка при регистрации. Попробуйте позже.');
            }
        } catch (error: any) {
            if (!operation.isCurrent()) return;

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
            operation.finish();
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
                <button type="button" className="mt-4 text-amber-700" onClick={onSuccess}>Перейти ко входу</button>
            </motion.div>
        );
    }

    if (awaitingCode) return <div>
        <p className="text-sm mb-3">Введите код, отправленный на {formData.email}.</p>
        <EmailConfirmation email={formData.email} password={formData.password} autoSend
            onConfirmed={()=>{setFormData(f=>({...f,password:''}));setRegistrationSuccess(true);setAwaitingCode(false);}}/>
    </div>;

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
        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Регистрация">
            <fieldset disabled={isSubmitting} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="registration-name" className="block text-coffee-dark mb-2">Имя *</label>
                    <input
                        type="text"
                        id="registration-name" name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
                            errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                        }`}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                    <label htmlFor="registration-surname" className="block text-coffee-dark mb-2">Фамилия *</label>
                    <input
                        type="text"
                        id="registration-surname" name="surname"
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
                <div className="registration-field-heading"><label htmlFor="registration-phone">Телефон *</label>
                    <label className="registration-channel"><input type="checkbox" checked={channel==='telegram'} onChange={()=>setChannel('telegram')}/> Код регистрации</label>
                    <span tabIndex={0} className="registration-tip" aria-label="О коде в Telegram">?<span role="tooltip">Код придёт в Telegram, привязанный к указанному телефону. Этот способ пока не подключён.</span></span>
                </div>
                <input
                    id="registration-phone"
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
                <div className="registration-field-heading"><label htmlFor="registration-email">Email *</label>
                    <label className="registration-channel"><input type="checkbox" checked={channel==='email'} onChange={()=>setChannel('email')}/> Код регистрации</label>
                    <span tabIndex={0} className="registration-tip" aria-label="О коде по email">?<span role="tooltip">На указанный email придёт код подтверждения регистрации.</span></span>
                </div>
                <input
                    id="registration-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
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
                <label htmlFor="registration-password" className="block text-coffee-dark mb-2">Пароль *</label>
                <PasswordInput
                    id="registration-password" name="password"
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
                disabled={isSubmitting || !canSubmit || isCheckingEmail || channel!=='email'}
                className="w-full bg-amber-700 hover:bg-amber-800 text-white py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>

            </fieldset>
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
