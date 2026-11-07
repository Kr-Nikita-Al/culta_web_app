import React, {useState} from 'react';
import api from '../services/api';

const labels: Record<string,string> = {pending:'Создан',confirmed:'Подтверждён',blocked:'Заблокирован',deleted:'Удалён'};
export default function AccountStatusAdmin() {
    const [id,setId]=useState('');
    const [loaded,setLoaded]=useState<{user_id:string;account_status:string}|null>(null);
    const [status,setStatus]=useState('pending');
    const [busy,setBusy]=useState(false);
    const [message,setMessage]=useState('');
    const run=async(save:boolean)=>{
        setBusy(true);setMessage('');
        try {
            const params={user_id:save?loaded!.user_id:id};
            const {data}=save?await api.patch('/user/account_status',{status,expected_status:loaded!.account_status},{params}):await api.get('/user/account_status',{params});
            setLoaded(data);setStatus(data.account_status);setMessage(save?'Статус сохранён.':'');
        } catch(e:any) {setMessage(e.response?.status===409?'Статус изменился. Загрузите заново.':'Не удалось выполнить действие. Проверьте ID и права.');}
        finally {setBusy(false);}
    };
    return <section className="workspace-card bg-white mb-6">
        <h2 className="section-title">Статус аккаунта Culta</h2>
        <p className="mb-3">Глобальный статус: блокировка ограничивает доступ ко всем заведениям.</p>
        <label>ID пользователя<input className="border rounded p-2 mx-2" value={id} onChange={e=>{setId(e.target.value);setLoaded(null);}}/></label>
        <button disabled={busy||!id} onClick={()=>run(false)}>Загрузить</button>
        {loaded&&<div className="flex gap-3 mt-3"><select aria-label="Статус аккаунта" value={status} onChange={e=>setStatus(e.target.value)}>
            {Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select><button disabled={busy||status===loaded.account_status} onClick={()=>run(true)}>Сохранить статус</button></div>}
        {message&&<p role="status" className="mt-3">{message}</p>}
    </section>;
}
