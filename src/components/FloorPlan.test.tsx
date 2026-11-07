import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FloorPlan from './FloorPlan';

test('selected objects have immediate isolated delete controls only in edit mode', () => {
    const removeTable=jest.fn(), removeRoom=jest.fn(), select=jest.fn();
    const props = {tables:[{table_id:'t',label:'Окно',seats:2,shape:'circle' as const,x:100,y:100,width:80,height:80}],
        rooms:[{room_id:'r',label:'Зал',x:20,y:20,width:300,height:200}], occupancy:[],start:'',end:'',
        selected:'t',selectedRoom:'r',editable:true,onSelect:select,onMove:jest.fn(),onDeleteTable:removeTable,onDeleteRoom:removeRoom};
    const {rerender}=render(<FloorPlan {...props} />);
    fireEvent.pointerDown(screen.getByRole('button',{name:'Удалить стол Окно'}));
    fireEvent.click(screen.getByRole('button',{name:'Удалить стол Окно'}));
    expect(removeTable).toHaveBeenCalledWith('t'); expect(select).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button',{name:'Удалить комнату Зал'}),{key:'Enter'});
    expect(removeRoom).toHaveBeenCalledWith('r');
    rerender(<FloorPlan {...props} selected="" selectedRoom="" />);
    expect(screen.queryByRole('button',{name:/Удалить/})).not.toBeInTheDocument();
    rerender(<FloorPlan {...props} editable={false} />);
    expect(screen.queryByRole('button',{name:/Удалить/})).not.toBeInTheDocument();
});

test('empty canvas deselects both object types and respects custom dimensions',()=>{
    const select = jest.fn(), selectRoom = jest.fn();
    render(<FloorPlan tables={[]} occupancy={[]} start="" end="" selected="t" selectedRoom="r" editable
        size={{width:1600,height:900}} onSelect={select} onSelectRoom={selectRoom} onMove={()=>{}} />);
    const canvas=screen.getByRole('group',{name:'План зала'});
    expect(canvas).toHaveAttribute('viewBox','0 0 1600 900');
    fireEvent.click(canvas);
    expect(select).toHaveBeenCalledWith(''); expect(selectRoom).toHaveBeenCalledWith('');
});

test('a reservation starting exactly at selected time is colored reserved', () => {
    render(<FloorPlan tables={[{ table_id: '1', label: 'Окно', seats: 2, shape: 'circle', x: 100, y: 100, width: 80, height: 80 }]}
        occupancy={[{ table_id: '1', starts_at: '2026-10-01T12:00:00Z', ends_at: '2026-10-01T14:00:00Z', status: 'confirmed' }]}
        start="2026-10-01T12:00:00Z" end="2026-10-01T14:00:00Z" selected="" editable={false} onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByRole('button', { name: 'Окно, 2 мест, забронирован' })).toBeInTheDocument();
});

test('editor can zoom, reset, expand and move rooms with keyboard', () => {
    const move = jest.fn();
    render(<FloorPlan tables={[]} occupancy={[]} start="" end="" selected="" editable onSelect={() => {}} onMove={() => {}}
        rooms={[{room_id:'r',label:'Зал',x:20,y:20,width:300,height:200}]} onMoveRoom={move} />);
    fireEvent.click(screen.getByRole('button', {name:'Увеличить масштаб'}));
    expect(screen.getByRole('group', {name:'План зала'})).toHaveAttribute('viewBox','100 60 800 480');
    fireEvent.click(screen.getByRole('button', {name:'Весь план'}));
    expect(screen.getByRole('group', {name:'План зала'})).toHaveAttribute('viewBox','0 0 1000 600');
    fireEvent.keyDown(screen.getByRole('button', {name:'Комната Зал'}), {key:'ArrowRight'});
    expect(move).toHaveBeenCalledWith(expect.objectContaining({x:30}));
    fireEvent.click(screen.getByRole('button', {name:'Развернуть'}));
    expect(screen.getByRole('button', {name:'Свернуть'})).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', {name:'Свернуть'}),{key:'Escape'});
    expect(screen.getByRole('button', {name:'Развернуть'})).toBeInTheDocument();
});
