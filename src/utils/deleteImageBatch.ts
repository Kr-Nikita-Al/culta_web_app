export async function deleteImageBatch(ids: readonly string[], options: {
    isCurrent: () => boolean;
    remove: (id: string) => Promise<unknown>;
    onDeleted: (id: string) => void;
    onError: (error: unknown) => void;
}): Promise<Set<string>> {
    const deleted = new Set<string>();
    for (const id of Array.from(new Set(ids))) {
        if (!options.isCurrent()) break;
        try {
            await options.remove(id);
        } catch (error) {
            if (!options.isCurrent()) break;
            options.onError(error);
            continue;
        }
        if (!options.isCurrent()) break;
        deleted.add(id);
        options.onDeleted(id);
    }
    return deleted;
}
