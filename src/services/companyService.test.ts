import api from './api';
import { updateCompany } from './companyService';

jest.mock('./api', () => ({ __esModule: true, default: { patch: jest.fn() } }));

test('sends independent order settings, including false, without the legacy flag', async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: {} });
    await updateCompany('company-a', { allow_client_orders_inside: true, allow_client_orders_outside: false });
    const payload = (api.patch as jest.Mock).mock.calls[0][1];
    expect(payload.allow_client_orders_inside).toBe(true);
    expect(payload.allow_client_orders_outside).toBe(false);
    expect(payload).not.toHaveProperty('is_can_client_create_order');
});

test('sends exact bonus percentages including zero', async () => {
    (api.patch as jest.Mock).mockClear();
    (api.patch as jest.Mock).mockResolvedValue({ data: {} });
    await updateCompany('company-a', { bonus_payment_perc: '0.00', bonus_accrual_perc: '7.25' });
    expect((api.patch as jest.Mock).mock.calls[0][1]).toMatchObject({bonus_payment_perc: '0.00', bonus_accrual_perc: '7.25'});
});

test.each([true,false])('persists editable email and age restriction (%s)',async age_limit=>{
    (api.patch as jest.Mock).mockClear();
    (api.patch as jest.Mock).mockResolvedValue({data:{updated_company_id:'company-a'}});
    const result=await updateCompany('company-a',{email:'new@example.test',age_limit},'lease');
    expect((api.patch as jest.Mock).mock.calls[0][1]).toMatchObject({email:'new@example.test',age_limit});
    expect((api.patch as jest.Mock).mock.calls[0][2].headers['X-Company-Edit-Token']).toBe('lease');
    expect(result).toEqual({updated_company_id:'company-a'});
});
