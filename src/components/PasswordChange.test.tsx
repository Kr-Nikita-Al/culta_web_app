import React from 'react';
import {render,screen,fireEvent,act} from '@testing-library/react';
import PasswordChange from './PasswordChange';
import api from '../services/api';
jest.mock('../services/api',()=>({__esModule:true,default:{post:jest.fn()}}));
const post=api.post as jest.Mock;
beforeEach(()=>post.mockReset());
function fill(){
    fireEvent.change(screen.getByLabelText('Телефон или email'),{target:{value:'a@example.com'}});
    fireEvent.change(screen.getByLabelText('Старый пароль'),{target:{value:'old-password'}});
    fireEvent.change(screen.getByLabelText('Новый пароль'),{target:{value:'new-password'}});
}
test('changes password only after code confirmation',async()=>{
    post.mockResolvedValueOnce({data:{status:'sent'}}).mockResolvedValueOnce({data:{status:'changed'}});
    render(<PasswordChange/>);fill();
    fireEvent.click(screen.getByText('Обновить'));
    fireEvent.change(await screen.findByLabelText('Код смены пароля'),{target:{value:'123456'}});
    expect(screen.queryByText('Пароль успешно изменён')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Подтвердить'));
    expect(await screen.findByText('Пароль успешно изменён')).toBeInTheDocument();
    expect(post).toHaveBeenLastCalledWith('/login/password/confirm',{identifier:'a@example.com',old_password:'old-password',new_password:'new-password',code:'123456'},{timeout:60000});
});
test('highlights incorrect old password',async()=>{
    post.mockRejectedValue({response:{status:401}});
    render(<PasswordChange/>);fill();fireEvent.click(screen.getByText('Обновить'));
    expect(await screen.findByText('Неверный email или старый пароль.')).toBeInTheDocument();
    expect(screen.getByLabelText('Старый пароль')).toHaveAttribute('aria-invalid','true');
});
test('rejects invalid identifiers and explains unavailable Telegram',()=>{
    render(<PasswordChange/>);
    fireEvent.change(screen.getByLabelText('Телефон или email'),{target:{value:'nonsense'}});
    expect(screen.getByRole('alert')).toHaveTextContent('Введите корректный email');
    expect(screen.getByText('Обновить')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Телефон или email'),{target:{value:'+7 (999) 123-45-67'}});
    expect(screen.getByText(/Подтверждение через Telegram пока недоступно/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
});


test('ignores an old request after credentials are edited',async()=>{
    let resolve: (value:any)=>void = ()=>{};
    post.mockReturnValue(new Promise(done=>{resolve=done;}));
    render(<PasswordChange/>);fill();
    fireEvent.click(screen.getByText('Обновить'));
    fireEvent.change(screen.getByLabelText('Телефон или email'),{target:{value:'b@example.com'}});
    await act(async()=>resolve({data:{status:'sent'}}));
    expect(screen.queryByLabelText('Код смены пароля')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Телефон или email')).toHaveValue('b@example.com');
});
test('does not accept malformed confirmation as password change',async()=>{
    post.mockResolvedValueOnce({data:{status:'sent'}}).mockResolvedValueOnce({data:{}});
    render(<PasswordChange/>);fill();fireEvent.click(screen.getByText('Обновить'));
    fireEvent.change(await screen.findByLabelText('Код смены пароля'),{target:{value:'123456'}});
    fireEvent.click(screen.getByText('Подтвердить'));
    await screen.findByText('Не удалось обработать ответ сервера. Попробуйте ещё раз.');
    expect(screen.queryByText('Пароль успешно изменён')).not.toBeInTheDocument();
});
test('blocks duplicate form submissions while a request is pending',()=>{
    post.mockReturnValue(new Promise(()=>{}));
    render(<PasswordChange/>);fill();
    const form=screen.getByRole('form',{name:'Изменение пароля'});
    fireEvent.submit(form);fireEvent.submit(form);
    expect(post).toHaveBeenCalledTimes(1);
});
test('explains network failure without blaming credentials',async()=>{
    post.mockRejectedValue(new Error('Network Error'));
    render(<PasswordChange/>);fill();fireEvent.click(screen.getByText('Обновить'));
    await screen.findByText('Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.');
    expect(screen.getByLabelText('Старый пароль')).toHaveValue('old-password');
});

test('resend respects server delay and clears the previous code only after delivery',async()=>{
    jest.useFakeTimers();
    try {
        post.mockResolvedValue({data:{status:'sent',retry_after:2}});
        render(<PasswordChange/>);fill();
        fireEvent.click(screen.getByText('Обновить'));
        await act(async()=>{await Promise.resolve();});
        fireEvent.change(screen.getByLabelText('Код смены пароля'),{target:{value:'123456'}});
        expect(screen.getByRole('button',{name:/Запросить новый код/})).toBeDisabled();
        act(()=>jest.advanceTimersByTime(2000));
        expect(screen.getByRole('button',{name:/Запросить новый код/})).toBeEnabled();
        fireEvent.click(screen.getByRole('button',{name:/Запросить новый код/}));
        await act(async()=>{await Promise.resolve();});
        expect(post).toHaveBeenCalledTimes(2);
        expect(screen.getByLabelText('Код смены пароля')).toHaveValue('');
    } finally {jest.useRealTimers();}
});
test('rate limit prevents another request until the countdown expires',async()=>{
    jest.useFakeTimers();
    try {
        post.mockRejectedValue({response:{status:429}});
        render(<PasswordChange/>);fill();
        fireEvent.click(screen.getByText('Обновить'));
        await act(async()=>{await Promise.resolve();});
        expect(screen.getByText('Обновить')).toBeDisabled();
        fireEvent.submit(screen.getByRole('form',{name:'Изменение пароля'}));
        expect(post).toHaveBeenCalledTimes(1);
        act(()=>jest.advanceTimersByTime(60000));
        expect(screen.getByText('Обновить')).toBeEnabled();
    } finally {jest.useRealTimers();}
});

test('blocks passwords that exceed the backend UTF-8 limit',()=>{
    render(<PasswordChange/>);fill();
    fireEvent.change(screen.getByLabelText('Новый пароль'),{target:{value:'я'.repeat(37)}});
    expect(screen.getByRole('alert')).toHaveTextContent('72 байта');
    expect(screen.getByText('Обновить')).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
});
