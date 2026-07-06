import { describe, expect, it } from 'vitest';
import { normalizeOAuthRedirectUrl } from './authRedirect';

describe('normalizeOAuthRedirectUrl', () => {
  it('normalizes a configured production host to an HTTPS root URL', () => {
    expect(normalizeOAuthRedirectUrl('mountian-map.vercel.app')).toBe('https://mountian-map.vercel.app/');
  });

  it('keeps localhost protocol and adds a root slash', () => {
    expect(normalizeOAuthRedirectUrl('http://localhost:5173')).toBe('http://localhost:5173/');
  });

  it('drops paths so Supabase redirects back to the app root', () => {
    expect(normalizeOAuthRedirectUrl('https://mountian-map.vercel.app/some/path')).toBe(
      'https://mountian-map.vercel.app/'
    );
  });

  it('ignores invalid values', () => {
    expect(normalizeOAuthRedirectUrl('not a valid url')).toBeUndefined();
  });
});
