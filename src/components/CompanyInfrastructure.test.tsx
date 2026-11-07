import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import CompanyInfrastructure from './CompanyInfrastructure';
import api from '../services/api';
jest.mock('../services/api', ()=>({__esModule:true,default:{get:jest.fn(),put:jest.fn()}}));
jest.mock('../hooks/useCompanyEditLease',()=>({useCompanyEditLease:()=>({token:'test-lease',error:'',pending:false,acquire:jest.fn(),release:jest.fn().mockResolvedValue(undefined)}),companyLeaseError:()=>''}));
const mockRefresh = jest.fn();
const mockNotify = jest.fn();
jest.mock('../context/NotificationContext',()=>({useNotifications:()=>({addNotification:mockNotify})}));
jest.mock('../context/CompaniesContext', ()=>({useCompanies:()=>({refreshCompanies:mockRefresh})}));
const initial = {version:0,levels:[],bonus_payment_perc:'20.00',bonus_accrual_perc:'10.00',
    orders_enabled:true,reservations_enabled:true,images_enabled:true};
beforeEach(()=>{jest.clearAllMocks(); (api.get as jest.Mock).mockResolvedValue({data:initial});});

test('validates ratios and saves levels and section switches together', async()=>{
    (api.put as jest.Mock).mockResolvedValue({data:{...initial,version:1}});
    render(<CompanyInfrastructure companyId="company-a"/>);
    fireEvent.change(await screen.findByLabelText('Начисление, %'),{target:{value:'21'}});
    expect(screen.getByRole('button',{name:'Сохранить'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Начисление, %'),{target:{value:'5'}});
    fireEvent.click(screen.getByRole('button',{name:'Добавить уровень'}));
    fireEvent.change(screen.getByLabelText('Название'),{target:{value:'Любимый гость'}});
    fireEvent.change(screen.getByLabelText('Потрачено от, ₽'),{target:{value:'1000'}});
    fireEvent.click(screen.getByLabelText('Бронирования'));
    fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
    await waitFor(()=>expect(mockNotify).toHaveBeenCalledWith('Настройки сохранены','success'));
    expect((api.put as jest.Mock).mock.calls[0][1]).toMatchObject({reservations_enabled:false,levels:[{name:'Любимый гость',threshold:'1000'}]});
    expect(mockRefresh).toHaveBeenCalled();
});

test('version conflict disables resaving until refreshed', async()=>{
    (api.put as jest.Mock).mockRejectedValue({response:{status:409}});
    render(<CompanyInfrastructure companyId="company-a"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Сохранить'}));
    await waitFor(()=>expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining('Настройки изменены в другом окне'),'error'));
    expect(screen.getByRole('button',{name:'Сохранить'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Загрузить актуальные настройки'}));
    await waitFor(()=>expect(api.get).toHaveBeenCalledTimes(2));
});
