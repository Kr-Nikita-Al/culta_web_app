import React, {useEffect, useState} from 'react';
import api from '../services/api';
import StorageMoveDetails from './StorageMoveDetails';

interface Operation {operation_id: string; source_key: string; destination_key: string; planned_count: number}
const pageSize = 20;

export default function PendingStorageMoves({companyId, revision = 0}: {companyId: string; revision?: number}) {
    // Remount on company changes, including requests still awaiting a response.
    return <CompanyMoves key={companyId} companyId={companyId} externalRevision={revision}/>;
}

function CompanyMoves({companyId, externalRevision}: {companyId: string; externalRevision: number}) {
    const [operations, setOperations] = useState<Operation[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(false);
        setSelected(null);
        setOperations([]);
        api.get('/image/pending_moves', {params: {company_id: companyId, offset, limit: pageSize}})
            .then(({data}) => {
                if (!active) return;
                if (!Array.isArray(data.operations) || !Number.isInteger(data.total) || data.total < 0)
                    throw new Error('Invalid operation list');
                // Operations can finish while the user is viewing a later page.
                if (offset > 0 && data.operations.length === 0) {setOffset(0); return;}
                setOperations(data.operations); setTotal(data.total);
            })
            .catch(reason => {
                if (!active) return;
                if (reason.response?.status === 403) {setOperations([]); setTotal(0);}
                else setError(true);
            })
            .finally(() => {if (active) setLoading(false);});
        return () => {active = false;};
    }, [companyId, offset, revision, externalRevision]);
    const relative = (key: string) => key.replace(`company_images/company_${companyId}/`, '') || 'Диск';
    if (!error && total === 0) return null;
    return <section aria-label="Незавершённые перемещения" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-semibold">Незавершённые перемещения</h3>
        {total > 0 && <p>Некоторые перемещения ещё не завершены. Они могут выполняться сейчас. Проверьте состояние позже, прежде чем повторять действие.</p>}
        {error && <p role="alert">Не удалось проверить состояние перемещений.</p>}
        <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}
            className="rounded-lg bg-amber-100 px-3 py-2">Проверить перемещения</button>
        {operations.map(item => <div key={item.operation_id} className="mt-3 break-all">
            <span>{relative(item.source_key)} → {relative(item.destination_key)}</span>
            <span className="ml-2">· файлов: {item.planned_count}</span>
            <button type="button" className="ml-3 rounded-lg bg-amber-100 px-3 py-2" aria-expanded={selected === item.operation_id}
                onClick={() => setSelected(value => value === item.operation_id ? null : item.operation_id)}>
                {selected === item.operation_id ? 'Скрыть проверку' : 'Проверить файлы'}
            </button>
            {selected === item.operation_id && <StorageMoveDetails companyId={companyId} operationId={item.operation_id}/>}
        </div>)}
        {total > pageSize && <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - pageSize))}>Назад</button>
            <span>{offset + 1}–{Math.min(offset + pageSize, total)} из {total}</span>
            <button type="button" disabled={loading || offset + pageSize >= total} onClick={() => setOffset(value => value + pageSize)}>Далее</button>
        </div>}
    </section>;
}
