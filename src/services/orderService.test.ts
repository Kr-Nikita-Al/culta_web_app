import api from './api';
import { orderService } from './orderService';

jest.mock('./api', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
const mocked = api as jest.Mocked<typeof api>;
beforeEach(() => jest.clearAllMocks());

test('uses actual backend query parameters for staff and client reads', async () => {
    mocked.get.mockResolvedValue({ data: { orders: [] } });
    await orderService.list('company', 'completed');
    expect(mocked.get).toHaveBeenLastCalledWith('/order/get_all', { params: { company_id: 'company', filter_status_str: 'completed' } });
    await orderService.get('  order-id  ');
    expect(mocked.get).toHaveBeenLastCalledWith('/order/get_by_id', { params: { order_id: 'order-id', company_id: undefined } });
});

test('status is a query parameter and never a field in order PATCH', async () => {
    mocked.patch.mockResolvedValue({ data: { updated_order_id: 'id' } });
    await orderService.updateStatus('id', 'closed');
    expect(mocked.patch).toHaveBeenLastCalledWith('/order/update_status_by_id', null, { params: { order_id: 'id', new_status: 'closed' } });
    await orderService.update('id', { cocking_time: 0 });
    expect(mocked.patch).toHaveBeenLastCalledWith('/order/update_by_id', { cocking_time: 0 }, { params: { order_id: 'id' } });
});
