/** Keep decimal API strings exact, even above Number.MAX_SAFE_INTEGER. */
export function formatMoney(value: string | number): string {
    if (typeof value === 'number') {
        return Number.isFinite(value)
            ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value)
            : '—';
    }
    const match = /^(\d+)\.(\d{2})$/.exec(value);
    if (!match) return '—';
    const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return `${integer},${match[2]}\u00a0₽`;
}
