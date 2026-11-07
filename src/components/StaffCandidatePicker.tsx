import React, {useCallback, useEffect, useRef, useState} from 'react';
import {searchStaffCandidates, StaffCandidate} from '../services/roleService';

type Props = {companyId: string; role: string; action: string; value: string; onChange: (id: string) => void};
export default function StaffCandidatePicker(props: Props) {
    return <Picker key={JSON.stringify([props.companyId, props.role, props.action])} {...props}/>;
}
function Picker({companyId, role, action, value, onChange}: Props) {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<StaffCandidate[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const generation = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlight = useRef(false);
    const change = useRef(onChange);
    change.current = onChange;
    useEffect(() => {
        change.current('');
        const requests = generation;
        return () => {requests.current++;};
    }, []);
    const search = useCallback(async () => {
        if (timer.current !== null) {clearTimeout(timer.current); timer.current = null;}
        if (inFlight.current) return;
        inFlight.current = true;
        const request = ++generation.current;
        change.current(''); setUsers([]); setMessage(''); setBusy(true);
        try {
            const data = await searchStaffCandidates(companyId, role, action, query.trim());
            if (request !== generation.current) return;
            setUsers(data.users);
            setMessage(data.has_more ? 'Найдено более 20 пользователей. Уточните ФИО.' :
                data.users.length ? 'Выберите пользователя из списка.' : 'Пользователи не найдены.');
        } catch {
            if (request === generation.current) setMessage('Не удалось выполнить поиск. Проверьте права и повторите.');
        } finally {
            if (request === generation.current) {setBusy(false); inFlight.current = false;}
        }
    }, [companyId, role, action, query]);
    useEffect(() => {
        const requests = generation;
        if (!companyId || query.trim().length < 2) return;
        timer.current = setTimeout(() => {void search();}, 300);
        return () => {
            if (timer.current !== null) clearTimeout(timer.current);
            timer.current = null;
            requests.current++;
            inFlight.current = false;
        };
    }, [companyId, query, search]);
    return <div>
        <label htmlFor="staff-name" className="block text-gray-600 mb-2">Поиск по ФИО:</label>
        <div className="flex gap-2">
            <input id="staff-name" className="w-full min-w-0 p-2 border border-gray-300 rounded"
                placeholder="Имя или фамилия" value={query} disabled={!companyId}
                onChange={e => {generation.current++; setBusy(false); setQuery(e.target.value); onChange(''); setUsers([]); setMessage('');}}
                onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault(); e.stopPropagation(); if (query.trim().length >= 2 && !busy && companyId) void search();}}}/>
        </div>
        {message && <p className="text-sm text-gray-500 mt-2" role="status">{message}</p>}
        <div className="max-h-48 overflow-y-auto mt-2" aria-label="Результаты поиска">
            {users.map(user => <button type="button" key={user.user_id} aria-pressed={value === user.user_id}
                className={`block w-full text-left p-2 border rounded mb-1 ${value === user.user_id ? 'bg-amber-100 border-amber-500' : 'bg-white border-gray-200'}`}
                onClick={() => onChange(user.user_id)}>
                <span className="block font-medium">{user.surname} {user.name}</span>
                <span className="block text-xs text-gray-500 break-all">{user.email_hint} · ID: {user.user_id}</span>
            </button>)}
        </div>
    </div>;
}
