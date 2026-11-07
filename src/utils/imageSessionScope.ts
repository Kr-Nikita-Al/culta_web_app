// Refreshing credentials does not change ownership of in-flight gallery work.
export function imageSessionScope(userId: string | null | undefined, token: string | null | undefined): string {
    if (!token) return 'anonymous';
    return userId ? `user:${userId}` : `unresolved:${token}`;
}
