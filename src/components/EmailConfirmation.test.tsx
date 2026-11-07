import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import EmailConfirmation from './EmailConfirmation';
import api from '../services/api';
jest.mock('../services/api',()=>({__esModule:true,default:{post:jest.fn()}}));
const post=api.post as jest.Mock;
beforeEach(()=>post.mockReset());
test('requests and verifies a code without returning credentials to UI',async()=>{
    const done=jest.fn();
    post.mockResolvedValueOnce({data:{status:'sent'}}).mockResolvedValueOnce({data:{status:'confirmed'}});
    render(<EmailConfirmation email="a@example.com" password="secret" onConfirmed={done}/>);
    fireEvent.click(screen.getByText('Подтвердить email по коду'));
    const input=await screen.findByLabelText('Код из письма');
    fireEvent.change(input,{target:{value:'123456'}});
    fireEvent.click(screen.getByText('Подтвердить',{exact:true}));
    await waitFor(()=>expect(done).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenLastCalledWith('/login/email/confirm',{email:'a@example.com',password:'secret',code:'123456'},{timeout:60000});
});
test('explains missing mail delivery',async()=>{
    post.mockRejectedValue({response:{status:503}});
    render(<EmailConfirmation email="a@example.com" password="secret" onConfirmed={()=>{}}/>);
    fireEvent.click(screen.getByText('Подтвердить email по коду'));
    expect(await screen.findByText('Не удалось отправить письмо. Попробуйте позже.')).toBeInTheDocument();
});


test('auto-send runs once in StrictMode', async () => {
    post.mockResolvedValue({data:{status:'sent'}});
    render(<React.StrictMode><EmailConfirmation email="a@example.com" password="secret" autoSend onConfirmed={()=>{}}/></React.StrictMode>);
    await screen.findByText('Код отправлен.');
    expect(post).toHaveBeenCalledTimes(1);
});

test.each(['email', 'password', 'unmount'])('late confirmation is ignored after %s changes', async change => {
    let resolve: (value: any) => void = () => {};
    const done = jest.fn();
    post.mockResolvedValueOnce({data:{status:'sent'}})
        .mockReturnValueOnce(new Promise(finish => {resolve = finish;}));
    const view = render(<EmailConfirmation email="a@example.com" password="secret" onConfirmed={done}/>);
    fireEvent.click(screen.getByText('Подтвердить email по коду'));
    fireEvent.change(await screen.findByLabelText('Код из письма'), {target:{value:'123456'}});
    fireEvent.click(screen.getByText('Подтвердить', {exact:true}));
    if (change === 'unmount') view.unmount();
    else view.rerender(<EmailConfirmation email={change === 'email' ? 'b@example.com' : 'a@example.com'}
        password={change === 'password' ? 'changed' : 'secret'} onConfirmed={done}/>);
    await act(async () => resolve({data:{status:'confirmed'}}));
    expect(done).not.toHaveBeenCalled();
});

test.each([
    [{}, 'Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.'],
    [{response:{status:500}}, 'Не удалось проверить код. Попробуйте ещё раз.'],
    [{response:{status:400}}, 'Код неверен или истёк. Запросите новый код.'],
])('distinguishes confirmation failures: %j', async (error, message) => {
    post.mockResolvedValueOnce({data:{status:'sent'}}).mockRejectedValueOnce(error);
    const done = jest.fn();
    render(<EmailConfirmation email="a@example.com" password="secret" onConfirmed={done} autoSend/>);
    await screen.findByText('Код отправлен.');
    fireEvent.change(screen.getByLabelText('Код из письма'), {target:{value:'123456'}});
    fireEvent.click(screen.getByText('Подтвердить', {exact:true}));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Код из письма')).toHaveValue('123456');
});

test.each([null, {}, {status:'unknown'}])('does not report delivery for malformed responses: %j', async data => {
    post.mockResolvedValue({data});
    render(<EmailConfirmation email="a@example.com" password="secret" onConfirmed={()=>{}}/>);
    fireEvent.click(screen.getByText('Подтвердить email по коду'));
    await screen.findByText('Не удалось обработать ответ сервера. Попробуйте ещё раз.');
    expect(screen.queryByText('Код отправлен.')).not.toBeInTheDocument();
    expect(screen.getByText('Подтвердить email по коду')).toBeEnabled();
});
