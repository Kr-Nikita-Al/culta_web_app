import React, {useEffect, useRef, useState} from 'react';
import api from '../services/api';
import {useNotifications} from '../context/NotificationContext';

interface Operation {operation_id: string; prefix: string; file_count: number}
export default function PendingStorageDeletions({companyId, revision = 0, onCompleted}: {
    companyId: string; revision?: number; onCompleted: () => void | Promise<void>;
}) {
    const [operations, setOperations] = useState<Operation[]>([]);
    const [error, setError] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const alive = useRef(true);
    const {addNotification} = useNotifications();
    useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
    useEffect(() => {
        if (busy) return;
        let active = true;
        api.get('/s3_directory/pending_deletions', {params: {company_id: companyId}})
            .then(({data}) => {if (active) {setOperations(data); setError(false);}})
            .catch((reason) => {
                if (!active) return;
                if (reason.response?.status === 403) {setOperations([]); setError(false);}
                else setError(true);
            });
        return () => {active = false;};
    }, [companyId, revision, refresh, busy]);
    const retry = async (operationId: string) => {
        if (inFlight.current) return;
        inFlight.current = true; setBusy(true);
        try {
            await api.post('/s3_directory/retry_deletion', null, {
                params: {company_id: companyId, operation_id: operationId}, timeout: 45000
            });
            if (!alive.current) return;
            setOperations(items => items.filter(item => item.operation_id !== operationId));
            addNotification('Удаление папки завершено', 'success');
            try {await onCompleted();} catch {
                if (alive.current) addNotification('Папка удалена, но галерею не удалось обновить. Обновите страницу.', 'error');
            }
        } catch {
            if (alive.current) addNotification('Удаление не завершено. Попробуйте повторить позже.', 'error');
        } finally {
            inFlight.current = false;
            if (alive.current) {setBusy(false); setRefresh(value => value + 1);}
        }
    };
    if (!error && operations.length === 0) return null;
    return <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Незавершённые удаления">
        <h3 className="font-semibold">Незавершённые удаления</h3>
        {operations.length > 0 && <p>Удаление файлов из хранилища не завершилось. Повторите его, чтобы продолжить изменения в галерее.</p>}
        {error && <p role="alert">Не удалось проверить состояние удалений.</p>}
        <button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Проверить состояние</button>
        {operations.map(item => <div key={item.operation_id} className="flex items-center justify-between gap-3 mt-3">
            <span className="break-all">{item.prefix.replace(`company_images/company_${companyId}/`, '')} · файлов: {item.file_count}</span>
            <button type="button" className="rounded-lg bg-amber-100 px-3 py-2" disabled={busy}
                onClick={() => retry(item.operation_id)}>Повторить удаление</button>
        </div>)}
    </section>;
}
