import api from './api';
import {loginUser} from './authService';
import {storeSession} from './sessionService';
jest.mock('./api',()=>({__esModule:true,default:{post:jest.fn()}}));
jest.mock('./sessionService',()=>({storeSession:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
test('stale login never persists session credentials',async()=>{
    (api.post as jest.Mock).mockResolvedValue({data:{access_token:'token',user_id:'id'}});
    expect(await loginUser({username:'user',password:'password'},()=>false)).toBeNull();
    expect(storeSession).not.toHaveBeenCalled();
});
test('current login persists the accepted session',async()=>{
    const data={access_token:'token',refresh_token:'refresh',user_id:'id'};
    (api.post as jest.Mock).mockResolvedValue({data});
    expect(await loginUser({username:'user',password:'password'},()=>true)).toEqual({token:'token',userId:'id'});
    expect(storeSession).toHaveBeenCalledWith(data);
});

test('stale OAuth callback never persists credentials',async()=>{
    const {oauthLogin}=await import('./authService');
    (api.post as jest.Mock).mockResolvedValue({data:{access_token:'token',refresh_token:'refresh',user_id:'id'}});
    expect(await oauthLogin('google','code','state',()=>false)).toBeNull();
    expect(storeSession).not.toHaveBeenCalled();
});
