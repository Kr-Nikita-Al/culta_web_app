import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import PendingStorageDeletions from './PendingStorageDeletions';
import api from '../services/api';
jest.mock('../services/api');
const mockNotify = jest.fn();
jest.mock('../context/NotificationContext', () => ({useNotifications: () => ({addNotification: mockNotify})}));
const get = api.get as jest.Mock, post = api.post as jest.Mock;
const operation = {operation_id: 'op', prefix: 'company_images/company_a/photos/', file_count: 2};
beforeEach(() => {jest.resetAllMocks(); get.mockResolvedValue({data: [operation]});});

test('retry is scoped to company and removes completed operation', async () => {
    const completed = jest.fn();
    post.mockResolvedValue({data: {status: 'done'}});
    render(<PendingStorageDeletions companyId="a" onCompleted={completed}/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Повторить удаление'}));
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/s3_directory/retry_deletion', null, {
        params: {company_id: 'a', operation_id: 'op'}, timeout: 45000
    });
    expect(mockNotify).toHaveBeenCalledWith('Удаление папки завершено', 'success');
});

test('failure preserves retry and does not report success', async () => {
    post.mockRejectedValue(new Error('offline'));
    const completed = jest.fn();
    render(<PendingStorageDeletions companyId="a" onCompleted={completed}/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Повторить удаление'}));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(expect.any(String), 'error'));
    expect(completed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Повторить удаление'})).toBeEnabled();
});

test('double click sends a single mutation', async () => {
    post.mockReturnValue(new Promise(() => {}));
    render(<PendingStorageDeletions companyId="a" onCompleted={jest.fn()}/>);
    const button = await screen.findByRole('button', {name: 'Повторить удаление'});
    fireEvent.click(button); fireEvent.click(button);
    expect(post).toHaveBeenCalledTimes(1);
});

test('refresh failure after deletion does not claim deletion failed', async () => {
    post.mockResolvedValue({data: {status: 'done'}});
    render(<PendingStorageDeletions companyId="a" onCompleted={() => Promise.reject(new Error('offline'))}/>);
    fireEvent.click(await screen.findByRole('button', {name: 'Повторить удаление'}));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(
        'Папка удалена, но галерею не удалось обновить. Обновите страницу.', 'error'));
    expect(mockNotify).not.toHaveBeenCalledWith('Удаление не завершено. Попробуйте повторить позже.', 'error');
});

test('late response from previous company is ignored', async () => {
    let resolveOld: (value: any) => void = () => {};
    get.mockReturnValueOnce(new Promise(resolve => {resolveOld = resolve;}));
    get.mockResolvedValueOnce({data: []});
    const view = render(<PendingStorageDeletions key="a" companyId="a" onCompleted={jest.fn()}/>);
    view.rerender(<PendingStorageDeletions key="b" companyId="b" onCompleted={jest.fn()}/>);
    resolveOld({data: [operation]});
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', {name: 'Повторить удаление'})).not.toBeInTheDocument();
});

test('permission revocation clears previous operations', async () => {
    const view = render(<PendingStorageDeletions companyId="a" onCompleted={jest.fn()}/>);
    await screen.findByRole('button', {name: 'Повторить удаление'});
    get.mockRejectedValueOnce({response: {status: 403}});
    view.rerender(<PendingStorageDeletions companyId="a" revision={1} onCompleted={jest.fn()}/>);
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Повторить удаление'})).not.toBeInTheDocument());
});
