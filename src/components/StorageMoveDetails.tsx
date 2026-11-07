import React, {useEffect, useState} from 'react';
import api from '../services/api';

interface Snapshot {
    status: string; status_changed: boolean; total: number; next_offset: number | null;
    objects: {source?: string; destination?: string; state: string}[];
}
const labels: Record<string, string> = {
    both_present: 'Файл есть в обеих папках', source_only: 'Файл есть только в исходной папке',
    destination_only: 'Файл есть только в новой папке', neither_present: 'Файл не найден в обеих папках',
    unavailable: 'Хранилище недоступно — состояние неизвестно', invalid_manifest: 'Некорректная запись операции'
};
export default function StorageMoveDetails({companyId, operationId}: {companyId: string; operationId: string}) {
    return <Details key={`${companyId}:${operationId}`} companyId={companyId} operationId={operationId}/>;
}
function Details({companyId, operationId}: {companyId: string; operationId: string}) {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [offset, setOffset] = useState(0);
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(false); setSnapshot(null);
        api.get('/image/move_diagnostics', {params: {company_id: companyId, operation_id: operationId, offset, limit: 20}, timeout: 15000})
            .then(({data}) => {
                if (!active) return;
                if (!Array.isArray(data.objects) || !Number.isInteger(data.total)
                    || (data.next_offset !== null && (!Number.isInteger(data.next_offset) || data.next_offset <= offset)))
                    throw new Error('Invalid diagnostics');
                setSnapshot(data);
            })
            .catch(() => {if (active) setError(true);})
            .finally(() => {if (active) setLoading(false);});
        return () => {active = false;};
    }, [companyId, operationId, offset, revision]);
    return <div className="mt-2 rounded-lg bg-white p-3" aria-label="Проверка файлов перемещения">
        {loading && <p role="status">Проверяем файлы…</p>}
        {error && <p role="alert">Не удалось проверить файлы. Повторите проверку.</p>}
        {snapshot && <>
            <p>{snapshot.status === 'committed' ? 'Перемещение завершено.' : 'Перемещение ещё не подтверждено.'} Результат отражает состояние на момент проверки.</p>
            {snapshot.status_changed && <p>Во время проверки состояние операции изменилось. Обновите список перемещений.</p>}
            <ul>{snapshot.objects.map((item, index) => <li key={offset + index} className="mt-2">
                {item.source?.replace(`company_images/company_${companyId}/`, '') || `Файл ${offset + index + 1}`}: {labels[item.state] || 'Состояние неизвестно'}
            </li>)}</ul>
            {snapshot.total === 0 && <p>В журнале нет файлов для проверки.</p>}
            {snapshot.total > 20 && <p>Файлы {offset + 1}–{offset + snapshot.objects.length} из {snapshot.total}</p>}
        </>}
        <div className="mt-2 flex gap-3">
            <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)}>Повторить проверку файлов</button>
            {offset > 0 && <button type="button" disabled={loading} onClick={() => setOffset(value => Math.max(0, value - 20))}>Предыдущие файлы</button>}
            {snapshot?.next_offset != null && <button type="button" disabled={loading} onClick={() => setOffset(snapshot.next_offset!)}>Следующие файлы</button>}
        </div>
    </div>;
}
