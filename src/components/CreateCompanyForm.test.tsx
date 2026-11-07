import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import CreateCompanyForm from './CreateCompanyForm';
import api from '../services/api';
const mockNotify=jest.fn();
jest.mock('../context/AuthContext',()=>({useAuth:()=>({userId:'admin',token:'token'})}));
jest.mock('../context/NotificationContext',()=>({useNotifications:()=>({addNotification:mockNotify})}));
jest.mock('../services/api',()=>({__esModule:true,default:{post:jest.fn()}}));
const post=api.post as jest.Mock;
beforeEach(()=>jest.resetAllMocks());
function setup(){
    render(<CreateCompanyForm/>);
    for(const [label,value] of [['Название компании *','Кафе'],['Адрес *','Москва'],['Телефон *','+79990000000'],['Email *','a@example.test']]){
        fireEvent.change(screen.getByLabelText(label),{target:{value}});
    }
}
test('failed creation is visible and retains entered data',async()=>{
    post.mockRejectedValue({response:{status:422,data:{detail:[{msg:'invalid'}]}}});
    setup();fireEvent.submit(screen.getByRole('form',{name:'Создание компании'}));
    await screen.findByText('Проверьте данные компании.');
    expect(screen.getByLabelText('Название компании *')).toHaveValue('Кафе');
    expect(mockNotify).toHaveBeenCalledWith('Проверьте данные компании.','error');
});
test('successful creation resets the active checkbox and all fields',async()=>{
    post.mockResolvedValue({data:{company_id:'id'}});
    setup();fireEvent.click(screen.getByLabelText('Активно'));
    fireEvent.submit(screen.getByRole('form',{name:'Создание компании'}));
    await waitFor(()=>expect(screen.getByLabelText('Название компании *')).toHaveValue(''));
    expect(screen.getByLabelText('Активно')).not.toBeChecked();
    expect(post.mock.calls[0][1].work_state).toBe(true);
});
test('pending creation prevents duplicate requests and field edits',()=>{
    post.mockReturnValue(new Promise(()=>{}));
    setup();
    fireEvent.submit(screen.getByRole('form',{name:'Создание компании'}));
    fireEvent.submit(screen.getByRole('form',{name:'Создание компании'}));
    expect(post).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Название компании *')).toBeDisabled();
});
