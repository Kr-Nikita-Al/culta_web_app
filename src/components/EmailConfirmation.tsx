import React, {useState, useEffect, useRef, useCallback} from 'react';
import api from '../services/api';
import {useScopedOperation} from '../hooks/useScopedOperation';

type Props = {email: string; password: string; onConfirmed: () => void; autoSend?: boolean};
export default function EmailConfirmation(props: Props) {
    return <ConfirmationStep key={props.email} {...props}/>;
}
function ConfirmationStep({email, password, onConfirmed, autoSend = false}: Props) {
    const [code, setCode] = useState('');
    const {busy, begin} = useScopedOperation(JSON.stringify([email, password]));
    const [message, setMessage] = useState('');
    const [sent, setSent] = useState(false);
    const started = useRef(false);
    const [retryAt, setRetryAt] = useState(0);
    const [now, setNow] = useState(Date.now());
    useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
    const run = useCallback(async (confirm: boolean) => {
        const operation = begin();
        if (!operation) return;
        setMessage('');
        try {
            const {data} = await api.post(`/login/email/${confirm ? 'confirm' : 'request-code'}`,
                {email, password, ...(confirm ? {code} : {})}, {timeout: 60000});
            if (!operation.isCurrent()) return;
            if (data?.status === 'confirmed') {
                setCode(''); setSent(false); setMessage('Email подтверждён. Теперь можно войти.'); onConfirmed();
            } else if (!confirm && data?.status === 'sent') {
                const delay = typeof data.retry_after === 'number' && Number.isFinite(data.retry_after) && data.retry_after >= 0 ? data.retry_after : 60;
                setRetryAt(Date.now() + delay*1000);
                setSent(true); setMessage('Код отправлен.');
            } else {
                setMessage('Не удалось обработать ответ сервера. Попробуйте ещё раз.');
            }
        } catch (error: any) {
            if (!operation.isCurrent()) return;
            const status = error.response?.status;
            if(status===429)setRetryAt(Date.now()+60000);
            setMessage(
                status === 429 ? 'Подождите минуту перед повторным запросом.' :
                status === 401 ? 'Проверьте email и пароль.' :
                status === 403 ? 'Аккаунт недоступен.' :
                confirm && status === 400 ? 'Код неверен или истёк. Запросите новый код.' :
                !status ? 'Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.' :
                confirm ? 'Не удалось проверить код. Попробуйте ещё раз.' :
                'Не удалось отправить письмо. Попробуйте позже.'
            );
        } finally { operation.finish(); }
    }, [begin, email, password, code, onConfirmed]);
    useEffect(()=>{if(autoSend && !started.current){started.current=true;void run(false);}},[autoSend, run]);

    return <section className="mb-6 border-t pt-4" aria-label="Подтверждение email">
        <button type="button" disabled={busy || !email || !password || now<retryAt} onClick={()=>run(false)}>
            {sent || autoSend ? 'Запросить новый код' : 'Подтвердить email по коду'}{now<retryAt ? ` (${Math.ceil((retryAt-now)/1000)} с)` : ''}
        </button>
        {(sent || autoSend) && <div className="flex gap-2 mt-3">
            <input aria-label="Код из письма" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={e=>{setCode(e.target.value.replace(/\D/g,''));setMessage('');}} className="border rounded p-2 w-32" />
            <button className="confirmation-submit" type="button" disabled={busy || code.length!==6} onClick={()=>run(true)}>Подтвердить</button>
        </div>}
        {(autoSend || sent) && <p className="text-sm mt-2 text-gray-500">Проверьте почту и «Спам». Код действует 10 минут.</p>}
        {message && <p role="status" className="text-sm mt-3">{message}</p>}
    </section>;
}
