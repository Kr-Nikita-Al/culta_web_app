import React, { useEffect, useState } from 'react';
import { Check, checkService } from '../services/checkService';
import { formatMoney } from '../utils/money';
import { getOrderError } from '../utils/orderUtils';
import Button from './Button';
import { bonusPreview } from '../utils/bonusMath';

export default function CheckPanel({ checkId, companyId, canClose, disabled = false, onLocked }: {
    checkId: string; companyId: string; canClose: boolean; disabled?: boolean; onLocked: (locked: boolean) => void;
}) {
    const [check, setCheck] = useState<Check | null>(null);
    const [paid, setPaid] = useState('');
    const [spent, setSpent] = useState('0.00');
    const [uncertain, setUncertain] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [qrToken, setQrToken] = useState('');
    useEffect(() => {
        let active = true;
        onLocked(true);
        checkService.get(checkId, companyId).then(result => {
            if (active) { setCheck(result); onLocked(result.status !== 'open'); }
        }).catch(cause => { if (active) setError(getOrderError(cause).message); });
        return () => { active = false; };
    }, [checkId, companyId, onLocked]);

    const preview = check?.total_amount == null ? null : bonusPreview(check.total_amount,
        spent || '0', check.max_bonus_spend || '0.00', check.bonus_accrual_perc || '0.00');

    return <section aria-label="Чек">
        <h3>Чек</h3>
        <p className="orders-id">{checkId}</p>
        {error && <p role="alert" className="orders-error">{error}</p>}
        {check && <>
            <p>{check.status === 'closed' ? 'Оплачен и закрыт' : check.status === 'open' ? 'Открыт' : 'Отменён'} · Заказов: {check.order_ids.length}</p>
            <p>Сумма чека: {check.total_amount === null ? 'не определена' : formatMoney(check.total_amount)}</p>
            <p>{check.user_id ? `Уровень: ${check.loyalty_level_name || 'Базовый'}` : `Гость: ${check.guest_name || 'без имени'} · Без бонусов`}</p>
            {canClose && check.status === 'open' && !check.user_id && <details>
                <summary>Привязать аккаунт клиента до оплаты</summary>
                <label>Код из QR клиента<input value={qrToken} disabled={busy || disabled || uncertain} onChange={e=>setQrToken(e.target.value)} /></label>
                <Button type="button" disabled={busy || disabled || uncertain || !qrToken.trim()} onClick={async()=>{
                    setBusy(true);setError('');onLocked(true);
                    try {setCheck(await checkService.link(checkId,companyId,qrToken.trim()));setQrToken('');setPaid('');setSpent('0.00');onLocked(false);}
                    catch(cause){setError('Обновите заказ и проверьте привязку. '+getOrderError(cause).message);setUncertain(true);}
                    finally{setBusy(false);}
                }}>Привязать клиента</Button>
            </details>}
            {check.status === 'closed' && <>
                <p>Оплачено деньгами: {formatMoney(check.paid_amount)}</p>
                <p>Списано баллов: {check.bonus_spent || '0.00'} · Начислено: {check.bonus_earned || '0.00'}</p>
            </>}
            {canClose && check.status === 'open' && <form onSubmit={async event => {
                event.preventDefault();
                if (busy || disabled || uncertain || !preview) return;
                setBusy(true); setError(''); onLocked(true);
                try {
                    const result = await checkService.close(checkId, companyId, paid, spent || '0.00');
                    setCheck(result);
                } catch (cause) {
                    setUncertain(true);
                    setError('Закрытие не подтверждено. Обновите заказ и проверьте чек. Все заказы должны быть готовы или отменены, а оплата вместе с баллами — равна актуальной сумме. ' + getOrderError(cause).message);
                    // Keep editing locked after an ambiguous response until the order is refreshed.
                } finally { setBusy(false); }
            }}>
                <p className="orders-muted">Закрытие фиксирует полученную оплату. Это не списание с банковской карты. Все заказы должны быть готовы или отменены.</p>
                {check.bonus_balance != null && <>
                    <p>Баланс: {check.bonus_balance} баллов · Можно списать: {check.max_bonus_spend || '0.00'} (до {check.bonus_payment_perc || '0'}%)</p>
                    <label>Списать баллы<input type="number" min="0" max={check.max_bonus_spend || '0'} step="0.01"
                        value={spent} disabled={busy || disabled || uncertain || check.max_bonus_spend === '0.00'}
                        onChange={event => setSpent(event.target.value)} /></label>
                </>}
                {preview ? <p>К оплате деньгами: {formatMoney(preview.paid)} · Будет начислено: {preview.earned} баллов</p>
                    : <p role="alert">Проверьте сумму списания баллов.</p>}
                <label>Получено, ₽<input required type="number" min="0" step="0.01" value={paid} disabled={busy || disabled || uncertain}
                    onChange={event => setPaid(event.target.value)} /></label>
                <Button type="submit" disabled={busy || disabled || uncertain || paid === '' || !preview}>Подтвердить оплату и закрыть чек</Button>
            </form>}
        </>}
    </section>;
}
