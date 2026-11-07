import api from './api';
export interface PlanSize { width: number; height: number; }
export const DEFAULT_PLAN_SIZE: PlanSize = { width: 1000, height: 600 };

export interface DiningTable {
    table_id: string; label: string; shape: 'square' | 'rectangle' | 'circle';
    seats: number; x: number; y: number; width: number; height: number;
}
export interface Occupancy {
    table_id: string; starts_at: string; ends_at: string; status: string;
}
export interface FloorRoom {
    room_id: string; label: string; x: number; y: number; width: number; height: number;
}
export interface Reservation extends Occupancy {
    reservation_id: string; company_id: string; user_id: string | null;
    guest_name: string; guest_phone: string; guests: number; version: number;
}
export interface ReservationBoard {
    version: number; tables: DiningTable[]; bookings: Reservation[]; occupancy: Occupancy[];
    rooms?: FloorRoom[];
    width?: number; height?: number;
    can_edit_plan: boolean; can_manage_bookings: boolean; server_time: string;
}
export interface BookingInput {
    company_id: string; table_id: string; request_id: string; guests: number;
    starts_at: string; ends_at: string; guest_name?: string; guest_phone?: string;
}
export const reservationService = {
    async companies(): Promise<Array<{ company_id: string; company_name: string }>> {
        return (await api.get('/reservations/companies')).data;
    },
    async board(companyId: string, start: string, end: string): Promise<ReservationBoard> {
        return (await api.get('/reservations/board', { params: { company_id: companyId, starts_at: start, ends_at: end } })).data;
    },
    async layout(companyId: string, version: number, tables: DiningTable[], rooms?: FloorRoom[], size?: PlanSize): Promise<{ version: number }> {
        return (await api.put('/reservations/layout', { company_id: companyId, version, tables, rooms, ...size })).data;
    },
    async create(body: BookingInput): Promise<Reservation> {
        return (await api.post('/reservations', body)).data;
    },
    async edit(id: string, body: BookingInput, version: number): Promise<Reservation> {
        return (await api.put(`/reservations/${id}`, { ...body, version })).data;
    },
    async status(booking: Reservation, status: string): Promise<Reservation> {
        return (await api.patch(`/reservations/${booking.reservation_id}/status`, {
            company_id: booking.company_id, version: booking.version, status,
        })).data;
    },
};
