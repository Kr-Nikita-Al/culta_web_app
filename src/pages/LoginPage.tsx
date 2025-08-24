import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import {loginUser, oauthProviders} from '../services/authService';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { login } = useAuth();
    const { callApi, loading } = useApi();
    const navigate = useNavigate();



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const result = await callApi(() => loginUser({ username, password }));

            if (result) {
                login(result.token, result.userId); // Теперь передаем 2 аргумента
                navigate('/profile');
            }
        } catch (err: any) {
            setError(err.message || 'Ошибка авторизации');
        }
    };

    const handleOAuthLogin = (providerUrl: string) => {
        window.location.href = providerUrl;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-coffee-light">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h1 className="text-2xl font-bold text-coffee-dark mb-6 text-center">
                    Вход для сотрудников
                </h1>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mb-6">
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
                    {/* Яндекс */}
                    <button
                        onClick={() => handleOAuthLogin(oauthProviders[0].authUrl)}
                        className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition transform hover:scale-105"
                        title="Войти через Яндекс"
                    >
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/5/58/Yandex_icon.svg"
                            alt="Яндекс"
                            className="w-6 h-6"
                        />
                    </button>

                    {/* Google */}
                    <button
                        onClick={() => handleOAuthLogin(oauthProviders[1].authUrl)}
                        className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition transform hover:scale-105"
                        title="Войти через Google"
                    >
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                            alt="Google"
                            className="w-6 h-6"
                        />
                    </button>

                    {/* Apple */}
                    <button
                        onClick={() => handleOAuthLogin(oauthProviders[2].authUrl)}
                        className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition transform hover:scale-105"
                        title="Войти через Apple"
                    >
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/1/1b/Apple_logo_grey.svg"
                            alt="Apple"
                            className="w-6 h-6"
                        />
                    </button>

                    {/* Telegram */}
                    <button
                        onClick={() => handleOAuthLogin(oauthProviders[3].authUrl)}
                        className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition transform hover:scale-105"
                        title="Войти через Telegram"
                    >
                        <img
                            src="https://telegram.org/img/t_logo.png"
                            alt="Telegram"
                            className="w-6 h-6"
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;


