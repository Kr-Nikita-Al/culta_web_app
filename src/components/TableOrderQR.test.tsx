import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TableOrderQR from './TableOrderQR';
import api from '../services/api';

jest.mock('../services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());

test('unsaved tables cannot issue a QR', () => {
    render(<TableOrderQR companyId="c" tableId="t" saved={false} />);
    expect(screen.getByRole('button', { name: 'Выпустить QR стола' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
});

test('requires confirmation, renders locally and does not issue again for print', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { company_id: 'c', table_id: 't', table_label: 'Стол 5', qr_payload: 'culta://table?token=test-only' } });
    const print = jest.spyOn(window, 'print').mockImplementation(() => {});
    const { unmount } = render(<TableOrderQR companyId="c" tableId="t" saved />);
    fireEvent.click(screen.getByRole('button', { name: 'Выпустить QR стола' }));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить выпуск' }));
    await screen.findByRole('button', { name: 'Скачать SVG' });
    expect(api.post).toHaveBeenCalledWith('/order/table-qr', { company_id: 'c', table_id: 't' });
    expect(screen.getByRole('img',{name:'QR: Стол 5'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Печать QR' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(document.body).toHaveClass('printing-table-qr');
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body).not.toHaveClass('printing-table-qr');
    unmount();
    expect(screen.queryByTestId('table-order-qr-print')).not.toBeInTheDocument();
    print.mockRestore();
});

test('failed reissue hides the potentially revoked QR and explains recovery', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('network'));
    render(<TableOrderQR companyId="c" tableId="t" saved />);
    fireEvent.click(screen.getByRole('button', { name: 'Выпустить QR стола' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить выпуск' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Старый код мог быть отозван'));
    expect(screen.queryByRole('button', { name: 'Скачать SVG' })).not.toBeInTheDocument();
});
