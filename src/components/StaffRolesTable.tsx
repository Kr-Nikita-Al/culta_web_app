import React,{useEffect,useRef,useState} from 'react';
import api from '../services/api';
import {ROLE_DISPLAY_NAMES} from '../services/roleService';
import {useNotifications} from '../context/NotificationContext';
type Staff={user_id:string;name:string;surname:string;roles:string[];self:boolean;can_grant:boolean};
type Data={users:Staff[];grantable_roles:string[];revocable_roles:string[];has_more:boolean};
const roles=['OWNER','ADMIN','MODERATOR','WAITER','COOK','HOSTESS'].map(r=>'PORTAL_ROLE_'+r);
export default function StaffRolesTable({companyId,revision}:{companyId:string;revision:number}){
    const {addNotification}=useNotifications();
    const [data,setData]=useState<Data|null>(null),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false);
    const generation=useRef(0),notify=useRef(addNotification);notify.current=addNotification;
    const load=async()=>{const id=++generation.current;setBusy(true);try{const r=await api.get<Data>('/user_role/staff_table',{params:{company_id:companyId,page}});if(id===generation.current)setData(r.data);}catch{if(id===generation.current){setData(null);notify.current('Не удалось загрузить сотрудников','error');}}finally{if(id===generation.current)setBusy(false);}};
    useEffect(()=>{void load();return()=>{generation.current++;};},[companyId,page,revision]); // eslint-disable-line react-hooks/exhaustive-deps
    const toggle=async(user:Staff,role:string)=>{setBusy(true);try{
        const exists=user.roles.includes(role);
        if(exists)await api.delete('/user_role/revoke_staff_privilege',{params:{company_id:companyId,demo_user_id:user.user_id,role}});
        else await api.post('/user_role/grant_staff_privilege',null,{params:{company_id:companyId,promo_user_id:user.user_id,role}});
        notify.current('Права сотрудника обновлены','success');
    }catch{notify.current('Не удалось изменить права. Проверьте доступ и актуальность роли.','error');}
    finally{await load();}};
    return <section className="workspace-card bg-white staff-roles-panel"><header className="staff-roles-heading"><h2 className="section-title">Сотрудники и роли</h2><div><button className="menu-icon" type="button" disabled={busy} aria-label="Обновить сотрудников" onClick={()=>void load()}>↻</button><button className="menu-icon" type="button" disabled={busy||!data} aria-label={editing?'Завершить редактирование ролей':'Редактировать роли сотрудников'} onClick={()=>setEditing(e=>!e)}>{editing?'✓':'✎'}</button></div></header>
        {editing&&<p className="text-sm text-gray-500 mb-3">Каждая отметка сохраняется сразу. Свои роли изменять нельзя.</p>}
        <div className="staff-roles-scroll"><table><thead><tr><th scope="col">ФИО</th>{roles.map(r=><th scope="col" key={r}>{ROLE_DISPLAY_NAMES[r]}</th>)}</tr></thead><tbody>{data?.users.map(u=><tr key={u.user_id}><th scope="row">{`${u.surname} ${u.name}`.trim()||'Без имени'}{u.self&&<small>Вы</small>}</th>{roles.map(r=>{const has=u.roles.includes(r),permitted=!u.self&&(has?data.revocable_roles.includes(r):u.can_grant&&data.grantable_roles.includes(r));return <td key={r}><input type="checkbox" checked={has} disabled={!editing||busy||!permitted} aria-label={`${u.surname} ${u.name}: ${ROLE_DISPLAY_NAMES[r]}`} onChange={()=>void toggle(u,r)}/></td>;})}</tr>)}</tbody></table></div>
        {busy&&<span className="sr-only" role="status">Загрузка сотрудников</span>}{data&&!data.users.length&&<p className="text-sm text-gray-500">Сотрудников нет.</p>}
        {(page>0||data?.has_more)&&<div className="staff-roles-pages"><button disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>← Назад</button><span>{page+1}</span><button disabled={busy||!data?.has_more} onClick={()=>setPage(p=>p+1)}>Далее →</button></div>}
    </section>;
}
