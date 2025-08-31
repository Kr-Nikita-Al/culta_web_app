import { Company, CompaniesListResponse } from '../types/authTypes';
import api from './api';

export const getAllCompanies = async (token: string): Promise<CompaniesListResponse> => {
    const response = await api.get<CompaniesListResponse>('/company/get_all', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
};

export const getCompanyById = async (companyId: string): Promise<Company> => {
    const response = await api.get<Company>(`/company/get_by_id?company_id=${companyId}`);
    return response.data;
};

export const updateCompany = async (companyId: string, data: Partial<Company>): Promise<Company> => {
    // Формируем данные точно как в рабочем curl-запросе
    const updateData = {
        company_name: data.company_name,
        address: data.address,
        phone: data.phone
        // Пока не включаем другие поля, чтобы точно соответствовать рабочему примеру
    };

    const response = await api.patch<Company>(
        `/company/update_by_id?company_id=${companyId}`,
        updateData,
        {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        }
    );
    return response.data;
};