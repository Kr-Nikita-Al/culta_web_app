import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import StoragePhoto, {clearStoragePhotoCache} from './StoragePhoto';
import api from '../services/api';
jest.mock('../services/api');
const get=api.get as jest.Mock, put=api.put as jest.Mock;
beforeEach(()=>{jest.resetAllMocks();clearStoragePhotoCache();localStorage.clear();});

test('photo is immediately available on remount and isolated between sessions',async()=>{
    get.mockResolvedValue({data:{image_id:'image',url:'https://example.test/photo.jpg'}});
    const {unmount:unmountFirst}=render(<StoragePhoto companyId="cached" title="Фото" editable/>);
    await screen.findByAltText('Фото');unmountFirst();
    const {unmount:unmountSecond}=render(<StoragePhoto companyId="cached" title="Фото" editable/>);
    expect(screen.getByAltText('Фото')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);unmountSecond();
    localStorage.setItem('authToken_v2','different-session');
    get.mockResolvedValue({data:{image_id:null,url:null}});
    render(<StoragePhoto companyId="cached" title="Фото" editable/>);
    expect(screen.queryByAltText('Фото')).not.toBeInTheDocument();
    await waitFor(()=>expect(get).toHaveBeenCalledTimes(2));
});

test('assigned photo opens viewer, not picker',async()=>{
    get.mockResolvedValue({data:{image_id:'image',url:'https://example.test/photo.jpg'}});
    render(<StoragePhoto companyId="company" title="Фото компании" editable/>);
    fireEvent.click(await screen.findByRole('button',{name:'Открыть фото: Фото компании'}));
    expect(screen.getByRole('dialog',{name:'Просмотр фото'})).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith('/photos/options',expect.anything());
    expect(screen.queryByText('Фото компании')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('dialog',{name:'Просмотр фото'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('other roles cannot toggle default and picker follows folders',async()=>{
    get.mockResolvedValueOnce({data:[{role:'PORTAL_ROLE_COOK',image_id:'image',url:'https://example.test/photo.jpg',default_role:'PORTAL_ROLE_ADMIN'}]});
    render(<StoragePhoto companyId="company" title="Фото" role="PORTAL_ROLE_COOK" editable/>);
    await screen.findByAltText('Фото');
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    get.mockResolvedValueOnce({data:[{image_id:'image',title:'Портрет',file_path:'company_images/company_company/staff/',url:'https://example.test/photo.jpg'}]});
    fireEvent.click(screen.getByRole('button',{name:'Заменить фото'}));
    fireEvent.click(await screen.findByRole('button',{name:'Открыть папку staff'}));
    expect(screen.getByRole('button',{name:'Выбрать Портрет'})).toBeInTheDocument();
});

test('company image is visible without edit controls to readers',async()=>{
    get.mockResolvedValue({data:{image_id:'image',url:'https://example.test/photo.jpg'}});
    render(<StoragePhoto companyId="company" title="Фото компании" editable={false}/>);
    expect(await screen.findByAltText('Фото компании')).toHaveAttribute('src','https://example.test/photo.jpg');
    expect(screen.queryByRole('button',{name:'Выбрать из изображений'})).not.toBeInTheDocument();
});

test('role picker saves only an existing image ID for the specified company and role',async()=>{
    let saved=false;
    get.mockImplementation((url:string)=>Promise.resolve({data:url==='/photos/options' ? [{image_id:'image',url:'https://example.test/photo.jpg',title:'Портрет'}] :
        [{role:'PORTAL_ROLE_COOK',image_id:saved?'image':null,url:saved?'https://example.test/photo.jpg':null}]}));
    put.mockImplementation(()=>{saved=true;return Promise.resolve({data:{image_id:'image'}});});
    render(<StoragePhoto companyId="company" role="PORTAL_ROLE_COOK" title="Фото повара" editable/>);
    await waitFor(()=>expect(get).toHaveBeenCalled());
    expect(screen.queryByRole('heading',{name:'Фото повара'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Выбрать фото: Фото повара'}));
    expect(screen.getByRole('dialog',{name:'Изображения заведения'})).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button',{name:'Выбрать Портрет'}));
    expect(await screen.findByAltText('Фото повара')).toBeInTheDocument();
    expect(put).toHaveBeenCalledWith('/photos/my-role',{image_id:'image'},{params:{company_id:'company',role:'PORTAL_ROLE_COOK'}});
    expect(screen.queryByRole('button',{name:'Выбрать Портрет'})).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('picker closes with Escape and restores focus; removing photo only clears its assignment',async()=>{
    get.mockResolvedValue({data:{image_id:'image',url:'https://example.test/photo.jpg'}});
    put.mockResolvedValue({data:{}});
    render(<StoragePhoto companyId="company" title="Фото компании" editable/>);
    await screen.findByAltText('Фото компании');
    get.mockResolvedValueOnce({data:[]});
    const replace=screen.getByRole('button',{name:'Заменить фото'});
    replace.focus();fireEvent.click(replace);
    await screen.findByText(/Нет доступных изображений/);
    fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(replace).toHaveFocus();
    fireEvent.click(screen.getByRole('button',{name:'Удалить фото'}));
    await waitFor(()=>expect(put).toHaveBeenCalledWith('/photos/company',{image_id:'00000000-0000-0000-0000-000000000000'},{params:{company_id:'company'}}));
    expect(api.delete).not.toHaveBeenCalled();
});
