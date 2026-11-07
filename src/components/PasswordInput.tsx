import React, {useState} from 'react';

export default function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    const [visible,setVisible]=useState(false);
    return <div className="password-field">
        <input {...props} type={visible?'text':'password'}/>
        <button type="button" className="password-toggle" aria-label={visible?'Скрыть пароль':'Показать пароль'}
            aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>
                {visible && <path d="m3 3 18 18"/>}
            </svg>
        </button>
    </div>;
}
