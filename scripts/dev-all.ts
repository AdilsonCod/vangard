import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Executar o Node diretamente evita npm.cmd/shell no Windows e processos netos.
const children = ['../server.ts', '../message-service-server.ts'].map(entry =>
  spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL(entry, import.meta.url))], {
    stdio: 'inherit',
    env: process.env,
  }),
);

const shutdown = () => children.forEach(child => child.kill());
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
children.forEach(child => child.on('error', error => {
  console.error('Falha ao iniciar serviço local:', error.message);
  process.exitCode = 1;
  shutdown();
}));
children.forEach(child => child.on('exit', code => {
  if (typeof code === 'number' && code !== 0) process.exitCode = code;
  shutdown();
}));
