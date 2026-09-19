import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMessageMediaUpload, MESSAGE_MEDIA_LIMITS, validateMessageMediaFile } from '../message-campaign-media';
import { planMessageCampaignCreation } from '../message-campaign-creation';

const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
const mp4 = Buffer.from([0,0,0,0x18,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d]);

test('aceita imagem e vídeo com extensão, MIME e assinatura coerentes', () => {
  assert.equal(validateMessageMediaFile({ fileName:'foto.png', mimeType:'image/png', buffer:png }), 'IMAGE');
  assert.equal(validateMessageMediaFile({ fileName:'video.mp4', mimeType:'video/mp4', buffer:mp4 }), 'VIDEO');
  const media = buildMessageMediaUpload({ unitId:'matriz', uploadId:'draft-1', fileName:'foto.png', mimeType:'image/png', buffer:png, caption:'Olá {{primeiro_nome}}', order:2 });
  assert.equal(media.unitId, 'matriz');
  assert.equal(media.caption, 'Olá {{primeiro_nome}}');
  assert.match(media.storagePath, /^message-campaign-media\/matriz\/draft-1\//);
});

test('rejeita arquivo disfarçado, extensão divergente e excesso de tamanho', () => {
  assert.throws(()=>validateMessageMediaFile({ fileName:'ataque.png', mimeType:'image/png', buffer:Buffer.from('<script>') }), /conteúdo/);
  assert.throws(()=>validateMessageMediaFile({ fileName:'foto.jpg', mimeType:'image/png', buffer:png }), /extensão/);
  assert.throws(()=>validateMessageMediaFile({ fileName:'grande.png', mimeType:'image/png', buffer:Buffer.alloc(MESSAGE_MEDIA_LIMITS.imageBytes+1, 0) }), /máximo 8 MB/);
});

test('campanha preserva a ordem das mídias e limita cinco anexos', () => {
  const base={requestIdempotencyKey:'media-1',unitId:'matriz',name:'Mídias',message:'Olá',contacts:['5511999999999'],createdBy:'admin'};
  const plan=planMessageCampaignCreation({...base,mediaIds:['media-a','media-b','media-a']});
  assert.deepEqual(plan.campaign.mediaIds,['media-a','media-b']);
  assert.throws(()=>planMessageCampaignCreation({...base,mediaIds:['1','2','3','4','5','6']}),/no máximo 5/);
});
