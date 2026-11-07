import React from 'react';
import {render,screen} from '@testing-library/react';
import AdminStatisticsPage from './AdminStatisticsPage';
import {useAuth} from '../context/AuthContext';
import api from '../services/api';
import {fireEvent} from '@testing-library/react';
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('../services/api',()=>({__esModule:true,default:{get:jest.fn()}}));
test('does not request cross-company data for ordinary admins',()=>{
    (useAuth as jest.Mock).mockReturnValue({roles:[{role:'PORTAL_ROLE_ADMIN'}]});
    render(<AdminStatisticsPage/>);
    expect(screen.getByText(/только суперадминистратору/)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
});
test('superadmin sees company comparison',async()=>{
    (useAuth as jest.Mock).mockReturnValue({roles:[{role:'PORTAL_ROLE_SUPER_ADMIN'}]});
    (api.get as jest.Mock).mockResolvedValue({data:{totals:{companies:1,closed_checks:2,orders:3,revenue:'100.00',average_check:'50.00'},companies:[{company_id:'a',name:'Кафе',is_active:true,closed_checks:2,orders:3,revenue:'100.00',average_check:'50.00',bonuses:'20.00'}]}});
    render(<AdminStatisticsPage/>);
    await screen.findByText('Топ-10 заведений по выручке, ₽');
    fireEvent.click(screen.getByRole('tab',{name:'Заведения'}));
    expect(screen.getByRole('table')).toBeInTheDocument();
});

test('switches user and order charts without refetching',async()=>{
    (useAuth as jest.Mock).mockReturnValue({roles:[{role:'PORTAL_ROLE_SUPER_ADMIN'}]});
    (api.get as jest.Mock).mockResolvedValue({data:{totals:{companies:0,closed_checks:0,orders:0,revenue:'0',average_check:'0'},companies:[],daily:[{date:'2026-10-01',registrations:2,orders:3,revenue:'0',closed_checks:0}],users:{total:8,available:6,new:2,active_buyers:1,statuses:{confirmed:6,pending:2}},order_activity:{total:3,statuses:{created:3}}}});
    render(<AdminStatisticsPage/>);
    await screen.findByRole('img',{name:'Выручка по дням'});
    fireEvent.click(screen.getByRole('tab',{name:'Пользователи'}));
    expect(screen.getByText('Всего пользователей')).toBeVisible();
    expect(screen.getByRole('img',{name:'Регистрации по дням, UTC'})).toBeVisible();
    fireEvent.click(screen.getByRole('tab',{name:'Заказы'}));
    expect(screen.getByRole('img',{name:'Заказы по дням'})).toBeVisible();
    expect(screen.queryByText('Всего пользователей')).not.toBeInTheDocument();
});

test('renders zero-base comparison and daily revenue',async()=>{
    (useAuth as jest.Mock).mockReturnValue({roles:[{role:'PORTAL_ROLE_SUPER_ADMIN'}]});
    (api.get as jest.Mock).mockResolvedValue({data:{totals:{companies:0,closed_checks:0,orders:0,revenue:'0.00',average_check:'0.00'},companies:[],comparison:{date_from:'2026-01-01',date_to:'2026-01-31',revenue:'0.00',revenue_change:'0.00',revenue_change_percent:null},daily:[{date:'2026-02-01',closed_checks:0,revenue:'0.00'}]}});
    render(<AdminStatisticsPage/>);
    expect(await screen.findByText(/процент не рассчитывается/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Динамика по дням'));
    expect(screen.getAllByText('2026-02-01').length).toBeGreaterThan(0);
});
