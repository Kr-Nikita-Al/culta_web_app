import React, {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import api from '../services/api';
import {useNotifications} from '../context/NotificationContext';
import './AccountConnections.css';
import PasswordInput from './PasswordInput';

type Provider = {provider:string; linked:boolean; available:boolean};
type Suggestion = {id:string;status:'pending'|'verified'};
const names:Record<string,string>={google:'Google',yandex:'Яндекс',telegram:'Telegram',vk:'VK',apple:'Apple'};
const symbols:Record<string,string>={google:'G',yandex:'Я',telegram:'➤',vk:'VK',apple:'●'};
export const LINK_FLOW_KEY='culta-account-link';
export async function startAccountLink(provider:string,suggestionId?:string) {
    const {data}=await api.post(`/login/accounts/${provider}/start`,{suggestion_id:suggestionId}, {withCredentials:true});
    sessionStorage.setItem(LINK_FLOW_KEY,JSON.stringify({provider,state:new URL(data.url).searchParams.get('state')}));
    window.location.assign(data.url);
}

export default function AccountConnections({methodsContainer}: {methodsContainer?: HTMLElement | null}) {
    const [providers,setProviders]=useState<Provider[]>([]);
    const [suggestions,setSuggestions]=useState<Suggestion[]>([]);
    const [busy,setBusy]=useState('');
    const [error,setError]=useState('');
    const {addNotification}=useNotifications();
    useEffect(()=>{
        let alive=true;
        Promise.all([api.get('/login/accounts'),api.get('/login/account-suggestions')]).then(([accounts,candidates])=>{
            if(alive){setProviders(accounts.data.providers);setSuggestions(candidates.data);}
        }).catch(()=>{if(alive)setError('Не удалось загрузить способы входа. Обновите страницу.');});
        return()=>{alive=false;};
    },[]);
    const connect=async(provider:string,suggestionId?:string)=>{
        setBusy(provider);
        try{await startAccountLink(provider,suggestionId);}
        catch{setBusy('');addNotification('Не удалось начать подключение. Проверьте, что вы авторизованы, и попробуйте снова.','error');}
    };
    const methods = <section className="account-connections account-connections-inline" aria-label="Способы входа">
            <h3 className="text-gray-600 text-sm font-normal">Способы входа</h3>
            <p>Подключите свои аккаунты: каждый из них позволит входить в этот профиль. Баланс, история и роли останутся прежними.</p>
            {error&&<p role="alert">{error}</p>}
            <div className="account-provider-grid">
                {[...providers,...['vk','apple'].map(provider=>({provider,linked:false,available:false}))].map(item=><div className="account-provider" key={item.provider}>
                    <span aria-hidden="true" className={`account-provider-icon ${item.provider}`}>{symbols[item.provider]}</span>
                    <div><span className="font-medium text-coffee-dark">{names[item.provider]}</span><small>{item.linked?'Подключён':item.available?'Не подключён':'Пока недоступен'}</small></div>
                    <button type="button" disabled={!!busy||!item.available||item.linked} onClick={()=>connect(item.provider)}>
                        {busy===item.provider?'Переход…':item.linked?'✓':'Авторизоваться'}
                    </button>
                </div>)}
            </div>
            <p className="account-security-note">Подключение требует входа у провайдера. Совпадение email, телефона или ФИО не объединяет профили автоматически.</p>
        </section>;
    return <>
        {methodsContainer ? createPortal(methods, methodsContainer) : methodsContainer === undefined ? methods : null}
        {suggestions.length>0&&<section className="workspace-card bg-white mb-6 account-connections" aria-label="Возможные аккаунты">
            <h2 className="section-title">Возможные аккаунты</h2>
            {suggestions.map(item=><div className="account-suggestion" key={item.id}>
                <button type="button" className="account-dismiss" aria-label="Это не мой аккаунт — больше не предлагать" title="Это не мой аккаунт — больше не предлагать" disabled={!!busy} onClick={async()=>{
                    setBusy(item.id);
                    try{await api.post(`/login/account-suggestions/${item.id}/dismiss`);setSuggestions(old=>old.filter(row=>row.id!==item.id));addNotification('Отказ сохранён. Эту пару аккаунтов больше не предложим.','success');}
                    catch{addNotification('Не удалось сохранить отказ. Попробуйте снова.','error');}
                    finally{setBusy('');}
                }}>×</button>
                <strong>{item.status==='verified'?'Доступ к другому аккаунту подтверждён':'Найден аккаунт, который может вам принадлежать'}</strong>
                <p>{item.status==='verified'?'Он уже связан с отдельным профилем. Профили, бонусы и права не объединены: это отдельный процесс.':'Есть совпадение контактных данных или ФИО. Оно не доказывает владение аккаунтом. Если аккаунт ваш, авторизуйтесь через его провайдера ниже.'}</p>
                {item.status==='pending'&&<><div className="account-candidate-actions">{providers.filter(p=>p.available).map(p=><button type="button" key={p.provider} disabled={!!busy} onClick={()=>connect(p.provider,item.id)}>Авторизоваться через {names[p.provider]}</button>)}</div>
                <details><summary>Подтвердить через email и пароль</summary><form onSubmit={async(event)=>{
                    event.preventDefault();const form=event.currentTarget;const values=new FormData(form);setBusy(item.id);
                    try{await api.post(`/login/account-suggestions/${item.id}/verify-password`,{email:values.get('email'),password:values.get('password')});
                        form.reset();setSuggestions(old=>old.map(row=>row.id===item.id?{...row,status:'verified'}:row));addNotification('Доступ к аккаунту подтверждён. Профили пока не объединены.','success');}
                    catch{addNotification('Не удалось подтвердить аккаунт. Проверьте данные; после пяти попыток нужно подождать 10 минут.','error');}
                    finally{setBusy('');}
                }}><label>Email другого аккаунта<input type="email" name="email" autoComplete="username" required disabled={!!busy}/></label>
                    <label>Пароль другого аккаунта<PasswordInput name="password" autoComplete="current-password" required disabled={!!busy}/></label>
                    <button type="submit" disabled={!!busy}>Подтвердить владение</button></form></details></>}
            </div>)}
        </section>}
    </>;
}
