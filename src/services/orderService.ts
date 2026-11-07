import api from './api';

export type OrderStatus = 'created' | 'processing' | 'completed' | 'closed' | 'canceled';

export interface OrderStatusEvent {
    event_id: string; order_id: string; old_status: OrderStatus | null;
    new_status: OrderStatus; actor_id: string; changed_at: string; reason: string | null;
}

export interface OrderItem {
    product_card_id: string;
    quantity: number;
    product_title?: string | null;
    unit_price?: string | null;
    unit_cost_price?: string | null;
    line_total?: string | null;
    snapshot_available?: boolean;
    product_info: { title: string; price: string | number };
}

export interface Order {
    check_id?: string | null;
    check_status?: 'open' | 'closed' | 'canceled' | null;
    order_id: string;
    company_id: string;
    user_id: string | null;
    status: OrderStatus;
    cocking_time: number;
    comment?: string;
    price: string | number;
    time_created: string;
    order_items: OrderItem[];
}

export interface OrderPatch {
    comment?: string;
    cocking_time?: number;
    order_items?: Array<{ product_card_id: string; quantity: number }>;
}

export interface CreateOrder extends OrderPatch {
    check_id?: string;
    company_id: string;
    user_id: string | null;
    guest_name?: string;
    table_id?: string;
}

export const orderService = {
    async list(companyId?: string, status?: OrderStatus): Promise<Order[]> {
        const response = await api.get<{ orders: Order[] }>('/order/get_all', {
            params: { company_id: companyId, filter_status_str: status || undefined },
        });
        return response.data.orders;
    },
    async get(orderId: string, companyId?: string): Promise<Order> {
        const response = await api.get<Order>('/order/get_by_id', {
            params: { order_id: orderId.trim(), company_id: companyId },
        });
        return response.data;
    },
    async create(body: CreateOrder): Promise<{ order_id: string }> {
        return (await api.post('/order/create', body)).data;
    },
    async update(orderId: string, body: OrderPatch): Promise<{ updated_order_id: string }> {
        return (await api.patch('/order/update_by_id', body, { params: { order_id: orderId } })).data;
    },
    async history(orderId: string, companyId: string): Promise<OrderStatusEvent[]> {
        return (await api.get('/order/status_history', {params: {order_id: orderId, company_id: companyId}})).data;
    },
    async updateStatus(orderId: string, status: OrderStatus, reason?: string): Promise<{ updated_order_id: string }> {
        return (await api.patch('/order/update_status_by_id', null, {
            params: { order_id: orderId, new_status: status, ...(reason?.trim() ? {reason: reason.trim()} : {}) },
        })).data;
    },
};
