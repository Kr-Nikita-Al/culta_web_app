import {moveImageBatch} from './moveImageBatch';

test('partial failure preserves failed selection and continues remaining requests', async () => {
    const move = jest.fn(async (id: string) => {if (id === 'b') throw new Error('offline');});
    const onMoved = jest.fn(), onError = jest.fn();
    const moved = await moveImageBatch(['a', 'b', 'c', 'a'], {
        isCurrent: () => true, move, onMoved, onError
    });
    expect(Array.from(moved)).toEqual(['a', 'c']);
    expect(['a', 'b', 'c'].filter(id => !moved.has(id))).toEqual(['b']);
    expect(move.mock.calls.map(call => call[0])).toEqual(['a', 'b', 'c']);
    expect(onMoved.mock.calls.map(call => call[0])).toEqual(['a', 'c']);
    expect(onError).toHaveBeenCalledTimes(1);
});

test.each([false, true])('scope change during request stops the batch, failure=%s', async fail => {
    let current = true;
    const move = jest.fn(async () => {current = false; if (fail) throw new Error('offline');});
    const onMoved = jest.fn(), onError = jest.fn();
    const moved = await moveImageBatch(['a', 'b'], {
        isCurrent: () => current, move, onMoved, onError
    });
    expect(move).toHaveBeenCalledTimes(1);
    expect(moved.size).toBe(0);
    expect(onMoved).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
});
