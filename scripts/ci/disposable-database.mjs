/**
 * @description Reject non-explicit, non-local or alternate database targets before initialization.
 * @param {Record<string, string | undefined>} env Explicit process environment.
 * @returns {string} Validated disposable PostgreSQL URL.
 */
export function assertDisposableDatabase(env) {
  const fail = () => { throw new Error('Explicit local disposable test database required.'); };
  if (env.ALLOW_DISPOSABLE_TEST_DB !== '1' || env.NODE_ENV === 'production') fail();
  if (!env.DATABASE_URL || env.DATABASE_URL_TEST !== env.DATABASE_URL) fail();
  if (env.DIRECT_URL && env.DIRECT_URL !== env.DATABASE_URL) fail();
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { fail(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || !/^\/tcp_test_[a-z0-9_]+$/.test(url.pathname)
    || !url.port || url.search || url.hash) fail();
  return env.DATABASE_URL;
}
