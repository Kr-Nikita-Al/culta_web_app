import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import api from '../services/api';
import PendingStorageMoves from './PendingStorageMoves';
jest.mock('../services/api');
const get = api.get as jest.Mock;
const operation = {operation_id: 'op', source_key: 'company_images/company_a/old/', destination_key: 'company_images/company_a/new/', planned_count: 2};
beforeEach(() => jest.resetAllMocks());

test('shows pending operations without offering unsafe retry and refreshes completion', async () => {
    get.mockResolvedValueOnce({data: {total: 1, operations: [operation]}})
        .mockResolvedValueOnce({data: {total: 0, operations: []}});
    render(<PendingStorageMoves companyId="a"/>);
    expect(await screen.findByText('old/ → new/')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Проверить перемещения'}));
    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
});

test('late previous company response cannot appear in current company', async () => {
    let resolve: (data: any) => void = () => {};
    get.mockReturnValueOnce(new Promise(done => {resolve = done;}));
    get.mockResolvedValueOnce({data: {total: 0, operations: []}});
    const view = render(<PendingStorageMoves companyId="a"/>);
    view.rerender(<PendingStorageMoves companyId="b"/>);
    await act(async () => resolve({data: {total: 1, operations: [operation]}}));
    expect(screen.queryByText('old/ → new/')).not.toBeInTheDocument();
});

test('network failure can be retried and forbidden lists stay hidden', async () => {
    get.mockRejectedValueOnce(new Error('offline'))
        .mockRejectedValueOnce({response: {status: 403}});
    render(<PendingStorageMoves companyId="a"/>);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', {name: 'Проверить перемещения'}));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('pagination is scoped and returns to first page when operations finish', async () => {
    get.mockResolvedValueOnce({data: {total: 21, operations: [operation]}})
        .mockResolvedValueOnce({data: {total: 1, operations: []}})
        .mockResolvedValueOnce({data: {total: 1, operations: [operation]}});
    render(<PendingStorageMoves companyId="a"/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Далее'}));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(get).toHaveBeenNthCalledWith(2, '/image/pending_moves', {params: {company_id: 'a', offset: 20, limit: 20}});
    expect(get).toHaveBeenNthCalledWith(3, '/image/pending_moves', {params: {company_id: 'a', offset: 0, limit: 20}});
});
