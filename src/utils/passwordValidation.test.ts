import {passwordValidation} from './passwordValidation';
test.each([['a'.repeat(72),true],['a'.repeat(73),false],['я'.repeat(36),true],['я'.repeat(37),false],['😀'.repeat(18),true],['😀'.repeat(19),false]])('checks UTF-8 limit for %s',(value,valid)=>{
    expect(passwordValidation(value,6)==='').toBe(valid);
});
test('counts emoji as single characters for the minimum',()=>{
    expect(passwordValidation('😀'.repeat(4),8)).toContain('минимум 8');
});
