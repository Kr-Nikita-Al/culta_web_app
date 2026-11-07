import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import api from '../services/api';
import StorageMoveDetails from './StorageMoveDetails';
jest.mock('../services/api');
const get = api.get as jest.Mock;
const data = {status: 'pending', status_changed: false, total: 1, next_offset: null,
    objects: [{source: 'company_images/company_a/tea.jpg', state: 'source_only'}]};
beforeEach(() => jest.resetAllMocks());
test('reads diagnostics without mutating storage and paginates', async () => {
    get.mockResolvedValueOnce({data: {...data, total: 21, next_offset: 20}}).mockResolvedValueOnce({data});
    render(<StorageMoveDetails companyId="a" operationId="op"/>);
    await screen.findByText(/Файл есть только в исходной папке/);
    fireEvent.click(screen.getByRole('button', {name: 'Следующие файлы'}));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get).toHaveBeenLastCalledWith('/image/move_diagnostics', {params: {company_id: 'a', operation_id: 'op', offset: 20, limit: 20}, timeout: 15000});
    expect(api.post).not.toHaveBeenCalled();
});
test('failure offers retry and unavailable storage is not reported as missing files', async () => {
    get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data: {...data, objects: [{state: 'unavailable'}]}});
    render(<StorageMoveDetails companyId="a" operationId="op"/>);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', {name: 'Повторить проверку файлов'}));
    await screen.findByText(/Хранилище недоступно — состояние неизвестно/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('late response after switching company is ignored', async () => {
    let resolve: (value: any) => void = () => {};
    get.mockReturnValueOnce(new Promise(done => {resolve = done;})).mockResolvedValueOnce({data: {...data, objects: []}});
    const view = render(<StorageMoveDetails companyId="a" operationId="op"/>);
    view.rerender(<StorageMoveDetails companyId="b" operationId="op2"/>);
    await act(async () => resolve({data}));
    expect(screen.queryByText(/tea.jpg/)).not.toBeInTheDocument();
});
