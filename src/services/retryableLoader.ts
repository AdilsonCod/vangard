/** Compartilha carregamentos simultâneos e permite tentar novamente após falha. */
export function createRetryableLoader<T>(load: () => Promise<T>, message: string): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = Promise.resolve().then(load).catch((cause: unknown) => {
        pending = null;
        throw new Error(message, { cause });
      });
    }
    return pending;
  };
}
