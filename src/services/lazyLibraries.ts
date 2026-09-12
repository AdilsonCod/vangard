/**
 * Utilitários para carregamento sob demanda de bibliotecas pesadas
 * (XLSX, PDF.js, jsPDF, html-to-image), reduzindo o custo do bundle inicial.
 */

let xlsxPromise: Promise<typeof import('xlsx')> | null = null;
export async function loadXlsx(): Promise<typeof import('xlsx')> {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx').catch((err) => {
      xlsxPromise = null;
      console.error('Falha ao carregar XLSX:', err);
      throw new Error('Não foi possível carregar a biblioteca de planilhas. Verifique sua conexão e tente novamente.');
    });
  }
  return xlsxPromise;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;
export async function loadPdfJs(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      try {
        const [pdfjsLib, workerModule] = await Promise.all([
          import('pdfjs-dist/legacy/build/pdf.mjs'),
          import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
        ]);

        const workerSrc = (workerModule as { default?: string }).default || workerModule;
        if (typeof workerSrc === 'string') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        }

        return pdfjsLib;
      } catch (err) {
        pdfjsPromise = null;
        console.error('Falha ao carregar PDF.js:', err);
        throw new Error('Não foi possível carregar o leitor de PDF. Verifique sua conexão e tente novamente.');
      }
    })();
  }
  return pdfjsPromise;
}

let pdfExporterPromise: Promise<{
  toCanvas: typeof import('html-to-image').toCanvas;
  jsPDF: typeof import('jspdf').jsPDF;
}> | null = null;

export async function loadPdfExporter() {
  if (!pdfExporterPromise) {
    pdfExporterPromise = (async () => {
      try {
        const [{ toCanvas }, { jsPDF }] = await Promise.all([
          import('html-to-image'),
          import('jspdf'),
        ]);
        return { toCanvas, jsPDF };
      } catch (err) {
        pdfExporterPromise = null;
        console.error('Falha ao carregar exportadores de PDF:', err);
        throw new Error('Não foi possível carregar os módulos de exportação de PDF. Verifique sua conexão e tente novamente.');
      }
    })();
  }
  return pdfExporterPromise;
}
