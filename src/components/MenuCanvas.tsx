import React,{useRef,useState} from 'react';
import {useNotifications} from '../context/NotificationContext';
import {packGrid,firstFreeCell,swapGrid} from '../utils/menuGrid';
import MenuDialog from './MenuDialog';
import {ItemsPreview,containerLayout,SCREEN_WIDTH} from './MenuPreview';
import {Product,Photo} from './MenuProductDialog';
type Publication={is_active?:boolean;is_visible?:boolean};
export type Placement=Publication&{id?:string;key:string;product_id:string;x:number;y:number};
export type CanvasContainer=Publication&{id?:string;key:string;title:string;description:string;x:number;y:number;items:Placement[]};
export type Canvas=Publication&{id?:string;title:string;description:string;version:number;containers:CanvasContainer[]};
const WIDTH=316,HEIGHT=2000;
export function freePosition(objects:{x:number;y:number}[],width:number,height:number){
    for(let y=12;y<=HEIGHT-height;y+=height+12)for(let x=12;x<=WIDTH-width;x+=width+12){
        if(objects.every(o=>x+width+8<=o.x||o.x+width+8<=x||y+height+8<=o.y||o.y+height+8<=y))return {x,y};
    }return null;
}
function Moveable({position,width,height,onMove,onOpen,children,label,snap=false}:{position:{x:number;y:number};width:number;height:number;onMove:(x:number,y:number)=>void;onOpen:()=>void;children:React.ReactNode;label:string;snap?:boolean}){
    const [ghost,setGhost]=useState<{x:number;y:number}|null>(null);
    const drag=useRef<{x:number;y:number;left:number;top:number;moved:boolean;scale:number}|null>(null);
    return <div role="button" tabIndex={0} aria-label={label} className="menu-moveable" style={{left:ghost?.x??position.x,top:ghost?.y??position.y,width,height}}
        onPointerDown={e=>{if(e.button!==0||(e.target as HTMLElement).closest('button'))return;e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,left:position.x,top:position.y,moved:false,scale:e.currentTarget.getBoundingClientRect().width/width};}}
        onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=(e.clientX-d.x)/d.scale,dy=(e.clientY-d.y)/d.scale;if(Math.abs(dx)+Math.abs(dy)>4)d.moved=true;if(d.moved)(snap?((x:number,y:number)=>setGhost({x,y})):onMove)(Math.max(0,Math.min(WIDTH-width,Math.round(d.left+dx))),Math.max(0,Math.min(HEIGHT-height,Math.round(d.top+dy))));}}
        onPointerUp={e=>{const d=drag.current;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d?.moved&&snap&&ghost)onMove(ghost.x,ghost.y);setGhost(null);if(d&&!d.moved)onOpen();}}
        onPointerCancel={()=>{drag.current=null;setGhost(null);}}
        onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Enter'){e.preventDefault();onOpen();}const delta:{[k:string]:[number,number]}={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};if(delta[e.key]){e.preventDefault();const [rawX,rawY]=delta[e.key];const dx=snap?rawX/8*152:rawX,dy=snap?rawY/8*152:rawY;onMove(Math.max(0,Math.min(WIDTH-width,position.x+dx)),Math.max(0,Math.min(HEIGHT-height,position.y+dy)));}}}>{children}</div>;
}
export default function MenuCanvas({initial,products,photos,busy,error,onClose,onSave}:{initial:Canvas;products:Product[];photos:Photo[];busy:boolean;error:string;onClose:()=>void;onSave:(screen:Canvas)=>void}){
    const {addNotification}=useNotifications();
    const baseline=useRef({...initial,containers:initial.containers.map(c=>({...c,items:packGrid(c.items)}))});
    const [draft,setDraft]=useState<Canvas>(()=>JSON.parse(JSON.stringify(baseline.current))),[selected,setSelected]=useState<string|null>(null),[picker,setPicker]=useState(false);
    const [settings,setSettings]=useState<string|null>(null);
    const [renaming,setRenaming]=useState(false);
    const [confirmClose,setConfirmClose]=useState(false);
    const dirty=JSON.stringify(draft)!==JSON.stringify(baseline.current);
    const active=draft.containers.find(c=>c.key===selected);
    const layout=containerLayout(draft.containers);
    const updateContainer=(key:string,values:Partial<CanvasContainer>)=>setDraft(d=>({...d,containers:d.containers.map(c=>c.key===key?{...c,...values}:c)}));
    const close=()=>{if(busy)return;if(dirty)setConfirmClose(true);else onClose();};
    const addContainer=()=>{const point={x:12,y:Math.max(0,...layout.map(c=>c.y+c.height))+12};if(point.y>1880){addNotification('На экране нет свободного места.','error');return;}if(!point){addNotification('На экране нет свободного места. Переместите или уберите контейнер.','error');return;}
        setDraft(d=>({...d,containers:[...d.containers,{key:crypto.randomUUID(),title:'Новый контейнер',description:'',items:[],...point}]}));};
    const addProduct=(product:Product)=>{if(!active)return;const point=firstFreeCell(active.items);if(!point){addNotification('В контейнере нет свободного места.','error');return;}
        updateContainer(active.key,{items:[...active.items,{key:crypto.randomUUID(),product_id:product.id,...point}]});setPicker(false);};
    return <MenuDialog title={active?'Содержимое контейнера':draft.id?'Редактирование экрана':'Новый экран'} onClose={close} compact headerActions={<>{active&&<button type="button" className="menu-icon" aria-label="К экрану" title="К экрану" onClick={()=>{setSelected(null);setRenaming(false);}}>←</button>}{dirty&&<button type="submit" form="menu-canvas-form" className="menu-icon menu-save-icon" aria-label="Сохранить экран" title="Сохранить" disabled={busy}>✓</button>}</>}>
        <form id="menu-canvas-form" onSubmit={e=>{e.preventDefault();if(!draft.title.trim()||draft.containers.some(c=>!c.title.trim())){addNotification('Укажите название экрана и каждого контейнера.','error');return;}const containers=containerLayout(draft.containers).map(({width,height,previewHeight,...c})=>c);if(containers.some(c=>c.y>1880)){addNotification('Контейнеры выходят за границы экрана. Уменьшите количество контейнеров.','error');return;}onSave({...draft,containers,grid:true} as Canvas);}}>
            <fieldset disabled={busy}>
                
                <div className="menu-product-flags">{(['is_active','is_visible'] as const).map(flag=><label key={flag}><input type="checkbox" checked={(active||draft)[flag]!==false} onChange={e=>active?updateContainer(active.key,{[flag]:e.target.checked}):setDraft(d=>({...d,[flag]:e.target.checked}))}/>{flag==='is_active'?'Активен':'Показывать посетителям'}</label>)}</div>
                <p className="menu-help">Перетаскивайте объекты. Нажмите на контейнер, чтобы открыть его.</p>
                <div className="menu-canvas-workspace"><div className={`menu-phone ${active?'':'menu-phone-screen'}`}><div className="menu-phone-heading">{renaming?<input autoFocus aria-label={active?'Название контейнера':'Название экрана'} maxLength={100} value={active?active.title:draft.title} onChange={e=>active?updateContainer(active.key,{title:e.target.value}):setDraft(d=>({...d,title:e.target.value}))} onBlur={()=>setRenaming(false)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setRenaming(false);}if(e.key==='Escape'){e.stopPropagation();setRenaming(false);}}}/>:<button className="menu-inline-title" type="button" aria-label={active?'Изменить название контейнера':'Изменить название экрана'} onClick={()=>setRenaming(true)}>{active?active.title:draft.title||'Новый экран'}</button>}<button type="button" className="menu-icon menu-add" aria-label={active?'Добавить товар в контейнер':'Добавить контейнер'} onClick={()=>active?setPicker(true):addContainer()}>+</button></div>
                    <div className="menu-phone-scroll"><div className="menu-canvas-surface" style={{width:active?WIDTH:SCREEN_WIDTH,height:Math.max(HEIGHT,...layout.map(c=>c.y+c.height+12))}}>
                        {active?active.items.map(item=>{const product=products.find(p=>p.id===item.product_id);const photo=photos.find(p=>p.image_id===product?.image_icon_id);return <Moveable key={item.key} label={product?.title||'Товар'} position={item} snap width={140} height={140} onOpen={()=>{}} onMove={(x,y)=>updateContainer(active.key,{items:swapGrid(active.items,item.key,x,y)})}><button type="button" className="menu-object-delete" aria-label={`Убрать ${product?.title||'товар'} из контейнера`} onClick={()=>updateContainer(active.key,{items:packGrid(active.items.filter(i=>i.key!==item.key))})}>×</button>{photo?<img draggable={false} src={photo.url} alt=""/>:<div className="menu-image-placeholder">◇</div>}<strong>{product?.title||'Товар недоступен'}</strong><button type="button" className="menu-object-settings" aria-label={`Настроить показ ${product?.title||'товара'}`} onClick={()=>setSettings(item.key)}>⚙</button><small>{product?.price} ₽</small></Moveable>;}):layout.map(container=><Moveable key={container.key} label={`Открыть ${container.title}`} position={container} snap width={container.width} height={container.height} onMove={(_x,y)=>{
                        const order=[...layout];const from=order.findIndex(c=>c.key===container.key);
                        const to=order.reduce((best,c,index)=>Math.abs(c.y-y)<Math.abs(order[best].y-y)?index:best,0);
                        [order[from],order[to]]=[order[to],order[from]];
                        let top=12;setDraft(d=>({...d,containers:order.map(c=>{const next={...c,x:12,y:top};top+=c.height+12;return next;})}));
                    }} onOpen={()=>setSelected(container.key)}><button type="button" className="menu-object-delete" aria-label={`Убрать контейнер ${container.title}`} onClick={()=>setDraft(d=>({...d,containers:d.containers.filter(c=>c.key!==container.key)}))}>×</button><strong>{container.title}{(container.is_active===false||container.is_visible===false)?' · скрыт':''}</strong><ItemsPreview items={container.items} products={products} photos={photos} width={container.width-8} height={container.previewHeight}/></Moveable>)}
                    </div></div></div></div>
            </fieldset>
        </form>
        {confirmClose&&<MenuDialog title="Закрыть без сохранения?" onClose={()=>setConfirmClose(false)}><p>Изменения экрана не сохранены.</p><button type="button" onClick={()=>setConfirmClose(false)}>Продолжить редактирование</button><button type="button" disabled={busy} onClick={()=>{if(!busy)onClose();}}>Закрыть без сохранения</button></MenuDialog>}
        {active&&settings&&<MenuDialog title="Показ товара" onClose={()=>setSettings(null)}><div className="menu-product-flags">{(['is_active','is_visible'] as const).map(flag=><label key={flag}><input type="checkbox" checked={active.items.find(i=>i.key===settings)?.[flag]!==false} onChange={e=>updateContainer(active.key,{items:active.items.map(i=>i.key===settings?{...i,[flag]:e.target.checked}:i)})}/>{flag==='is_active'?'Активен':'Показывать посетителям'}</label>)}</div><p>Настройки относятся только к этому размещению товара. Сохраните экран, чтобы применить изменения.</p></MenuDialog>}
        {picker&&<MenuDialog title="Добавить товар" onClose={()=>setPicker(false)}><div className="menu-photo-grid">{products.map(p=><button type="button" key={p.id} onClick={()=>addProduct(p)}>{photos.find(f=>f.image_id===p.image_icon_id)?.url&&<img alt="" src={photos.find(f=>f.image_id===p.image_icon_id)?.url}/>}<strong>{p.title}</strong><span>{p.price} ₽</span></button>)}{!products.length&&<p>Сначала создайте карточки во вкладке «Товары».</p>}</div></MenuDialog>}
    </MenuDialog>;
}
