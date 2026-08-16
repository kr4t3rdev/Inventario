export type MobileScreen = 'dashboard' | 'sales';

/**
 * @description Handles native back navigation for the authenticated mobile surfaces.
 * @param {MobileScreen} screen - Currently visible surface.
 * @param {(screen: MobileScreen) => void} navigate - Screen state setter.
 * @returns {boolean} Whether the event was consumed by the app.
 */
export function handleMobileBack(screen: MobileScreen, navigate: (screen: MobileScreen) => void): boolean {
  if (screen !== 'sales') return false;
  navigate('dashboard');
  return true;
}
