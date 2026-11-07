import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import Button from '../components/Button';
import FloorPlan from '../components/FloorPlan';
import TableOrderQR from '../components/TableOrderQR';
import PageTransition from '../components/PageTransition';
import { BookingInput, DEFAULT_PLAN_SIZE, DiningTable, FloorRoom, PlanSize, Reservation, ReservationBoard, reservationService } from '../services/reservationService';
import { clampRoom, clampTable, localInput, placeTable, reservationError, tableState } from '../utils/reservations';
import './ReservationsPage.css';

const statusNames: Record<string, string> = { confirmed: 'Ожидаем', seated: 'Гости пришли', completed: 'Завершена', canceled: 'Отменена' };
const displayTime = (value: string) => new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function ReservationsPage() {
    const { selectedCompany, selectedRole } = useSelectedCompany();
    return <PageTransition className="reservations-page workspace-page workspace-card">
        <header className="reservations-heading"><div><h1 className="section-title">Бронирования</h1>
            </div></header>
        {selectedRole?.role === 'PORTAL_ROLE_USER' ? <p className="reservation-empty">Клиентское бронирование доступно в мобильном приложении.</p> :
            selectedCompany ? <ReservationWorkspace key={selectedCompany} companyId={selectedCompany} /> :
                <p className="reservation-empty">Выберите заведение и роль сотрудника в шапке.</p>}
    </PageTransition>;
}

export function ReservationWorkspace({ companyId }: { companyId: string }) {
    const [start, setStart] = useState(() => localInput(new Date()));
    const [duration, setDuration] = useState('120');
    const end = Number.isFinite(Date.parse(start)) && Number.isFinite(Number(duration)) ? localInput(new Date(Date.parse(start)+Number(duration)*60000)) : '';
    const [tab, setTab] = useState<'new' | 'bookings' | 'edit'>('new');
    const [selectedBookingId, setSelectedBookingId] = useState('');
    const [board, setBoard] = useState<ReservationBoard | null>(null);
    const [loadedRange, setLoadedRange] = useState('');
    const [selected, setSelected] = useState('');
    const [draft, setDraft] = useState<DiningTable[] | null>(null);
    const [draftRooms, setDraftRooms] = useState<FloorRoom[]>([]);
    const [draftSize, setDraftSize] = useState<PlanSize>(DEFAULT_PLAN_SIZE);
    const [selectedRoom, setSelectedRoom] = useState('');
    const [newTableIds, setNewTableIds] = useState<string[]>([]);
    const [draftVersion, setDraftVersion] = useState(0);
    const [editBooking, setEditBooking] = useState<Reservation | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [clock, setClock] = useState(Date.now());
    const [live, setLive] = useState(true);
    const [formRevision, setFormRevision] = useState(0);
    const mounted = useRef(true);
    const generation = useRef(0);
    const bookingRail = useRef<HTMLDivElement>(null);
    const validInterval = Number.isFinite(Date.parse(start)) && Number.isInteger(Number(duration)) && Number(duration)>=15 && Number(duration)<=720;
    const firstDay = Number.isFinite(Date.parse(start)) ? start.slice(0, 10) : '';
    const lastDay = validInterval ? end.slice(0, 10) : firstDay;
    const load = useCallback(async () => {
        if (!firstDay || !lastDay) return;
        const id = ++generation.current;
        const from = new Date(firstDay+'T00:00'), to = new Date(lastDay+'T00:00'); to.setDate(to.getDate()+1);
        try {
            const result = await reservationService.board(companyId, from.toISOString(), to.toISOString());
            if (mounted.current && id === generation.current) { setBoard(result); setLoadedRange(firstDay+':'+lastDay); setError(''); }
        } catch (cause) {
            if (mounted.current && id === generation.current) setError(reservationError(cause));
        }
    }, [companyId, firstDay, lastDay]);
    useEffect(() => { mounted.current = true; const requests = generation; return () => { mounted.current = false; requests.current++; }; }, []);
    useEffect(() => {
        if (board && !board.can_edit_plan && tab === 'edit') { setTab('new'); setDraft(null); }
    }, [board, tab]);
    useEffect(() => {
        if (!live || tab !== 'bookings' || editBooking) return;
        const timer = window.setInterval(() => {
            const now = new Date(); setClock(now.getTime()); setStart(localInput(now));
        }, 30000);
        return () => window.clearInterval(timer);
    }, [live, tab, editBooking]);
    useEffect(() => {
        load();
        const timer = window.setInterval(() => { setClock(Date.now()); load(); }, 30000);
        const requests = generation;
        return () => { window.clearInterval(timer); requests.current++; };
    }, [load]);

    const mutate = async (operation: () => Promise<unknown>, success: string, after?: () => void) => {
        setBusy(true); setError(''); setMessage('');
        try {
            await operation();
            if (!mounted.current) return;
            setMessage(success); after?.(); await load();
        } catch (cause) { if (mounted.current) setError(reservationError(cause)); }
        finally { if (mounted.current) setBusy(false); }
    };
    const tables = (tab === 'edit' ? draft : null) || board?.tables || [];
    const rangeReady = loadedRange === firstDay+':'+lastDay;
    const available = validInterval && rangeReady ? tables.filter(t => !board?.bookings.some(b => b.reservation_id !== editBooking?.reservation_id &&
        b.table_id === t.table_id && ['confirmed', 'seated'].includes(b.status) && Date.parse(b.starts_at)<Date.parse(end) && Date.parse(b.ends_at)>Date.parse(start)) &&
        (tableState(t.table_id, board?.occupancy || [], start, end) === 'free' || !!editBooking)) : [];
    const table = tab === 'new' ? available.find(t => t.table_id === selected) : tables.find(t => t.table_id === selected);
    const room = draftRooms.find(r => r.room_id === selectedRoom);
    const selectTable = (id: string) => { setSelected(id); setSelectedRoom(''); };
    const updateRoom = (value: FloorRoom) => setDraftRooms(previous => previous.map(r => r.room_id === value.room_id ? clampRoom(value, draftSize) : r));
    const updateTable = (value: DiningTable) => setDraft(previous => previous?.map(t => t.table_id === value.table_id ? clampTable(value, draftSize) : t) || null);
    const resizePlan = (size: PlanSize) => {
        if ((draft || []).some(t => t.x+t.width/2+20>size.width || t.y+t.height/2+20>size.height) ||
            draftRooms.some(r => r.x+r.width>size.width || r.y+r.height>size.height)) {
            setError('Сначала переместите столы и комнаты внутрь нового размера плана. Расстановка не изменена.'); return;
        }
        setDraftSize(size); setError('');
    };
    const upcoming = (board?.bookings || []).filter(b => showHistory || (['confirmed', 'seated'].includes(b.status) && new Date(b.ends_at).getTime() > clock));
    const changeStart = (value: string) => {
        setLive(false);
        setStart(value);
    };
    const startEditingBooking = (b: Reservation) => {
        setLive(false);
        setSelected(b.table_id); setStart(localInput(new Date(b.starts_at)));
        setDuration(String((Date.parse(b.ends_at)-Date.parse(b.starts_at))/60000));
        setEditBooking(b); setTab('new'); setMessage('');
    };
    const activeBooking = board?.bookings.find(b => b.reservation_id === selectedBookingId);
    const switchTab = (next: typeof tab) => {
        setTab(next); setMessage(''); setError('');
        if (next === 'edit' && board?.can_edit_plan && !draft) {
            setDraft(board.tables.map(t => ({ ...t }))); setDraftVersion(board.version);
            setDraftRooms((board.rooms || []).map(r => ({ ...r })));
            setDraftSize({width:board.width || 1000,height:board.height || 600});
        }
    };
    if (board && !board.can_manage_bookings) return <p className="reservation-empty">Раздел доступен сотрудникам, управляющим бронями. Клиенты бронируют через мобильное приложение.</p>;
    return <>
        <div className="reservation-tabs" role="tablist" aria-label="Разделы бронирования">
            {([['new', 'Новое бронирование'], ['bookings', 'Резервы'], ...(board?.can_edit_plan ? [['edit', 'Редактирование']] : [])] as Array<[typeof tab, string]>).map(([id, label]) =>
                <button key={id} id={`reservation-tab-${id}`} type="button" role="tab" aria-selected={tab === id}
                    aria-controls="reservation-panel" tabIndex={tab === id ? 0 : -1} disabled={busy} onClick={() => switchTab(id)}
                    onKeyDown={event => {
                        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const tabs = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
                        const index = tabs.indexOf(event.currentTarget);
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (index+(event.key === 'ArrowRight' ? 1 : -1)+tabs.length)%tabs.length;
                        tabs[next].focus(); tabs[next].click();
                    }}>{label}</button>)}
        </div>
        <div role="tabpanel" id="reservation-panel" aria-labelledby={`reservation-tab-${tab}`} className={tab === 'new' ? 'reservation-new-card' : ''}>
        {tab === 'new' && editBooking && <h2>Изменить бронь</h2>}
        {tab !== 'edit' && <div className="reservation-timebar">
            <label>{tab === 'new' ? 'Начало визита' : 'Показать на'}<input type="datetime-local" value={start} disabled={busy} onChange={e => { changeStart(e.target.value); setSelectedBookingId(''); }} /></label>
            {tab === 'new' && <label className="reservation-duration">На, мин<input type="number" min="15" max="720" step="1" value={duration} disabled={busy} onChange={e => setDuration(e.target.value)} /></label>}
            <Button disabled={busy} onClick={() => { changeStart(localInput(new Date())); setLive(true); setSelectedBookingId(''); }}>Сейчас</Button>
        </div>}
        {error && <p role="alert" className="reservation-error">{error}</p>}
        {message && <p role="status" className="reservation-success">{message}</p>}
        {!validInterval && tab !== 'edit' && <p role="alert" className="reservation-error">Укажите начало и продолжительность от 15 до 720 минут.</p>}
        {board && <>
            {tab === 'new' && <>
                <div className="reservation-available" role="group" aria-label="Свободные столы">
                    <h3>Свободные столы <small>на весь визит</small></h3>
                    <div className="reservation-table-options">{available.map(t => <button type="button" key={t.table_id} disabled={busy}
                        aria-pressed={table?.table_id === t.table_id} aria-label={`${t.label}, ${t.seats} мест, свободен`}
                        onClick={() => selectTable(t.table_id)}><strong>{t.label}</strong><span>{t.seats} мест</span></button>)}</div>
                    {!available.length && <p className="reservation-muted">{!validInterval ? 'Укажите время и продолжительность визита.' : !rangeReady ? 'Проверяем свободные столы…' : 'На это время свободных столов нет. Выберите другое время.'}</p>}
                </div>
                <BookingForm key={`${editBooking?.reservation_id || 'new'}:${formRevision}`}
                    table={table} booking={editBooking} staff={board.can_manage_bookings} busy={busy || !validInterval}
                    start={start} end={end} occupied={false} onCancelEdit={() => setEditBooking(null)} onSubmit={(values, requestId) => {
                        if (!table) return;
                        const input: BookingInput = { ...values, company_id: companyId, table_id: table.table_id,
                            starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), request_id: requestId };
                        mutate(() => editBooking ? reservationService.edit(editBooking.reservation_id, input, editBooking.version) : reservationService.create(input),
                            editBooking ? 'Бронь изменена.' : 'Бронь подтверждена.', () => { setEditBooking(null); setFormRevision(r => r+1); });
                    }} />
            </>}
            {tab === 'bookings' && <section className="reservation-arrivals" aria-label="Резервы">
                <div className="reservation-section-heading"><h2>Резервы <span>{upcoming.length}</span></h2>
                    <div className="reservation-rail-controls"><label className="reservation-inline"><input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} /> История</label>
                        <Button aria-label="Предыдущие брони" onClick={() => bookingRail.current?.scrollBy({ left: -360, behavior: 'smooth' })}>‹</Button>
                        <Button aria-label="Следующие брони" onClick={() => bookingRail.current?.scrollBy({ left: 360, behavior: 'smooth' })}>›</Button>
                    </div></div>
                <div className="reservation-arrival-list" ref={bookingRail}>
                    {!upcoming.length && <p className="reservation-empty">На выбранные даты броней пока нет.</p>}
                    {upcoming.map(b => <button type="button" key={b.reservation_id} aria-pressed={selectedBookingId === b.reservation_id}
                        className={`reservation-arrival reservation-arrival--${b.status}`} onClick={() => { setSelectedBookingId(b.reservation_id); setSelected(b.table_id); }}>
                        <span className="reservation-card-time">{new Date(b.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        <strong>{b.guest_name}</strong>
                        <p>{board.tables.find(t => t.table_id === b.table_id)?.label || 'Архивный стол'} · {b.guests} гостей</p>
                        <span className="reservation-badge">{statusNames[b.status]}</span>
                    </button>)}
                </div>
                {activeBooking && (() => { const b = activeBooking; return <div className="reservation-booking-details">
                        <span>{b.guest_name} · {b.guest_phone} · {displayTime(b.starts_at)} — {displayTime(b.ends_at)}</span>
                        <div className="reservation-actions">
                            {b.status === 'confirmed' && (board.can_manage_bookings || new Date(b.starts_at).getTime()>clock) && <>
                                <Button disabled={busy} onClick={() => startEditingBooking(b)}>Изменить</Button>
                                <Button variant="ghost" disabled={busy} onClick={() => {
                                    if (window.confirm('Отменить эту бронь?')) mutate(() => reservationService.status(b, 'canceled'), 'Бронь отменена.');
                                }}>Отменить</Button>
                            </>}
                            {board.can_manage_bookings && b.status === 'confirmed' && new Date(b.starts_at).getTime()<=clock && new Date(b.ends_at).getTime()>clock &&
                                <Button disabled={busy} onClick={() => mutate(() => reservationService.status(b, 'seated'), 'Приход гостей отмечен.')}>Гости пришли</Button>}
                            {board.can_manage_bookings && b.status === 'seated' && <Button disabled={busy}
                                onClick={() => mutate(() => reservationService.status(b, 'completed'), 'Визит завершён.')}>Завершить визит</Button>}
                        </div>
                    </div>; })()}
            </section>}
            {tab !== 'new' && <><div className="reservation-section-heading reservation-plan-heading"><div><h2>План зала</h2>
                </div>
            </div>
            {tab !== 'edit' && <div className="reservation-legend"><span className="legend-free">Свободен</span><span className="legend-reserved">Забронирован</span><span className="legend-seated">Гости за столом</span></div>}
            <div className={`reservation-workspace ${tab === 'bookings' ? 'reservation-workspace--board' : ''}`}>
                <div className="reservation-canvas"><FloorPlan tables={tables} occupancy={tab === 'edit' ? [] : board.occupancy}
                    size={tab === 'edit' ? draftSize : {width:board.width || 1000,height:board.height || 600}}
                    start={tab === 'bookings' && activeBooking ? activeBooking.starts_at : start} end={end}
                    rooms={tab === 'edit' ? draftRooms : board.rooms} selectedRoom={tab === 'edit' ? selectedRoom : ''} newTableIds={tab === 'edit' ? newTableIds : []}
                    onSelectRoom={id => { setSelectedRoom(id); setSelected(''); }} onMoveRoom={updateRoom}
                    onDeleteTable={id => {
                        if (tab !== 'edit' || !board.can_edit_plan || !draft || busy) return;
                        setDraft(previous => previous ? previous.filter(t => t.table_id !== id) : previous);
                        setNewTableIds(previous => previous.filter(value => value !== id)); setSelected('');
                    }}
                    onDeleteRoom={id => {
                        if (tab !== 'edit' || !board.can_edit_plan || !draft || busy) return;
                        setDraftRooms(previous => previous.filter(r => r.room_id !== id)); setSelectedRoom('');
                    }}
                    selected={selected} editable={tab === 'edit' && board.can_edit_plan && !!draft && !busy} onSelect={selectTable} onMove={updateTable} />
                    {tab === 'edit' && <p className="reservation-muted">Столы и границы комнат можно двигать мышью или стрелками. Размер комнаты — за угол. Пустое поле — перемещение вида.</p>}</div>
                {tab !== 'bookings' && <aside className="reservation-inspector">
                    {tab === 'edit' && board.can_edit_plan && draft ? <>
                        <h3>Редактор зала</h3>
                        <PlanSizeEditor size={draftSize} disabled={busy} onResize={resizePlan} />
                        <Button disabled={busy || draft.length>=80} onClick={() => {
                            const item = placeTable({ table_id: crypto.randomUUID(), label: `Стол ${draft.length+1}`, shape: 'square',
                                seats: 4, x: 0, y: 0, width: 90, height: 90 }, draft, draftSize);
                            if (!item) { setError('Нет свободного места для нового стола. Передвиньте или уменьшите существующие столы.'); return; }
                            // Names must remain unique after deletion.
                            while (draft.some(t => t.label === item.label)) item.label += '+';
                            setDraft(previous => [...(previous || []), item]); selectTable(item.table_id);
                            setNewTableIds(previous => [...previous, item.table_id]); setError('');
                        }}>+ Добавить стол</Button>
                        <Button disabled={busy || draftRooms.length>=30} onClick={() => {
                            const item: FloorRoom = { room_id: crypto.randomUUID(), label: `Комната ${draftRooms.length+1}`, x: 20, y: 20, width: Math.min(350,draftSize.width-40), height: Math.min(260,draftSize.height-40) };
                            while (draftRooms.some(r => r.label === item.label)) item.label += '+';
                            setDraftRooms(previous => [...previous, item]); setSelectedRoom(item.room_id); setSelected('');
                        }}>+ Комната</Button>
                        {room && <fieldset disabled={busy} className="reservation-fields">
                            <label>Название комнаты<input maxLength={40} value={room.label} onChange={e => updateRoom({ ...room, label: e.target.value })} /></label>
                            <div className="reservation-pair">
                                <label>Ширина комнаты<input type="number" min="100" max={draftSize.width} value={room.width} onChange={e => updateRoom({ ...room, width: Number(e.target.value) })} /></label>
                                <label>Высота комнаты<input type="number" min="80" max={draftSize.height} value={room.height} onChange={e => updateRoom({ ...room, height: Number(e.target.value) })} /></label>
                            </div>
                        </fieldset>}
                        {table && <TableEditor table={table} disabled={busy} onChange={updateTable} />}
                        {table && <TableOrderQR key={`${companyId}:${table.table_id}`} companyId={companyId}
                            tableId={table.table_id} saved={board.tables.some(t => t.table_id === table.table_id)} disabled={busy} />}
                        <div className="reservation-actions"><Button variant="primary" disabled={busy} onClick={() => mutate(
                            async () => { const result = await reservationService.layout(companyId, draftVersion, draft, draftRooms, draftSize); if (mounted.current) { setDraftVersion(result.version); setNewTableIds([]); } }, '')}>Сохранить план</Button>
                            <Button disabled={busy} onClick={() => { setDraft(board.tables.map(t => ({ ...t }))); setDraftRooms((board.rooms || []).map(r => ({ ...r }))); setDraftSize({width:board.width || 1000,height:board.height || 600}); setNewTableIds([]); setSelectedRoom(''); setDraftVersion(board.version); setError(''); }}>Отменить правки</Button></div>
                        <p className="reservation-muted">До сохранения изменения видны только вам. Столы с действующими бронями удалить нельзя.</p>
                    </> : null}
                </aside>}
            </div></>}
        </>}
        {!board && validInterval && !error && <p role="status">Загружаем план зала…</p>}
        </div>
    </>;
}

function PlanSizeEditor({size,disabled,onResize}: {size:PlanSize;disabled:boolean;onResize:(size:PlanSize)=>void}) {
    const [width,setWidth] = useState(String(size.width)), [height,setHeight] = useState(String(size.height));
    useEffect(() => { setWidth(String(size.width)); setHeight(String(size.height)); }, [size.width,size.height]);
    const valid = Number.isInteger(Number(width)) && Number(width)>=300 && Number(width)<=4000 && Number.isInteger(Number(height)) && Number(height)>=200 && Number(height)<=2400;
    return <fieldset className="reservation-fields reservation-size" disabled={disabled}><legend>Рабочее пространство</legend>
        <div className="reservation-pair"><label>Ширина плана<input type="number" min="300" max="4000" value={width} onChange={e=>setWidth(e.target.value)} /></label>
            <label>Высота плана<input type="number" min="200" max="2400" value={height} onChange={e=>setHeight(e.target.value)} /></label></div>
        <Button disabled={!valid || (Number(width)===size.width && Number(height)===size.height)} onClick={()=>onResize({width:Number(width),height:Number(height)})}>Применить размер</Button>
    </fieldset>;
}

function TableEditor({ table, disabled, onChange }: { table: DiningTable; disabled: boolean; onChange: (table: DiningTable) => void }) {
    const number = (field: 'seats' | 'width' | 'height' | 'x' | 'y', value: string) => {
        const n = Number(value); if (!Number.isFinite(n)) return;
        const updated = { ...table, [field]: Math.round(n) };
        if (table.shape !== 'rectangle' && ['width', 'height'].includes(field)) updated.width = updated.height = Math.max(50, Math.min(220, n));
        updated.width = Math.max(50, Math.min(220, updated.width)); updated.height = Math.max(50, Math.min(220, updated.height));
        updated.seats = Math.max(1, Math.min(24, updated.seats)); onChange(updated);
    };
    return <fieldset disabled={disabled} className="reservation-fields">
        <div className="reservation-pair"><label>Название стола<input maxLength={40} value={table.label} onChange={e => onChange({ ...table, label: e.target.value })} /></label>
        <label>Форма<select value={table.shape} onChange={e => onChange({ ...table, shape: e.target.value as DiningTable['shape'],
            height: e.target.value === 'rectangle' ? table.height : table.width })}>
            <option value="square">Квадрат</option><option value="rectangle">Прямоугольник</option><option value="circle">Круг</option>
        </select></label></div>
        <div className="reservation-triple">
            <label>Мест<input type="number" min="1" max="24" value={table.seats} onChange={e => number('seats', e.target.value)} /></label>
            <label>Ширина<input type="number" min="50" max="220" value={table.width} onChange={e => number('width', e.target.value)} /></label>
            <label>Высота<input type="number" min="50" max="220" value={table.height} onChange={e => number('height', e.target.value)} /></label>
        </div>
    </fieldset>;
}

function BookingForm({ table, booking, staff, busy, start, end, occupied, onSubmit, onCancelEdit }: {
    table: DiningTable | undefined; booking: Reservation | null; staff: boolean; busy: boolean; start: string; end: string; occupied: boolean;
    onSubmit: (values: { guests: number; guest_name?: string; guest_phone?: string }, requestId: string) => void; onCancelEdit: () => void;
}) {
    const [guests, setGuests] = useState(String(booking?.guests || 2));
    const [name, setName] = useState(booking?.guest_name || '');
    const [phone, setPhone] = useState(booking?.guest_phone || '');
    const request = useRef<{ signature: string; id: string } | undefined>(undefined);
    return <form className="reservation-fields" onSubmit={event => {
        event.preventDefault(); if (busy || !table) return;
        const signature = JSON.stringify({ table: table.table_id, guests, name, phone, start, end });
        if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
        onSubmit({ guests: Number(guests), ...(staff ? { guest_name: name.trim(), guest_phone: phone.trim() } : {}) }, request.current!.id);
    }}>
        {occupied && !booking && <p className="reservation-warning">В выбранном интервале уже есть бронь. Измените время или выберите другой стол.</p>}
        <fieldset disabled={busy} className="reservation-fields">
            <label>Число гостей<input type="number" min="1" max={table?.seats || 24} required value={guests} onChange={e => setGuests(e.target.value)} /></label>
            {staff ? <><label>Имя гостя<input maxLength={100} required value={name} onChange={e => setName(e.target.value)} /></label>
                <label>Телефон гостя<input type="tel" maxLength={30} required value={phone} onChange={e => setPhone(e.target.value)} /></label></> :
                <p className="reservation-muted">Бронь будет оформлена на вас. Имя и телефон берутся из профиля.</p>}
            <Button type="submit" variant="primary" disabled={!table || (!booking && occupied) || !guests || Number(guests)>(table?.seats || 0) || Number(guests)<1}>
                {booking ? 'Сохранить бронь' : 'Забронировать стол'}</Button>
            {booking && <Button onClick={onCancelEdit}>Отменить редактирование</Button>}
        </fieldset>
    </form>;
}
