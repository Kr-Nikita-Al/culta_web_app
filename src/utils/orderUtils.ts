import { OrderStatus } from '../services/orderService';

export const statusLabels: Record<OrderStatus, string> = {
    created: 'Создан', processing: 'Готовится', completed: 'Готов', closed: 'Закрыт', canceled: 'Отменён',
};
export const staffRoles = ['PORTAL_ROLE_OWNER', 'PORTAL_ROLE_ADMIN', 'PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK'];
export const isFinal = (status: OrderStatus) => status === 'closed' || status === 'canceled';

export function allowedStatuses(status: OrderStatus, roles: string[], hasCheck = false): OrderStatus[] {
    const manager = roles.some(role => ['PORTAL_ROLE_OWNER', 'PORTAL_ROLE_ADMIN'].includes(role));
    const waiter = roles.includes('PORTAL_ROLE_WAITER');
    const cook = roles.includes('PORTAL_ROLE_COOK');
    if (status === 'created') {
        const result: OrderStatus[] = [];
        if (manager || cook) result.push('processing');
        if (manager || waiter) result.push(hasCheck ? 'completed' : 'closed');
        if (manager || waiter || cook) result.push('canceled');
        return result;
    }
    if (status === 'processing' && (manager || cook)) return ['completed'];
    if (status === 'completed' && !hasCheck && (manager || waiter)) return ['closed'];
    return [];
}

export interface OrderError { status?: number; message: string }

export function getOrderError(error: unknown): OrderError {
    const response = (error as { response?: { status: number; data?: { detail?: unknown } } })?.response;
    const status = response?.status;
    const messages: Record<number, string> = {
        401: 'Сессия истекла. Войдите заново.',
        403: 'Нет доступа к этому заказу или действию. Проверьте выбранное заведение и роль.',
        404: 'Заказ или позиция не найдены. Проверьте ID и обновите данные.',
        409: 'Данные изменились или заказ уже закрыт либо отменён. Обновите заказ перед следующей попыткой.',
        422: 'Проверьте поля запроса.',
        500: 'Внутренняя ошибка сервера. Проверьте состояние заказа перед повторной отправкой.',
        503: 'База данных временно недоступна. Попробуйте позже.',
    };
    let message = status ? (messages[status] || 'Не удалось выполнить запрос.') :
        'Нет ответа от API. Проверьте подключение и адрес сервера. Перед повторной отправкой обновите заказ.';
    const detail = response?.data?.detail;
    if (status === 409 && detail === 'Order has positions without historical prices; quantities cannot be changed') {
        return { status, message: 'У заказа нет сохранённых исторических цен. Изменение позиций отменено; сумма и количество остались прежними.' };
    }
    if (status === 422) {
        if (Array.isArray(detail)) {
            message += ' ' + detail.map(item => {
                const field = Array.isArray(item?.loc) ? item.loc.filter((part: unknown) => !['body', 'query'].includes(String(part))).join('.') : '';
                return `${field}: ${typeof item?.msg === 'string' ? item.msg : 'некорректное значение'}`;
            }).join('; ');
        } else if (typeof detail === 'string') {
            message += ` ${detail}`;
        }
    }
    return { status, message };
}
