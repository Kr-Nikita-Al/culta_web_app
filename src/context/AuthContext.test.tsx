import React from 'react';
import {act, render, waitFor} from '@testing-library/react';
import {AuthProvider, useAuth} from './AuthContext';
import {getUserInfo} from '../services/userService';
import {getUserRoles} from '../services/authService';
import {endSession} from '../services/sessionService';
jest.mock('../services/userService');
jest.mock('../services/authService');
jest.mock('../services/sessionService', () => ({endSession: jest.fn()}));
const info = getUserInfo as jest.Mock, roles = getUserRoles as jest.Mock;
let auth: ReturnType<typeof useAuth>;
function Probe() {auth = useAuth(); return null;}
beforeEach(() => {localStorage.clear(); jest.resetAllMocks();});

test('late profile from earlier login cannot overwrite newer account', async () => {
    let finishOld: (value: any) => void = () => {};
    info.mockImplementation((_token, userId) => userId === 'old'
        ? new Promise(resolve => {finishOld = resolve;}) : Promise.resolve({user_id: 'new'}));
    roles.mockResolvedValue([]);
    render(<AuthProvider><Probe/></AuthProvider>);
    act(() => {auth.login('old-token', 'old');});
    await act(async () => {await auth.login('new-token', 'new');});
    await act(async () => {finishOld({user_id: 'old'});});
    expect(auth.userId).toBe('new');
    expect(auth.userInfo).toEqual({user_id: 'new'});
    expect(JSON.parse(localStorage.getItem('userInfo_v2')!)).toEqual({user_id: 'new'});
});

test('late startup response cannot restore a previous account', async () => {
    localStorage.setItem('authToken_v2', 'old-token'); localStorage.setItem('userId_v2', 'old');
    let finishOld: (value: any) => void = () => {};
    info.mockImplementation((_token, userId) => userId === 'old'
        ? new Promise(resolve => {finishOld = resolve;}) : Promise.resolve({user_id: 'new'}));
    roles.mockResolvedValue([]);
    render(<AuthProvider><Probe/></AuthProvider>);
    await act(async () => {await auth.login('new-token', 'new');});
    await act(async () => {finishOld({user_id: 'old'});});
    expect(auth.userId).toBe('new');
    expect(auth.userInfo).toEqual({user_id: 'new'});
});

test('corrupt cached JSON does not crash the login screen', () => {
    localStorage.setItem('userInfo_v2', '{broken');
    localStorage.setItem('userRoles_v2', '{broken');
    render(<AuthProvider><Probe/></AuthProvider>);
    expect(auth.userInfo).toBeNull(); expect(auth.roles).toBeNull();
});

test('cross-tab logout clears profile and roles as well as token', async () => {
    info.mockResolvedValue({user_id: 'a'}); roles.mockResolvedValue([{role: 'PORTAL_ROLE_ADMIN'}]);
    render(<AuthProvider><Probe/></AuthProvider>);
    await act(async () => {await auth.login('token', 'a');});
    act(() => {localStorage.clear(); window.dispatchEvent(new Event('storage'));});
    await waitFor(() => expect(auth.userId).toBeNull());
    expect(auth.roles).toBeNull(); expect(auth.userInfo).toBeNull();
});

test.each([undefined, 503])('temporary startup failure preserves login and allows retry, status=%s', async status => {
    localStorage.setItem('authToken_v2', 'token'); localStorage.setItem('userId_v2', 'a');
    info.mockRejectedValueOnce({response: status ? {status} : undefined}); roles.mockResolvedValue([]);
    render(<AuthProvider><Probe/></AuthProvider>);
    await waitFor(() => expect(auth.sessionError).not.toBeNull());
    expect(endSession).not.toHaveBeenCalled();
    expect(auth.token).toBe('token');
    info.mockResolvedValueOnce({user_id: 'a'});
    act(() => auth.retrySession());
    await waitFor(() => expect(auth.userInfo).toEqual({user_id: 'a'}));
    expect(auth.sessionError).toBeNull();
});

test('profile failure after login exposes retry without discarding the session',async()=>{
    info.mockRejectedValueOnce(new Error('offline'));roles.mockResolvedValue([]);
    render(<AuthProvider><Probe/></AuthProvider>);
    await act(async()=>{await auth.login('token','a');});
    expect(auth.sessionError).not.toBeNull();
    expect(auth.token).toBe('token');
    info.mockResolvedValueOnce({user_id:'a'});
    act(()=>auth.retrySession());
    await waitFor(()=>expect(auth.userInfo).toEqual({user_id:'a'}));
    expect(auth.sessionError).toBeNull();
});
test('late failed login does not put the new account into error state',async()=>{
    let reject:(reason:any)=>void=()=>{};
    info.mockImplementation((_token,id)=>id==='old'?new Promise((_resolve,fail)=>{reject=fail;}):Promise.resolve({user_id:'new'}));
    roles.mockResolvedValue([]);
    render(<AuthProvider><Probe/></AuthProvider>);
    act(()=>{auth.login('old-token','old');});
    await act(async()=>{await auth.login('new-token','new');});
    await act(async()=>reject(new Error('offline')));
    expect(auth.userInfo).toEqual({user_id:'new'});
    expect(auth.sessionError).toBeNull();
});
