import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import StaffRolesTable from './StaffRolesTable';
import api from '../services/api';
jest.mock('../services/api',()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn(),delete:jest.fn()}}));
jest.mock('../context/NotificationContext',()=>({useNotifications:()=>({addNotification:jest.fn()})}));
test('shows role matrix and changes only permitted roles after edit is enabled',async()=>{
    (api.get as jest.Mock).mockResolvedValue({data:{users:[{user_id:'me',name:'Я',surname:'Сам',roles:['PORTAL_ROLE_ADMIN'],self:true,can_grant:true},{user_id:'staff',name:'Иван',surname:'Иванов',roles:['PORTAL_ROLE_WAITER'],self:false,can_grant:true}],grantable_roles:['PORTAL_ROLE_COOK'],revocable_roles:['PORTAL_ROLE_WAITER'],has_more:false}});
    (api.post as jest.Mock).mockResolvedValue({data:{}});
    render(<StaffRolesTable companyId="company" revision={0}/>);
    expect(await screen.findByLabelText('Иванов Иван: Повар')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Редактировать роли сотрудников'));
    expect(screen.getByLabelText('Сам Я: Администратор')).toBeDisabled();
    expect(screen.getByLabelText('Иванов Иван: Владелец')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Иванов Иван: Повар'));
    await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/user_role/grant_staff_privilege',null,{params:{company_id:'company',promo_user_id:'staff',role:'PORTAL_ROLE_COOK'}}));
});
