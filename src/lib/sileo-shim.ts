// Shim to make sileo available globally for components that use it without importing
import { sileo } from 'sileo'

// Make available on window for runtime
if (typeof window !== 'undefined') {
  // @ts-ignore - intentionally making sileo available globally
  window.sileo = sileo
}

// Re-export for imports
export { sileo }
