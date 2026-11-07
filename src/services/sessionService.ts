import axios from 'axios';
import config from '../config';
const KEY='refreshSession_v1';
const LOCK='culta-refresh-session';
const transport=axios.create({baseURL:config.apiBaseUrl,timeout:10000});
export function storeSession(data:any){
    if (!data || !['access_token','refresh_token','user_id'].every(key =>
        typeof data[key] === 'string' && data[key].trim().length > 0)) {
        throw new Error('Invalid session response');
    }
    localStorage.setItem(KEY,JSON.stringify({access:data.access_token,refresh:data.refresh_token,userId:data.user_id}));
    localStorage.setItem('authToken_v2',data.access_token);
    localStorage.setItem('userId_v2',data.user_id);
    window.dispatchEvent(new Event('culta-session'));
}
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
export function clearSession(){
    localStorage.removeItem(KEY);
    ['authToken_v2','userId_v2','userInfo_v2','userRoles_v2','selectedCompany','cachedCompanies'].forEach(k=>localStorage.removeItem(k));
    window.dispatchEvent(new Event('culta-session'));
}
async function locked<T>(fn:()=>Promise<T>):Promise<T>{
    const locks=(navigator as any).locks;
    if(!locks)throw new Error('Safe session refresh requires Web Locks');
    return locks.request(LOCK,fn);
}
export async function refreshSession(failedToken:string,userId:string|null):Promise<string>{
    return locked(async()=>{
        if(userId!==localStorage.getItem('userId_v2'))throw new Error('Account changed');
        const current=localStorage.getItem('authToken_v2');
        if(current&&current!==failedToken)return current;
        const before=read();
        if(!before?.refresh||before.access!==current)throw new Error('Sign in required');
        // Consume before sending. An ambiguous timeout must never replay the same token.
        const pending=JSON.stringify({...before,refresh:null});
        localStorage.setItem(KEY,pending);
        const result=await transport.post('/login/refresh',{refresh_token:before.refresh});
        if(localStorage.getItem(KEY)!==pending)throw new Error('Session changed');
        if(result.data?.user_id!==userId)throw new Error('Session account mismatch');
        storeSession(result.data);
        return result.data.access_token;
    });
}
export async function endSession(){
    const expectedSession=localStorage.getItem(KEY);
    const expectedAccess=localStorage.getItem('authToken_v2');
    const unchanged=()=>localStorage.getItem(KEY)===expectedSession&&localStorage.getItem('authToken_v2')===expectedAccess;
    try{await locked(async()=>{
        if(!unchanged())return;
        const current=read();clearSession();
        if(current?.refresh)try{await transport.post('/login/logout',{refresh_token:current.refresh});}catch{/* Local exit still succeeds. */}
    });}catch{if(unchanged())clearSession();}
}
