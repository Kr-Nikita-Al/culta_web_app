import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_PLAN_SIZE, DiningTable, FloorRoom, Occupancy, PlanSize } from '../services/reservationService';
import { chairPositions, clampRoom, clampTable, tableState } from '../utils/reservations';

const labels = { free: 'свободен', reserved: 'забронирован', seated: 'гости за столом' };

export default function FloorPlan({ tables, occupancy, start, end, selected, editable, onSelect, onMove,
    rooms = [], selectedRoom = '', newTableIds = [], onSelectRoom, onMoveRoom, onDeleteTable, onDeleteRoom, size = DEFAULT_PLAN_SIZE }: {
    tables: DiningTable[]; occupancy: Occupancy[]; start: string; end: string; selected: string;
    editable: boolean; onSelect: (id: string) => void; onMove: (table: DiningTable) => void;
    rooms?: FloorRoom[]; selectedRoom?: string; newTableIds?: string[];
    onSelectRoom?: (id: string) => void; onMoveRoom?: (room: FloorRoom) => void;
    size?: PlanSize;
    onDeleteTable?: (id: string) => void; onDeleteRoom?: (id: string) => void;
}) {
    const svg = useRef<SVGSVGElement>(null);
    const drag = useRef<{ table: DiningTable; x: number; y: number } | null>(null);
    const roomDrag = useRef<{ room: FloorRoom; x: number; y: number; resize: boolean } | null>(null);
    const [view, setView] = useState({ x: 0, y: 0, width: size.width });
    const ratio = size.height/size.width;
    useEffect(() => { setView({x:0,y:0,width:size.width}); }, [size.width,size.height]);
    const [hand, setHand] = useState(false);
    const [expanded, setExpanded] = useState(false);
    useEffect(() => { if (!editable) { setHand(false); setExpanded(false); } }, [editable]);
    const pan = useRef<{ x: number; y: number; vx: number; vy: number; scale: number } | null>(null);
    const zoom = (factor: number) => setView(v => {
        const width = Math.max(size.width/4, Math.min(size.width*2, v.width*factor));
        return { x: v.x+(v.width-width)/2, y: v.y+(v.width-width)*ratio/2, width };
    });
    const stop = () => { drag.current = null; roomDrag.current = null; pan.current = null; };
    const point = (event: React.PointerEvent) => {
        const matrix = svg.current?.getScreenCTM();
        if (!svg.current || !matrix) return { x: 0, y: 0 };
        const p = svg.current.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
        return p.matrixTransform(matrix.inverse());
    };
    return <div className={`floor-stage ${expanded ? 'floor-stage--expanded' : ''}`} onKeyDown={e => { if (e.key === 'Escape') { setExpanded(false); onSelect(''); onSelectRoom?.(''); } }}>
        {editable && <div className="floor-toolbar">
            <button type="button" aria-pressed={hand} onClick={() => setHand(!hand)}>✋ Перемещение</button>
            <button type="button" aria-label="Уменьшить масштаб" onClick={() => zoom(1.25)}>−</button>
            <span>{Math.round(size.width*100/view.width)}%</span>
            <button type="button" aria-label="Увеличить масштаб" onClick={() => zoom(.8)}>+</button>
            <button type="button" onClick={() => setView({ x: 0, y: 0, width: size.width })}>Весь план</button>
            <button className="floor-window-control" type="button" aria-label={expanded ? 'Свернуть' : 'Развернуть'} title={expanded ? 'Свернуть' : 'Развернуть'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    {expanded ? <path d="m6 6 12 12M18 6 6 18" /> : <rect x="5" y="5" width="14" height="14" rx="1" />}
                </svg>
            </button>
        </div>}
        <svg ref={svg} viewBox={editable ? `${view.x} ${view.y} ${view.width} ${view.width*ratio}` : `0 0 ${size.width} ${size.height}`} className={`floor-plan ${editable ? 'floor-plan--editing' : ''} ${hand ? 'floor-plan--hand' : ''}`}
        onClick={event => { if (editable && event.target === event.currentTarget) { onSelect(''); onSelectRoom?.(''); } }}
        onPointerDown={event => {
            if (!editable || (event.target !== event.currentTarget && !hand && event.button !== 1)) return;
            event.preventDefault();
            if (event.target === event.currentTarget && event.button === 0) { onSelect(''); onSelectRoom?.(''); }
            pan.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y, scale: svg.current?.getScreenCTM()?.a || 1 };
            event.currentTarget.setPointerCapture(event.pointerId);
        }}
        aria-label="План зала" role="group" onPointerMove={event => {
            if (pan.current && editable) {
                const p = pan.current;
                setView(v => ({ ...v, x: p.vx-(event.clientX-p.x)/p.scale, y: p.vy-(event.clientY-p.y)/p.scale })); return;
            }
            if (roomDrag.current && editable) {
                const p = point(event), d = roomDrag.current;
                onMoveRoom?.(clampRoom(d.resize ? { ...d.room, width: Math.min(size.width-d.room.x, d.room.width+p.x-d.x), height: Math.min(size.height-d.room.y, d.room.height+p.y-d.y) }
                    : { ...d.room, x: d.room.x+p.x-d.x, y: d.room.y+p.y-d.y }, size)); return;
            }
            if (!drag.current || !editable) return;
            const p = point(event), d = drag.current;
            onMove(clampTable({ ...d.table, x: d.table.x+p.x-d.x, y: d.table.y+p.y-d.y }, size));
        }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
        <defs><pattern id="floor-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#d6ddd5" /></pattern></defs>
        <rect x="2" y="2" width={size.width-4} height={size.height-4} rx="20" fill="url(#floor-grid)" stroke="#ccd5c9" strokeWidth="3" pointerEvents="none" />
        {rooms.map(room => <g key={room.room_id} className={`floor-room ${selectedRoom === room.room_id ? 'floor-room--selected' : ''}`}
            transform={`translate(${room.x},${room.y})`} role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
            aria-label={`Комната ${room.label}`} aria-pressed={editable ? selectedRoom === room.room_id : undefined}
            onPointerDown={event => {
                if (!editable || hand || event.button === 1) return;
                event.stopPropagation(); event.preventDefault(); onSelectRoom?.(room.room_id);
                const p = point(event); roomDrag.current = { room, x: p.x, y: p.y, resize: false };
                event.currentTarget.setPointerCapture(event.pointerId);
            }} onClick={() => { if (editable && !hand) onSelectRoom?.(room.room_id); }}
            onKeyDown={event => {
                if (!editable) return;
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectRoom?.(room.room_id); }
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                    event.preventDefault(); onMoveRoom?.(clampRoom({ ...room,
                        x: room.x+(event.key === 'ArrowRight' ? 10 : event.key === 'ArrowLeft' ? -10 : 0),
                        y: room.y+(event.key === 'ArrowDown' ? 10 : event.key === 'ArrowUp' ? -10 : 0) }, size));
                }
            }}>
            <rect width={room.width} height={room.height} rx="6" className="floor-room-boundary" pointerEvents={editable ? 'stroke' : 'none'} />
            {editable && selectedRoom === room.room_id && <rect x={room.width-8} y={room.height-8} width="16" height="16"
                className="floor-room-resize" aria-label="Изменить размер комнаты" onPointerDown={event => {
                    if (hand) return;
                    event.preventDefault(); event.stopPropagation(); const p = point(event);
                    roomDrag.current = { room, x: p.x, y: p.y, resize: true }; event.currentTarget.setPointerCapture(event.pointerId);
                }} />}
        </g>)}
        {!tables.length && <text x={size.width/2} y={size.height/2} pointerEvents="none" textAnchor="middle" fill="#6b7569" fontSize="20">План зала пока не создан</text>}
        {tables.map(table => {
            const instantEnd = Number.isFinite(Date.parse(start)) ? new Date(Date.parse(start)+1).toISOString() : end;
            const state = tableState(table.table_id, occupancy, start, instantEnd);
            return <g key={table.table_id} transform={`translate(${table.x}, ${table.y})`}
                className={`floor-table floor-table--${state} ${selected === table.table_id ? 'floor-table--selected' : ''} ${newTableIds.includes(table.table_id) ? 'floor-table--new' : ''}`}
                role="button" tabIndex={0} aria-pressed={selected === table.table_id}
                aria-label={`${table.label}, ${table.seats} мест, ${labels[state]}`}
                onClick={() => { if (!hand) onSelect(table.table_id); }} onPointerDown={event => {
                    if (hand || event.button === 1) return;
                    event.stopPropagation();
                    onSelect(table.table_id);
                    if (editable) {
                        event.preventDefault(); const p = point(event);
                        drag.current = { table, x: p.x, y: p.y };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }
                }} onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(table.table_id); }
                    if (editable && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                        event.preventDefault();
                        onMove(clampTable({ ...table, x: table.x+(event.key === 'ArrowRight' ? 10 : event.key === 'ArrowLeft' ? -10 : 0),
                            y: table.y+(event.key === 'ArrowDown' ? 10 : event.key === 'ArrowUp' ? -10 : 0) }, size));
                    }
                }}>
                {chairPositions(table).map((p, i) => <circle className="floor-chair" key={i} cx={p.x} cy={p.y} r="8" />)}
                {table.shape === 'circle' ? <circle className="floor-surface" r={table.width/2} /> :
                    <rect className="floor-surface" x={-table.width/2} y={-table.height/2} width={table.width} height={table.height} rx={table.shape === 'square' ? 10 : 12} />}
                <text className="floor-label" textAnchor="middle" y="-3">{table.label.length > 14 ? table.label.slice(0, 13)+'…' : table.label}</text>
                <text className="floor-seats" textAnchor="middle" y="17">{table.seats} мест</text>
                {newTableIds.includes(table.table_id) && <text className="floor-new-label" textAnchor="middle" y={-table.height/2-28}>Новый</text>}
            </g>;
        })}
        {rooms.map(room => {
            const count = Math.max(5, Math.floor((room.width-20)/9));
            const label = room.label.length>count ? room.label.slice(0,count-1)+'…' : room.label;
            return <g key={`label-${room.room_id}`} pointerEvents="none" aria-hidden="true"
                transform={`translate(${room.x+6},${Math.max(20,room.y-6)})`}>
                <rect x="0" y="-18" width={Math.min(room.width-6,label.length*9+16)} height="24" rx="5" fill="#f2f5ed" />
                <text x="8" y="0" className="floor-room-label">{label}</text>
            </g>;
        })}
        {editable && onDeleteTable && tables.filter(table => table.table_id === selected).map(table =>
            <DeleteControl key={table.table_id} x={Math.min(size.width-24,table.x+table.width/2+24)} y={Math.max(24,table.y-table.height/2-24)}
                label={`Удалить стол ${table.label}`} onDelete={() => { stop(); onDeleteTable(table.table_id); }} />)}
        {editable && onDeleteRoom && rooms.filter(room => room.room_id === selectedRoom).map(room =>
            <DeleteControl key={room.room_id} x={Math.min(size.width-24,room.x+room.width)} y={Math.max(24,room.y)}
                label={`Удалить комнату ${room.label}`} onDelete={() => { stop(); onDeleteRoom(room.room_id); }} />)}
    </svg></div>;
}

function DeleteControl({x,y,label,onDelete}: {x:number;y:number;label:string;onDelete:()=>void}) {
    return <g className="floor-delete-control" transform={`translate(${x},${y})`} role="button" tabIndex={0} aria-label={label}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); onDelete(); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onDelete(); } }}>
        <title>{label}</title><circle r="22" /><path d="m-6-6 12 12M6-6-6 6" />
    </g>;
}
