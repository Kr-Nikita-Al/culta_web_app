import React,{useEffect,useState,useCallback} from 'react';
import {useScopedOperation} from '../hooks/useScopedOperation';
import {useLatestRequest} from '../hooks/useLatestRequest';
import {motion} from 'framer-motion';
import {getMenuPhotos} from '../services/menuPhotoCache';
import api from '../services/api';
import {useSelectedCompany} from '../context/SelectedCompanyContext';
import {ProductDialog,Product,Photo} from '../components/MenuProductDialog';
import MenuCanvas,{Canvas} from '../components/MenuCanvas';
import {ScreenPreview} from '../components/MenuPreview';
import {useNotifications} from '../context/NotificationContext';
import './ScreensPage.css';
type Group={is_active?:boolean;is_visible?:boolean;id:string;title:string;description:string;order:number;parent_id?:string;x?:number;y?:number;version?:number};
type Item={is_active?:boolean;is_visible?:boolean;id:string;product_id:string;container_id:string;row:number;column:number;x?:number;y?:number};
type Data={screens:Group[];containers:Group[];items:Item[];products:Product[]};
export default function ScreensPage(){
    const {selectedCompany,selectedRole}=useSelectedCompany();
    if(!selectedCompany||!['PORTAL_ROLE_OWNER','PORTAL_ROLE_ADMIN','PORTAL_ROLE_MODERATOR'].includes(selectedRole?.role||''))return <div className="workspace-card">Выберите компанию и роль владельца, администратора или модератора.</div>;
    return <Editor key={selectedCompany+':'+selectedRole?.role} companyId={selectedCompany}/>;
}
function Editor({companyId}:{companyId:string}){
    const {addNotification}=useNotifications();
    const setError=useCallback((message:string)=>{if(message)addNotification(message,'error');},[addNotification]);
    const error='';
    const [data,setData]=useState<Data>({screens:[],containers:[],items:[],products:[]}),[photos,setPhotos]=useState<Photo[]>([]);
    const [tab,setTab]=useState<'products'|'screens'>('products'),[loading,setLoading]=useState(true);
    const [product,setProduct]=useState<Product|null|undefined>(undefined),[canvas,setCanvas]=useState<Canvas|null>(null);
    const {busy,begin}=useScopedOperation(companyId);
    const beginPhotos=useLatestRequest(companyId);
    const [loadFailed,setLoadFailed]=useState(false);
    const [productConflict,setProductConflict]=useState(false);
    const readMenu=useCallback(async()=>{
        const {data:menu}=await api.get<Data>('/navigation_editor',{params:{company_id:companyId}});
        if(!menu||!['products','screens','containers','items'].every(key=>Array.isArray(menu[key as keyof Data]))) {
            throw new Error('Invalid menu response');
        }
        return menu;
    },[companyId]);
    const reloadProduct=async()=>{
        if(!product||!window.confirm('Загрузить актуальную карточку? Несохранённые правки в этой форме будут потеряны.'))return;
        const request=begin();if(!request)return;
        try{
            const menu=await readMenu();if(!request.isCurrent())return;
            const latest=menu.products.find(p=>p.id===product.id);
            if(!latest){setError('Товар удалён или больше недоступен.');return;}
            setData(menu);setProduct(latest);setProductConflict(false);
        }catch{if(request.isCurrent())setError('Не удалось загрузить карточку. Ваши правки сохранены в форме.');}
        finally{request.finish();}
    };
    const config={params:{company_id:companyId}};
    const refreshMenu=async()=>{
        const request=begin();if(!request)return;
        try{const menu=await readMenu();if(request.isCurrent()){setData(menu);setLoadFailed(false);}}
        catch{if(request.isCurrent())setError('Не удалось обновить меню.');}
        finally{request.finish();}
    };
    const refreshPhotos=async()=>{
        const isCurrent=beginPhotos();
        try{const images=await getMenuPhotos(companyId,true);if(isCurrent())setPhotos(images);}
        catch{if(isCurrent())setError('Не удалось загрузить изображения.');}
    };
    useEffect(()=>{
        let alive=true;
        readMenu().then(menu=>{if(alive){setData(menu);setLoadFailed(false);}})
            .catch(()=>{if(alive){setLoadFailed(true);setError('Не удалось загрузить меню.');}})
            .finally(()=>{if(alive)setLoading(false);});
        const photosCurrent=beginPhotos();
        getMenuPhotos(companyId).then(images=>{if(alive&&photosCurrent())setPhotos(images);})
            .catch(()=>{if(alive&&photosCurrent())setError('Не удалось загрузить изображения. Меню доступно без фотографий.');});
        return()=>{alive=false;};
    },[companyId,setError,readMenu,beginPhotos]);
    const perform=async(operation:()=>Promise<unknown>,close:()=>void)=>{
        const request=begin();if(!request)return;
        try{
            await operation();if(!request.isCurrent())return;
            close();addNotification('Сохранено','success');
            try{const menu=await readMenu();if(request.isCurrent()){setData(menu);setLoadFailed(false);}}
            catch{if(request.isCurrent())setError('Изменения сохранены, но список не обновился. Обновите меню.');}
        }catch(e:any){
            if(!request.isCurrent())return;
            if(e.response?.status===409&&e.response?.data?.detail?.code==='product_version_conflict'){
                setProductConflict(true);setError('Карточка товара изменена другим сотрудником. Загрузите актуальную версию.');
            }else setError(e.response?.status===409?'Экран изменён в другом окне. Закройте редактор и обновите список перед повторной правкой.':'Не удалось сохранить. Проверьте поля, права и доступность изображений.');
        }finally{request.finish();}
    };
    const openScreen=(s?:Group)=>{setError('');setCanvas({is_active:s?.is_active??true,is_visible:s?.is_visible??true,id:s?.id,title:s?.title||'',description:s?.description||'',version:s?.version||0,containers:s?data.containers.filter(c=>c.parent_id===s.id).sort((a,b)=>a.order-b.order).map((c,index)=>({is_active:c.is_active??true,is_visible:c.is_visible??true,id:c.id,key:c.id,title:c.title,description:c.description||'',x:c.x??12,y:c.y??index*132+12,items:data.items.filter(i=>i.container_id===c.id&&data.products.some(p=>p.id===i.product_id)).sort((a,b)=>a.row-b.row||a.column-b.column).map((i,n)=>({is_active:i.is_active??true,is_visible:i.is_visible??true,id:i.id,key:i.id,product_id:i.product_id,x:i.x??12+(n%2)*152,y:i.y??12+Math.floor(n/2)*152}))})):[]});};
    return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="workspace-page workspace-card menu-editor">
        <h1 className="section-title">Меню</h1><div className="menu-tabs" role="tablist" aria-label="Меню заведения">{(['products','screens'] as const).map(id=><button role="tab" aria-selected={tab===id} key={id} onClick={()=>setTab(id)}>{id==='products'?'Товары':'Экраны'}</button>)}</div>
        <section className="menu-gallery-panel"><header className="menu-gallery-heading"><h2>{tab==='products'?'Карточки товаров':'Экраны меню'}</h2><div>{tab==='products'&&<button className="menu-icon" aria-label="Обновить меню" disabled={busy||loading} onClick={()=>{void refreshMenu();}}>↻</button>}<button className="menu-icon menu-add" aria-label={tab==='products'?'Добавить товар':'Добавить экран'} disabled={busy||loading||loadFailed} onClick={()=>{setError('');setProductConflict(false);tab==='products'?setProduct(null):openScreen();}}>+</button></div></header>
            
            {loading?<p>Загрузка…</p>:loadFailed?<div role="alert"><p>Меню не загружено.</p><button type="button" disabled={busy} onClick={()=>void refreshMenu()}>Повторить загрузку меню</button></div>:tab==='products'?<div className="menu-product-gallery">{data.products.map(p=>{const photo=photos.find(f=>f.image_id===(p.image_product_id||p.image_id));return <article className="menu-product-card" key={p.id}><button className="menu-product-open" disabled={busy} onClick={()=>{setError('');setProductConflict(false);setProduct(p);}}>{photo?<img src={photo.url} alt="" loading="lazy"/>:<div className="menu-image-placeholder">◇</div>}<strong>{p.title}</strong><small>{p.price} ₽</small></button><div className="menu-card-tools"><button disabled={busy} aria-label={`Удалить ${p.title}`} title="Архивировать товар" onClick={()=>perform(()=>api.delete(`/navigation_editor/products/${p.id}`,config),()=>{})}>×</button></div></article>;})}{!data.products.length&&<p>Создайте первый товар кнопкой «+».</p>}</div>:<div className="menu-screen-gallery">{[...data.screens].sort((a,b)=>a.order-b.order).map(s=><button className="menu-screen-thumbnail" disabled={busy} key={s.id} onClick={()=>openScreen(s)}><h3>{s.title}</h3>{(s.is_active===false||s.is_visible===false)&&<small>Не показывается посетителям</small>}<div className="menu-thumbnail-content"><ScreenPreview containers={data.containers.filter(c=>c.parent_id===s.id).sort((a,b)=>a.order-b.order).map(c=>({...c,items:data.items.filter(i=>i.container_id===c.id).sort((a,b)=>a.row-b.row||a.column-b.column)}))} products={data.products} photos={photos}/></div></button>)}{!data.screens.length&&<p>Создайте первый экран кнопкой «+».</p>}</div>}
        </section>
        {product!==undefined&&<ProductDialog key={product?.id+':'+product?.version} conflict={productConflict} onReload={reloadProduct} product={product} photos={photos} busy={busy} error={error} refreshPhotos={refreshPhotos} onClose={()=>{if(busy)return;setProduct(undefined);setError('');}} onSave={p=>perform(()=>api.put('/navigation_editor/products',p,config),()=>setProduct(undefined))}/>}
        {canvas&&<MenuCanvas initial={canvas} products={data.products} photos={photos} busy={busy} error={error} onClose={()=>{if(busy)return;setCanvas(null);setError('');}} onSave={screen=>perform(()=>api.put('/navigation_editor/canvas',screen,config),()=>setCanvas(null))}/>}
    </motion.div>;
}
