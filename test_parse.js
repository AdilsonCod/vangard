const fs = require('fs');

const ocrText = `1
Vangard
Eusébio
Kaio Feitosa
Categoria Quantidade Produto
Valor
unidade Total
Total
vendido Comissão
Cosméticos
1
1
1
1
MATTE CLAY -
BABOON
shampoo barba
urbana(Preto)
ULTRA HOLD-BABOON
shampoo barba
urbana(branco)
R$ 98,00
R$ 80,00
R$ 98,00
R$ 80,00
R$ 98,00
R$ 59,50
R$ 98,00
R$ 70,00
R$ 325,50 R$ 22,79
Cosméticos
Avant
1 Iron hold R$ 78,00 R$ 70,00 R$ 70,00 R$ 14,00`;

// We can see from the OCR text that the values are somewhat grouped by column.
// "Cosméticos" -> then all quantities -> then all products -> then all unit prices -> then all totals -> then total vendido -> then comissao.
