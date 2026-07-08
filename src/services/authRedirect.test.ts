import { describe, expect, it } from 'vitest';
import { normalizeOAuthRedirectUrl } from './authRedirect';

describe('normalizeOAuthRedirectUrl', () => {
  it('normalizes a configured production host to an HTTPS root URL', () => {
    expect(normalizeOAuthRedirectUrl('mountain-map.vercel.app')).toBe('https://mountain-map.vercel.app/');
  });

  it('keeps localhost protocol and adds a root slash', () => {
    expect(normalizeOAuthRedirectUrl('http://localhost:5173')).toBe('http://localhost:5173/');
  });

  it('drops paths so Supabase redirects back to the app root', () => {
    expect(normalizeOAuthRedirectUrl('https://mountain-map.vercel.app/some/path')).toBe(
      'https://mountain-map.vercel.app/'
    );
  });

  it('rejects Supabase project URLs as user-facing app redirects', () => {
    expect(normalizeOAuthRedirectUrl('https://example.supabase.co/auth/v1/callback')).toBeUndefined();
  });

  it('ignores invalid values', () => {
    expect(normalizeOAuthRedirectUrl('not a valid url')).toBeUndefined();
  });
});
