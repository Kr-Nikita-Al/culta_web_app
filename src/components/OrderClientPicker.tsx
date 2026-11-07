import React, {useEffect, useState} from 'react';
import api from '../services/api';
import Button from './Button';
import {getOrderError} from '../utils/orderUtils';

type Client = {user_id: string; name: string; surname: string};
export default function OrderClientPicker({companyId, disabled, onSelect}: {
    companyId: string; disabled: boolean; onSelect: (id: string) => void;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Client[]>([]);
    const [chosen, setChosen] = useState('');
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let alive = true;
        const timer = setTimeout(async () => {
            if (query.trim().length < 3) {setResults([]); return;}
            try {
                const response = await api.get('/check/clients', {params: {company_id: companyId, query}});
                if (alive) setResults(response.data);
            } catch (cause) {if (alive) setError(getOrderError(cause).message);}
        }, 300);
        return () => {alive = false; clearTimeout(timer);};
    }, [companyId, query]);
    return <div>
        <label>Клиент приложения<input value={query} disabled={disabled || busy} placeholder="Точный email или ФИО постоянного клиента"
            onChange={e => {setQuery(e.target.value); setResults([]); setChosen(''); onSelect(''); setError('');}} /></label>
        {!chosen && results.map(client => <Button key={client.user_id} type="button" disabled={disabled || busy} onClick={() => {
            setChosen(`${client.name} ${client.surname}`); onSelect(client.user_id);
        }}>{client.name} {client.surname}</Button>)}
        <details><summary>Выбрать по QR клиента</summary>
            <label>Код из QR<input value={token} disabled={disabled || busy} onChange={e => setToken(e.target.value)} /></label>
            <Button type="button" disabled={disabled || busy || !token.trim()} onClick={async () => {
                setBusy(true); setError('');
                try {
                    const response = await api.post('/user/scan_qr_code', {company_id: companyId, qr_token: token.trim()});
                    onSelect(response.data.user_id); setChosen('Клиент подтверждён по QR');
                } catch (cause) {setError(getOrderError(cause).message);}
                finally {setBusy(false);}
            }}>Проверить QR</Button>
        </details>
        {chosen && <p role="status">{chosen}</p>}
        {error && <p role="alert">{error}</p>}
    </div>;
}
