import React,{useState,useEffect} from 'react';
import api from '../services/api';
import {useScopedOperation} from '../hooks/useScopedOperation';
import {passwordValidation} from '../utils/passwordValidation';
import PasswordInput from './PasswordInput';

export default function PasswordChange(){
    const [identifier,setIdentifier]=useState(''),[oldPassword,setOld]=useState(''),[newPassword,setNew]=useState('');
    const [step,setStep]=useState<'form'|'code'|'success'>('form'),[code,setCode]=useState('');
    const {busy,begin}=useScopedOperation(JSON.stringify([identifier,oldPassword,newPassword]));
    const [error,setError]=useState(''),[oldInvalid,setOldInvalid]=useState(false);
    const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
    const phone=/^(\+7|8)\d{10}$/.test(identifier.replace(/[\s()-]/g,''));
    const [retryAt,setRetryAt]=useState(0);
    const [now,setNow]=useState(Date.now());
    useEffect(()=>{
        if(!retryAt)return;
        const timer=setInterval(()=>setNow(Date.now()),1000);
        return()=>clearInterval(timer);
    },[retryAt]);
    const cooldown=Math.max(0,Math.ceil((retryAt-now)/1000));
    const setCooldown=(seconds:unknown)=>{
        const delay=typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>=0?seconds:60;
        const current=Date.now();
        setNow(current);setRetryAt(current+delay*1000);
    };
    const newPasswordError=passwordValidation(newPassword,8);
    const oldPasswordError=passwordValidation(oldPassword,1);
    const send=async(confirm=false)=>{
        if (!email || oldPasswordError || newPasswordError || newPassword === oldPassword || (confirm && !/^\d{6}$/.test(code))) return;
        if(!confirm && Date.now()<retryAt)return;
        const operation=begin();
        if(!operation)return;
        setError('');setOldInvalid(false);
        try{
            const {data}=await api.post(`/login/password/${confirm?'confirm':'request-code'}`,{identifier:identifier.trim(),old_password:oldPassword,new_password:newPassword,...(confirm?{code}:{})},{timeout:60000});
            if(!operation.isCurrent())return;
            if(data?.status !== (confirm?'changed':'sent')){
                setError('Не удалось обработать ответ сервера. Попробуйте ещё раз.');
                return;
            }
            if(confirm){setStep('success');setOld('');setNew('');setCode('');}
            else{setStep('code');setCode('');setCooldown(data.retry_after);}
        }catch(e:any){
            if(!operation.isCurrent())return;
            const status=e.response?.status;
            if(status===429)setCooldown(60);
            if(status===401){setOldInvalid(true);setStep('form');}
            setError(status===401?'Неверный email или старый пароль.':status===400&&confirm?'Код неверен или истёк.':status===429?'Новый код можно запросить через минуту.':status===503&&!confirm?'Не удалось отправить письмо. Повторите позже.':status===403?'Аккаунт недоступен или email не подтверждён.':!status?'Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.':'Не удалось изменить пароль. Повторите попытку.');
        }finally{operation.finish();}
    };
    if(step==='success')return <div role="status" className="text-center py-6"><h3 className="text-green-700 font-semibold">Пароль успешно изменён</h3><p className="text-sm mt-2">Используйте новый пароль при входе.</p></div>;
    return <form aria-label="Изменение пароля" onSubmit={e=>{e.preventDefault();void send(step==='code');}} className="space-y-3">
        {step==='form'?<>
            <label className="block text-sm">Телефон или email<input className="w-full border rounded mt-1" value={identifier} onChange={e=>{setIdentifier(e.target.value);setError('');}} required autoComplete="username"/></label>
            {identifier&&!email&&!phone&&<p role="alert" className="text-red-700 text-sm">Введите корректный email или телефон в формате +7… / 8…</p>}
            {phone&&<p className="text-sm text-amber-700">Подтверждение через Telegram пока недоступно. Используйте email.</p>}
            <label className="block text-sm">Старый пароль<PasswordInput className={`w-full border rounded mt-1 ${oldInvalid?'border-red-500':''}`} aria-invalid={oldInvalid} value={oldPassword} onChange={e=>{setOld(e.target.value);setOldInvalid(false);}} autoComplete="current-password" required/></label>
            <label className="block text-sm">Новый пароль<PasswordInput className="w-full border rounded mt-1" value={newPassword} onChange={e=>setNew(e.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required/></label>
            {newPassword&&newPasswordError&&<p role="alert" className="text-red-700 text-sm">{newPasswordError}</p>}
            {oldPassword&&oldPasswordError&&<p role="alert" className="text-red-700 text-sm">Старый пароль: {oldPasswordError}</p>}
            <p className="text-xs text-gray-500">От 8 символов; новый пароль должен отличаться от старого.</p>
        </>:<>
            <p className="text-sm">Введите код из письма на {identifier}.</p>
            <input aria-label="Код смены пароля" className="border rounded w-full" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/>
            <button type="button" disabled={busy||cooldown>0} onClick={()=>void send()}>Запросить новый код{cooldown>0? ` (${cooldown} с)`: ''}</button>
            <p className="text-sm text-gray-500">Проверьте почту и «Спам». Код действует 10 минут.</p>
        </>}
        {step==='form'&&cooldown>0&&<p role="status" className="text-sm">Повторный запрос через {cooldown} с.</p>}
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" className="confirmation-submit w-full" disabled={busy||(step==='form'?(cooldown>0||!email||!!newPasswordError||!!oldPasswordError||newPassword===oldPassword):code.length!==6)}>{busy?'Подождите…':step==='code'?'Подтвердить':'Обновить'}</button>
    </form>;
}
