import api from './api';
import config from '../config';

export interface GrantRoleParams {
    promo_user_id: string;
    company_id: string;
    role: 'PORTAL_ROLE_OWNER' | 'PORTAL_ROLE_ADMIN' | 'PORTAL_ROLE_MODERATOR' | 'PORTAL_ROLE_WAITER' | 'PORTAL_ROLE_COOK';
}

export interface RevokeRoleParams {
    demo_user_id: string;
    company_id: string;
    role: 'PORTAL_ROLE_OWNER' | 'PORTAL_ROLE_ADMIN' | 'PORTAL_ROLE_MODERATOR' | 'PORTAL_ROLE_WAITER' | 'PORTAL_ROLE_COOK';
}

export const grantStaffPrivilege = async (token: string, params: GrantRoleParams) => {
    const response = await api.post(`${config.apiBaseUrl}/user_role/grant_staff_privilege`, null, {
        params: {
            promo_user_id: params.promo_user_id,
            company_id: params.company_id,
            role: params.role
        },
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
};

export const revokeStaffPrivilege = async (token: string, params: RevokeRoleParams) => {
    const response = await api.delete(`${config.apiBaseUrl}/user_role/revoke_staff_privilege`, {
        params: {
            demo_user_id: params.demo_user_id,
            company_id: params.company_id,
            role: params.role
        },
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
};

// Типы для ролей
export const ROLE_TYPES = {
    PORTAL_ROLE_OWNER: 'PORTAL_ROLE_OWNER',
    PORTAL_ROLE_ADMIN: 'PORTAL_ROLE_ADMIN',
    PORTAL_ROLE_MODERATOR: 'PORTAL_ROLE_MODERATOR',
    PORTAL_ROLE_WAITER: 'PORTAL_ROLE_WAITER',
    PORTAL_ROLE_COOK: 'PORTAL_ROLE_COOK',
    PORTAL_ROLE_USER: 'PORTAL_ROLE_USER',
    PORTAL_ROLE_SUPER_ADMIN: 'PORTAL_ROLE_SUPER_ADMIN'
} as const;

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
    PORTAL_ROLE_OWNER: 'Владелец',
    PORTAL_ROLE_ADMIN: 'Администратор',
    PORTAL_ROLE_MODERATOR: 'Модератор',
    PORTAL_ROLE_WAITER: 'Официант',
    PORTAL_ROLE_COOK: 'Повар',
    PORTAL_ROLE_USER: 'Пользователь',
    PORTAL_ROLE_SUPER_ADMIN: 'Супер администратор'
};