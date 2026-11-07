import {deleteImageBatch} from './deleteImageBatch';

test('partial failure preserves failed selection and continues remaining requests', async () => {
    const remove = jest.fn(async (id: string) => {if (id === 'b') throw new Error('offline');});
    const onDeleted = jest.fn(), onError = jest.fn();
    const deleted = await deleteImageBatch(['a', 'b', 'c', 'a'], {
        isCurrent: () => true, remove, onDeleted, onError
    });
    expect(Array.from(deleted)).toEqual(['a', 'c']);
    expect(['a', 'b', 'c'].filter(id => !deleted.has(id))).toEqual(['b']);
    expect(remove.mock.calls.map(call => call[0])).toEqual(['a', 'b', 'c']);
    expect(onDeleted.mock.calls.map(call => call[0])).toEqual(['a', 'c']);
    expect(onError).toHaveBeenCalledTimes(1);
});

test.each([false, true])('scope change during request stops the batch, failure=%s', async fail => {
    let current = true;
    const remove = jest.fn(async () => {current = false; if (fail) throw new Error('offline');});
    const onDeleted = jest.fn(), onError = jest.fn();
    const deleted = await deleteImageBatch(['a', 'b'], {
        isCurrent: () => current, remove, onDeleted, onError
    });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(deleted.size).toBe(0);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
});
