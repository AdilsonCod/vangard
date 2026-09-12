import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = ['dev', 'dev:messages'].map(script => spawn(npm, ['run', script], { stdio: 'inherit', env: process.env }));

const shutdown = () => children.forEach(child => child.kill());
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
children.forEach(child => child.on('exit', code => {
  if (typeof code === 'number' && code !== 0) process.exitCode = code;
  shutdown();
}));
