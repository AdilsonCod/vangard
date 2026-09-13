export const DEFAULT_LIGHT_LOGO = '/logo-escura.png';
export const DEFAULT_DARK_LOGO = '/logo-clara.png';
export const MAX_LOGO_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_LOGO_DIMENSION = 1200;
export const MAX_STORED_LOGO_BYTES = 900 * 1024;

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateLogoFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) return 'Use uma imagem PNG, JPG ou WebP.';
  if (file.size > MAX_LOGO_FILE_BYTES) return 'A imagem deve ter no máximo 3 MB.';
  return null;
}

export async function prepareLogoImage(file: File): Promise<string> {
  const validationError = validateLogoFile(file);
  if (validationError) throw new Error(validationError);
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    await image.decode();
    let scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu processar a imagem.');
    let result = '';
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL('image/webp', Math.max(0.6, 0.9 - attempt * 0.06));
      const encodedBytes = Math.ceil((result.length - result.indexOf(',') - 1) * 0.75);
      if (encodedBytes <= MAX_STORED_LOGO_BYTES) return result;
      scale *= 0.75;
    }
    throw new Error('A imagem é muito complexa para ser salva. Escolha uma versão mais leve.');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('O navegador')) throw error;
    throw new Error('Não foi possível ler a imagem selecionada.');
  } finally {
    URL.revokeObjectURL(source);
  }
}
