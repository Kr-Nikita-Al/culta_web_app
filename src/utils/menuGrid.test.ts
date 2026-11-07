import {packGrid,swapGrid} from './menuGrid';
test('normalizes arbitrary overlapping positions to two columns',()=>{
    const result=packGrid([{key:'a',x:99,y:99},{key:'b',x:99,y:99},{key:'c',x:0,y:500}]);
    expect(new Set(result.map(i=>`${i.x}:${i.y}`)).size).toBe(3);
    expect(result.every(i=>[12,164].includes(i.x)&&(i.y-12)%152===0)).toBe(true);
});
test('occupied cell swaps with source, without overlap',()=>{
    const items=[{key:'a',x:12,y:12},{key:'b',x:164,y:12},{key:'c',x:12,y:164}];
    const moved=swapGrid(items,'a',164,12);
    expect(moved.find(i=>i.key==='a')).toEqual({key:'a',x:164,y:12});
    expect(moved.find(i=>i.key==='b')).toEqual({key:'b',x:12,y:12});
    expect(new Set(moved.map(i=>`${i.x}:${i.y}`)).size).toBe(3);
});
test('empty target keeps a gap through normalization and reload',()=>{
    const moved=swapGrid([{key:'a',x:12,y:12},{key:'b',x:164,y:12}],'a',164,468);
    expect(moved.find(i=>i.key==='a')).toEqual({key:'a',x:164,y:468});
    expect(packGrid(moved)).not.toContainEqual(expect.objectContaining({x:12,y:12}));
});
