import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SVAOverview } from '../src/components/SVAOverview';
import '../src/index.css';
function Preview() {
 const [unit,setUnit] = useState('A'); const [date,setDate] = useState(new Date(2026,8,1));
 const days = Array.from({length:30},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,units:{A:{servicos:i<5?5600:null,produtos:i<5?800:null,assinaturas:i<5?2000:null,isFilled:i<5,isNonWorkingDay:false}}}));
 return <div style={{padding:16, maxWidth:1400, margin:'auto'}}><SVAOverview days={days} units={['A']} settings={{id:'2026-09',metaGeral:200000,units:{A:{metaMensal:200000,metaQuinzenal:100000,diasNaoUteisMensal:5,diasNaoUteisQuinzenal:2}}}} unit={unit} setUnit={setUnit} unitName={()=>'Matriz'} date={date} setDate={setDate} edit={()=>{}} adjust={()=>{}} /></div>;
} createRoot(document.getElementById('root')!).render(<Preview/>);
