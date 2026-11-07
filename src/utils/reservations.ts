import { DEFAULT_PLAN_SIZE, DiningTable, FloorRoom, Occupancy, PlanSize } from '../services/reservationService';

export function placeTable(table: DiningTable, tables: DiningTable[], size: PlanSize = DEFAULT_PLAN_SIZE): DiningTable | null {
    for (let y=table.height/2+25; y<=size.height-25-table.height/2; y+=10) {
        for (let x=table.width/2+25; x<=size.width-25-table.width/2; x+=10) {
            if (tables.every(t => Math.abs(t.x-x)>=(t.width+table.width)/2+45 || Math.abs(t.y-y)>=(t.height+table.height)/2+45)) {
                return { ...table, x, y };
            }
        }
    }
    return null;
}
export function clampRoom(room: FloorRoom, size: PlanSize = DEFAULT_PLAN_SIZE): FloorRoom {
    const width = Math.round(Math.max(100, Math.min(size.width, room.width)));
    const height = Math.round(Math.max(80, Math.min(size.height, room.height)));
    return { ...room, width, height, x: Math.round(Math.max(0, Math.min(size.width-width, room.x))),
        y: Math.round(Math.max(0, Math.min(size.height-height, room.y))) };
}

export function localInput(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function tableState(tableId: string, occupancy: Occupancy[], start: string, end: string) {
    const matches = occupancy.filter(b => b.table_id === tableId && new Date(b.starts_at) < new Date(end) && new Date(b.ends_at) > new Date(start));
    return matches.some(b => b.status === 'seated') ? 'seated' : matches.length ? 'reserved' : 'free';
}
export function clampTable(table: DiningTable, size: PlanSize = DEFAULT_PLAN_SIZE): DiningTable {
    return { ...table, x: Math.round(Math.max(table.width/2+20, Math.min(size.width-20-table.width/2, table.x))),
        y: Math.round(Math.max(table.height/2+20, Math.min(size.height-20-table.height/2, table.y))) };
}
export function chairPositions(table: DiningTable) {
    const w = table.width/2+14, h = table.height/2+14;
    return Array.from({ length: table.seats }, (_, i) => {
        if (table.shape === 'circle') {
            const angle = 2*Math.PI*i/table.seats-Math.PI/2;
            return { x: w*Math.cos(angle), y: h*Math.sin(angle) };
        }
        const d = (i+0.5)*4*(w+h)/table.seats;
        if (d < 2*w) return { x: -w+d, y: -h };
        if (d < 2*w+2*h) return { x: w, y: -h+d-2*w };
        if (d < 4*w+2*h) return { x: w-(d-2*w-2*h), y: h };
        return { x: -w, y: h-(d-4*w-2*h) };
    });
}

export function reservationError(error: unknown): string {
    const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
    const details: Record<string, string> = {
        'Table is already booked for this interval': 'На это время стол уже забронирован. Выберите другой стол или время.',
        'Floor plan changed; reload before saving': 'План изменён другим сотрудником. Отмените свои правки и загрузите актуальный план.',
        'Cannot remove a booked table or reduce capacity below booked guests': 'У стола есть действующие брони. Нельзя удалить его или уменьшить число мест ниже числа гостей.',
        'Guest count exceeds table capacity': 'Число гостей превышает количество мест за столом.',
        'Guests can be seated only during the reserved interval': 'Отметить приход гостей можно только в интервале брони.',
        'Reservation changed; reload before updating': 'Бронь изменена другим сотрудником. Обновите данные.',
        'Reservation changed or is no longer confirmed': 'Бронь изменена или уже не доступна для переноса. Обновите данные.',
        'Booking must start between now and one year ahead': 'Выберите время не в прошлом и не далее чем на год вперёд.',
    };
    const detail = response?.data?.detail;
    if (typeof detail === 'string' && details[detail]) return details[detail];
    if (response?.status === 403) return 'Недостаточно прав для этого действия.';
    if (response?.status === 404) return 'Заведение, стол или бронь недоступны. Обновите данные.';
    if (response?.status === 422) return 'Проверьте поля: длительность от 15 минут до 12 часов, число гостей, уникальные названия и размеры столов и комнат.';
    if (response?.status === 409) return 'Данные изменились или действие недоступно. Обновите данные перед повторной попыткой.';
    return 'Не удалось подтвердить результат. Обновите данные перед повторной попыткой.';
}
