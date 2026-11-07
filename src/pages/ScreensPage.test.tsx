import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import ScreensPage from './ScreensPage';
import {freePosition} from '../components/MenuCanvas';
import api from '../services/api';
import {getMenuPhotos} from '../services/menuPhotoCache';
const mockNotify=jest.fn();
let mockCompany='a';
jest.mock('../context/NotificationContext',()=>({useNotifications:()=>({addNotification:mockNotify})}));
jest.mock('../services/menuPhotoCache',()=>({getMenuPhotos:jest.fn()}));
jest.mock('../services/api',()=>({__esModule:true,default:{get:jest.fn(),put:jest.fn(),delete:jest.fn()}}));
jest.mock('../context/SelectedCompanyContext',()=>({useSelectedCompany:()=>({selectedCompany:mockCompany,selectedRole:{role:'PORTAL_ROLE_ADMIN'}})}));
const data={screens:[],containers:[],items:[],products:[]};
beforeEach(()=>{mockCompany='a';jest.clearAllMocks();(getMenuPhotos as jest.Mock).mockResolvedValue([]);(api.get as jest.Mock).mockImplementation((url:string)=>Promise.resolve({data:url==='/photos/options'?[]:data}));(api.put as jest.Mock).mockResolvedValue({data:{id:'s'}});Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>Math.random().toString()}});});
test('creates a catalog product without a container',async()=>{
    render(<ScreensPage/>);
    await screen.findByText('Создайте первый товар кнопкой «+».');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Добавить товар'));
    fireEvent.change(screen.getByLabelText('Название'),{target:{value:'Сенча'}});
    fireEvent.change(screen.getByLabelText('Цена, ₽'),{target:{value:'300.50'}});
    fireEvent.click(screen.getByRole('button',{name:'Сохранить товар'}));
    await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/navigation_editor/products',expect.objectContaining({title:'Сенча',price:'300.50'}),{params:{company_id:'a'}}));
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
test('creates screen and container and saves complete draft',async()=>{
    render(<ScreensPage/>);await screen.findByText('Создайте первый товар кнопкой «+».');
    fireEvent.click(screen.getByRole('tab',{name:'Экраны'}));fireEvent.click(screen.getByLabelText('Добавить экран'));
    expect(screen.queryByLabelText('Сохранить экран')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Изменить название экрана'));
    fireEvent.change(screen.getByLabelText('Название экрана'),{target:{value:'Сезонное меню'}});
    fireEvent.blur(screen.getByLabelText('Название экрана'));
    fireEvent.click(screen.getByLabelText('Добавить контейнер'));
    fireEvent.keyDown(screen.getByRole('button',{name:'Открыть Новый контейнер'}),{key:'Enter'});
    fireEvent.click(screen.getByLabelText('Изменить название контейнера'));
    fireEvent.change(screen.getByLabelText('Название контейнера'),{target:{value:'Чаи'}});
    fireEvent.click(screen.getByLabelText('Сохранить экран'));
    await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/navigation_editor/canvas',expect.objectContaining({title:'Сезонное меню',containers:[expect.objectContaining({title:'Чаи',x:4,y:12})]}),{params:{company_id:'a'}}));
});
test('preserves publication flags and saves a visibility change',async()=>{
    (api.get as jest.Mock).mockResolvedValue({data:{...data,screens:[{id:'s',title:'Меню',order:0,version:2,is_active:true,is_visible:false}],containers:[{id:'c',parent_id:'s',title:'Чаи',order:0,is_active:false,is_visible:true}],items:[]}});
    render(<ScreensPage/>);await screen.findByText('Создайте первый товар кнопкой «+».');
    fireEvent.click(screen.getByRole('tab',{name:'Экраны'}));
    fireEvent.click(screen.getByRole('button',{name:/Меню Не показывается/}));
    expect(screen.getByLabelText('Показывать посетителям')).not.toBeChecked();
    expect(screen.queryByLabelText('Сохранить экран')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Показывать посетителям'));
    fireEvent.click(screen.getByLabelText('Сохранить экран'));
    await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/navigation_editor/canvas',expect.objectContaining({is_visible:true,containers:[expect.objectContaining({is_active:false,is_visible:true})]}),{params:{company_id:'a'}}));
});
test('places new objects in free space',()=>{
    expect(freePosition([{x:12,y:12}],290,120)).toEqual({x:12,y:144});
    expect(freePosition([{x:12,y:12}],140,140)).toEqual({x:164,y:12});
});
test('adds an existing product and persists keyboard-adjusted position',async()=>{
    const product={id:'p',title:'Чай',price:'120.00',description:'',image_id:'',image_product_id:''};
    (api.get as jest.Mock).mockImplementation((url:string)=>Promise.resolve({data:url==='/photos/options'?[]:{...data,products:[product]}}));
    render(<ScreensPage/>);await screen.findByText('Чай');
    fireEvent.click(screen.getByRole('tab',{name:'Экраны'}));fireEvent.click(screen.getByLabelText('Добавить экран'));
    expect(screen.queryByLabelText('Сохранить экран')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Изменить название экрана'));
    fireEvent.change(screen.getByLabelText('Название экрана'),{target:{value:'Меню'}});
    fireEvent.blur(screen.getByLabelText('Название экрана'));
    fireEvent.click(screen.getByLabelText('Добавить контейнер'));
    fireEvent.keyDown(screen.getByRole('button',{name:'Открыть Новый контейнер'}),{key:'Enter'});
    fireEvent.click(screen.getByLabelText('Добавить товар в контейнер'));
    fireEvent.click(screen.getByRole('button',{name:'Чай 120.00 ₽'}));
    fireEvent.keyDown(screen.getByRole('button',{name:/^Чай$/}),{key:'ArrowRight'});
    fireEvent.click(screen.getByLabelText('Сохранить экран'));
    await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/navigation_editor/canvas',expect.objectContaining({grid:true,containers:[expect.objectContaining({items:[expect.objectContaining({product_id:'p',x:164,y:12})]})]}),{params:{company_id:'a'}}));
});


test('photo failure does not hide a successfully loaded catalog',async()=>{
    (getMenuPhotos as jest.Mock).mockRejectedValue(new Error('storage unavailable'));
    (api.get as jest.Mock).mockResolvedValue({data:{...data,products:[{id:'p',title:'Сенча',price:'100.00'}]}});
    render(<ScreensPage/>);
    await screen.findByText('Сенча');
    expect(mockNotify).toHaveBeenCalledWith('Не удалось загрузить изображения. Меню доступно без фотографий.','error');
    expect(screen.getByLabelText('Добавить товар')).toBeEnabled();
});
test('slow photo delivery does not block loading the catalog',async()=>{
    (getMenuPhotos as jest.Mock).mockReturnValue(new Promise(()=>{}));
    (api.get as jest.Mock).mockResolvedValue({data:{...data,products:[{id:'p',title:'Сенча',price:'100.00'}]}});
    render(<ScreensPage/>);
    await screen.findByText('Сенча');
    expect(screen.getByLabelText('Добавить товар')).toBeEnabled();
});

test.each([null, {}])('invalid initial response offers retry instead of empty menu: %j',async invalid=>{
    (api.get as jest.Mock).mockResolvedValueOnce({data:invalid}).mockResolvedValueOnce({data});
    render(<ScreensPage/>);
    await screen.findByText('Меню не загружено.');
    expect(screen.queryByText('Создайте первый товар кнопкой «+».')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Добавить товар')).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Повторить загрузку меню'}));
    await screen.findByText('Создайте первый товар кнопкой «+».');
    expect(screen.getByLabelText('Добавить товар')).toBeEnabled();
});
test('completed old-company mutation cannot notify or reload after switching companies',async()=>{
    let resolve:(value:unknown)=>void=()=>{};
    (api.get as jest.Mock).mockResolvedValue({data:{...data,products:[{id:'p',title:'Чай',price:'100.00'}]}});
    (api.delete as jest.Mock).mockReturnValue(new Promise(done=>{resolve=done;}));
    const view=render(<ScreensPage/>);
    fireEvent.click(await screen.findByLabelText('Удалить Чай'));
    mockCompany='b';view.rerender(<ScreensPage/>);
    await screen.findByText('Чай');
    mockNotify.mockClear();
    const reads=(api.get as jest.Mock).mock.calls.length;
    await act(async()=>resolve({data:{}}));
    expect(mockNotify).not.toHaveBeenCalled();
    expect(api.get).toHaveBeenCalledTimes(reads);
});
test('repeated refresh is blocked until the first refresh completes',async()=>{
    render(<ScreensPage/>);
    await screen.findByText('Создайте первый товар кнопкой «+».');
    (api.get as jest.Mock).mockReturnValue(new Promise(()=>{}));
    fireEvent.click(screen.getByLabelText('Обновить меню'));
    fireEvent.click(screen.getByLabelText('Обновить меню'));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Обновить меню')).toBeDisabled();
});
test('late initial photos cannot replace a manually refreshed list',async()=>{
    let resolve:(value:unknown)=>void=()=>{};
    (getMenuPhotos as jest.Mock).mockReturnValueOnce(new Promise(done=>{resolve=done;}))
        .mockResolvedValueOnce([{image_id:'new',title:'Новое фото',url:'/new.jpg'}]);
    render(<ScreensPage/>);
    await screen.findByText('Создайте первый товар кнопкой «+».');
    fireEvent.click(screen.getByLabelText('Добавить товар'));
    fireEvent.click(screen.getByLabelText('Заменить фото'));
    await screen.findByText('Новое фото');
    await act(async()=>resolve([{image_id:'old',title:'Старое фото',url:'/old.jpg'}]));
    expect(screen.getByText('Новое фото')).toBeInTheDocument();
    expect(screen.queryByText('Старое фото')).not.toBeInTheDocument();
    expect(getMenuPhotos).toHaveBeenLastCalledWith('a',true);
});

test('canceling discard preserves the screen draft; confirming closes without saving',async()=>{
    render(<ScreensPage/>);await screen.findByText('Создайте первый товар кнопкой «+».');
    fireEvent.click(screen.getByRole('tab',{name:'Экраны'}));
    fireEvent.click(screen.getByLabelText('Добавить экран'));
    fireEvent.click(screen.getByLabelText('Изменить название экрана'));
    fireEvent.change(screen.getByLabelText('Название экрана'),{target:{value:'Черновик'}});
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(screen.getByRole('dialog',{name:'Закрыть без сохранения?'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Продолжить редактирование'}));
    expect(screen.getByLabelText('Изменить название экрана')).toHaveTextContent('Черновик');
    fireEvent.click(screen.getByLabelText('Закрыть'));
    fireEvent.click(screen.getByRole('button',{name:'Закрыть без сохранения'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
});
