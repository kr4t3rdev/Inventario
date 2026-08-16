import { describe, expect, it, vi } from 'vitest';
import { handleMobileBack } from './mobile-navigation';

describe('mobile native navigation', () => {
  it('returns from sales to dashboard and consumes the back event', () => {
    const navigate = vi.fn();

    expect(handleMobileBack('sales', navigate)).toBe(true);
    expect(navigate).toHaveBeenCalledWith('dashboard');
  });

  it('leaves the dashboard back event to the operating system', () => {
    expect(handleMobileBack('dashboard', vi.fn())).toBe(false);
  });
});
