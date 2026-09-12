import type { Role } from '../types';

export function canUseDemoControls(options: { isDevelopment: boolean; explicitAdminPermission: boolean; role?: Role }): boolean {
  return options.isDevelopment || (options.explicitAdminPermission && options.role === 'ADMIN');
}

export const demoControlsEnabledFor = (role?: Role) => canUseDemoControls({
  isDevelopment: import.meta.env.DEV,
  explicitAdminPermission: import.meta.env.VITE_ENABLE_ADMIN_DEMO_CONTROLS === 'true',
  role,
});
