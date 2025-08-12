import {CompanyResponse} from '../types/authTypes';
import config from "../config";


export const getAllCompanies = async (token: string): Promise<CompanyResponse> => {
    const response = await fetch(`${config.apiBaseUrl}/company/get_all`, {
        method: 'GET',
        mode: 'cors',
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