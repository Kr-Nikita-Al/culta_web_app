import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import {CompaniesProvider, useCompanies} from './CompaniesContext';
import {getAllCompanies} from '../services/companyService';
let mockToken = 'a';
let mockUserId: string | undefined;
const mockCallApi = async (call: () => Promise<unknown>) => call();
jest.mock('./AuthContext', () => ({useAuth: () => ({token:mockToken,userId:mockUserId})}));
jest.mock('../hooks/useApi', () => ({useApi: () => ({callApi:mockCallApi})}));
jest.mock('../services/companyService', () => ({getAllCompanies:jest.fn()}));
const get = getAllCompanies as jest.Mock;
function Probe() {
    const {companies,refreshCompanies,error} = useCompanies();
    return <><button onClick={() => {void refreshCompanies();}}>Refresh</button>
        <span role="alert">{error}</span><span>{companies.map(c => c.company_name).join(',')}</span></>;
}
beforeEach(() => {get.mockReset(); mockToken='a'; mockUserId=undefined; localStorage.clear();});
test('refreshes loaded companies and deduplicates concurrent refreshes', async () => {
    get.mockResolvedValueOnce({companies:[{company_name:'Old'}]});
    render(<CompaniesProvider><Probe/></CompaniesProvider>);
    await screen.findByText('Old');
    let resolve: any;
    get.mockReturnValueOnce(new Promise(r => {resolve=r;}));
    fireEvent.click(screen.getByText('Refresh'));
    fireEvent.click(screen.getByText('Refresh'));
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Old')).toBeInTheDocument();
    await act(async () => resolve({companies:[{company_name:'New'}]}));
    expect(screen.getByText('New')).toBeInTheDocument();
});
test('ignores the previous account response after token changes', async () => {
    let resolve: any;
    get.mockReturnValueOnce(new Promise(r => {resolve=r;}));
    const view = render(<CompaniesProvider><Probe/></CompaniesProvider>);
    mockToken='b';
    get.mockResolvedValueOnce({companies:[{company_name:'Account B'}]});
    view.rerender(<CompaniesProvider><Probe/></CompaniesProvider>);
    await screen.findByText('Account B');
    await act(async () => resolve({companies:[{company_name:'Account A'}]}));
    expect(screen.queryByText('Account A')).not.toBeInTheDocument();
    expect(screen.getByText('Account B')).toBeInTheDocument();
});


test('token refresh keeps company list and next reload uses new credentials', async () => {
    mockUserId='same'; get.mockResolvedValue({companies:[{company_name:'Cafe'}]});
    const view=render(<CompaniesProvider><Probe/></CompaniesProvider>);
    await screen.findByText('Cafe');
    mockToken='refreshed'; view.rerender(<CompaniesProvider><Probe/></CompaniesProvider>);
    expect(screen.getByText('Cafe')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(()=>expect(get).toHaveBeenLastCalledWith('refreshed'));
});

test('failed refresh retains existing companies and exposes retryable error', async () => {
    get.mockResolvedValueOnce({companies:[{company_name:'Cafe'}]});
    render(<CompaniesProvider><Probe/></CompaniesProvider>);
    await screen.findByText('Cafe');
    get.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Не удалось'));
    expect(screen.getByText('Cafe')).toBeInTheDocument();
    get.mockResolvedValueOnce({companies:[]}); fireEvent.click(screen.getByText('Refresh'));
    await waitFor(()=>expect(screen.getByRole('alert')).toBeEmptyDOMElement());
});

test.each([null, {}, {companies:null}, {companies:[null]}])('malformed response preserves existing companies and allows retry: %j',async data=>{
    get.mockResolvedValueOnce({companies:[{company_name:'Cafe'}]});
    render(<CompaniesProvider><Probe/></CompaniesProvider>);
    await screen.findByText('Cafe');
    get.mockResolvedValueOnce(data);
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Не удалось'));
    expect(screen.getByText('Cafe')).toBeInTheDocument();
    get.mockResolvedValueOnce({companies:[{company_name:'Updated'}]});
    fireEvent.click(screen.getByText('Refresh'));
    await screen.findByText('Updated');
});
