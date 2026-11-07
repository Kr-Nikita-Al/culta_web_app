import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import ProfilePage from './ProfilePage';
const mockRetry=jest.fn();
let mockAuth:any;
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('../context/SelectedCompanyContext',()=>({useSelectedCompany:()=>({selectedCompany:null,selectedRole:null})}));
jest.mock('../components/AccountConnections',()=>()=>null);
jest.mock('../components/StoragePhoto',()=>()=>null);
test('shows loading then retry instead of an empty profile',()=>{
    mockAuth={userInfo:null,sessionError:null,retrySession:mockRetry};
    const view=render(<ProfilePage/>);
    expect(screen.getByText('Загрузка профиля…')).toBeInTheDocument();
    mockAuth={...mockAuth,sessionError:'Нет связи'};
    view.rerender(<ProfilePage/>);
    expect(screen.getByRole('alert')).toHaveTextContent('Нет связи');
    fireEvent.click(screen.getByRole('button',{name:'Повторить загрузку'}));
    expect(mockRetry).toHaveBeenCalledTimes(1);
});
