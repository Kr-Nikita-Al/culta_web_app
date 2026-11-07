import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
export default function MenuDialog({title,onClose,children,wide=false,compact=false,headerActions}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean;compact?:boolean;headerActions?:React.ReactNode}){
    const ref=useRef<HTMLElement>(null);
    useEffect(()=>{const previous=document.activeElement as HTMLElement;const overflow=document.body.style.overflow;
        document.body.style.overflow='hidden';ref.current?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
    return createPortal(<div className="menu-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
        <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`menu-modal ${wide?'menu-modal-wide':''} ${compact?'menu-modal-canvas':''}`} onKeyDown={e=>{
            if(e.key==='Escape'){e.stopPropagation();onClose();}
            if(e.key==='Tab'){const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]');
                if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];
                if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}
                else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus();}}
        }}><header className="menu-dialog-header"><h2>{title}</h2><div className="menu-header-actions">{headerActions}<button type="button" className="menu-icon" aria-label="Закрыть" onClick={onClose}>×</button></div></header>{children}</section>
    </div>,document.body);
}
