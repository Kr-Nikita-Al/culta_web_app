import React from 'react';
import {act, render} from '@testing-library/react';
import {SelectedCompanyProvider, useSelectedCompany} from './SelectedCompanyContext';
let mockAuth = {userId: 'first', token: 'token'};
jest.mock('./AuthContext', () => ({useAuth: () => mockAuth}));
let selected: ReturnType<typeof useSelectedCompany>;
function Probe() {selected = useSelectedCompany(); return null;}
const role = {company_id: 'company', role: 'PORTAL_ROLE_ADMIN'};
beforeEach(() => {localStorage.clear(); mockAuth = {userId: 'first', token: 'token'};});
test('stored choice belongs only to the account that selected it', () => {
    const view = render(<SelectedCompanyProvider><Probe/></SelectedCompanyProvider>);
    act(() => selected.setSelectedCompany('company', role));
    expect(JSON.parse(localStorage.getItem('selectedCompany')!).userId).toBe('first');
    mockAuth = {userId: 'second', token: 'other'};
    view.rerender(<SelectedCompanyProvider><Probe/></SelectedCompanyProvider>);
    expect(selected.selectedCompany).toBeNull();
    expect(selected.selectedRole).toBeNull();
    expect(selected.availableCompanies).toEqual([]);
});
test('same account restores selection while legacy unowned selection is discarded', () => {
    localStorage.setItem('selectedCompany', JSON.stringify({userId: 'first', companyId: 'company', role}));
    const view = render(<SelectedCompanyProvider><Probe/></SelectedCompanyProvider>);
    expect(selected.selectedCompany).toBe('company');
    view.unmount();
    localStorage.setItem('selectedCompany', JSON.stringify({companyId: 'company', role}));
    render(<SelectedCompanyProvider><Probe/></SelectedCompanyProvider>);
    expect(selected.selectedCompany).toBeNull();
});
test('superadmin choice with no company survives remount', () => {
    const view = render(<SelectedCompanyProvider><Probe/></SelectedCompanyProvider>);
    act(() => selected.setSelectedCompany(null, {company_id: 'superadmin', role: 'PORTAL_ROLE_SUPER_ADMIN'}));
    view.unmount();
    render(<SelectedCompanyProvider><Probe/></SelectedCompanyProvider>);
    expect(selected.selectedRole?.role).toBe('PORTAL_ROLE_SUPER_ADMIN');
    expect(selected.selectedCompany).toBeNull();
});
