import {renderHook,act} from '@testing-library/react';
import api from '../services/api';
import {useCompanyEditLease} from './useCompanyEditLease';
jest.mock('../services/api',()=>({__esModule:true,default:{post:jest.fn(),put:jest.fn(),delete:jest.fn()}}));
beforeEach(()=>{jest.useFakeTimers();jest.clearAllMocks();(api.post as jest.Mock).mockResolvedValue({data:{token:'one'}});(api.put as jest.Mock).mockResolvedValue({data:{}});(api.delete as jest.Mock).mockResolvedValue({data:{}});});
afterEach(()=>jest.useRealTimers());
test('acquires, renews, releases on unmount',async()=>{
    const {result,unmount}=renderHook(()=>useCompanyEditLease('a'));
    await act(async()=>{await result.current.acquire();});
    expect(result.current.token).toBe('one');
    await act(async()=>{jest.advanceTimersByTime(25000);});
    expect(api.put).toHaveBeenCalledWith('/company/edit-lease',null,expect.objectContaining({headers:{'X-Company-Edit-Token':'one'}}));
    unmount();
    expect(api.delete).toHaveBeenCalledTimes(1);
});
test('heartbeat failure disables writes and releases lock',async()=>{
    const {result}=renderHook(()=>useCompanyEditLease('a'));
    await act(async()=>{await result.current.acquire();});
    (api.put as jest.Mock).mockRejectedValue({response:{status:423}});
    await act(async()=>{jest.advanceTimersByTime(25000);});
    expect(result.current.token).toBeNull();
    expect(result.current.error).toContain('другом окне');
});
test('late acquisition after company switch is released, never adopted',async()=>{
    let resolve:(value:any)=>void=()=>{};
    (api.post as jest.Mock).mockReturnValue(new Promise(r=>{resolve=r;}));
    const {result,rerender}=renderHook(({id})=>useCompanyEditLease(id),{initialProps:{id:'a'}});
    act(()=>{void result.current.acquire();});
    rerender({id:'b'});
    await act(async()=>{resolve({data:{token:'late'}});});
    expect(result.current.token).toBeNull();
    expect(api.delete).toHaveBeenCalledWith('/company/edit-lease',{params:{company_id:'a'},headers:{'X-Company-Edit-Token':'late'}});
});

test.each([null,{}, {token:''},{token:123}])('invalid lease response cannot enable editing: %p',async(data)=>{
    (api.post as jest.Mock).mockResolvedValue({data});
    const {result}=renderHook(()=>useCompanyEditLease('a'));
    await act(async()=>{await result.current.acquire();});
    expect(result.current.token).toBeNull();
    expect(result.current.error).not.toBe('');
});
