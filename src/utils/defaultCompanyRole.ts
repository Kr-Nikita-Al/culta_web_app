import {UserRole} from '../types/authTypes';

// Stable preference, independent of the order in which the API returns roles.
const staffPriority = ['PORTAL_ROLE_OWNER', 'PORTAL_ROLE_ADMIN', 'PORTAL_ROLE_MODERATOR',
    'PORTAL_ROLE_HOSTESS', 'PORTAL_ROLE_WAITER', 'PORTAL_ROLE_COOK'];

export function defaultCompanyRole(roles: UserRole[]): UserRole | null {
    const superAdmin = roles.find(r => r.role === 'PORTAL_ROLE_SUPER_ADMIN');
    if (superAdmin) return superAdmin;
    const staff = roles.filter(r => staffPriority.includes(r.role) && r.company_id &&
        r.company_id !== '00000000-0000-0000-0000-000000000000');
    if (new Set(staff.map(r => r.company_id)).size === 1) {
        return [...staff].sort((a, b) => staffPriority.indexOf(a.role) - staffPriority.indexOf(b.role))[0];
    }
    if (roles.length === 1 && roles[0].role === 'PORTAL_ROLE_USER') return roles[0];
    return null;
}
