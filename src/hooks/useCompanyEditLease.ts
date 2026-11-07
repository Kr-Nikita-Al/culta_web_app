import {useCallback,useEffect,useRef,useState} from 'react';
import api from '../services/api';
export const companyLeaseError=(e:any)=>e.response?.status===423
    ? 'Компания редактируется в другом окне или время блокировки истекло. Повторите попытку позже.'
    : 'Не удалось получить или продлить блокировку. Проверьте соединение.';

export function useCompanyEditLease(companyId:string) {
    const held=useRef<{company:string;token:string}|null>(null);
    const generation=useRef(0);
    const [token,setToken]=useState<string|null>(null);
    const [error,setError]=useState('');
    const [pending,setPending]=useState(false);
    const requesting=useRef(false);
    const drop=async(value:{company:string;token:string})=>{
        try{await api.delete('/company/edit-lease',{params:{company_id:value.company},headers:{'X-Company-Edit-Token':value.token}});}catch{/* Server TTL is the final release guarantee. */}
    };
    const release=useCallback(async()=>{
        generation.current++;const old=held.current;held.current=null;setToken(null);
        if(old)await drop(old);
    },[]);
    useEffect(()=>{
        generation.current++;setToken(null);setError('');
        const requests=generation;
        return()=>{requests.current++;const old=held.current;held.current=null;if(old)void drop(old);};
    },[companyId]);
    const acquire=useCallback(async()=>{
        if(requesting.current||!companyId)return null;
        requesting.current=true;setPending(true);setError('');
        const gen=generation.current;
        try{
            const response=await api.post('/company/edit-lease',null,{params:{company_id:companyId}});
            if(typeof response.data?.token!=='string'||!response.data.token.trim())throw new Error('Missing edit lease token');
            const value={company:companyId,token:response.data.token as string};
            if(gen!==generation.current){await drop(value);return null;}
            held.current=value;setToken(value.token);return value.token;
        }catch(e){if(gen===generation.current)setError(companyLeaseError(e));return null;}
        finally{requesting.current=false;setPending(false);}
    },[companyId]);
    useEffect(()=>{
        if(!token)return;
        let active=true,inFlight=false;
        const beat=async()=>{
            if(inFlight)return;inFlight=true;
            try{await api.put('/company/edit-lease',null,{params:{company_id:companyId},headers:{'X-Company-Edit-Token':token}});}
            catch(e){if(active){setError(companyLeaseError(e));await release();}}
            finally{inFlight=false;}
        };
        const timer=window.setInterval(beat,25000);
        return()=>{active=false;window.clearInterval(timer);};
    },[companyId,token,release]);
    return {token,error,pending,acquire,release};
}
