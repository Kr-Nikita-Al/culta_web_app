import { chairPositions, clampRoom, clampTable, localInput, placeTable, tableState } from './reservations';
import { DiningTable } from '../services/reservationService';

const table: DiningTable = { table_id: 'table', label: '1', shape: 'square', seats: 6, x: 150, y: 150, width: 90, height: 90 };
test('draws exactly the configured number of chairs for each shape', () => {
    for (const shape of ['square', 'rectangle', 'circle'] as const) {
        const positions = chairPositions({ ...table, shape });
        expect(positions).toHaveLength(6);
        expect(positions.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    }
});
test('keeps table and chairs within the plan', () => {
    expect(clampTable({ ...table, x: -500, y: 2000 })).toMatchObject({ x: 65, y: 535 });
});
test('detects overlapping intervals but allows adjacent visits', () => {
    const occupancy = [{ table_id: 'table', starts_at: '2026-10-02T10:00:00Z', ends_at: '2026-10-02T12:00:00Z', status: 'confirmed' }];
    expect(tableState('table', occupancy, '2026-10-02T11:00:00Z', '2026-10-02T13:00:00Z')).toBe('reserved');
    expect(tableState('table', occupancy, '2026-10-02T12:00:00Z', '2026-10-02T13:00:00Z')).toBe('free');
    expect(tableState('other', occupancy, '2026-10-02T11:00:00Z', '2026-10-02T13:00:00Z')).toBe('free');
});
test('local datetime inputs preserve local wall time', () => {
    expect(localInput(new Date(2026, 9, 2, 18, 30))).toBe('2026-10-02T18:30');
});
test('new tables find free space including chairs, or report a full plan', () => {
    const placed = placeTable(table, [table])!;
    expect(placed).not.toBeNull();
    expect(Math.abs(placed.x-table.x)>=135 || Math.abs(placed.y-table.y)>=135).toBe(true);
    const full = Array.from({length:60}, (_,i) => ({ ...table, x:50+(i%10)*100, y:50+Math.floor(i/10)*100 }));
    expect(placeTable(table, full)).toBeNull();
});
test('room bounds stay inside the plan', () => {
    expect(clampRoom({room_id:'r', label:'Room', x:900, y:-2, width:300, height:200})).toMatchObject({x:700,y:0,width:300,height:200});
});
