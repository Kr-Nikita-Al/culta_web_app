import React, {useEffect, useRef} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { getUserInfo } from '../services/userService';
import {oauthLogin} from "../services/authService";

const OAuthCallbackPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const { callApi } = useApi();
    const navigate = useNavigate();
    const isProcessing = useRef(false); // Флаг для отслеживания процесса

    const pathParts = window.location.pathname.split('/');
    const provider = pathParts[2];
    const { token, login, updateUserInfo } = useAuth();

    useEffect(() => {
        // Если уже аутентифицированы, перенаправляем на профиль
        if (token) {
            navigate('/profile/user_info', { replace: true });
            return;
        }
        const handleOAuthCallback = async () => {
            // Если уже обрабатываем запрос, выходим
            if (isProcessing.current) return;
            isProcessing.current = true;

            const code = searchParams.get('code');
            const error = searchParams.get('error');

            if (error) {
                navigate('/login', {
                    state: { error: `OAuth ошибка: ${error}` }
                });
                isProcessing.current = false;
                return;
            }

            if (!code) {
                navigate('/login', {
                    state: { error: 'Код авторизации не получен' }
                });
                isProcessing.current = false;
                return;
            }

            try {
                const result = await callApi(() => oauthLogin(provider, code));

                if (result) {
                    login(result.token, result.userId);

                    try {
                        const userData = await callApi(() => getUserInfo(result.token, result.userId));
                        if (userData) {
                            updateUserInfo(userData);
                        }
                    } catch (err) {
                        console.error('Не удалось загрузить информацию о пользователе:', err);
                    }

                    // После успешной обработки
                    navigate('/profile', { replace: true });

                    // Или очистите параметры URL
                    const cleanUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                } else {
                    navigate('/login', {
                        state: { error: 'Не удалось получить токен' }
                    });
                }
            } catch (err: any) {
                console.error('OAuth ошибка:', err);
                navigate('/login', {
                    state: { error: err.message || 'Ошибка авторизации через ' + provider }
                });
            } finally {
                isProcessing.current = false;
            }
        };

        handleOAuthCallback();
    }, [provider, searchParams, callApi, login, updateUserInfo, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mx-auto"></div>
                <p className="mt-4 text-gray-600">Завершение авторизации через {provider}...</p>
            </div>
        </div>
    );
};

export default OAuthCallbackPage;