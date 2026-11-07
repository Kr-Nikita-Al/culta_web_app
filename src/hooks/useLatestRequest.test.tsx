import React from 'react';
import {render} from '@testing-library/react';
import {useLatestRequest} from './useLatestRequest';
let begin: ReturnType<typeof useLatestRequest>;
function Probe({scope}: {scope: string}) {begin = useLatestRequest(scope); return null;}
test('only newest request may update state', () => {
    render(<Probe scope="a"/>);
    const old = begin(); const latest = begin();
    expect(old()).toBe(false); expect(latest()).toBe(true);
});
test('scope switch back and unmount invalidate requests', () => {
    const view = render(<Probe scope="a"/>);
    const old = begin();
    view.rerender(<Probe scope="b"/>); view.rerender(<Probe scope="a"/>);
    expect(old()).toBe(false);
    const latest = begin(); expect(latest()).toBe(true);
    view.unmount(); expect(latest()).toBe(false);
});
test('request starter remains stable across rerenders while scope guards stay current',()=>{
    const view=render(<Probe scope="a"/>);
    const original=begin;
    const old=begin();
    view.rerender(<Probe scope="b"/>);
    expect(begin).toBe(original);
    expect(old()).toBe(false);
    expect(begin()()).toBe(true);
});
