export async function moveImageBatch(ids: readonly string[], options: {
    isCurrent: () => boolean;
    move: (id: string) => Promise<unknown>;
    onMoved: (id: string) => void;
    onError: (error: unknown) => void;
}): Promise<Set<string>> {
    const moved = new Set<string>();
    for (const id of Array.from(new Set(ids))) {
        if (!options.isCurrent()) break;
        try {
            await options.move(id);
        } catch (error) {
            if (!options.isCurrent()) break;
            options.onError(error);
            continue;
        }
        if (!options.isCurrent()) break;
        moved.add(id);
        options.onMoved(id);
    }
    return moved;
}
