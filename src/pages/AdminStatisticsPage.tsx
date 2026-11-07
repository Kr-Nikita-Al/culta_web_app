import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import api from '../services/api';
import './AdminStatisticsPage.css';
import '../components/CompanyInfrastructure.css';
import {StatisticsChart,StatisticsBars} from '../components/StatisticsChart';
type Row={company_id:string;name:string;is_active:boolean;closed_checks:number;orders:number;revenue:string;bonuses:string;average_check:string};
type Report={users?:{total:number;available:number;active_buyers:number;new:number;statuses:Record<string,number>};order_activity?:{total:number;statuses:Record<string,number>};daily?:{date:string;closed_checks:number;revenue:string;registrations?:number;orders?:number}[];comparison?:{date_from:string;date_to:string;revenue:string;closed_checks:number;revenue_change:string;revenue_change_percent:string|null};date_from:string;date_to:string;companies:Row[];totals:{companies:number;closed_checks:number;orders:number;revenue:string;average_check:string}};
const money=(value:string)=>Number(value).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
export default function AdminStatisticsPage(){
    const {roles}=useAuth();
    return roles?.some(r=>r.role==='PORTAL_ROLE_SUPER_ADMIN')?<Statistics/>:<div className="workspace-card">Раздел доступен только суперадминистратору.</div>;
}
function Statistics(){
    const [tab,setTab]=useState('overview');
    const today=new Date().toISOString().slice(0,10);
    const [from,setFrom]=useState(today.slice(0,8)+'01'),[to,setTo]=useState(today);
    const [period,setPeriod]=useState({from,to}),[report,setReport]=useState<Report|null>(null);
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState('');
    useEffect(()=>{let live=true;setBusy(true);setError('');setReport(null);
        api.get<Report>('/admin/statistics',{params:{date_from:period.from,date_to:period.to}}).then(r=>{if(live)setReport(r.data);}).catch(e=>{if(live)setError(e.response?.status===403?'Нет доступа к статистике.':'Не удалось загрузить статистику. Проверьте период (не более 367 дней) и повторите запрос.');}).finally(()=>{if(live)setBusy(false);});
        return()=>{live=false;};
    },[period]);
    const rows=(report?.companies||[]).filter(c=>c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>Number(b.revenue)-Number(a.revenue));
    return <section className="workspace-page workspace-card admin-statistics"><h1 className="section-title">Статистика заведений</h1>
        <div className="company-tabs" role="tablist" aria-label="Разделы статистики">{[['overview','Обзор'],['users','Пользователи'],['orders','Заказы'],['companies','Заведения']].map(([id,label])=><button type="button" role="tab" id={`statistics-tab-${id}`} aria-controls="statistics-panel" aria-selected={tab===id} key={id} onClick={()=>setTab(id)}>{label}</button>)}</div>
        <div className="statistics-panel" id="statistics-panel" role="tabpanel" aria-labelledby={`statistics-tab-${tab}`}>
        <form className="admin-statistics-filters" onSubmit={e=>{e.preventDefault();if(from>to){setError('Начало периода должно быть раньше окончания.');return;}setPeriod({from,to});}}>
            <label>С<input required type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>По<input required type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button type="submit" disabled={busy}>Показать</button>
        </form>
        <p className="statistics-note" hidden={tab==='users'||tab==='orders'}>Период по дате закрытия чека, UTC. Выручка — оплата деньгами, без списанных бонусов. Заказы — только в закрытых чеках.</p>
        {busy&&<p role="status">Загрузка…</p>}{error&&<p role="alert">{error}</p>}
        {report&&<><div hidden={tab!=='overview'}><div className="admin-statistics-summary">{[['Заведения',report.totals.companies],['Закрытые чеки',report.totals.closed_checks],['Заказы',report.totals.orders],['Выручка',money(report.totals.revenue)],['Средний чек деньгами',money(report.totals.average_check)]].map(([title,value])=><article key={title}><span>{title}</span><strong>{value}</strong></article>)}</div>
            {report.comparison&&<section className="admin-statistics-comparison"><h2>Сравнение с предыдущим периодом</h2><p>{report.comparison.date_from} — {report.comparison.date_to} (столько же дней)</p><p>Выручка: {money(report.comparison.revenue)}. Изменение: {money(report.comparison.revenue_change)} {report.comparison.revenue_change_percent===null?'(процент не рассчитывается: раньше выручка была нулевой)':`(${report.comparison.revenue_change_percent} %)`}.</p></section>}
            {report.daily&&<details><summary>Динамика по дням</summary><div className="admin-statistics-table"><table><thead><tr><th>Дата, UTC</th><th>Закрытые чеки</th><th>Выручка</th></tr></thead><tbody>{report.daily.map(day=><tr key={day.date}><th scope="row">{day.date}</th><td>{day.closed_checks}</td><td>{money(day.revenue)}</td></tr>)}</tbody></table></div></details>}
            <div className="statistics-charts"><StatisticsChart title="Выручка по дням" values={(report.daily||[]).map(d=>Number(d.revenue))} labels={(report.daily||[]).map(d=>d.date)} unit="₽"/><StatisticsChart title="Закрытые чеки по дням" values={(report.daily||[]).map(d=>d.closed_checks)} labels={(report.daily||[]).map(d=>d.date)} bars/></div>
            </div>
            {tab==='users'&&<><p className="statistics-note">Всего и статусы — на текущий момент. Доступные аккаунты — подтверждённые и не отключённые. Активные покупатели — пользователи, создавшие заказ за выбранный период, а не посетители сайта.</p>{report.users?<><div className="admin-statistics-summary">{[['Всего пользователей',report.users.total],['Доступные аккаунты',report.users.available],['Новые за период',report.users.new],['Активные покупатели',report.users.active_buyers]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="statistics-charts"><StatisticsChart title="Регистрации по дням, UTC" labels={(report.daily||[]).map(d=>d.date)} values={(report.daily||[]).map(d=>d.registrations||0)} bars/><StatisticsBars title="Текущие статусы аккаунтов" rows={Object.entries(report.users.statuses).map(([name,value])=>({name:({pending:'Ожидают подтверждения',confirmed:'Подтверждены',blocked:'Заблокированы',deleted:'Удалены'} as Record<string,string>)[name]||name,value}))}/></div></>:<p>Статистика пользователей недоступна. Обновите API.</p>}</>}
            {tab==='orders'&&<><p className="statistics-note">По дате создания заказа, UTC. Статусы — текущие, независимо от закрытия чека.</p>{report.order_activity?<><div className="admin-statistics-summary"><article><span>Создано заказов за период</span><strong>{report.order_activity.total}</strong></article></div><div className="statistics-charts"><StatisticsChart title="Заказы по дням" labels={(report.daily||[]).map(d=>d.date)} values={(report.daily||[]).map(d=>d.orders||0)} bars/><StatisticsBars title="Статусы заказов за период" rows={Object.entries(report.order_activity.statuses).map(([name,value])=>({name:({created:'Новые',processing:'В работе',completed:'Готовы',canceled:'Отменены',closed:'Закрыты'} as Record<string,string>)[name]||name,value}))}/></div></>:<p>Статистика заказов недоступна. Обновите API.</p>}</>}
            <div hidden={tab!=='companies'}>
            <StatisticsBars title="Топ-10 заведений по выручке, ₽" rows={[...(report.companies||[])].sort((a,b)=>Number(b.revenue)-Number(a.revenue)).slice(0,10).map(c=>({name:c.name,value:Number(c.revenue)}))}/>
            <label>Поиск заведения<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название"/></label>
            <div className="admin-statistics-table"><table><thead><tr><th>Заведение</th><th>Статус</th><th>Заказы</th><th>Чеки</th><th>Выручка</th><th>Средний чек</th><th>Списано бонусов</th></tr></thead><tbody>{rows.map(c=><tr key={c.company_id}><th scope="row">{c.name}</th><td>{c.is_active?'Активно':'Неактивно'}</td><td>{c.orders}</td><td>{c.closed_checks}</td><td>{money(c.revenue)}</td><td>{money(c.average_check)}</td><td>{c.bonuses}</td></tr>)}</tbody></table>{!rows.length&&<p>Заведения не найдены.</p>}</div><small>Сводка включает все заведения; поиск фильтрует только таблицу.</small></div></>}
        </div>
    </section>;
}
