import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedCompany } from '../context/SelectedCompanyContext';
import { Order, OrderPatch, OrderStatus, CreateOrder, orderService } from '../services/orderService';
import { Check, checkService } from '../services/checkService';
import OrderClientPicker from '../components/OrderClientPicker';
import { allowedStatuses, getOrderError, isFinal, OrderError, staffRoles, statusLabels } from '../utils/orderUtils';
import api from '../services/api';
import Button from '../components/Button';
import CheckPanel from '../components/CheckPanel';
import OrderStatusHistory from '../components/OrderStatusHistory';
import PageTransition from '../components/PageTransition';
import { formatMoney as money } from '../utils/money';
import './OrdersPage.css';

const OrdersPage: React.FC = () => {
    const { userId, roles } = useAuth();
    const { selectedCompany, selectedRole } = useSelectedCompany();
    const companyRoles = (roles || []).filter(role => role.company_id === selectedCompany).map(role => role.role);
    const canViewCompany = selectedRole?.role !== 'PORTAL_ROLE_USER' && companyRoles.some(role => staffRoles.includes(role));
    const companyId = canViewCompany ? selectedCompany || undefined : undefined;

    return <PageTransition className="orders-page workspace-page workspace-card">
        <h1 className="section-title">Заказы</h1>
        <OrdersWorkspace key={`${userId}:${companyId || 'personal'}`} companyId={companyId} roles={companyRoles} />
    </PageTransition>;
};

function OrdersWorkspace({ companyId, roles }: { companyId?: string; roles: string[] }) {
    const [tab,setTab]=useState<'new'|'active'|'history'>('active');
    const [orders, setOrders] = useState<Order[]>([]);
    const [filter, setFilter] = useState<OrderStatus | ''>('');
    const [lookupId, setLookupId] = useState('');
    const [selected, setSelected] = useState<Order | null>(null);
    const [error, setError] = useState<OrderError | null>(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [needsReload, setNeedsReload] = useState(false);
    const [listLoaded, setListLoaded] = useState(false);
    const [revision, setRevision] = useState(0);
    const [checkLocked, setCheckLocked] = useState(true);
    const [statusReason, setStatusReason] = useState('');
    const request = useRef(0);

    // Ignore responses from an obsolete request or an unmounted company view.
    const run = useCallback(async <T,>(operation: () => Promise<T>, accept: (result: T) => void, failure?: () => void) => {
        const id = ++request.current;
        setBusy(true); setError(null); setMessage('');
        try {
            const result = await operation();
            if (id === request.current) accept(result);
        } catch (cause) {
            if (id === request.current) {
                setError(getOrderError(cause));
                failure?.();
            }
        } finally {
            if (id === request.current) setBusy(false);
        }
    }, []);

    useEffect(() => {
        run(() => orderService.list(companyId, filter === 'closed' ? undefined : filter || undefined), result => {
            setOrders(result); setListLoaded(true);
        });
        return () => { request.current += 1; };
    }, [companyId, filter, run]);

    const loadOrder = (id: string) => {
        // Do not leave another customer's old order visible after a failed lookup.
        setSelected(null); setNeedsReload(false); setCheckLocked(true); setStatusReason('');
        run(() => orderService.get(id, companyId), result => { setSelected(result); setRevision(value => value + 1); });
    };
    const refreshList = () => run(() => orderService.list(companyId, filter === 'closed' ? undefined : filter || undefined), result => {
        setOrders(result); setListLoaded(true);
    });

    const mutate = (operation: () => Promise<unknown>) => {
        if (!selected) return;
        const id = selected.order_id;
        run(operation, () => {
            setMessage('Изменения сохранены. Обновите заказ, чтобы увидеть текущее состояние.');
            setNeedsReload(true);
            // A list entry should not continue advertising a stale status.
            setOrders(previous => previous.filter(order => order.order_id !== id));
        }, () => setNeedsReload(true));
    };
    const canCreate = !!companyId && roles.some(role => ['PORTAL_ROLE_OWNER', 'PORTAL_ROLE_ADMIN', 'PORTAL_ROLE_WAITER'].includes(role));
    const tabs=[...(canCreate?[{id:'new' as const,label:'Новый заказ'}]:[]),{id:'active' as const,label:'Активные заказы'},{id:'history' as const,label:'История'}];
    const changeTab=(value:typeof tab)=>{setTab(value);setFilter('');setSelected(null);setMessage('');setError(null);};
    const visibleOrders=orders.filter(order=>{
        const archived=isFinal(order.status)||order.check_status==='closed'||order.check_status==='canceled';
        const matches=!filter||(filter==='closed'?(order.status==='closed'||order.check_status==='closed'):order.status===filter);
        return matches&&(tab==='history'?archived:!archived);
    });

    return <>
        <div className="orders-tabs" role="tablist" aria-label="Разделы заказов">
            {tabs.map((item,index)=><button type="button" key={item.id} role="tab" id={`orders-tab-${item.id}`} aria-controls="orders-panel" aria-selected={tab===item.id} tabIndex={tab===item.id?0:-1} disabled={busy} onClick={()=>changeTab(item.id)} onKeyDown={event=>{
                const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
                if(next>=0){event.preventDefault();changeTab(tabs[next].id);document.getElementById(`orders-tab-${tabs[next].id}`)?.focus();}
            }}>{item.label}</button>)}
        </div>
        <section id="orders-panel" className="orders-tab-panel" role="tabpanel" aria-labelledby={`orders-tab-${tab}`}>
        {error && <div className="orders-error" role="alert">{error.status && <strong>HTTP {error.status}. </strong>}{error.message}</div>}
        {message && <p className="orders-success" role="status">{message}</p>}
        {busy && <p role="status">Выполняется запрос…</p>}
        {tab!=='new' && <>
        <div className="orders-toolbar">
            <label>Статус<select value={filter} disabled={busy} onChange={event => setFilter(event.target.value as OrderStatus | '')}>
                <option value="">{tab==='history'?'Закрытые и отменённые':'Все активные статусы'}</option>
                {Object.entries(statusLabels).filter(([value])=>tab==='history'?isFinal(value as OrderStatus):!isFinal(value as OrderStatus)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <button type="button" className="orders-refresh" aria-label="Обновить список" title="Обновить список" disabled={busy} onClick={refreshList}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></svg>
            </button>
        </div>
        <form className="orders-toolbar" onSubmit={event => { event.preventDefault(); loadOrder(lookupId.trim()); }}>
            <label className="orders-grow">ID заказа<input value={lookupId} onChange={event => setLookupId(event.target.value)} placeholder="UUID заказа" required disabled={busy} /></label>
            <Button type="submit" disabled={busy || !lookupId.trim()}>Открыть по ID</Button>
        </form>
        {!busy && listLoaded && !visibleOrders.length && <p className="orders-muted">{tab==='history'?'В истории пока нет заказов.':'Активных заказов пока нет.'} Обновите список или откройте заказ по ID.</p>}
        <div className="orders-list" aria-label="Список заказов">
            {visibleOrders.map(order => <button key={order.order_id} className="orders-card" aria-pressed={selected?.order_id === order.order_id} disabled={busy} onClick={() => loadOrder(order.order_id)}>
                <strong>Заказ {order.order_id.slice(0, 8)}</strong>
                <span className={`order-status status-${order.status}`}>{statusLabels[order.status]}</span>
                {order.check_status==='closed'&&<span>Чек закрыт</span>}
                <span>{new Date(order.time_created).toLocaleString('ru-RU')}</span>
                <small>{order.order_id}</small>
            </button>)}
        </div>
        {selected && <div className="order-detail">
            <div className="orders-toolbar"><h2>Заказ {selected.order_id.slice(0, 8)}</h2>
                <Button disabled={busy} onClick={() => loadOrder(selected.order_id)}>Обновить заказ</Button></div>
            <p className="orders-id">{selected.order_id}</p>
            <p>Статус: <strong>{statusLabels[selected.status]}</strong></p>
            {!selected.check_id && <p className="orders-id">Клиент: {selected.user_id || 'Гость без аккаунта'}</p>}
            <p>Сумма из API: {money(selected.price)}</p>
            {selected.check_id && <CheckPanel key={`check:${selected.order_id}:${revision}`} checkId={selected.check_id}
                companyId={selected.company_id} canClose={canCreate} disabled={busy || needsReload} onLocked={setCheckLocked} />}
            <p className="orders-muted">Сумма рассчитывается сервером по сохранённым ценам и обновляется при изменении количества.</p>
            {needsReload && <p className="orders-warning">Обновите заказ перед следующим изменением.</p>}
            {isFinal(selected.status) && <p className="orders-warning">Закрытый или отменённый заказ нельзя редактировать.</p>}
            <OrderEditor key={`editor:${selected.order_id}:${revision}`} order={selected} editable={!!companyId}
                disabled={busy || needsReload || isFinal(selected.status) || (!!selected.check_id && checkLocked)}
                onSave={body => mutate(() => orderService.update(selected.order_id, body))} />
            {companyId && <>
            {allowedStatuses(selected.status, roles, !!selected.check_id).length > 0 && <label>Причина смены статуса (необязательно)
                <input maxLength={500} value={statusReason} disabled={busy || needsReload || (!!selected.check_id && checkLocked)} onChange={e=>setStatusReason(e.target.value)} />
            </label>}
            <div className="orders-toolbar">
                {allowedStatuses(selected.status, roles, !!selected.check_id).map(status => <Button key={status} variant={status === 'canceled' ? 'danger' : 'secondary'}
                    disabled={busy || needsReload || (!!selected.check_id && checkLocked)} onClick={() => mutate(() => statusReason.trim() ? orderService.updateStatus(selected.order_id, status, statusReason) : orderService.updateStatus(selected.order_id, status))}>
                    {status === 'closed' ? 'Закрыть заказ' : status === 'canceled' ? 'Отменить заказ' : `Перевести: ${statusLabels[status]}`}
                </Button>)}
            </div>
            <OrderStatusHistory key={`${selected.order_id}:${revision}`} orderId={selected.order_id} companyId={companyId} />
            </>}
        </div>}
        </>}
        {canCreate && tab==='new' && <div className="orders-create"><h2>Создать заказ</h2>
            <p className="orders-muted">Выберите гостя или клиента приложения и добавьте товар.</p>
            <CreateOrderForm companyId={companyId!} disabled={busy} onSubmit={body => run(async () => {
                const created=await orderService.create({ ...body, company_id: companyId! });
                return created;
            }, result => {
                setLookupId(result.order_id);
                setTab('active');setFilter('');setSelected(null);setNeedsReload(false);setCheckLocked(true);
                setMessage(`Заказ создан: ${result.order_id}. Нажмите «Открыть по ID» или обновите список.`);
            })} />
        </div>}
        </section>
    </>;
}

function OrderEditor({ order, editable, disabled, onSave }: {
    order: Order; editable: boolean; disabled: boolean; onSave: (body: OrderPatch) => void;
}) {
    const [comment, setComment] = useState(order.comment || '');
    const [time, setTime] = useState(String(order.cocking_time));
    const [quantities, setQuantities] = useState(order.order_items.map(item => String(item.quantity)));
    const missingPrices = order.order_items.some(item => !item.snapshot_available || item.unit_price == null);
    const changes: OrderPatch = {};
    if (comment !== (order.comment || '')) changes.comment = comment;
    if (time !== String(order.cocking_time)) changes.cocking_time = Number(time);
    const changedItems = order.order_items.flatMap((item, index) => quantities[index] !== String(item.quantity) ?
        [{ product_card_id: item.product_card_id, quantity: Number(quantities[index]) }] : []);
    if (changedItems.length) changes.order_items = changedItems;
    const valid = time.trim() !== '' && Number.isInteger(Number(time)) && Number(time) >= 0 &&
        quantities.every(value => value.trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= 0);

    return <form onSubmit={event => { event.preventDefault(); if (valid && !disabled && Object.keys(changes).length) onSave(changes); }}>
        {editable && <label>Комментарий<textarea maxLength={500} value={comment} disabled={disabled} onChange={event => setComment(event.target.value)} /></label>}
        <label>Время приготовления, мин<input type="number" min="0" step="1" required value={time} disabled={!editable || disabled} onChange={event => setTime(event.target.value)} /></label>
        <h3>Позиции заказа</h3>
        {missingPrices && <p className="orders-warning">Для этого заказа не сохранены исторические цены. Изменение количества недоступно; итог оставлен без пересчёта.</p>}
        {order.order_items.length === 0 && <p className="orders-muted">Позиций нет.</p>}
        {order.order_items.map((item, index) => <div key={item.product_card_id} className="order-position">
            <div><strong>{item.product_title ?? (item.product_info.title || item.product_card_id)}</strong><small>{item.product_card_id}</small>
                {item.snapshot_available && item.unit_price != null && item.line_total != null ? <>
                    <small>Цена при заказе: {money(item.unit_price)}</small>
                    <small>Сохранённая сумма позиции ({item.quantity} шт.): {money(item.line_total)}</small>
                    {quantities[index] !== String(item.quantity) && <small>Новая сумма появится после сохранения и обновления заказа.</small>}
                </> : <small>Исторические название и цена не сохранены. Название показано из каталога.</small>}
            </div>
            <label>Количество<input type="number" min="0" step="1" required aria-label={`Количество ${item.product_title ?? (item.product_info.title || item.product_card_id)}`}
                value={quantities[index]} disabled={!editable || disabled || missingPrices} onChange={event => setQuantities(previous => previous.map((value, i) => i === index ? event.target.value : value))} /></label>
        </div>)}
        {editable && <Button type="submit" variant="primary" className="orders-primary" disabled={disabled || !valid || Object.keys(changes).length === 0}>Сохранить изменения</Button>}
    </form>;
}

function CreateOrderForm({ disabled, onSubmit, companyId }: {
    companyId: string; disabled: boolean; onSubmit: (body: Omit<CreateOrder, 'company_id'>) => void;
}) {
    const [userId, setUserId] = useState('');
    const [guest, setGuest] = useState(true);
    const [guestName, setGuestName] = useState('');
    const [tableId, setTableId] = useState('');
    const [existing, setExisting] = useState(false);
    const [checks, setChecks] = useState<Check[]>([]);
    const [tables, setTables] = useState<{table_id:string;name:string}[]>([]);
    const [visitError, setVisitError] = useState('');
    useEffect(() => {
        let alive = true;
        Promise.all([checkService.open(companyId), api.get('/check/tables', {params:{company_id:companyId}})])
            .then(([open, response]) => {if (alive) {setChecks(open); setTables(response.data);}})
            .catch(cause => {if (alive) setVisitError(getOrderError(cause).message);});
        return () => {alive = false;};
    }, [companyId]);
    const [productId, setProductId] = useState('');
    const [query,setQuery]=useState('');
    const [catalog,setCatalog]=useState<{product_card_id:string;title:string;price:string;is_active:boolean}[]>([]);
    const [catalogState,setCatalogState]=useState('Загрузка товаров…');
    const [suggestions,setSuggestions]=useState(false);
    const [highlight,setHighlight]=useState(0);
    useEffect(()=>{let alive=true;api.get('/product_card/get_product_cards_company_by_id',{params:{company_id:companyId,include_cost:false}}).then(r=>{if(alive){setCatalog(r.data.products.filter((p:{is_active:boolean})=>p.is_active));setCatalogState('');}}).catch(()=>{if(alive)setCatalogState('Не удалось загрузить товары. Откройте вкладку повторно.');});return()=>{alive=false;};},[companyId]);
    const matches=catalog.filter(p=>p.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,20);
    const choose=(p:typeof catalog[number])=>{setProductId(p.product_card_id);setQuery(p.title);setSuggestions(false);};
    const [quantity, setQuantity] = useState('1');
    const [checkId, setCheckId] = useState('');
    return <form onSubmit={event => {
        event.preventDefault();
        if(!productId || (existing ? !checks.some(check => check.check_id === checkId) : !guest && !userId))return;
        const visit = existing ? checks.find(check => check.check_id === checkId) : undefined;
        onSubmit({ user_id: visit ? visit.user_id : guest ? null : userId, check_id: visit?.check_id,
            guest_name: !existing && guest ? guestName.trim() || undefined : undefined,
            table_id: !existing ? tableId || undefined : undefined, comment: '', cocking_time: 0,
            order_items: [{ product_card_id: productId.trim(), quantity: Number(quantity) }] });
    }}>
        <fieldset disabled={disabled}>
            <label>Чек<select value={existing ? 'existing' : 'new'} onChange={e => {setExisting(e.target.value === 'existing'); setCheckId('');}}>
                <option value="new">Новый чек</option><option value="existing">Добавить в открытый</option>
            </select></label>
            {existing ? <label>Открытый чек<select required value={checkId} onChange={e => setCheckId(e.target.value)}>
                <option value="">Выберите чек</option>
                {checks.map(check => <option key={check.check_id} value={check.check_id}>
                    {check.check_id.slice(0,8)} · {check.guest_name || (check.user_id ? 'Клиент приложения' : 'Гость')} · {tables.find(table=>table.table_id===check.table_id)?.name || 'Без стола'} · {money(check.total_amount || '0')}
                </option>)}
            </select></label> : <>
                <label>Клиент<select value={guest ? 'guest' : 'client'} onChange={e=>{setGuest(e.target.value==='guest');setUserId('');}}>
                    <option value="guest">Гость без аккаунта</option><option value="client">Клиент приложения</option>
                </select></label>
                {guest ? <label>Имя гостя (необязательно)<input maxLength={100} value={guestName} onChange={e=>setGuestName(e.target.value)} /></label>
                    : <OrderClientPicker companyId={companyId} disabled={disabled} onSelect={setUserId} />}
                <label>Стол (необязательно)<select value={tableId} onChange={e=>setTableId(e.target.value)}><option value="">Без стола</option>
                    {tables.map(table=><option key={table.table_id} value={table.table_id}>{table.name}</option>)}
                </select></label>
                {guest && <p className="orders-muted">Гостевой чек оплачивается деньгами. До оплаты можно привязать аккаунт клиента по QR.</p>}
            </>}
            {visitError && <p role="alert">Не удалось загрузить чеки и столы: {visitError}</p>}
            <div className="order-product-row">
                <div className="order-product-search" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setSuggestions(false);}}>
                    <label>Товар<input required role="combobox" aria-autocomplete="list" aria-expanded={suggestions} aria-controls="order-product-options" aria-activedescendant={suggestions&&matches[highlight]?'order-product-'+highlight:undefined} value={query} placeholder="Начните вводить название" onFocus={()=>setSuggestions(true)} onChange={e=>{setQuery(e.target.value);setProductId('');setHighlight(0);setSuggestions(true);}} onKeyDown={e=>{if(e.key==='Escape')setSuggestions(false);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setSuggestions(true);setHighlight(i=>Math.max(0,Math.min(matches.length-1,i+(e.key==='ArrowDown'?1:-1))));}if(e.key==='Enter'&&suggestions){e.preventDefault();if(matches[highlight])choose(matches[highlight]);}}}/></label>
                    {suggestions&&<ul id="order-product-options" role="listbox" className="order-product-options">{matches.map((p,i)=><li key={p.product_card_id} role="option" aria-selected={highlight===i} id={'order-product-'+i} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(p)}>{p.title} <small>{money(p.price)}</small></li>)}{!matches.length&&<li>{catalogState||'Товары не найдены'}</li>}</ul>}
                    {catalogState&&<small role="status">{catalogState}</small>}
                </div>
                <label className="order-product-quantity">Количество<input required type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
            </div>
            <Button type="submit" variant="primary" className="orders-primary" disabled={!productId.trim() || (existing ? !checkId : !guest && !userId)}>Создать заказ</Button>
        </fieldset>
    </form>;
}

export default OrdersPage;
