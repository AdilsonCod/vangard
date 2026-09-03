const text = `
Data: 03/08/2026
1030
46745
R$ 40.453,00
40,00%
R$ 16.181,20
R$ 16.181,20 (40,00%)
R$ 24.271,80 (60,00%)
1030
46745
R$ 40.453,00 (100,00%)
R$ 16.181,20 (40,00%)
R$ 24.271,80 (60,00%)
Denis Lima Santiago
Comissão total
R$ 1.550,79 (9,58%)
Quantidade Fichas
28 1120
18 540
13 910
8 120
11 660
19 950
12 180
109 4480
Kildery silva
Comissão total
R$ 2.526,96 (15,62%)
Quantidade Fichas
23 920
23 690
35 2450
10 150
23 1380
30 1500
14 210
158 7300
Samuel
Comissão total
R$ 2.217,15 (13,7%)
`;

// Usually pdfjs returns items. Let's write a regex/state machine parser.
function parseDPote(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  let totalAssinaturas = 0;
  let potPercentage = 0;
  
  // Find "Valor total das assinaturas"
  // Wait, the OCR says "R$ 40.453,00" right after "46745". But in pdfjs, items could be out of order or exactly in this order.
  // We can look for "R$" and percentages.
  // Actually, the OCR is from the screenshot.
  // The screenshot shows:
  // Informações gerais
  // Quantidade de serviços realizados  1030
  // Quantidade total de fichas         46745
  // Valor total das assinaturas        R$ 40.453,00
  // % do pote                          40,00%
  // Valor do pote                      R$ 16.181,20
  
  // Since pdfjs returns items, they might be:
  // "Quantidade de serviços realizados", "1030"
  // Or "Quantidade de serviços realizados 1030"
  // Let's assume we can find a string "R$ 40.453,00" for "Valor total das assinaturas".
  // Let's create a robust parser based on pdf.js output.
}
