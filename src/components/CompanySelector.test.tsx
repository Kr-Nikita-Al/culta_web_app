import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import CompanySelector from './CompanySelector';
const mockSetSelectedCompany = jest.fn();
const mockAdmin = {company_id:'a', role:'PORTAL_ROLE_ADMIN'};
const mockWaiter = {company_id:'a', role:'PORTAL_ROLE_WAITER'};
jest.mock('../context/AuthContext', () => ({useAuth: () => ({roles:[mockAdmin,mockWaiter]})}));
jest.mock('../context/SelectedCompanyContext', () => ({useSelectedCompany: () => ({
    setSelectedCompany:mockSetSelectedCompany,
    availableCompanies:[
        {companyId:'a',companyName:'Кафе',role:mockAdmin},
        {companyId:'a',companyName:'Кафе',role:mockWaiter},
    ],
})}));
test('selects the requested role, not the first role in the same company', () => {
    render(<MemoryRouter><CompanySelector/></MemoryRouter>);
    fireEvent.change(screen.getByRole('combobox'), {target:{value:'a:PORTAL_ROLE_WAITER'}});
    fireEvent.click(screen.getByRole('button', {name:'Продолжить'}));
    expect(mockSetSelectedCompany).toHaveBeenCalledWith('a',mockWaiter);
});
