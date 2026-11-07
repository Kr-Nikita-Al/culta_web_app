import api from './api';

export interface Check {
    loyalty_level_name?: string | null;
    check_id: string;
    company_id: string;
    user_id: string | null;
    guest_name?: string | null;
    table_id?: string | null;
    service_type: 'self_service' | 'waiter_service';
    status: 'open' | 'closed' | 'canceled';
    total_amount: string | null;
    paid_amount: string;
    bonus_spent?: string;
    bonus_earned?: string;
    bonus_balance?: string | null;
    max_bonus_spend?: string | null;
    bonus_payment_perc?: string | null;
    bonus_accrual_perc?: string | null;
    closed_at: string | null;
    order_ids: string[];
}

export const checkService = {
    async open(companyId: string): Promise<Check[]> {
        return (await api.get('/check/open', {params: {company_id: companyId}})).data;
    },
    async link(checkId: string, companyId: string, qrToken: string): Promise<Check> {
        return (await api.post('/check/link_guest', {check_id: checkId, company_id: companyId, qr_token: qrToken})).data;
    },
    async get(checkId: string, companyId: string): Promise<Check> {
        return (await api.get('/check/get', { params: { check_id: checkId, company_id: companyId } })).data;
    },
    async close(checkId: string, companyId: string, paidAmount: string, bonusSpent = '0.00'): Promise<Check> {
        return (await api.post('/check/close', {
            check_id: checkId, company_id: companyId, paid_amount: paidAmount, bonus_spent: bonusSpent,
        })).data;
    },
};
