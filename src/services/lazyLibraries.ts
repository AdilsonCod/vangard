import { createRetryableLoader } from './retryableLoader';

export const loadXlsx = createRetryableLoader(
  () => import('xlsx'),
  'Não foi possível carregar a biblioteca de planilhas. Verifique sua conexão e tente novamente.',
);

export const loadPdfJs = createRetryableLoader(async () => {
  const [pdfjsLib, workerModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
  ]);
  const workerSrc = (workerModule as { default?: string }).default || workerModule;
  if (typeof workerSrc === 'string') pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  return pdfjsLib;
}, 'Não foi possível carregar o leitor de PDF. Verifique sua conexão e tente novamente.');

export const loadPdfExporter = createRetryableLoader(async () => {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ]);
  return { toCanvas, jsPDF };
}, 'Não foi possível carregar os módulos de exportação de PDF. Verifique sua conexão e tente novamente.');
