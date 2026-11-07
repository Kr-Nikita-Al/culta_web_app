// bcrypt accepts at most 72 UTF-8 bytes, not 72 JavaScript characters.
export function passwordValidation(value: string, minimum: number): string {
    if (Array.from(value).length < minimum) return `Пароль должен содержать минимум ${minimum} символов`;
    if (new Blob([value]).size > 72) return 'Пароль слишком длинный: максимум 72 байта UTF-8 (кириллица и эмодзи занимают больше одного байта).';
    return '';
}
