import config from '../config';
import { LoginData, UserRole } from '../types/authTypes';


export const loginUser = async (data: LoginData): Promise<string> => {
    const params = new URLSearchParams();
    params.append('username', data.username);
    params.append('password', data.password);
    params.append('grant_type', 'password');

    try {
        const response = await fetch(`${config.apiBaseUrl}/login/token`, {
            method: 'POST',
            mode: 'cors', // Явно указываем режим CORS
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString()
        });

        // Проверяем различные форматы ответа
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result.access_token || result.token;
    } catch (error: any) {
        console.error('Ошибка авторизации:', error);
        if (error.response) {
            throw new Error(`Ошибка сервера: ${error.response.status} ${error.response.data?.detail || ''}`);
        } else {
            throw new Error('Сетевая ошибка или проблема с CORS');
        }
    }
};

export const getUserRoles = async (token: string): Promise<UserRole[]> => {

    const response = await fetch(`${config.apiBaseUrl}/user_role/get_user_roles`, {
        method: 'GET',
        mode: 'cors', // Явно указываем режим CORS
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    // Проверяем различные форматы ответа
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
};