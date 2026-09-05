import React from 'react';
import {createRoot} from 'react-dom/client';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis} from 'recharts';
import '../src/index.css';
createRoot(document.getElementById('root')!).render(<div className="app-main-content" style={{padding:24}}><div style={{height:200,width:'100%'}}><ResponsiveContainer width="100%" height="100%"><BarChart data={[{name:'Jan',value:100},{name:'Fev',value:200}]}><XAxis dataKey="name"/><YAxis/><Bar dataKey="value" fill="#00aa88" isAnimationActive={false}/></BarChart></ResponsiveContainer></div></div>);
