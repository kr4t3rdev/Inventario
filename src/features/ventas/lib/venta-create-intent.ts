/** State for one sale-create intent across ambiguous transport failures. */
export interface VentaCreateIntent {
  key: string | null;
}

/**
 * @description Reuses the pending key or creates one for a new sale intent.
 * @param {VentaCreateIntent} intent - Mutable ref-backed intent state.
 * @param {() => string} createKey - Key generator, defaulting to a UUID.
 * @returns {string} Stable idempotency key for this intent.
 */
export function getVentaCreateIntentKey(
  intent: VentaCreateIntent,
  createKey: () => string = () => crypto.randomUUID(),
): string {
  intent.key ??= createKey();
  return intent.key;
}

/**
 * @description Clears a completed or explicitly abandoned sale intent.
 * @param {VentaCreateIntent} intent - Mutable ref-backed intent state.
 * @returns {void} No return value.
 */
export function resetVentaCreateIntent(intent: VentaCreateIntent): void {
  intent.key = null;
}
