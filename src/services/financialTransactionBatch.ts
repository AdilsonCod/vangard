export function financialTransactionBatchId(operationId: string, rowIndex: number, installmentIndex: number, editingId?: string | null) {
  if (editingId) return editingId;
  return `trans_${operationId}_${rowIndex + 1}_${installmentIndex + 1}`;
}

export function financialTransactionInstallmentCount(input: { recurrence?: string; installments?: number }, editingId?: string | null) {
  if (editingId) return 1;
  return input.recurrence !== 'NONE' && Number(input.installments) > 1 ? Math.floor(Number(input.installments)) : 1;
}
