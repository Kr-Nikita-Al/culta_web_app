import { formatMoney } from './money';

test('formats exact decimal strings without binary conversion', () => {
    expect(formatMoney('9999999999999999.99')).toBe('9\u00a0999\u00a0999\u00a0999\u00a0999\u00a0999,99\u00a0₽');
    expect(formatMoney('0.30')).toBe('0,30\u00a0₽');
    expect(formatMoney('250.50')).toBe('250,50\u00a0₽');
});

test('supports legacy numeric API responses and invalid values', () => {
    expect(formatMoney(250.5)).toBe('250,50\u00a0₽');
    expect(formatMoney('NaN')).toBe('—');
    expect(formatMoney(Infinity)).toBe('—');
});
