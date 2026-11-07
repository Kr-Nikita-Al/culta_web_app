import React from 'react';
import {act, render} from '@testing-library/react';
import {useScopedOperation} from './useScopedOperation';
import {imageSessionScope} from '../utils/imageSessionScope';
let operation: ReturnType<typeof useScopedOperation>;
function Probe({scope}: {scope: string}) {operation = useScopedOperation(scope); return null;}

test('duplicate start is blocked synchronously and finish allows retry', () => {
    render(<Probe scope="a"/>);
    let first: ReturnType<typeof operation.begin> = null;
    act(() => {
        first = operation.begin();
        expect(operation.begin()).toBeNull();
    });
    expect(operation.busy).toBe(true);
    act(() => first!.finish());
    expect(operation.busy).toBe(false);
});

test('switching away and back cannot reactivate an old operation', () => {
    const view = render(<Probe scope="a"/>);
    let old: ReturnType<typeof operation.begin> = null;
    act(() => {old = operation.begin();});
    view.rerender(<Probe scope="b"/>);
    view.rerender(<Probe scope="a"/>);
    expect(old!.isCurrent()).toBe(false);
    let next: ReturnType<typeof operation.begin> = null;
    act(() => {next = operation.begin();});
    act(() => old!.finish());
    expect(operation.busy).toBe(true);
    expect(next!.isCurrent()).toBe(true);
    view.unmount();
    expect(next!.isCurrent()).toBe(false);
});

test('credential refresh preserves operation, logout invalidates it', () => {
    const view = render(<Probe scope={imageSessionScope('a', 'old-token')}/>);
    let started: ReturnType<typeof operation.begin> = null;
    act(() => {started = operation.begin();});
    view.rerender(<Probe scope={imageSessionScope('a', 'new-token')}/>);
    expect(started!.isCurrent()).toBe(true);
    expect(operation.busy).toBe(true);
    view.rerender(<Probe scope={imageSessionScope('a', null)}/>);
    expect(started!.isCurrent()).toBe(false);
});
