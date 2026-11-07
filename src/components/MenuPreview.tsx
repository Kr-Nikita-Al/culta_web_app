import React from 'react';
import {Photo,Product} from './MenuProductDialog';

type PreviewItem={id?:string;key?:string;product_id:string;x?:number|null;y?:number|null};
type PreviewContainer={id?:string;key?:string;title:string;x?:number|null;y?:number|null;items:PreviewItem[]};

export const SCREEN_WIDTH=300;
export function itemsBottom(items:PreviewItem[]){
    return Math.max(164,...items.map((item,index)=>(item.y??12+Math.floor(index/2)*152)+152));
}
export function containerLayout<T extends PreviewContainer>(containers:T[]){
    let bottom=0;
    return containers.map((c,index)=>({...c,x:4,y:c.y??index*132+12}))
        .sort((a,b)=>a.y-b.y).map(c=>{
            const width=SCREEN_WIDTH-2*c.x;
            const previewHeight=c.items.length?Math.ceil(itemsBottom(c.items)*(width-8)/304):48;
            const height=previewHeight+42;
            const y=bottom+12;
            bottom=y+height;
            return {...c,y,width,height,previewHeight};
        });
}

// The same saved coordinate space and 140px square cards as the live editor.
// SVG's uniform scaling preserves both the saved positions and card proportions.
export function ItemsPreview({items,products,photos,x=0,y=0,width=266,height=64}:{items:PreviewItem[];products:Product[];photos:Photo[];x?:number;y?:number;width?:number;height?:number}){
    const positioned=items.map((item,index)=>({...item,x:item.x??12+(index%2)*152,y:item.y??12+Math.floor(index/2)*152}));
    const bottom=itemsBottom(items);
    return <svg data-testid="items-preview" className="menu-items-preview" x={x} y={y} width={width} height={height} viewBox={`6 0 304 ${bottom}`} preserveAspectRatio="xMidYMin meet" aria-hidden="true">
        {positioned.map((item,index)=>{const product=products.find(p=>p.id===item.product_id);const photo=photos.find(p=>p.image_id===product?.image_icon_id);return <g data-testid="preview-item" key={item.key||item.id||index} transform={`translate(${item.x} ${item.y})`}>
            <rect data-testid="preview-card" width="140" height="140" rx="14" fill="#e5edf4" stroke="#ccd8e4"/>
            <svg x="12" y="12" width="116" height="74" viewBox="0 0 116 74" overflow="hidden">
                <rect width="116" height="74" rx="8" fill="#f1f3f5"/>
                {photo?<image data-testid="preview-photo" href={photo.url} width="116" height="74" preserveAspectRatio="xMidYMid slice"/>:<path d="M58 24 71 37 58 50 45 37Z" fill="none" stroke="#9ca6b4" strokeWidth="2"/>}
            </svg>
            <svg x="12" y="92" width="116" height="42" overflow="hidden"><text y="14" fontSize="14" fontWeight="600" fill="#32251e">{product?.title||'Товар недоступен'}</text><text y="32" fontSize="11" fill="#64748b">{product?.price} ₽</text></svg>
        </g>;})}
    </svg>;
}

export function ScreenPreview({containers,products,photos}:{containers:PreviewContainer[];products:Product[];photos:Photo[]}){
    const positioned=containerLayout(containers);
    return <svg className="menu-screen-preview" style={{height:Math.max(540,...positioned.map(c=>c.y+c.height+12))*180/SCREEN_WIDTH}} viewBox={`0 0 ${SCREEN_WIDTH} ${Math.max(540,...positioned.map(c=>c.y+c.height+12))}`} preserveAspectRatio="xMidYMin meet" aria-hidden="true">
        {positioned.map((c,index)=><g data-testid="preview-container" key={c.id||c.key||index} transform={`translate(${c.x} ${c.y})`}>
            <rect width={c.width} height={c.height} rx="14" fill="#e5edf4" stroke="#ccd8e4"/>
            <svg x="12" y="10" width={c.width-24} height="22" overflow="hidden"><text y="16" fontSize="14" fontWeight="600" fill="#32251e">{c.title}</text></svg>
            <ItemsPreview items={c.items} products={products} photos={photos} x={4} y={30} width={c.width-8} height={c.previewHeight}/>
        </g>)}
    </svg>;
}
