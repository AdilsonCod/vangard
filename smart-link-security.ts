import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

type Address = { address: string };
type Resolver = (hostname: string) => Promise<Address[]>;

const privateIpv4 = (address: string) => {
  const p = address.split('.').map(Number);
  return p.length !== 4 || p.some(value => !Number.isInteger(value) || value < 0 || value > 255) ||
    p[0] === 0 || p[0] === 10 || p[0] === 127 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || (p[0] === 198 && (p[1] === 18 || p[1] === 19)) ||
    p[0] >= 224;
};

const privateIpv6 = (address: string) => {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized.startsWith('::ffff:')) return privateIpv4(normalized.slice(7));
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') ||
    normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') ||
    normalized.startsWith('ff');
};

export const isPrivateNetworkAddress = (address: string) => address.includes(':') ? privateIpv6(address) : privateIpv4(address);

const defaultResolver: Resolver = async hostname => isIP(hostname) ? [{ address: hostname }] : lookup(hostname, { all: true });

export async function assertSafePublicUrl(raw: string, resolve: Resolver = defaultResolver) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Informe uma URL válida.'); }
  if (url.protocol !== 'https:') throw new Error('Somente URLs HTTPS são permitidas.');
  if (url.username || url.password) throw new Error('URLs com credenciais não são permitidas.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('Destinos internos não são permitidos.');
  const addresses = await resolve(hostname);
  if (!addresses.length || addresses.some(item => isPrivateNetworkAddress(item.address))) throw new Error('Destinos internos não são permitidos.');
  return url;
}
