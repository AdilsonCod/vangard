import { useState, useMemo } from 'react';

export function usePagination<T>(data: T[], itemsPerPage: number = 50) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(data.length / itemsPerPage);
  
  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);

  const nextPage = () => setCurrentPage(p => Math.min(p + 1, totalPages));
  const prevPage = () => setCurrentPage(p => Math.max(p - 1, 1));
  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  // Reseta para a página 1 sempre que o tamanho dos dados mudar (ex: aplicar filtros)
  useMemo(() => setCurrentPage(1), [data.length]);

  return {
    currentPage,
    totalPages,
    currentData,
    nextPage,
    prevPage,
    goToPage,
    totalItems: data.length
  };
}
