import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../services/api';
import OrdersPage from './OrdersPage';
import { useAuth } from '../context/AuthContext';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { orderService, Order } from '../services/orderService';
jest.mock('../services/api',()=>({__esModule:true,default:{get:jest.fn()}}));

jest.mock('../context/AuthContext');
jest.mock('../context/SelectedCompanyContext');
jest.mock('../services/orderService');

const service = orderService as jest.Mocked<typeof orderService>;
const auth = useAuth as jest.Mock;
const selection = useSelectedCompany as jest.Mock;
const order: Order = {
    order_id: '00000000-0000-4000-8000-000000000001',
    company_id: '00000000-0000-4000-8000-000000000002',
    user_id: '00000000-0000-4000-8000-000000000003',
    status: 'created', comment: 'Без сахара', cocking_time: 5, price: 0,
    time_created: '2026-09-16T12:00:00Z',
    order_items: [{ product_card_id: '00000000-0000-4000-8000-000000000004', quantity: 1,
        snapshot_available: true, product_title: 'Кофе', unit_price: '200.00', line_total: '200.00',
        product_info: { title: 'Кофе', price: 200 } }],
};

beforeEach(() => {
    jest.resetAllMocks();
    auth.mockReturnValue({ userId: order.user_id, roles: [{ company_id: order.company_id, role: 'PORTAL_ROLE_ADMIN' }] });
    selection.mockReturnValue({ selectedCompany: order.company_id, selectedRole: { role: 'PORTAL_ROLE_ADMIN' } });
    (api.get as jest.Mock).mockImplementation((url:string)=>Promise.resolve({data:url==='/check/open'||url==='/check/tables'?[]:url==='/check/clients'?[{user_id:order.user_id,name:'Анна',surname:'Иванова'}]:{products:[{product_card_id:order.order_items[0].product_card_id,title:'Кофе',price:'200',is_active:true}]}}));
    service.list.mockResolvedValue([order]);
    service.get.mockResolvedValue(order);
    service.update.mockResolvedValue({ updated_order_id: order.order_id });
    service.updateStatus.mockResolvedValue({ updated_order_id: order.order_id });
    service.create.mockResolvedValue({ order_id: order.order_id });
});

async function openOrder() {
    render(<OrdersPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Заказ 00000000/ }));
    await screen.findByLabelText('Комментарий');
}

test('loads staff orders for the selected company and opens details', async () => {
    await openOrder();
    expect(service.list).toHaveBeenCalledWith(order.company_id, undefined);
    expect(service.get).toHaveBeenCalledWith(order.order_id, order.company_id);
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
});

test('renders the exact decimal API amount in order details', async () => {
    service.get.mockResolvedValue({ ...order, price: '9999999999999999.99' });
    await openOrder();
    expect(screen.getByText('Сумма из API: 9 999 999 999 999 999,99 ₽')).toBeInTheDocument();
});

test('uses the captured title and price instead of catalog values', async () => {
    service.get.mockResolvedValue({ ...order, order_items: [{ ...order.order_items[0],
        snapshot_available: true, product_title: 'Исторический кофе', unit_price: '200.50',
        unit_cost_price: '77.00', line_total: '200.50', product_info: { title: 'Новое название', price: '999.00' },
    }] });
    await openOrder();
    expect(screen.getByText('Исторический кофе')).toBeInTheDocument();
    expect(screen.queryByText('Новое название')).not.toBeInTheDocument();
    expect(screen.getByText('Цена при заказе: 200,50 ₽')).toBeInTheDocument();
    expect(screen.getByText('Сохранённая сумма позиции (1 шт.): 200,50 ₽')).toBeInTheDocument();
    expect(screen.queryByText(/77,00/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Количество Исторический кофе'), { target: { value: '3' } });
    expect(screen.getByText(/Новая сумма появится после сохранения/)).toBeInTheDocument();
});

test('warns when an old position has no historical snapshot', async () => {
    service.get.mockResolvedValue({ ...order, order_items: [{ ...order.order_items[0],
        snapshot_available: false, product_title: null, unit_price: null, line_total: null }] });
    await openOrder();
    expect(screen.getByText(/Исторические название и цена не сохранены/)).toBeInTheDocument();
    expect(screen.queryByText(/Цена при заказе:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Количество Кофе')).toBeDisabled();
    expect(screen.getByLabelText('Комментарий')).toBeEnabled();
});

test('shows the recalculated server total after saving and refreshing', async () => {
    await openOrder();
    fireEvent.change(screen.getByLabelText('Количество Кофе'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    await screen.findByText(/Изменения сохранены/);
    service.get.mockResolvedValue({ ...order, price: '600.00', order_items: [{ ...order.order_items[0], quantity: 3, line_total: '600.00' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Обновить заказ' }));
    expect(await screen.findByText('Сумма из API: 600,00 ₽')).toBeInTheDocument();
    expect(screen.getByText('Сохранённая сумма позиции (3 шт.): 600,00 ₽')).toBeInTheDocument();
});

test('sends only changed fields and requires refresh after successful save', async () => {
    await openOrder();
    fireEvent.change(screen.getByLabelText('Комментарий'), { target: { value: 'С молоком' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    await screen.findByText(/Изменения сохранены/);
    expect(service.update).toHaveBeenCalledWith(order.order_id, { comment: 'С молоком' });
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
});

test('updates item quantity without leaking product DTO fields into PATCH', async () => {
    await openOrder();
    fireEvent.change(screen.getByLabelText('Количество Кофе'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    await screen.findByText(/Изменения сохранены/);
    expect(service.update).toHaveBeenCalledWith(order.order_id, {
        order_items: [{ product_card_id: order.order_items[0].product_card_id, quantity: 2 }],
    });
});

test.each(['closed', 'canceled'] as const)('prevents editing a %s order', async status => {
    service.get.mockResolvedValue({ ...order, status });
    await openOrder();
    expect(screen.getByLabelText('Комментарий')).toBeDisabled();
    expect(screen.getByLabelText('Количество Кофе')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Закрыть заказ' })).not.toBeInTheDocument();
});

test('conflict preserves draft and forces refresh before another edit', async () => {
    service.update.mockRejectedValue({ response: { status: 409 } });
    await openOrder();
    fireEvent.change(screen.getByLabelText('Комментарий'), { target: { value: 'Черновик' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 409');
    expect(screen.getByLabelText('Комментарий')).toHaveValue('Черновик');
    expect(screen.getByLabelText('Комментарий')).toBeDisabled();
    service.get.mockResolvedValue({ ...order, status: 'closed', comment: 'Актуальное значение' });
    fireEvent.click(screen.getByRole('button', { name: 'Обновить заказ' }));
    await waitFor(() => expect(screen.getByLabelText('Комментарий')).toHaveValue('Актуальное значение'));
    expect(screen.getByLabelText('Комментарий')).toBeDisabled();
});

test.each([403, 404, 422, 500, 503])('shows HTTP %s and clears previously opened details', async status => {
    await openOrder();
    service.get.mockRejectedValue({ response: { status, data: { detail: 'test' } } });
    fireEvent.change(screen.getByLabelText('ID заказа'), { target: { value: 'another-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Открыть по ID' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(`HTTP ${status}`);
    expect(screen.queryByLabelText('Комментарий')).not.toBeInTheDocument();
});

test('client view omits company_id and does not offer editing', async () => {
    auth.mockReturnValue({ userId: order.user_id, roles: [{ role: 'PORTAL_ROLE_USER' }] });
    selection.mockReturnValue({ selectedCompany: 'user', selectedRole: { role: 'PORTAL_ROLE_USER' } });
    render(<OrdersPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Заказ 00000000/ }));
    await screen.findByText('Сумма из API: 0,00 ₽');
    expect(service.list).toHaveBeenCalledWith(undefined, undefined);
    expect(service.get).toHaveBeenCalledWith(order.order_id, undefined);
    expect(screen.queryByRole('button', { name: 'Сохранить изменения' })).not.toBeInTheDocument();
    expect(screen.queryByText('Создать заказ')).not.toBeInTheDocument();
    expect(screen.queryByText('История статусов')).not.toBeInTheDocument();
});

test('status update uses a separate API request', async () => {
    await openOrder();
    fireEvent.click(screen.getByRole('button', { name: 'Перевести: Готовится' }));
    await screen.findByText(/Изменения сохранены/);
    expect(service.updateStatus).toHaveBeenCalledWith(order.order_id, 'processing');
    expect(service.update).not.toHaveBeenCalled();
});

test('staff can send a reason and view status history', async () => {
    service.history.mockResolvedValue([{event_id:'event',order_id:order.order_id,old_status:'created',new_status:'processing',
        actor_id:'staff-id',changed_at:'2026-10-03T10:00:00Z',reason:'Передан на кухню'}]);
    await openOrder();
    fireEvent.change(screen.getByLabelText('Причина смены статуса (необязательно)'), {target:{value:'Передан на кухню'}});
    fireEvent.click(screen.getByRole('button',{name:'Перевести: Готовится'}));
    await screen.findByText(/Изменения сохранены/);
    expect(service.updateStatus).toHaveBeenCalledWith(order.order_id,'processing','Передан на кухню');
    fireEvent.click(screen.getByText('История статусов',{selector:'summary'}));
    fireEvent.click(screen.getByRole('button',{name:'Загрузить историю'}));
    expect(await screen.findByText('Передан на кухню',{selector:'p'})).toBeInTheDocument();
    expect(service.history).toHaveBeenCalledWith(order.order_id,order.company_id);
    expect(screen.getByText('Сотрудник: staff-id')).toBeInTheDocument();
});

test('filter and manual refresh query the API again', async () => {
    render(<OrdersPage />);
    await screen.findByRole('button', { name: /Заказ 00000000/ });
    fireEvent.click(screen.getByRole('tab',{name:'История'}));
    fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'canceled' } });
    await waitFor(() => expect(service.list).toHaveBeenLastCalledWith(order.company_id, 'canceled'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Обновить список' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Обновить список' }));
    await waitFor(() => expect(service.list).toHaveBeenCalledTimes(3));
});

test('creates a guest order by default without a synthetic user', async () => {
    render(<OrdersPage />);
    await screen.findByRole('button', { name: /Заказ 00000000/ });
    fireEvent.click(screen.getByRole('tab', { name: 'Новый заказ' }));
    expect(screen.getByLabelText('Клиент')).toHaveValue('guest');
    fireEvent.change(screen.getByRole('combobox',{name:'Товар'}),{target:{value:'Коф'}});
    fireEvent.click(await screen.findByRole('option',{name:/Кофе/}));
    fireEvent.click(screen.getByRole('button', { name: 'Создать заказ' }));
    await screen.findByText(/Заказ создан:/);
    expect(service.create).toHaveBeenCalledWith({ company_id: order.company_id, user_id: null,
        comment: '', cocking_time: 0, order_items: [{ product_card_id: order.order_items[0].product_card_id, quantity: 1 }] });
});

test('selects a verified application client through search instead of UUID input', async () => {
    render(<OrdersPage />);
    await screen.findByRole('button', {name:/Заказ 00000000/});
    fireEvent.click(screen.getByRole('tab', {name:'Новый заказ'}));
    fireEvent.change(screen.getByLabelText('Клиент'), {target:{value:'client'}});
    fireEvent.change(screen.getByLabelText('Клиент приложения'), {target:{value:'anna@example.com'}});
    fireEvent.click(await screen.findByRole('button', {name:'Анна Иванова'}));
    fireEvent.change(screen.getByRole('combobox', {name:'Товар'}), {target:{value:'Коф'}});
    fireEvent.click(await screen.findByRole('option', {name:/Кофе/}));
    fireEvent.click(screen.getByRole('button', {name:'Создать заказ'}));
    await waitFor(()=>expect(service.create).toHaveBeenCalledWith(expect.objectContaining({user_id:order.user_id})));
});

test('adds to a chosen guest check without requiring a client identifier', async () => {
    const original = (api.get as jest.Mock).getMockImplementation()!;
    (api.get as jest.Mock).mockImplementation((url,...args)=>url==='/check/open'?Promise.resolve({data:[{
        check_id:'guest-check',user_id:null,guest_name:'Анна',table_id:null,total_amount:'200.00'
    }]}):original(url,...args));
    render(<OrdersPage />);
    await screen.findByRole('button',{name:/Заказ 00000000/});
    fireEvent.click(screen.getByRole('tab',{name:'Новый заказ'}));
    fireEvent.change(screen.getByLabelText('Чек'),{target:{value:'existing'}});
    await screen.findByRole('option',{name:/Анна/});
    fireEvent.change(screen.getByLabelText('Открытый чек'),{target:{value:'guest-check'}});
    fireEvent.change(screen.getByRole('combobox',{name:'Товар'}),{target:{value:'Коф'}});
    fireEvent.click(await screen.findByRole('option',{name:/Кофе/}));
    fireEvent.click(screen.getByRole('button',{name:'Создать заказ'}));
    await waitFor(()=>expect(service.create).toHaveBeenCalledWith(expect.objectContaining({check_id:'guest-check',user_id:null})));
});

test('late response from the old company does not populate the new company view', async () => {
    let resolveOld: (orders: Order[]) => void = () => {};
    service.list.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const view = render(<OrdersPage />);
    const otherCompany = '00000000-0000-4000-8000-000000000099';
    auth.mockReturnValue({ userId: order.user_id, roles: [{ role: 'PORTAL_ROLE_ADMIN', company_id: otherCompany }] });
    selection.mockReturnValue({ selectedCompany: otherCompany, selectedRole: { role: 'PORTAL_ROLE_ADMIN' } });
    service.list.mockResolvedValue([]);
    view.rerender(<OrdersPage />);
    await screen.findByText(/Активных заказов пока нет/);
    await act(async () => resolveOld([order]));
    expect(screen.queryByRole('button', { name: /Заказ 00000000/ })).not.toBeInTheDocument();
});

test('tabs separate active orders from history and creation',async()=>{
    service.list.mockResolvedValue([order,{...order,order_id:'history-order',status:'closed'}]);
    render(<OrdersPage/>);
    await screen.findByRole('button',{name:/Заказ 00000000/});
    expect(screen.queryByRole('button',{name:/Заказ history/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'История'}));
    expect(screen.getByRole('button',{name:/Заказ history/})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:/Заказ 00000000/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'Новый заказ'}));
    await waitFor(()=>expect(screen.queryByText('Загрузка товаров…')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Клиент')).toBeInTheDocument();
    expect(screen.queryByLabelText('Статус')).not.toBeInTheDocument();
});

test('order refresh keeps a single check panel and editor with distinct keys',async()=>{
    service.get.mockResolvedValue({...order,check_id:'check-id'});
    const previousGet=(api.get as jest.Mock).getMockImplementation();
    (api.get as jest.Mock).mockImplementation((url:string,...args:any[])=>url==='/check/get'?Promise.resolve({data:{check_id:'check-id',status:'open',order_ids:[order.order_id],total_amount:'200.00',paid_amount:'0.00',user_id:null}}):previousGet?.(url,...args));
    const errors=jest.spyOn(console,'error').mockImplementation(()=>{});
    try{
        await openOrder();
        await screen.findByText(/Гость: без имени/);
        fireEvent.click(screen.getByRole('button',{name:'Обновить заказ'}));
        await screen.findByText(/Гость: без имени/);
        expect(screen.getAllByRole('heading',{name:'Чек'})).toHaveLength(1);
        expect(screen.getAllByLabelText('Комментарий')).toHaveLength(1);
        expect(errors.mock.calls.some(call=>String(call[0]).includes('same key'))).toBe(false);
    }finally{errors.mockRestore();}
});

test('paid check moves a prepared order into history',async()=>{
    service.list.mockResolvedValue([{...order,status:'completed',check_id:'paid',check_status:'closed'}]);
    render(<OrdersPage/>);
    await screen.findByText(/Активных заказов пока нет/);
    expect(screen.queryByRole('button',{name:/Заказ 00000000/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab',{name:'История'}));
    expect(await screen.findByRole('button',{name:/Заказ 00000000/})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Статус'),{target:{value:'closed'}});
    expect(await screen.findByRole('button',{name:/Заказ 00000000/})).toHaveTextContent('Чек закрыт');
});
