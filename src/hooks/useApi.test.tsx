import {renderHook,act} from '@testing-library/react';
import {useApi} from './useApi';
function deferred<T>(){
    let resolve!:(value:T)=>void, reject!:(reason:unknown)=>void;
    const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
    return {promise,resolve,reject};
}
test('loading stays active until all concurrent reads finish',async()=>{
    const {result}=renderHook(()=>useApi());
    const first=deferred<string>(),second=deferred<string>();
    let a!:Promise<string|null>,b!:Promise<string|null>;
    act(()=>{a=result.current.callApi(()=>first.promise);b=result.current.callApi(()=>second.promise);});
    await act(async()=>{first.resolve('a');await a;});
    expect(result.current.loading).toBe(true);
    await act(async()=>{second.resolve('b');await b;});
    expect(result.current.loading).toBe(false);
});
test('cancel aborts every signal and ignores late results',async()=>{
    const {result}=renderHook(()=>useApi());
    const pending=deferred<string>();
    let signal!:AbortSignal,request!:Promise<string|null>;
    act(()=>{request=result.current.callApi(value=>{signal=value;return pending.promise;});});
    act(()=>result.current.cancelRequest());
    expect(signal.aborted).toBe(true);
    expect(result.current.loading).toBe(false);
    let value:unknown;
    await act(async()=>{pending.resolve('stale');value=await request;});
    expect(value).toBeNull();
});
test('unmount aborts pending reads',()=>{
    const {result,unmount}=renderHook(()=>useApi());
    let signal!:AbortSignal;
    act(()=>{void result.current.callApi(value=>{signal=value;return new Promise(()=>{});});});
    unmount();
    expect(signal.aborted).toBe(true);
});
test('an older failure does not overwrite the newer request status',async()=>{
    const {result}=renderHook(()=>useApi());
    const older=deferred<string>();
    let request!:Promise<string|null>;
    act(()=>{request=result.current.callApi(()=>older.promise);});
    await act(async()=>{await result.current.callApi(async()=> 'new');});
    await act(async()=>{older.reject(new Error('old failure'));await request;});
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
});
