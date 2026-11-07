import {storeSession,refreshSession,endSession} from './sessionService';
import axios from 'axios';
jest.mock('axios',()=>({__esModule:true,default:{create:jest.fn(()=>({post:jest.fn()}))}}));
const post=(axios.create as jest.Mock).mock.results[0].value.post;
beforeEach(()=>{
    localStorage.clear();post.mockReset();
    let queue=Promise.resolve();
    Object.defineProperty(navigator,'locks',{configurable:true,value:{request:(_name:string,fn:any)=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;}}});
    storeSession({access_token:'old',refresh_token:'r1',user_id:'u'});
});
test('parallel requests rotate once and use the new access token',async()=>{
    post.mockResolvedValue({data:{access_token:'new',refresh_token:'r2',user_id:'u'}});
    expect(await Promise.all([refreshSession('old','u'),refreshSession('old','u')])).toEqual(['new','new']);
    expect(post).toHaveBeenCalledTimes(1);
});
test('ambiguous failure never retries the consumed refresh token',async()=>{
    post.mockRejectedValue(new Error('timeout'));
    await expect(refreshSession('old','u')).rejects.toThrow();
    await expect(refreshSession('old','u')).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
});
test('old account request cannot refresh a new account',async()=>{
    storeSession({access_token:'other',refresh_token:'r3',user_id:'v'});
    await expect(refreshSession('old','u')).rejects.toThrow('Account changed');
    expect(post).not.toHaveBeenCalled();
});
test('logout revokes refresh and clears local authentication',async()=>{
    post.mockResolvedValue({data:{revoked:true}});
    await endSession();
    expect(post).toHaveBeenCalledWith('/login/logout',{refresh_token:'r1'});
    expect(localStorage.getItem('authToken_v2')).toBeNull();
});

test('logout waiting for a lock cannot clear a newer login',async()=>{
    let enter: (()=>Promise<void>) | undefined;
    Object.defineProperty(navigator,'locks',{configurable:true,value:{request:(_name:string,fn:any)=>new Promise<void>(resolve=>{
        enter=async()=>{await fn();resolve();};
    })}});
    const pending=endSession();
    storeSession({access_token:'other',refresh_token:'r3',user_id:'v'});
    await enter!(); await pending;
    expect(localStorage.getItem('authToken_v2')).toBe('other');
    expect(post).not.toHaveBeenCalled();
});

test('server logout finishing after a new login preserves it',async()=>{
    let finish: (value:any)=>void=()=>{};
    post.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
    const pending=endSession();
    await Promise.resolve();
    storeSession({access_token:'other',refresh_token:'r3',user_id:'v'});
    finish({data:{revoked:true}}); await pending;
    expect(localStorage.getItem('authToken_v2')).toBe('other');
});

test.each([null, {}, {access_token:'new',user_id:'u'}, {access_token:'',refresh_token:'r2',user_id:'u'}, {access_token:'new',refresh_token:'r2',user_id:42}])('invalid session response leaves the existing session intact: %j',data=>{
    const previous=localStorage.getItem('refreshSession_v1');
    expect(()=>storeSession(data)).toThrow('Invalid session response');
    expect(localStorage.getItem('authToken_v2')).toBe('old');
    expect(localStorage.getItem('refreshSession_v1')).toBe(previous);
});
test('refresh cannot switch the signed-in account',async()=>{
    post.mockResolvedValue({data:{access_token:'other',refresh_token:'r2',user_id:'v'}});
    await expect(refreshSession('old','u')).rejects.toThrow('Session account mismatch');
    expect(localStorage.getItem('authToken_v2')).toBe('old');
    expect(localStorage.getItem('userId_v2')).toBe('u');
    await expect(refreshSession('old','u')).rejects.toThrow('Sign in required');
    expect(post).toHaveBeenCalledTimes(1);
});
