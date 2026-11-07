/** Integer hundredths: never convert wallet amounts to floating point. */
export function hundredths(value: string): bigint | null {
    const match = /^(\d{1,16})(?:\.(\d{0,2}))?$/.exec(value);
    return match ? BigInt(match[1]) * BigInt(100) + BigInt((match[2] || '').padEnd(2, '0')) : null;
}

function fixed(value: bigint): string {
    return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, '0')}`;
}

export function bonusPreview(total: string, spent: string, limit: string, accrual: string) {
    const t = hundredths(total), s = hundredths(spent), l = hundredths(limit), p = hundredths(accrual);
    if (t === null || s === null || l === null || p === null || s > t || s > l || p > BigInt(10000)) return null;
    const paid = t - s;
    return { paid: fixed(paid), earned: fixed(paid * p / BigInt(10000)) };
}
