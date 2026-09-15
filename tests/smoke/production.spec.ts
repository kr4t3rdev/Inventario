import { test, expect } from '@playwright/test';

// HTTP-only public checks: no browser scripts, login, storage state or mutations.
for (const path of ['/', '/login']) {
  test(`public smoke GET ${path}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(await response.text()).toMatch(/<html/i);
  });
}
