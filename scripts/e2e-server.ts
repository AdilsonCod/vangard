process.env.VITE_ENABLE_E2E_SESSION = 'true';
process.env.PORT = process.env.PORT || '4174';
process.env.DISABLE_HMR = 'true';
await import('../server');
