import axios from 'axios';
import { UserInfo } from '../types/authTypes';
import config from '../config';

export const getUserInfo = async (token: string, userId: string): Promise<UserInfo> => {
    const response = await axios.get(`${config.apiBaseUrl}/user/get_by_id?user_id=${userId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
};