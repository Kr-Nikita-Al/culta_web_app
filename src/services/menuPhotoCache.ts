import api from './api';
import type {Photo} from '../components/MenuProductDialog';

// Reuse signed URLs while they are fresh so the browser can reuse decoded images.
const entries=new Map<string,{expires:number;request:Promise<Photo[]>}>();
export function getMenuPhotos(companyId:string, force=false):Promise<Photo[]> {
    const key=companyId+':'+localStorage.getItem('authToken_v2');
    const cached=entries.get(key);
    if(!force&&cached&&cached.expires>Date.now())return cached.request;
    const request=api.get<Photo[]>('/photos/options',{params:{company_id:companyId}})
        .then(r=>{
            if(!Array.isArray(r.data))throw new Error('Invalid photo list');
            return r.data;
        }).catch(error=>{
            if(entries.get(key)?.request===request)entries.delete(key);
            throw error;
        });
    entries.set(key,{expires:Date.now()+120000,request});
    // Bound memory across company/account switches.
    if(entries.size>20)entries.delete(entries.keys().next().value!);
    return request;
}
