import React from 'react';
export function StatisticsChart({title,values,labels,unit='',bars=false}:{title:string;values:number[];labels:string[];unit?:string;bars?:boolean}) {
    const max=Math.max(1,...values),step=values.length>1?520/(values.length-1):0;
    return <article className="statistics-chart"><h2>{title}</h2>{values.length?<>
        <svg viewBox="0 0 600 200" role="img" aria-label={title}>
            {[0,.5,1].map(r=><g key={r}><line x1="40" x2="560" y1={160-r*125} y2={160-r*125} stroke="#e3e8e1"/><text x="40" y={152-r*125}>{(max*r).toLocaleString('ru-RU',{maximumFractionDigits:1})} {unit}</text></g>)}
            {bars?values.map((v,i)=><rect key={i} x={40+i*520/values.length} y={160-v/max*125} width={Math.max(1,480/values.length)} height={v/max*125} rx="2" fill="#839b75"><title>{labels[i]}: {v} {unit}</title></rect>):<><polyline points={values.map((v,i)=>`${40+i*step},${160-v/max*125}`).join(' ')} fill="none" stroke="#537b65" strokeWidth="3"/>{values.length===1&&<circle cx="40" cy={160-values[0]/max*125} r="4" fill="#537b65"/>}</>}
            <text x="40" y="187">{labels[0]}</text><text x="560" y="187" textAnchor="end">{labels.length>1?labels[labels.length-1]:''}</text>
        </svg>{values.every(v=>v===0)&&<p className="statistics-note">За выбранный период данных нет.</p>}
        <details><summary>Данные графика</summary><div className="statistics-data">{values.map((v,i)=><div key={i}><span>{labels[i]}</span><strong>{v.toLocaleString('ru-RU')} {unit}</strong></div>)}</div></details>
    </>:<p>Нет данных.</p>}</article>;
}
export function StatisticsBars({title,rows}:{title:string;rows:{name:string;value:number}[]}) {
    const max=Math.max(1,...rows.map(r=>r.value));
    return <article className="statistics-chart"><h2>{title}</h2>{rows.length?rows.map(r=><div className="statistics-bar" key={r.name}><div><span>{r.name}</span><strong>{r.value.toLocaleString('ru-RU')}</strong></div><div className="statistics-track"><div style={{width:`${r.value/max*100}%`}}/></div></div>):<p>Нет данных.</p>}</article>;
}
