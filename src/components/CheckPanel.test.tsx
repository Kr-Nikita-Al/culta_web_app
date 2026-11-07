import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckPanel from './CheckPanel';
import { checkService, Check } from '../services/checkService';

jest.mock('../services/checkService');
const service = checkService as jest.Mocked<typeof checkService>;
const open: Check = { check_id: 'check', company_id: 'company', user_id: 'client', service_type: 'waiter_service',
    status: 'open', total_amount: '1049.25', paid_amount: '0.00', closed_at: null, order_ids: ['a', 'b'] };

beforeEach(() => { jest.clearAllMocks(); service.get.mockResolvedValue(open); });

test('closes a check using the exact payment string and locks editing', async () => {
    const lock = jest.fn();
    service.close.mockResolvedValue({ ...open, status: 'closed', paid_amount: '1049.25' });
    render(<CheckPanel checkId="check" companyId="company" canClose onLocked={lock} />);
    await screen.findByText(/Заказов: 2/);
    fireEvent.change(screen.getByLabelText(/Получено/), { target: { value: '1049.25' } });
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить оплату/ }));
    await screen.findByText(/Оплачен и закрыт/);
    expect(service.close).toHaveBeenCalledWith('check', 'company', '1049.25', '0.00');
    expect(lock).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('button', { name: /Подтвердить оплату/ })).not.toBeInTheDocument();
});

test('clients cannot close a check', async () => {
    render(<CheckPanel checkId="check" companyId="company" canClose={false} onLocked={jest.fn()} />);
    await screen.findByText(/Заказов: 2/);
    expect(screen.queryByLabelText(/Получено/)).not.toBeInTheDocument();
});

test('shows bonus limits and sends chosen redemption separately from cash', async () => {
    service.get.mockResolvedValue({...open, bonus_balance: '500.00', max_bonus_spend: '209.85',
        bonus_payment_perc: '20.00', bonus_accrual_perc: '10.00'});
    service.close.mockResolvedValue({...open, status: 'closed', paid_amount: '949.25', bonus_spent: '100.00', bonus_earned: '94.92'});
    render(<CheckPanel checkId="check" companyId="company" canClose onLocked={jest.fn()} />);
    fireEvent.change(await screen.findByLabelText('Списать баллы'), {target: {value: '100.00'}});
    expect(screen.getByText(/Будет начислено: 94.92/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Получено/), {target: {value: '949.25'}});
    fireEvent.click(screen.getByRole('button', {name: /Подтвердить оплату/}));
    await screen.findByText(/Оплачен и закрыт/);
    expect(service.close).toHaveBeenCalledWith('check', 'company', '949.25', '100.00');
});

test('failed close remains visible and does not unlock stale order editing', async () => {
    const lock = jest.fn();
    service.close.mockRejectedValue({ response: { status: 409 } });
    render(<CheckPanel checkId="check" companyId="company" canClose onLocked={lock} />);
    fireEvent.change(await screen.findByLabelText(/Получено/), { target: { value: '1.00' } });
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить оплату/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Закрытие не подтверждено'));
    expect(lock).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText(/Оплачен и закрыт/)).not.toBeInTheDocument();
});

test('guest has no bonus controls and can link a verified QR before closing', async () => {
    service.get.mockResolvedValue({...open,user_id:null,guest_name:'Анна'});
    service.link.mockResolvedValue({...open,bonus_balance:'500.00',max_bonus_spend:'100.00'});
    render(<CheckPanel checkId="check" companyId="company" canClose onLocked={jest.fn()} />);
    await screen.findByText(/Гость: Анна/);
    expect(screen.queryByLabelText('Списать баллы')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Привязать аккаунт клиента до оплаты'));
    fireEvent.change(screen.getByLabelText('Код из QR клиента'),{target:{value:'signed-qr'}});
    fireEvent.click(screen.getByRole('button',{name:'Привязать клиента'}));
    await screen.findByLabelText('Списать баллы');
    expect(service.link).toHaveBeenCalledWith('check','company','signed-qr');
    expect(screen.queryByText('Привязать аккаунт клиента до оплаты')).not.toBeInTheDocument();
});

test('closed guest check cannot be linked in UI', async () => {
    service.get.mockResolvedValue({...open,user_id:null,status:'closed'});
    render(<CheckPanel checkId="check" companyId="company" canClose onLocked={jest.fn()} />);
    await screen.findByText(/Оплачен и закрыт/);
    expect(screen.queryByText('Привязать аккаунт клиента до оплаты')).not.toBeInTheDocument();
});
