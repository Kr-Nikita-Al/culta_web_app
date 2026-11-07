import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';
import Button from './Button';
import './TableOrderQR.css';

interface IssuedQR { company_id: string; table_id: string; table_label: string; qr_payload: string; }

export default function TableOrderQR({ companyId, tableId, saved, disabled = false }: {
    companyId: string; tableId: string; saved: boolean; disabled?: boolean;
}) {
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<IssuedQR | null>(null);
    const [error, setError] = useState('');
    const mounted = useRef(true);
    const inFlight = useRef(false);
    const svg = useRef<SVGSVGElement>(null);
    useEffect(() => { mounted.current = true; return () => {
        mounted.current = false; document.body.classList.remove('printing-table-qr');
    }; }, []);
    useEffect(() => {
        const finish = () => document.body.classList.remove('printing-table-qr');
        window.addEventListener('afterprint', finish);
        return () => window.removeEventListener('afterprint', finish);
    }, []);

    const issue = async () => {
        if (inFlight.current || disabled || !saved) return;
        inFlight.current = true; setBusy(true); setError('');
        // The previous code may already be revoked if the response is lost.
        setResult(null);
        try {
            const { data } = await api.post<IssuedQR>('/order/table-qr', { company_id: companyId, table_id: tableId });
            if (data.company_id !== companyId || data.table_id !== tableId || !data.qr_payload) throw new Error('Invalid QR response');
            if (mounted.current) { setResult(data); setConfirm(false); }
        } catch {
            if (mounted.current) setError('Не удалось получить QR. Старый код мог быть отозван. Повторите выпуск, затем замените распечатку.');
        } finally {
            inFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const download = () => {
        if (!svg.current) return;
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg.current)], { type: 'image/svg+xml' }));
        const link = document.createElement('a'); link.href = url; link.download = `table-${tableId}-qr.svg`;
        link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return <section className="table-order-qr" aria-label="QR для заказа за столом">
        <Button disabled={!saved || disabled || busy} onClick={() => setConfirm(true)}>Выпустить QR стола</Button>
        {!saved && <p>Сначала сохраните стол в плане зала.</p>}
        {confirm && <div className="table-order-qr-warning">
            <p>Новый QR заменит предыдущий. Старый код перестанет работать — замените распечатку на столе.</p>
            <div className="reservation-actions"><Button disabled={busy || disabled} onClick={issue}>{busy ? 'Выпускаем…' : 'Подтвердить выпуск'}</Button>
                <Button disabled={busy} onClick={() => setConfirm(false)}>Отмена выпуска</Button></div>
        </div>}
        {error && <p role="alert">{error}</p>}
        {result && <div className="table-order-qr-result">
            <strong>{result.table_label}</strong>
            <QRCodeSVG role="img" aria-label={`QR: ${result.table_label}`} ref={svg} value={result.qr_payload} size={240} level="M" marginSize={4} title={`QR: ${result.table_label}`} />
            <div className="reservation-actions"><Button onClick={download}>Скачать SVG</Button>
                <Button onClick={() => { document.body.classList.add('printing-table-qr'); window.print(); }}>Печать QR</Button></div>
            <p>Сохраните код сейчас: после выхода из редактора он не будет показан повторно. Для заказа нужно мобильное приложение Culta.</p>
        </div>}
        {result && createPortal(<div data-testid="table-order-qr-print" className="table-order-qr-print"><h1>{result.table_label}</h1>
            <QRCodeSVG value={result.qr_payload} size={320} level="M" marginSize={4} />
            <p>Отсканируйте в приложении Culta, чтобы заказать за этим столом.</p>
        </div>, document.body)}
    </section>;
}
