import { bonusPreview } from './bonusMath';

test('exact settlement and rounding down', () => {
    expect(bonusPreview('798.75', '99.75', '159.75', '10')).toEqual({paid: '699.00', earned: '69.90'});
    expect(bonusPreview('798.75', '0', '0', '1')).toEqual({paid: '798.75', earned: '7.98'});
    expect(bonusPreview('9999999999999999.99', '0', '0', '100')).toEqual({paid: '9999999999999999.99', earned: '9999999999999999.99'});
});

test('invalid and over-limit spend is rejected', () => {
    for (const value of ['-1', '0.001', '101', 'NaN', '1e2']) {
        expect(bonusPreview('100', value, '100', '10')).toBeNull();
    }
    expect(bonusPreview('100', '21', '20', '10')).toBeNull();
});
