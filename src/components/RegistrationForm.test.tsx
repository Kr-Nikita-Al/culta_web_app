import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import RegistrationForm from './RegistrationForm';
import {checkEmailExists,createUser} from '../services/userService';
import api from '../services/api';
jest.mock('../services/userService',()=>({checkEmailExists:jest.fn(),createUser:jest.fn()}));
jest.mock('../services/api',()=>({__esModule:true,default:{post:jest.fn()}}));
beforeEach(()=>{jest.clearAllMocks();(checkEmailExists as jest.Mock).mockResolvedValue(true);});
function setup(){render(<RegistrationForm onSuccess={jest.fn()} onSwitchToLogin={jest.fn()}/>);
    const fill=(name:string,value:string)=>fireEvent.change(screen.getByLabelText(({name:'Имя *',surname:'Фамилия *',phone:'Телефон *',email:'Email *',password:'Пароль *'} as Record<string,string>)[name]),{target:{name,value}});
    return {fill};}
test('checks email on change without blur and switches exclusive delivery options',async()=>{
    const {fill}=setup();fill('email','first@example.test');
    await waitFor(()=>expect(checkEmailExists).toHaveBeenCalledWith('first@example.test'));
    fill('email','next@example.test');
    await waitFor(()=>expect(checkEmailExists).toHaveBeenCalledWith('next@example.test'));
    const choices=screen.getAllByRole('checkbox');
    expect(choices[1]).toBeChecked();fireEvent.click(choices[0]);
    expect(choices[1]).not.toBeChecked();expect(choices[0]).toBeChecked();
    expect(screen.getByText('Зарегистрироваться')).toBeDisabled();
});
test('success appears only after a correct email code, without recreating account',async()=>{
    (createUser as jest.Mock).mockResolvedValue({user_id:'id'});
    (api.post as jest.Mock).mockResolvedValueOnce({data:{status:'sent'}})
        .mockRejectedValueOnce({response:{status:400}}).mockResolvedValueOnce({data:{status:'confirmed'}});
    const {fill}=setup();
    Object.entries({name:'Никита',surname:'Тест',phone:'+79990000000',email:'a@example.test',password:'test-only-password'}).forEach(([key,value])=>fill(key,value));
    await waitFor(()=>expect(screen.getByText('Зарегистрироваться')).toBeEnabled());
    fireEvent.click(screen.getByText('Зарегистрироваться'));
    const code=await screen.findByLabelText('Код из письма');
    await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/login/email/request-code',expect.anything(),{timeout:60000}));
    expect(screen.queryByText('Регистрация прошла успешно!')).not.toBeInTheDocument();
    fireEvent.change(code,{target:{value:'111111'}});fireEvent.click(screen.getByText('Подтвердить',{exact:true}));
    await screen.findByText('Код неверен или истёк. Запросите новый код.');
    fireEvent.change(code,{target:{value:'222222'}});fireEvent.click(screen.getByText('Подтвердить',{exact:true}));
    await screen.findByText('Регистрация прошла успешно!');expect(createUser).toHaveBeenCalledTimes(1);
});

test('registration locks fields and prevents duplicate submissions',async()=>{
    (createUser as jest.Mock).mockReturnValue(new Promise(()=>{}));
    const {fill}=setup();
    Object.entries({name:'Никита',surname:'Тест',phone:'+79990000000',email:'a@example.test',password:'test-password'}).forEach(([key,value])=>fill(key,value));
    await waitFor(()=>expect(screen.getByText('Зарегистрироваться')).toBeEnabled());
    fireEvent.submit(screen.getByRole('form',{name:'Регистрация'}));
    fireEvent.submit(screen.getByRole('form',{name:'Регистрация'}));
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Email *')).toBeDisabled();
    expect(screen.getByLabelText('Пароль *')).toBeDisabled();
});
test('reports duplicate email returned by registration without losing input',async()=>{
    (createUser as jest.Mock).mockRejectedValue(new Error(JSON.stringify({status:404})));
    const {fill}=setup();
    Object.entries({name:'Никита',surname:'Тест',phone:'+79990000000',email:'a@example.test',password:'test-password'}).forEach(([key,value])=>fill(key,value));
    await waitFor(()=>expect(screen.getByText('Зарегистрироваться')).toBeEnabled());
    fireEvent.click(screen.getByText('Зарегистрироваться'));
    await screen.findByText('Пользователь с таким email уже существует');
    fireEvent.click(screen.getByText('Попробовать снова'));
    expect(screen.getByLabelText('Email *')).toHaveValue('a@example.test');
});
