import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import AccountConnections from './AccountConnections';
import api from '../services/api';
jest.mock('../services/api',()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn()}}));
const mockNotify=jest.fn();
jest.mock('../context/NotificationContext',()=>({useNotifications:()=>({addNotification:mockNotify})}));
beforeEach(()=>{
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url:string)=>Promise.resolve({data:url==='/login/accounts'?{providers:[
        {provider:'google',linked:true,available:true},{provider:'yandex',linked:false,available:true},{provider:'telegram',linked:false,available:false}
    ]}:[{id:'candidate',status:'pending'}]}));
    (api.post as jest.Mock).mockResolvedValue({data:{}});
});

test('shows connected and unavailable providers without implying automatic linking',async()=>{
    render(<AccountConnections/>);
    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'✓'})).toBeDisabled();
    expect(screen.getByText(/Совпадение email/)).toBeInTheDocument();
    expect(screen.getByText(/Найден аккаунт/)).toBeInTheDocument();
});

test('embeds methods in the personal information column and keeps suggestions outside',async()=>{
    function ProfileLayout() {
        const [host,setHost]=React.useState<HTMLDivElement|null>(null);
        return <><section aria-label="Личная информация"><div ref={setHost}/></section><AccountConnections methodsContainer={host}/></>;
    }
    render(<ProfileLayout/>);
    expect(await screen.findByText('Google')).toBeInTheDocument();
    const personal=screen.getByRole('region',{name:'Личная информация'});
    const methods=screen.getByRole('region',{name:'Способы входа'});
    expect(personal).toContainElement(methods);
    expect(methods).not.toHaveClass('workspace-card');
    expect(personal).not.toContainElement(screen.getByRole('region',{name:'Возможные аккаунты'}));
    expect(api.get).toHaveBeenCalledTimes(2);
});

test('dismissal is persisted before removing a suggestion',async()=>{
    render(<AccountConnections/>);
    fireEvent.click(await screen.findByRole('button',{name:'Это не мой аккаунт — больше не предлагать'}));
    await waitFor(()=>expect(screen.queryByText(/Найден аккаунт/)).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/login/account-suggestions/candidate/dismiss');
});

test('failed dismissal retains suggestion for retry',async()=>{
    (api.post as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<AccountConnections/>);
    fireEvent.click(await screen.findByRole('button',{name:'Это не мой аккаунт — больше не предлагать'}));
    await waitFor(()=>expect(mockNotify).toHaveBeenCalledWith(expect.any(String),'error'));
    expect(screen.getByText(/Найден аккаунт/)).toBeInTheDocument();
});

test('password proof changes suggestion state but does not merge accounts',async()=>{
    render(<AccountConnections/>);
    fireEvent.click(await screen.findByText('Подтвердить через email и пароль'));
    fireEvent.change(screen.getByLabelText('Email другого аккаунта'),{target:{value:'other@example.com'}});
    fireEvent.change(screen.getByLabelText('Пароль другого аккаунта'),{target:{value:'secret'}});
    fireEvent.click(screen.getByRole('button',{name:'Подтвердить владение'}));
    expect(await screen.findByText('Доступ к другому аккаунту подтверждён')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/login/account-suggestions/candidate/verify-password',{email:'other@example.com',password:'secret'});
    expect(screen.getByText(/Профили, бонусы и права не объединены/)).toBeInTheDocument();
});
