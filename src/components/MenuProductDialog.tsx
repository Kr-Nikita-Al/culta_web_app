import React,{useState,useRef} from 'react';
import MenuDialog from './MenuDialog';
export type Product={id:string;title:string;description:string;price:string;image_id:string;[key:string]:any};
export type Photo={image_id:string;url:string;title:string;file_path?:string};
export const EMPTY_IMAGE='00000000-0000-0000-0000-000000000000';
const texts:Record<string,string>={title:'Название',sub_title:'Подзаголовок',header:'Заголовок',hint_header:'Заголовок подсказки',hint_description:'Подсказка',product_category:'Категория',custom_product_category:'Своя категория',product_release_type:'Тип выпуска',allergens_list:'Аллергены',quantity_system:'Единица измерения',tags:'Теги'};
const numbers:Record<string,string>={price:'Цена, ₽',cost_price:'Себестоимость, ₽',cashback_perc:'Кешбэк, %',count_number:'Количество',product_quantity:'Объём / вес',calorie_content:'Калорийность',proteins:'Белки',fats:'Жиры',carbohydrates:'Углеводы',cooking_time:'Время приготовления, мин',company_group_id:'Группа компании'};
const flags:Record<string,string>={bonuses_payment:'Оплата бонусами',single_product_type:'Единичный товар',is_sharpness:'Острое',is_hotness:'Горячее'};
export function ProductDialog({product,photos,onSave,onClose,busy,error,refreshPhotos,conflict=false,onReload}:{product:Product|null;photos:Photo[];onSave:(p:any)=>void;onClose:()=>void;busy:boolean;error:string;refreshPhotos:()=>void;conflict?:boolean;onReload?:()=>void}){
    const editing=true;
    const [picker,setPicker]=useState<string|null>(null),[viewer,setViewer]=useState<string|null>(null);
    const [form,setForm]=useState<any>(()=>({...Object.fromEntries(Object.keys(texts).map(k=>[k,''])),...Object.fromEntries(Object.keys(numbers).map(k=>[k,k==='company_group_id'?-1:0])),...Object.fromEntries(Object.keys(flags).map(k=>[k,false])),description:'',image_product_id:EMPTY_IMAGE,image_icon_id:EMPTY_IMAGE,...product}));
    const baseline=useRef(JSON.stringify(form));
    const [sameIcon,setSameIcon]=useState(!!product?.image_product_id&&product.image_product_id!==EMPTY_IMAGE&&product.image_product_id===product.image_icon_id);
    const change=(key:string,value:any)=>{if(key==='image_icon_id')setSameIcon(false);setForm((f:any)=>({...f,[key]:value,...(key==='image_product_id'&&sameIcon?{image_icon_id:value}:{})}));};
    const close=()=>{if(!busy&&(!editing||JSON.stringify(form)===baseline.current||window.confirm('Закрыть карточку без сохранения изменений?')))onClose();};
    return <MenuDialog title={product?'Карточка товара':'Новый товар'} onClose={close} wide>
        <form onSubmit={e=>{e.preventDefault();const fields=['id','version','description','image_product_id','image_icon_id',...Object.keys(texts),...Object.keys(numbers),...Object.keys(flags)];onSave(Object.fromEntries(fields.filter(k=>form[k]!==undefined).map(k=>[k,form[k]])));}}>
            {conflict&&<div className="menu-conflict" role="alert">Карточка изменена другим сотрудником. Ваши правки не сохранены и остаются в форме.<button type="button" className="menu-secondary" disabled={busy} onClick={onReload}>Загрузить актуальную карточку</button></div>}
            <div className="menu-dialog-actions"><button className="menu-icon menu-save-icon" aria-label="Сохранить товар" title="Сохранить" disabled={busy||conflict} type="submit">✓</button></div>
            
            <fieldset disabled={busy}>
                {product&&<p role="status">{product.is_used?'Используется в меню':'Не размещён в меню'}</p>}
                <div className="menu-product-photos">{(['image_product_id','image_icon_id']).map((key,index)=>{const photo=photos.find(p=>p.image_id===form[key]);return <div key={key}><small>{index?'Иконка':'Фото товара'}</small><div className="menu-photo-preview"><button type="button" disabled={!editing&&!photo} onClick={()=>{if(photo)setViewer(photo.url);else{setPicker(key);refreshPhotos();}}}>{photo?<img src={photo.url} alt={index?'Иконка':'Фото товара'}/>:<span>Нет фото</span>}</button>{editing&&<div className="menu-card-tools"><button type="button" aria-label={index?'Заменить иконку':'Заменить фото'} onClick={()=>{setPicker(key);refreshPhotos();}}>↻</button><button type="button" aria-label={index?'Снять иконку':'Снять фото'} onClick={()=>change(key,EMPTY_IMAGE)}>×</button></div>}</div></div>;})}<label className="menu-copy-photo"><input type="checkbox" disabled={!editing||busy} checked={sameIcon} onChange={e=>{setSameIcon(e.target.checked);if(e.target.checked)setForm((f:any)=>({...f,image_icon_id:f.image_product_id}));}}/>Изображение фото товара совпадает с иконкой</label></div>
                <div className="menu-product-fields">{Object.entries(texts).map(([key,label])=><label key={key}>{label}<input required={key==='title'} maxLength={35} readOnly={!editing} value={form[key]??''} onChange={e=>change(key,e.target.value)}/></label>)}</div>
                <label>Описание<textarea rows={4} maxLength={5000} readOnly={!editing} value={form.description||''} onChange={e=>change('description',e.target.value)}/></label>
                <div className="menu-product-fields">{Object.entries(numbers).map(([key,label])=><label key={key}>{label}<input required type="number" min={key==='company_group_id'?-1:0} max={key==='cashback_perc'?100:undefined} step={['price','cost_price','cashback_perc'].includes(key)?'0.01':'1'} readOnly={!editing} value={form[key]??0} onChange={e=>change(key,e.target.value)}/></label>)}</div>
                <div className="menu-product-flags">{Object.entries(flags).map(([key,label])=><label key={key}><input type="checkbox" disabled={!editing} checked={!!form[key]} onChange={e=>change(key,e.target.checked)}/>{label}</label>)}</div>
            </fieldset>
            {product&&<details className="menu-technical"><summary>Служебные поля</summary><dl>{['product_card_id','company_id','image_product_id','image_icon_id','creator_id','updater_id','time_created','time_updated','is_active'].map(k=><React.Fragment key={k}><dt>{k}</dt><dd>{String(product[k]??'—')}</dd></React.Fragment>)}</dl></details>}
        </form>
        {picker&&<MenuDialog title="Изображения заведения" onClose={()=>setPicker(null)}><div className="menu-photo-grid">{photos.map(p=><button type="button" key={p.image_id} onClick={()=>{change(picker,p.image_id);setPicker(null);}}><img src={p.url} alt="" loading="lazy"/><span>{p.title}</span></button>)}{!photos.length&&<p>Добавьте фото в разделе «Изображения».</p>}</div></MenuDialog>}
        {viewer&&<MenuDialog title="Просмотр фото" onClose={()=>setViewer(null)}><img className="menu-full-photo" src={viewer} alt="Фото товара"/></MenuDialog>}
    </MenuDialog>;
}
