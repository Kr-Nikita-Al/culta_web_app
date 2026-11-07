import React from 'react';
import {render,waitFor} from '@testing-library/react';
import OAuthCallbackPage from './OAuthCallbackPage';
import api from '../services/api';
import {oauthLogin} from '../services/authService';
let mockToken:string|null='current-session';
const mockCallApi=(call:()=>Promise<unknown>)=>call();
const mockNavigate=jest.fn(),mockLogin=jest.fn(),mockNotify=jest.fn();
jest.mock('../services/api',()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn()}}));
jest.mock('../services/authService',()=>({oauthLogin:jest.fn()}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({token:mockToken,login:mockLogin,updateUserInfo:jest.fn()})}));
jest.mock('../context/NotificationContext',()=>({useNotifications:()=>({addNotification:mockNotify})}));
jest.mock('../hooks/useApi',()=>({useApi:()=>({callApi:mockCallApi})}));
jest.mock('react-router-dom',()=>({useNavigate:()=>mockNavigate,useSearchParams:()=>[new URLSearchParams('code=proof&state=state')]}));
beforeEach(()=>{mockToken='current-session';jest.clearAllMocks();sessionStorage.clear();window.history.replaceState({},'','/auth/google/callback');
    sessionStorage.setItem('culta-account-link',JSON.stringify({provider:'google',state:'state'}));});
test('link callback preserves current session instead of consuming a mockLogin response',async()=>{
    (api.post as jest.Mock).mockResolvedValue({data:{linked:true}});
    render(<OAuthCallbackPage/>);
    await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith('/profile/user_info',{replace:true}));
    expect(mockLogin).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/login/auth/google/callback',{code:'proof',state:'state'},{withCredentials:true,accountLinkFlow:true});
    expect(sessionStorage.getItem('culta-account-link')).toBeNull();
});
test('wrong state never sends a callback request',async()=>{
    sessionStorage.setItem('culta-account-link',JSON.stringify({provider:'google',state:'wrong'}));
    render(<OAuthCallbackPage/>);
    await waitFor(()=>expect(mockNavigate).toHaveBeenCalled());
    expect(api.post).not.toHaveBeenCalled();expect(mockLogin).not.toHaveBeenCalled();
});

test('successful OAuth delegates profile loading to AuthContext and navigates once',async()=>{
    mockToken=null;sessionStorage.clear();
    (oauthLogin as jest.Mock).mockResolvedValue({token:'token',userId:'id'});
    render(<React.StrictMode><OAuthCallbackPage/></React.StrictMode>);
    await waitFor(()=>expect(mockLogin).toHaveBeenCalledWith('token','id'));
    expect(oauthLogin).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/profile/user_info',{replace:true});
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
});

test('leaving callback page ignores late login response',async()=>{
    mockToken=null;sessionStorage.clear();
    let resolve:(value:unknown)=>void=()=>{};
    (oauthLogin as jest.Mock).mockReturnValue(new Promise(r=>{resolve=r;}));
    const {unmount}=render(<OAuthCallbackPage/>);
    const isCurrent=(oauthLogin as jest.Mock).mock.calls[0][3];
    expect(isCurrent()).toBe(true);
    unmount();
    expect(isCurrent()).toBe(false);
    resolve({token:'late',userId:'id'});
    await Promise.resolve();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
});
