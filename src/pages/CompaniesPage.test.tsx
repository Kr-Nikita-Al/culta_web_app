import React from 'react';
import {render,screen,act,fireEvent} from '@testing-library/react';
import CompaniesPage from './CompaniesPage';
import {getCompanyById,updateCompany} from '../services/companyService';
let mockCompany='a';
const mockRelease=jest.fn(),mockNotify=jest.fn(),mockUpdate=jest.fn(),mockAcquire=jest.fn();
jest.mock('../context/AuthContext',()=>({useAuth:()=>({token:'token',userId:'user'})}));
jest.mock('../context/SelectedCompanyContext',()=>({useSelectedCompany:()=>({selectedCompany:mockCompany,selectedRole:{role:'PORTAL_ROLE_OWNER'},updateSelectedCompany:mockUpdate})}));
jest.mock('../context/CompaniesContext',()=>({useCompanies:()=>({companies:[],refreshCompanies:jest.fn(),isLoading:false})}));
jest.mock('../context/NotificationContext',()=>({useNotifications:()=>({addNotification:mockNotify})}));
jest.mock('../hooks/useCompanyEditLease',()=>({useCompanyEditLease:()=>({release:mockRelease,acquire:mockAcquire,token:'lease'}),companyLeaseError:()=>''}));
jest.mock('../services/companyService',()=>({getCompanyById:jest.fn(),updateCompany:jest.fn()}));
jest.mock('../components/AccountStatusAdmin',()=>()=>null);
jest.mock('../components/StoragePhoto',()=>()=>null);
jest.mock('../components/CompanyInfrastructure',()=>()=>null);
jest.mock('../components/StaffCandidatePicker',()=>()=>null);
jest.mock('../components/StaffRolesTable',()=>()=>null);
beforeEach(()=>{jest.clearAllMocks();mockCompany='a';mockAcquire.mockResolvedValue('lease');});
test('old company response cannot replace the currently selected company',async()=>{
    let resolve:(value:any)=>void=()=>{};
    (getCompanyById as jest.Mock).mockImplementation(id=>id==='a'?new Promise(done=>{resolve=done;}):Promise.resolve({company_id:'b',company_name:'Компания Б'}));
    const view=render(<CompaniesPage/>);
    mockCompany='b';view.rerender(<CompaniesPage/>);
    await screen.findByText('Компания Б');
    await act(async()=>resolve({company_id:'a',company_name:'Компания А'}));
    expect(screen.queryByText('Компания А')).not.toBeInTheDocument();
    expect(screen.getByText('Компания Б')).toBeInTheDocument();
});
test('company load errors are visible rather than silently swallowed',async()=>{
    (getCompanyById as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<CompaniesPage/>);
    await screen.findByText('Ошибка загрузки данных компании');
});

test('saving the previous company cannot change the new selection',async()=>{
    let resolve:(value:any)=>void=()=>{};
    (getCompanyById as jest.Mock).mockImplementation(id=>Promise.resolve({company_id:id,address:'Москва',company_name:id==='a'?'Компания А':'Компания Б'}));
    (updateCompany as jest.Mock).mockReturnValue(new Promise(done=>{resolve=done;}));
    const view=render(<CompaniesPage/>);
    await screen.findByText('Компания А');
    fireEvent.click(screen.getByRole('button',{name:'Редактировать компанию'}));
    await screen.findByRole('button',{name:'Сохранить'});
    fireEvent.click(screen.getByLabelText('Внутри заведения'));
    fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
    mockCompany='b';view.rerender(<CompaniesPage/>);
    await screen.findByText('Компания Б');
    await act(async()=>resolve({}));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Компания Б')).toBeInTheDocument();
    expect(mockNotify).not.toHaveBeenCalled();
});


test.each([['Название компании','', 'Укажите название компании'],['Адрес','я'.repeat(51),'Адрес — не более 50 символов']])('validates %s before saving',async(label,value,message)=>{
    (getCompanyById as jest.Mock).mockResolvedValue({company_id:'a',company_name:'Кафе',address:'Москва'});
    render(<CompaniesPage/>);
    await screen.findByText('Кафе');
    fireEvent.click(screen.getByRole('button',{name:'Редактировать компанию'}));
    await screen.findByRole('button',{name:'Сохранить'});
    fireEvent.change(screen.getByLabelText(label),{target:{value}});
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button',{name:'Сохранить'})).toBeDisabled();
    expect(updateCompany).not.toHaveBeenCalled();
});

test('late edit preparation error cannot release the next company lock',async()=>{
    (getCompanyById as jest.Mock).mockImplementation(id=>Promise.resolve({company_id:id,company_name:id,address:'Москва'}));
    const view=render(<CompaniesPage/>);
    await screen.findByText('a');
    let reject:(error:Error)=>void=()=>{};
    (getCompanyById as jest.Mock).mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;}));
    fireEvent.click(screen.getByRole('button',{name:'Редактировать компанию'}));
    await act(async()=>{await Promise.resolve();});
    mockCompany='b';view.rerender(<CompaniesPage/>);
    await screen.findByText('b');
    mockRelease.mockClear();mockNotify.mockClear();
    await act(async()=>{reject(new Error('offline'));});
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
});
