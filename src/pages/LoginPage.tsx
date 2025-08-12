import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { loginUser } from '../services/authService';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // Добавляем состояние для ошибки
    const [error, setError] = useState<string | null>(null);

    const { login } = useAuth();
    const { callApi, loading } = useApi(); // Убираем error из useApi, так как будем использовать локальное состояние
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const result = await callApi(() => loginUser({ username, password }));

            if (result) {
                login(result);
                navigate('/profile');
            }
        } catch (err: any) {
            let errorMessage = 'Ошибка авторизации';

            // Детализация ошибок
            if (err.message.includes('401')) {
                errorMessage = 'Неверные учетные данные';
            } else if (err.message.includes('CORS')) {
                errorMessage = 'Проблема с CORS. Попробуйте обновить страницу.';
            } else if (err.message.includes('Сетевая ошибка')) {
                errorMessage = 'Проблема с сетью. Проверьте подключение к интернету.';
            } else {
                errorMessage = err.message || 'Неизвестная ошибка';
            }

            setError(errorMessage);
            console.error('Детали ошибки:', err);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-coffee-light">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h1 className="text-2xl font-bold text-coffee-dark mb-6 text-center">Вход для сотрудников</h1>

                {/* Отображение ошибки */}
                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-center">{error}</div>}

                <form onSubmit={handleSubmit}>
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
            </div>
        </div>
    );
};

export default LoginPage;