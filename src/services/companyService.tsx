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

export const updateCompany = async (companyId: string, data: Partial<Company>, leaseToken?: string): Promise<{updated_company_id: string}> => {
    const updateData = {
        company_name: data.company_name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        age_limit: data.age_limit,
        service_type: data.service_type,
        allow_client_orders_inside: data.allow_client_orders_inside,
        allow_client_orders_outside: data.allow_client_orders_outside,
        bonus_payment_perc: data.bonus_payment_perc,
        bonus_accrual_perc: data.bonus_accrual_perc,
    };

    const response = await api.patch<{updated_company_id: string}>(
        `/company/update_by_id?company_id=${companyId}`,
        updateData,
        {
            headers: {
                ...(leaseToken ? {'X-Company-Edit-Token':leaseToken} : {}),
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        }
    );
    return response.data;
};
