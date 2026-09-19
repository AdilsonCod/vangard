import { createHash } from 'node:crypto';
import type { MessageCampaignMediaDocument } from './src/services/messageCampaignSchema';

export const MESSAGE_MEDIA_LIMITS = { maxFiles: 5, imageBytes: 8 * 1024 * 1024, videoBytes: 25 * 1024 * 1024 } as const;

const allowed = {
  'image/jpeg': { type: 'IMAGE', extensions: ['jpg', 'jpeg'], signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': { type: 'IMAGE', extensions: ['png'], signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  'image/webp': { type: 'IMAGE', extensions: ['webp'], signatures: [[0x52, 0x49, 0x46, 0x46]] },
  'video/mp4': { type: 'VIDEO', extensions: ['mp4', 'm4v'], signatures: [[0x00, 0x00, 0x00]] },
  'video/webm': { type: 'VIDEO', extensions: ['webm'], signatures: [[0x1a, 0x45, 0xdf, 0xa3]] },
} as const;

export type AllowedMessageMediaMime = keyof typeof allowed;
export type MessageMediaUploadInput = { unitId: string; uploadId: string; fileName: string; mimeType: string; buffer: Buffer; caption?: string; order?: number; createdAt?: string };

const safePart = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
const extensionOf = (name: string) => name.toLowerCase().split('.').pop() || '';

export function validateMessageMediaFile(input: Pick<MessageMediaUploadInput, 'fileName' | 'mimeType' | 'buffer'>) {
  const config = allowed[input.mimeType as AllowedMessageMediaMime];
  if (!config) throw new Error('Formato não suportado. Use JPG, PNG, WebP, MP4 ou WebM.');
  if (!config.extensions.includes(extensionOf(input.fileName) as never)) throw new Error('A extensão do arquivo não corresponde ao formato informado.');
  const limit = config.type === 'IMAGE' ? MESSAGE_MEDIA_LIMITS.imageBytes : MESSAGE_MEDIA_LIMITS.videoBytes;
  if (!input.buffer.length || input.buffer.length > limit) throw new Error(`${config.type === 'IMAGE' ? 'A imagem' : 'O vídeo'} deve ter no máximo ${Math.round(limit / 1024 / 1024)} MB.`);
  if (!config.signatures.some(signature => signature.every((byte, index) => input.buffer[index] === byte))) throw new Error('O conteúdo do arquivo não corresponde ao formato informado.');
  if (input.mimeType === 'image/webp' && input.buffer.subarray(8, 12).toString('ascii') !== 'WEBP') throw new Error('Arquivo WebP inválido.');
  if (input.mimeType === 'video/mp4' && input.buffer.subarray(4, 8).toString('ascii') !== 'ftyp') throw new Error('Arquivo MP4 inválido.');
  return config.type;
}

export function buildMessageMediaUpload(input: MessageMediaUploadInput) {
  const type = validateMessageMediaFile(input);
  const unitId = safePart(input.unitId), uploadId = safePart(input.uploadId);
  if (!unitId || !uploadId) throw new Error('Unidade ou identificação do upload inválida.');
  const id = `media_${createHash('sha256').update(`${unitId}:${uploadId}:${input.fileName}:${input.buffer.length}:${input.buffer.subarray(0, 64).toString('hex')}`).digest('hex').slice(0, 40)}`;
  const extension = extensionOf(input.fileName);
  const storagePath = `message-campaign-media/${unitId}/${uploadId}/${id}.${extension}`;
  const document: MessageCampaignMediaDocument & { uploadId: string; originalName: string; campaignId: '' } = {
    schemaVersion: 1,
    id,
    campaignId: '',
    uploadId,
    unitId,
    type,
    storagePath,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    caption: String(input.caption || '').trim().slice(0, 1024),
    order: Math.max(0, Math.floor(Number(input.order) || 0)),
    originalName: input.fileName.slice(0, 180),
    createdAt: input.createdAt || new Date().toISOString(),
  };
  return document;
}
