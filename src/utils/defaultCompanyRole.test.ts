import {defaultCompanyRole} from './defaultCompanyRole';
const admin = {company_id:'a',role:'PORTAL_ROLE_ADMIN'};
const waiter = {company_id:'a',role:'PORTAL_ROLE_WAITER'};
const client = {company_id:'user',role:'PORTAL_ROLE_USER'};
test('one company with several roles has a stable default', () => {
    expect(defaultCompanyRole([waiter, admin])).toEqual(admin);
    expect(defaultCompanyRole([admin, waiter, client])).toEqual(admin);
    expect(defaultCompanyRole([waiter])).toEqual(waiter);
});
test('multiple companies require explicit selection', () => {
    expect(defaultCompanyRole([admin,{...waiter,company_id:'b'}])).toBeNull();
});
test('preserves global defaults and handles empty roles', () => {
    expect(defaultCompanyRole([client])).toEqual(client);
    const superAdmin = {company_id:'superadmin',role:'PORTAL_ROLE_SUPER_ADMIN'};
    expect(defaultCompanyRole([admin,superAdmin])).toEqual(superAdmin);
    expect(defaultCompanyRole([])).toBeNull();
});
