import { allowedStatuses, getOrderError } from './orderUtils';

test('combines waiter and cook permissions within a company', () => {
    expect(allowedStatuses('created', ['PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK'])).toEqual(['processing', 'closed', 'canceled']);
    expect(allowedStatuses('processing', ['PORTAL_ROLE_WAITER'])).toEqual([]);
    expect(allowedStatuses('closed', ['PORTAL_ROLE_ADMIN'])).toEqual([]);
    expect(allowedStatuses('created', ['PORTAL_ROLE_SUPER_ADMIN'])).toEqual([]);
});

test('check orders separate readiness from financial closing', () => {
    expect(allowedStatuses('created', ['PORTAL_ROLE_WAITER'], true)).toEqual(['completed', 'canceled']);
    expect(allowedStatuses('completed', ['PORTAL_ROLE_ADMIN'], true)).toEqual([]);
});

test('formats FastAPI validation arrays instead of rendering an object', () => {
    expect(getOrderError({ response: { status: 422, data: { detail: [{ loc: ['query', 'order_id'], msg: 'value is not a valid uuid' }] } } }).message)
        .toContain('order_id: value is not a valid uuid');
});

test('network failure warns against blindly repeating a mutation', () => {
    expect(getOrderError(new Error('Network Error')).message).toContain('Перед повторной отправкой обновите заказ');
});
