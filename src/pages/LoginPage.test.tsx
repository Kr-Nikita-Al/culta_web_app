import React from 'react';
import {render,screen,fireEvent,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import LoginPage from './LoginPage';
import {loginUser} from '../services/authService';
const mockLogin=jest.fn();
jest.mock('../context/AuthContext',()=>({useAuth:()=>({login:mockLogin})}));
jest.mock('../services/authService',()=>({loginUser:jest.fn(),oauthProviders:[],startGoogleLogin:jest.fn(),startTelegramLogin:jest.fn()}));
jest.mock('../components/RegistrationForm',()=>()=> <div>Форма регистрации</div>);
jest.mock('../components/PasswordChange',()=>()=> <div>Смена пароля</div>);
const request=loginUser as jest.Mock;
beforeEach(()=>{jest.resetAllMocks();});
function setup(){
    render(<MemoryRouter><LoginPage/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Логин'),{target:{value:'a@example.test'}});
    fireEvent.change(screen.getByLabelText('Пароль'),{target:{value:'password'}});
}
test.each(['credentials','tab'])('ignores pending login after changing %s',async(change)=>{
    let resolve:(value:any)=>void=()=>{};
    request.mockReturnValue(new Promise(done=>{resolve=done;}));
    setup();fireEvent.submit(screen.getByRole('form',{name:'Авторизация'}));
    const current=request.mock.calls[0][1];
    expect(current()).toBe(true);
    if(change==='tab')fireEvent.click(screen.getByRole('button',{name:'Регистрация'}));
    else fireEvent.change(screen.getByLabelText('Логин'),{target:{value:'b@example.test'}});
    expect(current()).toBe(false);
    await act(async()=>resolve({token:'token',userId:'user'}));
    expect(mockLogin).not.toHaveBeenCalled();
});
test('prevents duplicate login submissions',()=>{
    request.mockReturnValue(new Promise(()=>{}));
    setup();
    fireEvent.submit(screen.getByRole('form',{name:'Авторизация'}));
    fireEvent.submit(screen.getByRole('form',{name:'Авторизация'}));
    expect(request).toHaveBeenCalledTimes(1);
});
test('does not blame password for network failure',async()=>{
    request.mockRejectedValue(new Error('offline'));
    setup();fireEvent.click(screen.getByRole('button',{name:'Войти'}));
    await screen.findByText('Не удалось связаться с сервисом входа. Попробуйте ещё раз.');
});
test('displays the OAuth failure forwarded by the callback',()=>{
    render(<MemoryRouter initialEntries={[{pathname:'/login',state:{error:'Вход отменён'}}]}><LoginPage/></MemoryRouter>);
    expect(screen.getByText('Вход отменён')).toBeInTheDocument();
});
