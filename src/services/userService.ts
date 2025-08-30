import axios from 'axios';
import { UserInfo } from '../types/authTypes';
import config from '../config';
import api from "./api";

export const getUserInfo = async (token: string, userId: string): Promise<UserInfo> => {
    const response = await axios.get(`${config.apiBaseUrl}/user/get_by_id?user_id=${userId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
};

export const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
        const response = await api.get(`/user/check_by_email?email=${encodeURIComponent(email)}`);
        // Успешный ответ (200) означает, что email свободен
        return true;
    } catch (error: any) {
        if (error.response?.status === 404) {
            // 404 означает, что email уже существует
            return false;
        }
        // Другие ошибки (например, проблемы с сетью)
        throw new Error('Ошибка проверки email');
    }
};

export const createUser = async (userData: {
    name: string;
    surname: string;
    phone: string;
    email: string;
    password: string;
}): Promise<UserInfo> => {
    try {
        const response = await api.post('/user/create', userData);
        return response.data;
    } catch (error: any) {
        // Пробрасываем ошибку с деталями для обработки в компоненте
        if (error.response?.status === 404) {
            throw new Error(JSON.stringify({
                status: 404,
                data: error.response.data
            }));
        }
        throw error;
    }
};