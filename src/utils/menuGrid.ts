export const gridPoint=(index:number)=>({x:12+(index%2)*152,y:12+Math.floor(index/2)*152});
export const gridIndex=(x:number,y:number)=>Math.max(0,Math.min(12,Math.round((y-12)/152)))*2+Math.max(0,Math.min(1,Math.round((x-12)/152)));
export function firstFreeCell(items:{x:number;y:number}[]){
    const used=new Set(items.map(i=>gridIndex(i.x,i.y)));
    for(let index=0;index<26;index++)if(!used.has(index))return gridPoint(index);
    return null;
}
// Preserve empty cells. Only legacy off-grid/duplicate placements are repaired.
export function packGrid<T extends {x:number;y:number}>(items:T[]):T[]{
    const used=new Set<number>();
    return [...items].sort((a,b)=>a.y-b.y||a.x-b.x).map(item=>{
        let index=gridIndex(item.x,item.y);
        if(used.has(index)){index=0;while(used.has(index))index++;}
        used.add(index);return {...item,...gridPoint(index)};
    });
}
export function swapGrid<T extends {key:string;x:number;y:number}>(items:T[],key:string,x:number,y:number):T[]{
    const ordered=packGrid(items),source=ordered.find(i=>i.key===key);
    if(!source)return ordered;
    const target=gridPoint(gridIndex(x,y));
    return ordered.map(item=>item.key===key?{...item,...target}:
        item.x===target.x&&item.y===target.y?{...item,x:source.x,y:source.y}:item);
}
