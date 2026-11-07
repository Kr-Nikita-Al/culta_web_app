import React, {useEffect, useState} from 'react';
import {useCompanyEditLease,companyLeaseError} from '../hooks/useCompanyEditLease';
import api from '../services/api';
import Button from './Button';
import {useCompanies} from '../context/CompaniesContext';
import {getOrderError} from '../utils/orderUtils';
import './CompanyInfrastructure.css';
import {useNotifications} from '../context/NotificationContext';

type Level = {name: string; threshold: string; bonus_payment_perc: string; bonus_accrual_perc: string};
type Settings = {version: number; bonus_payment_perc: string; bonus_accrual_perc: string; levels: Level[];
    orders_enabled: boolean; reservations_enabled: boolean; images_enabled: boolean};

export default function CompanyInfrastructure({companyId}: {companyId: string}) {
    const lease=useCompanyEditLease(companyId);
    const beginEdit=async()=>{if(lease.error&&!window.confirm('Загрузить актуальные настройки? Несохранённые правки будут потеряны.'))return;if(!await lease.acquire())return;setReload(x=>x+1);};
    const [data, setData] = useState<Settings | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [conflict, setConflict] = useState(false);
    const [reload, setReload] = useState(0);
    const {refreshCompanies} = useCompanies();
    const {addNotification} = useNotifications();
    useEffect(() => {
        let active = true;
        setData(null); setMessage(''); setConflict(false);
        api.get('/company/infrastructure', {params:{company_id:companyId}}).then(r => {if(active) setData(r.data);})
            .catch(e => {if(active) setMessage(getOrderError(e).message);});
        return () => {active = false;};
    }, [companyId, reload]);
    if (!data) return <section className="workspace-card bg-white"><p>{message || 'Загрузка настроек…'}</p></section>;
    const updateLevel = (index: number, field: keyof Level, value: string) => setData({...data,
        levels: data.levels.map((level, i) => i === index ? {...level, [field]:value} : level)});
    const validRates = (row: {bonus_payment_perc:string; bonus_accrual_perc:string}) =>
        [row.bonus_payment_perc,row.bonus_accrual_perc].every(v => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v)<=100)
        && Number(row.bonus_accrual_perc)<=Number(row.bonus_payment_perc);
    const valid = validRates(data) && data.levels.every(x => validRates(x) && x.name.trim() && /^\d{1,16}(\.\d{1,2})?$/.test(x.threshold));
    return <form className="workspace-card bg-white company-infrastructure" onSubmit={async e => {
        e.preventDefault(); if(busy || !valid || conflict || !lease.token) return;
        setBusy(true); setMessage('');
        try {
            const response = await api.put('/company/infrastructure', data, {params:{company_id:companyId},headers:{'X-Company-Edit-Token':lease.token}});
            await lease.release();
            setData(response.data); addNotification('Настройки сохранены','success');
            await refreshCompanies();
        } catch (e:any) {
            if(e.response?.status===423){await lease.release();addNotification(companyLeaseError(e),'error');return;}
            if(e.response?.status === 409) setConflict(true);
            addNotification(e.response?.status === 409 ? 'Настройки изменены в другом окне. Загрузите актуальную версию.' : getOrderError(e).message,'error');
        } finally {setBusy(false);}
    }}>
        <h2 className="section-title">Инфраструктура</h2>
        {lease.error&&<p role="alert">{lease.error}</p>}
        {!lease.token?<button type="button" className="company-edit-button" aria-label="Редактировать инфраструктуру" disabled={lease.pending} onClick={beginEdit}>✎</button>:<button type="button" className="company-edit-button" aria-label="Отменить редактирование инфраструктуры" disabled={busy} onClick={async()=>{await lease.release();setReload(x=>x+1);}}>×</button>}
        {message && <p role="status">{message}</p>}
        {conflict && <Button type="button" onClick={() => setReload(x=>x+1)}>Загрузить актуальные настройки</Button>}
        <fieldset disabled={busy || conflict || !lease.token}>
            <legend>Бонусная программа</legend>
            <p className="orders-muted">Баланс общий для Culta. Начисление не выше списания; 0% отключает операцию. Базовые проценты действуют до первого уровня.</p>
            <div className="infrastructure-rates">
                <label>Списание, до %<input type="number" min="0" max="100" step="0.01" required value={data.bonus_payment_perc} onChange={e=>setData({...data,bonus_payment_perc:e.target.value})}/></label>
                <label>Начисление, %<input type="number" min="0" max="100" step="0.01" required value={data.bonus_accrual_perc} onChange={e=>setData({...data,bonus_accrual_perc:e.target.value})}/></label>
            </div>
            <h3>Уровни гостей</h3>
            <p className="orders-muted">Считаются оплаты деньгами по закрытым чекам только этого заведения. Достигнутый уровень действует со следующего чека. Пороги и названия должны быть уникальны.</p>
            {data.levels.map((level,i)=><div className="infrastructure-level" key={i}>
                <label>Название<input required maxLength={80} value={level.name} onChange={e=>updateLevel(i,'name',e.target.value)}/></label>
                <label>Потрачено от, ₽<input required type="number" min="0" step="0.01" value={level.threshold} onChange={e=>updateLevel(i,'threshold',e.target.value)}/></label>
                <label>Списание, до %<input required type="number" min="0" max="100" step="0.01" value={level.bonus_payment_perc} onChange={e=>updateLevel(i,'bonus_payment_perc',e.target.value)}/></label>
                <label>Начисление, %<input required type="number" min="0" max="100" step="0.01" value={level.bonus_accrual_perc} onChange={e=>updateLevel(i,'bonus_accrual_perc',e.target.value)}/></label>
                <button type="button" className="company-edit-button" aria-label={`Удалить уровень ${i+1}`} onClick={()=>setData({...data,levels:data.levels.filter((_,j)=>i!==j)})}>×</button>
            </div>)}
            <Button type="button" onClick={()=>setData({...data,levels:[...data.levels,{name:'',threshold:'',bonus_payment_perc:data.bonus_payment_perc,bonus_accrual_perc:data.bonus_accrual_perc}]})}>Добавить уровень</Button>
        </fieldset>
        <fieldset disabled={busy || conflict || !lease.token}>
            <legend>Разделы приложения</legend>
            <p className="orders-muted">Отключённый раздел скрывается и становится недоступен. Данные сохраняются; для работы с ними включите раздел обратно.</p>
            {([['orders_enabled','Заказы'],['reservations_enabled','Бронирования'],['images_enabled','Изображения']] as const).map(([field,label])=>
                <label className="infrastructure-switch" key={field}><input type="checkbox" checked={data[field]} onChange={e=>setData({...data,[field]:e.target.checked})}/>{label}</label>)}
        </fieldset>
        {!valid && <p role="alert">Проверьте поля: проценты от 0 до 100, начисление ≤ списание, название и порог каждого уровня обязательны.</p>}
        <div className="company-save-actions"><button className="company-access-action" type="submit" disabled={!valid || busy || conflict || !lease.token}>{busy?'Сохранение…':'Сохранить'}</button></div>
    </form>;
}
