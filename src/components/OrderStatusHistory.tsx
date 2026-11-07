import React, { useEffect, useRef, useState } from 'react';
import { OrderStatusEvent, orderService } from '../services/orderService';
import { getOrderError, statusLabels } from '../utils/orderUtils';
import Button from './Button';

export default function OrderStatusHistory({orderId, companyId}: {orderId:string;companyId:string}) {
    const [events,setEvents] = useState<OrderStatusEvent[] | null>(null);
    const [busy,setBusy] = useState(false);
    const [error,setError] = useState('');
    const request = useRef(0);
    useEffect(() => () => { request.current++; }, []);
    const load = async () => {
        const id = ++request.current;
        setBusy(true); setError('');
        try { const result = await orderService.history(orderId,companyId); if (id===request.current) setEvents(result); }
        catch (cause) { if (id===request.current) setError(getOrderError(cause).message); }
        finally { if (id===request.current) setBusy(false); }
    };
    return <details className="order-history">
        <summary>История статусов</summary>
        <Button disabled={busy} onClick={load}>{busy ? 'Загрузка…' : 'Загрузить историю'}</Button>
        {error && <p role="alert">{error}</p>}
        {events?.length === 0 && <p className="orders-muted">Записей пока нет. История сохраняется с момента включения журнала.</p>}
        {events && events.length > 0 && <ol>{events.map(event => <li key={event.event_id}>
            <strong>{event.old_status ? `${statusLabels[event.old_status]} → ` : ''}{statusLabels[event.new_status]}</strong>
            <div>{new Date(event.changed_at).toLocaleString('ru-RU')}</div>
            <div className="orders-id">Сотрудник: {event.actor_id}</div>
            {event.reason && <p>{event.reason}</p>}
        </li>)}</ol>}
    </details>;
}
