import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import api from '../services/api';
import Button from './Button';
import './StoragePhoto.css';

type Photo = {image_id:string|null;url:string|null;title?:string;role?:string;file_path?:string;size?:number;default_role?:string|null;inherited?:boolean};
const EMPTY = '00000000-0000-0000-0000-000000000000';
const photoCache=new Map<string,{photo:Photo;expires:number}>();
let cacheSession:string|null=null;
export function clearStoragePhotoCache(){photoCache.clear();cacheSession=null;}
function cacheKey(companyId:string,role?:string){
    const session=localStorage.getItem('authToken_v2');
    if(session!==cacheSession){photoCache.clear();cacheSession=session;}
    return `${companyId}:${role || 'company'}`;
}
function cachedPhoto(companyId:string,role?:string){
    return photoCache.get(cacheKey(companyId,role));
}
function remember(companyId:string,role:string|undefined,photo:Photo){
    if(photoCache.size>=100)photoCache.delete(photoCache.keys().next().value!);
    photoCache.set(cacheKey(companyId,role),{photo,expires:Date.now()+120000});
}

export default function StoragePhoto({companyId,role,editable,title,defaultControlContainer,leaseToken}: {companyId:string;role?:string;editable:boolean;title:string;defaultControlContainer?:HTMLElement|null;leaseToken?:string|null}) {
    const [photo,setPhoto]=useState<Photo>(()=>cachedPhoto(companyId,role)?.photo || {image_id:null,url:null});
    const [options,setOptions]=useState<Photo[]|null>(null);
    const [pickerOpen,setPickerOpen]=useState(false);
    const [viewerOpen,setViewerOpen]=useState(false);
    const [folder,setFolder]=useState('');
    const dialog=useRef<HTMLDivElement>(null);
    const [busy,setBusy]=useState(false), [error,setError]=useState('');
    const request=useRef(0), renewed=useRef(false);
    const load=async () => {
        const session=localStorage.getItem('authToken_v2');
        const result = await api.get(role ? '/photos/my-roles' : '/photos/company',{params:{company_id:companyId}});
        if(session===localStorage.getItem('authToken_v2')){
            if(role){for(const item of result.data)remember(companyId,item.role,item);}
            else remember(companyId,undefined,result.data);
        }
        return role ? result.data.find((p:Photo)=>p.role===role) || {image_id:null,url:null} : result.data;
    };
    useEffect(()=>{
        const id=++request.current;
        const cached=cachedPhoto(companyId,role);
        setPhoto(cached?.photo || {image_id:null,url:null});setOptions(null);setPickerOpen(false);setViewerOpen(false);setError('');renewed.current=false;
        if(!cached || cached.expires<=Date.now())load().then(value=>{if(id===request.current)setPhoto(value);}).catch(()=>{if(id===request.current)setError('Не удалось загрузить фотографию.');});
        const requests = request;
        return ()=>{requests.current++;};
        // Each company/role owns its photo and outstanding requests.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[companyId,role]);
    const choose=async()=>{
        const id=++request.current; setPickerOpen(true);setFolder('');setOptions(null);setBusy(true);setError('');
        try {const response=await api.get('/photos/options',{params:{company_id:companyId}});if(id===request.current)setOptions(response.data);}
        catch {if(id===request.current)setError('Не удалось загрузить изображения заведения.');}
        finally {if(id===request.current)setBusy(false);}
    };
    const save=async(image_id:string)=>{
        const id=++request.current;setBusy(true);setError('');
        try {
            await api.put(role ? '/photos/my-role' : '/photos/company',{image_id},{params:{company_id:companyId,...(role?{role}:{})},...(!role&&leaseToken?{headers:{'X-Company-Edit-Token':leaseToken}}:{})});
            for(const key of Array.from(photoCache.keys()))if(key.startsWith(`${companyId}:`))photoCache.delete(key);
            const value=await load();
            if(id===request.current){setPhoto(value);setOptions(null);setPickerOpen(false);renewed.current=false;}
        } catch {if(id===request.current)setError('Не удалось сохранить. Проверьте права и доступность изображения.');}
        finally {if(id===request.current)setBusy(false);}
    };
    const renew=async()=>{
        if(renewed.current)return;
        renewed.current=true;const id=request.current;
        try {const value=await load();if(id===request.current)setPhoto(value);}catch {if(id===request.current)setError('Фотография недоступна.');}
    };
    const setDefault=async(value:boolean)=>{
        const id=++request.current;setBusy(true);setError('');
        try {
            await api.put('/photos/my-role',{apply_to_all:value},{params:{company_id:companyId,role}});
            for(const key of Array.from(photoCache.keys()))if(key.startsWith(`${companyId}:`))photoCache.delete(key);
            const updated=await load();if(id===request.current)setPhoto(updated);
        } catch {if(id===request.current)setError('Не удалось изменить общее фото. Обновите страницу и повторите.');}
        finally {if(id===request.current)setBusy(false);}
    };
    useEffect(()=>{
        if(!pickerOpen && !viewerOpen)return;
        const previous=document.activeElement as HTMLElement|null;
        const overflow=document.body.style.overflow;
        document.body.style.overflow='hidden';
        dialog.current?.focus();
        return ()=>{document.body.style.overflow=overflow;previous?.focus();};
    },[pickerOpen,viewerOpen]);
    const close=()=>{setPickerOpen(false);setViewerOpen(false);};
    const relativePath=(p:Photo)=>(p.file_path || '').replace(`company_images/company_${companyId}/`,'').replace(/^\/+|\/+$/g,'');
    const folders=Array.from(new Set((options || []).map(relativePath).filter(p=>p && (!folder || p.startsWith(folder+'/')) && p!==folder).map(p=>p.slice(folder?folder.length+1:0).split('/')[0]))).sort();
    const visibleOptions=options?.filter(p=>relativePath(p)===folder);
    const defaultControl=role && editable ? <label className="storage-photo-default"><input type="checkbox" checked={!!photo.default_role} disabled={busy || (!!photo.default_role && photo.default_role!==role) || !photo.image_id} onChange={e=>setDefault(e.target.checked)}/> Установить фото на все роли в компании
        {photo.default_role && photo.default_role!==role && <small>Изменить можно только в роли, установившей общее фото.</small>}
    </label> : null;
    const visual=photo.url ? <img className={role?'storage-photo-avatar':'storage-photo-cover'} src={photo.url} alt={title} onError={renew}/> : <div className="storage-photo-empty">Нет фото</div>;
    return <section className="storage-photo" aria-label={title}>
        <div className="storage-photo-heading">
            <div className="storage-photo-preview">
                {editable || photo.url ? <button type="button" className="storage-photo-trigger" disabled={busy} onClick={()=>photo.url?setViewerOpen(true):choose()} aria-label={`${photo.url?'Открыть':'Выбрать'} фото: ${title}`}>{visual}</button> : visual}
                {editable && photo.image_id && <div className="storage-photo-tools">
                    <button type="button" className="storage-photo-icon storage-photo-replace" disabled={busy} onClick={choose} aria-label="Заменить фото" title="Заменить фото"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0112-1l2 6M18 17a7 7 0 01-12 1l-2-6"/></svg></button>
                    <button type="button" className="storage-photo-icon storage-photo-remove" disabled={busy} onClick={()=>save(EMPTY)} aria-label="Удалить фото" title="Снять фото (файл останется в изображениях)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
                </div>}
            </div>
            {defaultControlContainer ? createPortal(defaultControl,defaultControlContainer) : defaultControlContainer===undefined ? defaultControl : null}
        </div>
        {error && !pickerOpen && <p role="alert">{error}</p>}
        {(pickerOpen || viewerOpen) && createPortal(<div className={`storage-photo-backdrop ${viewerOpen?'storage-photo-fullscreen':''}`} onClick={event=>{if(event.target===event.currentTarget)close();}}>
          <div className={viewerOpen?'storage-photo-viewer':'storage-photo-picker'} onClick={event=>{if(viewerOpen && event.target===event.currentTarget)close();}} ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={viewerOpen?'Просмотр фото':'Изображения заведения'} onKeyDown={event=>{
              if(event.key==='Escape'){event.stopPropagation();close();}
              if(event.key==='Tab'){
                  const items=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled)');
                  if(!items?.length)return;
                  const first=items[0],last=items[items.length-1];
                  if(event.shiftKey && (document.activeElement===first || document.activeElement===dialog.current)){event.preventDefault();last.focus();}
                  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
              }
          }}>
            {viewerOpen ? <><button type="button" className="storage-photo-icon storage-photo-viewer-close" aria-label="Закрыть" onClick={close}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button><img src={photo.url || ''} alt={title} onError={renew}/></> : <>
            <div className="storage-photo-modal-heading"><h2>Изображения заведения</h2><button type="button" className="storage-photo-icon" aria-label="Закрыть" onClick={close}>×</button></div>
            <nav className="storage-photo-path" aria-label="Папки изображений"><button onClick={()=>setFolder('')}>Все изображения</button>{folder.split('/').filter(Boolean).map((part,index)=><React.Fragment key={index}><span>/</span><button onClick={()=>setFolder(folder.split('/').slice(0,index+1).join('/'))}>{part}</button></React.Fragment>)}</nav>
            {busy && <p role="status">Загрузка…</p>}
            {error && <p role="alert">{error} <Button disabled={busy} onClick={choose}>Повторить</Button></p>}
            {options?.length===0 && <p>Нет доступных изображений. Загрузите их в разделе «Изображения».</p>}
            <div className="storage-photo-grid">{folders.map(name=><button type="button" key={`folder:${name}`} onClick={()=>setFolder(folder?`${folder}/${name}`:name)} aria-label={`Открыть папку ${name}`}><svg className="storage-photo-folder" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h7l2 2h9v13H3z"/></svg><span>{name}</span></button>)}{visibleOptions?.map(p=><button type="button" disabled={busy} key={p.image_id} onClick={()=>save(p.image_id!)} aria-label={`Выбрать ${p.title}`}>
                {p.url && <img src={p.url} alt="" loading="lazy"/>}<span>{p.title}</span>{p.size!==undefined && <small>{(p.size/1024).toFixed(1)} KB</small>}
            </button>)}</div>
            </>}
          </div>
        </div>,document.body)}
    </section>;
}
