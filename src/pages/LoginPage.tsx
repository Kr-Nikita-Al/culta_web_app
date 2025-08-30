import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { loginUser, oauthProviders } from '../services/authService';
import RegistrationForm from '../components/RegistrationForm';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
    const { login } = useAuth();
    const { callApi, loading } = useApi();
    const navigate = useNavigate();

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const result = await callApi(() => loginUser({ username, password }));

            if (result) {
                login(result.token, result.userId);
                navigate('/profile');
            }
        } catch (err: any) {
            setError(err.message || 'Ошибка авторизации');
        }
    };

    const handleOAuthLogin = (providerUrl: string) => {
        window.location.href = providerUrl;
    };

    const handleRegistrationSuccess = () => {
        setActiveTab('login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-coffee-light">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                {/* Вкладки */}
                <div className="flex border-b border-gray-200 mb-6">
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
                </div>

                <h1 className="text-2xl font-bold text-coffee-dark mb-6 text-center">
                    {activeTab === 'login' ? 'Вход для сотрудников' : 'Регистрация'}
                </h1>

                {activeTab === 'login' ? (
                    <>
                        {error && (
                            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLoginSubmit} className="mb-6">
                            <div className="mb-4">
                                <label className="block text-coffee-dark mb-2">Логин</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-coffee-dark mb-2">Пароль</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">Или войдите через</span>
                            </div>
                        </div>

                        <div className="flex justify-center space-x-4">
                            {oauthProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() => handleOAuthLogin(provider.authUrl)}
                                    className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition transform hover:scale-105"
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
                ) : (
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