import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser, oauthProviders, startGoogleLogin, startTelegramLogin } from '../services/authService';
import RegistrationForm from '../components/RegistrationForm';
import EmailConfirmation from '../components/EmailConfirmation';
import './LoginPage.css';
import PasswordInput from '../components/PasswordInput';
import {useScopedOperation} from '../hooks/useScopedOperation';
import PasswordChange from '../components/PasswordChange';

const LoginPage: React.FC = () => {
    const location = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(() => typeof location.state?.error === 'string' ? location.state.error : null);
    const [activeTab, setActiveTab] = useState<'login' | 'register' | 'password'>('login');
    const { login } = useAuth();
    const {busy: loading, begin} = useScopedOperation(JSON.stringify([username, password, activeTab]));
    const [needsConfirmation, setNeedsConfirmation] = useState(false);
    const navigate = useNavigate();

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const operation = begin();
        if (!operation) return;
        setError(null);

        try {
            const result = await loginUser({ username, password }, operation.isCurrent);
            if (!operation.isCurrent()) return;

            if (result) {
                login(result.token, result.userId);
                navigate('/profile/user_info');
            }
        } catch (err: any) {
            if (!operation.isCurrent()) return;
            if (err.response?.data?.detail === 'Email confirmation required') {
                setNeedsConfirmation(true); setError(null);
            } else setError(err.response?.status === 403 ? 'Аккаунт недоступен.' : err.response?.status === 401 ? 'Проверьте логин и пароль.' : err.response?.status === 429 ? 'Слишком много попыток входа. Попробуйте позже.' : 'Не удалось связаться с сервисом входа. Попробуйте ещё раз.');
        } finally {
            operation.finish();
        }
    };

    const handleOAuthLogin = (providerUrl: string) => {
        window.location.href = providerUrl;
    };

    const handleRegistrationSuccess = () => {
        setActiveTab('login');
    };

    return (
        <div className="auth-shell min-h-screen flex justify-center bg-coffee-light">
            <div className="auth-card bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                {/* Вкладки */}
                <div className="auth-tabs flex border-b border-gray-200 mb-6">
                    <button
                        className={`py-2 px-4 font-medium ${
                            activeTab === 'login'
                                ? 'text-amber-700 border-b-2 border-amber-700'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('login')}
                    >
                        Авторизация
                    </button>
                    <button
                        className={`py-2 px-4 font-medium ${
                            activeTab === 'register'
                                ? 'text-amber-700 border-b-2 border-amber-700'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('register')}
                    >
                        Регистрация
                    </button>
                    <button type="button" className={`py-2 px-2 font-medium ${activeTab==='password'?'text-amber-700 border-b-2 border-amber-700':'text-gray-500'}`} onClick={()=>setActiveTab('password')}>Изменение пароля</button>
                </div>

                <h1 className="text-2xl font-bold text-coffee-dark mb-6 text-center">
                    {activeTab === 'login' ? 'Вход для сотрудников' : activeTab==='register'?'Регистрация':'Изменение пароля'}
                </h1>

                {activeTab === 'login' ? (
                    <>
                        {error && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-center">
                                {error}
                            </div>
                        )}

                        <form aria-label="Авторизация" onSubmit={handleLoginSubmit} className="mb-6">
                            <div className="mb-4">
                                <label htmlFor="login-username" className="block text-coffee-dark mb-2">Логин</label>
                                <input
                                    type="text" id="login-username" autoComplete="username"
                                    value={username}
                                    onChange={(e) => {setUsername(e.target.value);setNeedsConfirmation(false);setError(null);}}
                                    className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label htmlFor="login-password" className="block text-coffee-dark mb-2">Пароль</label>
                                <PasswordInput id="login-password" autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => {setPassword(e.target.value);setNeedsConfirmation(false);setError(null);}}
                                    className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-amber-700 hover:bg-amber-800 text-white py-3 rounded transition disabled:opacity-50"
                            >
                                {loading ? 'Вход...' : 'Войти'}
                            </button>
                        </form>
                        {needsConfirmation && <EmailConfirmation key={username} email={username} password={password} autoSend onConfirmed={()=>{setError(null);setNeedsConfirmation(false);setError(null);}}/>}

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">Или войдите через</span>
                            </div>
                        </div>

                        <div className="flex justify-center space-x-4">
                            {['Google','ВК','Telegram','Apple'].map(name=><button type="button" key={name}
                                title={(name==='Google'||name==='Telegram')?`Войти через ${name}`:`${name}: скоро`} aria-label={(name==='Google'||name==='Telegram')?`Войти через ${name}`:`${name} — скоро`}
                                onClick={()=>name==='Telegram'?startTelegramLogin().catch(()=>setError('Вход через Telegram пока не настроен или сервис недоступен.')):name==='Google'?startGoogleLogin().catch(()=>setError('Вход через Google пока не настроен или сервис недоступен.')):setError(`Вход через ${name} пока не подключён.`)}
                                className="oauth-icon-button">
                                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                                    {name==='Google'?<><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.6c-.3 1.3-1 2.3-2.1 3l3.4 2.6C20.8 17.8 22 15.3 22 12.2Z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.4l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3l-3.5 2.7C4.4 19.7 7.9 22 12 22Z"/><path fill="#FBBC05" d="M6.2 13.7a6 6 0 0 1 0-3.4L2.7 7.6a10 10 0 0 0 0 8.8Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l3-3C17.2 2.9 14.8 2 12 2 7.9 2 4.4 4.3 2.7 7.6l3.5 2.7C7 7.8 9.3 6 12 6Z"/></>:
                                    name==='Telegram'?<><circle cx="12" cy="12" r="11" fill="#29A9EA"/><path fill="white" d="m5 11 14-5-3 13-4-3-2 2v-4l7-6-9 5Z"/></>:
                                    name==='ВК'?<><rect width="24" height="24" rx="6" fill="#07F"/><path fill="white" d="M4 7h3c.4 3 1.5 5 3 5.8V7h3v3.4c1.4-1 2.4-2.3 3-3.4h3c-.7 2-2 3.6-3.4 4.7 1.6 1 3 2.9 3.8 5.3h-3.2c-.7-1.7-1.8-3-3.2-3.5V17h-.4C7 17 4.5 13.3 4 7Z"/></>:
                                    <path fill="currentColor" d="M16.5 2c.1 1.5-.6 2.8-1.5 3.7-.9.9-2.1 1.4-3.3 1.3-.2-1.4.5-2.7 1.4-3.6.9-.9 2.3-1.5 3.4-1.4Zm3.3 15.8c-.6 1.4-.9 2-1.7 3.2-1.1 1.5-2.6 3.3-4.4 1.8-1.5-1-2.5-.9-4 0-1.8 1.1-3.1-.5-4.1-2C2.7 16.6 2.4 11 4.2 8.5c1.3-1.8 3.4-2.3 5.2-1.6 1.3.5 2.3.8 3.3.4 2.4-1.1 4.8-.8 6.2 1-3.8 2-3.2 7.2.9 9.5Z"/>}
                                </svg></button>)}
                            {oauthProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() => handleOAuthLogin(provider.authUrl)}
                                    className="oauth-icon-button"
                                    title={`Войти через ${provider.name}`}
                                >
                                    <img
                                        src={provider.icon}
                                        alt={provider.name}
                                        className="w-6 h-6"
                                    />
                                </button>
                            ))}
                        </div>
                    </>
                ) : activeTab==='password' ? <PasswordChange/> : (
                    <RegistrationForm
                        onSuccess={handleRegistrationSuccess}
                        onSwitchToLogin={() => setActiveTab('login')}
                    />
                )}
            </div>
        </div>
    );
};

export default LoginPage;
