import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReservationWorkspace } from './ReservationsPage';
import { reservationService, ReservationBoard } from '../services/reservationService';

jest.mock('../services/reservationService');
const service = reservationService as jest.Mocked<typeof reservationService>;
const base: ReservationBoard = { version: 1, tables: [{ table_id: 'table', label: 'У окна', shape: 'circle', seats: 4,
    x: 150, y: 150, width: 90, height: 90 }], bookings: [], occupancy: [], can_edit_plan: false,
    can_manage_bookings: true, server_time: new Date().toISOString() };
beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => '00000000-0000-4000-8000-000000000001' } });
    service.board.mockResolvedValue(base);
    service.create.mockResolvedValue({} as never);
    service.layout.mockResolvedValue({ version: 2 });
});

test('client web access does not expose a booking form', async () => {
    service.board.mockResolvedValue({ ...base, can_manage_bookings: false });
    render(<ReservationWorkspace companyId="company" />);
    await screen.findByText(/Клиенты бронируют через мобильное приложение/);
    expect(screen.queryByRole('tab', { name: 'Редактирование' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Имя гостя')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Забронировать стол' })).not.toBeInTheDocument();
    expect(service.create).not.toHaveBeenCalled();
});

test('staff can book a guest and see the editor', async () => {
    service.board.mockResolvedValue({ ...base, can_edit_plan: true, can_manage_bookings: true });
    render(<ReservationWorkspace companyId="company" />);
    fireEvent.click(await screen.findByRole('button', { name: /У окна, 4 мест/ }));
    fireEvent.change(screen.getByLabelText('Имя гостя'), { target: { value: 'Анна' } });
    fireEvent.change(screen.getByLabelText('Телефон гостя'), { target: { value: '+79990000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Забронировать стол' }));
    await waitFor(() => expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ guest_name: 'Анна', guest_phone: '+79990000000' })));
    expect(screen.getByRole('tab', { name: 'Редактирование' })).toBeInTheDocument();
});

test('editor moves a table by keyboard and saves with original plan version', async () => {
    service.board.mockResolvedValue({ ...base, can_edit_plan: true, can_manage_bookings: true });
    render(<ReservationWorkspace companyId="company" />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Редактирование' }));
    const table = screen.getByRole('button', { name: /У окна, 4 мест/ });
    fireEvent.click(table);
    fireEvent.keyDown(table, { key: 'ArrowRight' });
    expect(screen.queryByLabelText('Позиция X')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить план' }));
    await waitFor(() => expect(service.layout).toHaveBeenCalledWith('company', 1, [expect.objectContaining({ x: 160 })], [], {width:1000,height:600}));
});

test('conflicting layout save keeps local edits visible', async () => {
    service.board.mockResolvedValue({ ...base, can_edit_plan: true, can_manage_bookings: true });
    service.layout.mockRejectedValue({ response: { status: 409, data: { detail: 'Floor plan changed; reload before saving' } } });
    render(<ReservationWorkspace companyId="company" />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Редактирование' }));
    fireEvent.click(screen.getByRole('button', { name: /У окна, 4 мест/ }));
    fireEvent.change(screen.getByLabelText('Название стола'), { target: { value: 'Моя правка' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить план' }));
    await screen.findByText(/План изменён другим сотрудником/);
    expect(screen.getByLabelText('Название стола')).toHaveValue('Моя правка');
});

test('unavailable interval cannot be submitted from UI', async () => {
    service.board.mockResolvedValue({ ...base, occupancy: [{ table_id: 'table', status: 'confirmed',
        starts_at: new Date(Date.now()-3600000).toISOString(), ends_at: new Date(Date.now()+3600000).toISOString() }] });
    render(<ReservationWorkspace companyId="company" />);
    await screen.findByText(/На это время свободных столов нет/);
    expect(screen.queryByRole('button', { name: /У окна, 4 мест/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Забронировать стол' })).toBeDisabled();
});

test('duration determines end time and new booking tab has no arrivals list', async () => {
    render(<ReservationWorkspace companyId="company" />);
    fireEvent.click(await screen.findByRole('button', { name: /У окна, 4 мест/ }));
    expect(screen.queryByLabelText('Окончание')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'План зала' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Резервы' })).not.toBeInTheDocument();
    expect(screen.queryByText('Новая бронь')).not.toBeInTheDocument();
    expect(screen.queryByText('Выберите свободный стол выше.')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Начало визита'), { target: { value: '2026-10-02T18:00' } });
    fireEvent.change(screen.getByLabelText('На, мин'), { target: { value: '90' } });
    await screen.findByLabelText('Имя гостя');
    fireEvent.change(screen.getByLabelText('Имя гостя'), { target: { value: 'Анна' } });
    fireEvent.change(screen.getByLabelText('Телефон гостя'), { target: { value: '000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Забронировать стол' }));
    await waitFor(() => expect(service.create).toHaveBeenCalled());
    const sent = service.create.mock.calls[0][0];
    expect(Date.parse(sent.ends_at)-Date.parse(sent.starts_at)).toBe(90*60000);
});

test('booking cards select their table without exposing a creation form', async () => {
    service.board.mockResolvedValue({ ...base, bookings: [{ reservation_id: 'booking', company_id: 'company', user_id: null,
        table_id: 'table', guest_name: 'Анна', guest_phone: '000', guests: 2, version: 1, status: 'confirmed',
        starts_at: new Date(Date.now()+3600000).toISOString(), ends_at: new Date(Date.now()+7200000).toISOString() }] });
    render(<ReservationWorkspace companyId="company" />);
    await screen.findByRole('group', { name: 'Свободные столы' });
    fireEvent.click(screen.getByRole('tab', { name: 'Резервы' }));
    fireEvent.click(screen.getByRole('button', { name: /Анна/ }));
    expect(screen.getByRole('button', { name: /У окна, 4 мест/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Имя гостя')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Забронировать стол' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Редактирование' })).not.toBeInTheDocument();
});

test('editing tab has no booking controls and preserves unsaved draft across tabs', async () => {
    service.board.mockResolvedValue({ ...base, can_edit_plan: true });
    render(<ReservationWorkspace companyId="company" />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Редактирование' }));
    fireEvent.click(screen.getByRole('button', { name: /У окна, 4 мест/ }));
    expect(screen.queryByLabelText('Начало визита')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Имя гостя')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Название стола'), { target: { value: 'Черновик' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Резервы' }));
    expect(screen.getByRole('button', { name: /У окна, 4 мест/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Редактирование' }));
    expect(screen.getByLabelText('Название стола')).toHaveValue('Черновик');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить план' }));
    await waitFor(() => expect(service.layout).toHaveBeenCalled());
    expect(screen.queryByText('План зала сохранён.')).not.toBeInTheDocument();
});

test('new table is highlighted and rooms are included in versioned save', async () => {
    service.board.mockResolvedValue({ ...base, can_edit_plan: true });
    render(<ReservationWorkspace companyId="company" />);
    fireEvent.click(await screen.findByRole('tab', { name:'Редактирование' }));
    fireEvent.click(screen.getByRole('button', { name:'+ Добавить стол' }));
    expect(screen.getByText('Новый')).toBeInTheDocument();
    expect(screen.queryByLabelText('Позиция Y')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name:'+ Комната' }));
    fireEvent.change(screen.getByLabelText('Название комнаты'), {target:{value:'Терраса'}});
    fireEvent.click(screen.getByRole('button', { name:'Сохранить план' }));
    await waitFor(() => expect(service.layout).toHaveBeenCalledWith('company',1,expect.any(Array),[expect.objectContaining({label:'Терраса'})],{width:1000,height:600}));
    await waitFor(() => expect(screen.queryByText('Новый')).not.toBeInTheDocument());
});

test('changing tables preserves guest details and checks the entire interval', async () => {
    const future = new Date(Date.now()+3600000).toISOString();
    service.board.mockResolvedValue({...base, tables:[...base.tables,{...base.tables[0],table_id:'second',label:'Другой'}],
        occupancy:[{table_id:'second',starts_at:future,ends_at:new Date(Date.now()+7200000).toISOString(),status:'confirmed'}]});
    render(<ReservationWorkspace companyId="company" />);
    fireEvent.click(await screen.findByRole('button', {name:/У окна, 4 мест/}));
    expect(screen.queryByRole('button', {name:/Другой, 4 мест/})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Имя гостя'), {target:{value:'Анна'}});
    fireEvent.change(screen.getByLabelText('На, мин'), {target:{value:'30'}});
    fireEvent.click(await screen.findByRole('button', {name:/Другой, 4 мест/}));
    expect(screen.getByLabelText('Имя гостя')).toHaveValue('Анна');
});

test('plan dimensions save and unsafe shrink leaves objects unchanged',async()=>{
    service.board.mockResolvedValue({...base,can_edit_plan:true,tables:[{...base.tables[0],x:850}]});
    render(<ReservationWorkspace companyId="company" />);
    fireEvent.click(await screen.findByRole('tab',{name:'Редактирование'}));
    fireEvent.change(screen.getByLabelText('Ширина плана'),{target:{value:'400'}});
    fireEvent.click(screen.getByRole('button',{name:'Применить размер'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Расстановка не изменена');
    expect(screen.getByRole('group',{name:'План зала'})).toHaveAttribute('viewBox','0 0 1000 600');
    fireEvent.change(screen.getByLabelText('Ширина плана'),{target:{value:'1600'}});
    fireEvent.click(screen.getByRole('button',{name:'Применить размер'}));
    expect(screen.getByRole('group',{name:'План зала'})).toHaveAttribute('viewBox','0 0 1600 600');
    fireEvent.click(screen.getByRole('button',{name:'Сохранить план'}));
    await waitFor(()=>expect(service.layout).toHaveBeenCalledWith('company',1,[expect.objectContaining({x:850})],[],{width:1600,height:600}));
});
