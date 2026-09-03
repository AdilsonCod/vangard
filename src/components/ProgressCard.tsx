import React from 'react';

interface ProgressCardProps {
  label: string;
  total: number;
  target: number;
}

export function ProgressCard({ label, total, target }: ProgressCardProps) {
  const percent = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const missing = Math.max(0, target - total);
  
  return (
    <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-700 dark:text-zinc-300">{label}</h3>
        <span className="text-sm font-bold px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
          {percent}%
        </span>
      </div>
      
      <div className="flex items-end gap-2 mb-4">
        <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">R$ {total.toFixed(2)}</p>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mb-1">/ R$ {target.toFixed(2)}</p>
      </div>
      
      <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-2.5 mb-2 overflow-hidden">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      
      {missing > 0 ? (
        <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
          Faltam <span className="text-gray-900 dark:text-zinc-100 font-bold">R$ {missing.toFixed(2)}</span> para o objetivo
        </p>
      ) : (
        <p className="text-xs text-blue-600 font-bold gap-1 flex items-center">
           Objetivo atingido!
        </p>
      )}
    </div>
  );
}
