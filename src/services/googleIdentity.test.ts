import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Google Identity Services loader', () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.google;
    document.querySelectorAll('script[data-google-identity-script]').forEach((script) => script.remove());
  });

  it('loads the GIS script once for concurrent callers', async () => {
    const { loadGoogleIdentityScript } = await import('./googleIdentity');
    const firstLoad = loadGoogleIdentityScript();
    const secondLoad = loadGoogleIdentityScript();
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-google-identity-script]');

    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('https://accounts.google.com/gsi/client');

    const googleIdentity = {
      accounts: {
        id: {
          initialize: vi.fn(),
          renderButton: vi.fn(),
          disableAutoSelect: vi.fn()
        }
      }
    } satisfies GoogleIdentityServices;
    window.google = googleIdentity;
    scripts[0].dispatchEvent(new Event('load'));

    await expect(firstLoad).resolves.toBe(googleIdentity);
    await expect(secondLoad).resolves.toBe(googleIdentity);
  });

  it('removes a failed script so a later attempt can retry', async () => {
    const { loadGoogleIdentityScript } = await import('./googleIdentity');
    const failedLoad = loadGoogleIdentityScript();
    document.querySelector<HTMLScriptElement>('script[data-google-identity-script]')
      ?.dispatchEvent(new Event('error'));

    await expect(failedLoad).rejects.toThrow('Failed to load Google Identity Services.');
    expect(document.querySelector('script[data-google-identity-script]')).toBeNull();

    void loadGoogleIdentityScript();
    expect(document.querySelectorAll('script[data-google-identity-script]')).toHaveLength(1);
  });
});

describe('Google nonce', () => {
  it('creates a raw nonce and its SHA-256 hexadecimal representation', async () => {
    const digest = vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, index) => { bytes[index] = index; });
        return bytes;
      },
      subtle: { digest }
    });
    const { createGoogleNonce } = await import('./googleIdentity');
    const nonce = await createGoogleNonce();

    expect(nonce.rawNonce).toBe(btoa(String.fromCharCode(...new Uint8Array(32).map((_, index) => index))));
    expect(nonce.hashedNonce).toBe('ab'.repeat(32));
    expect(digest).toHaveBeenCalledWith('SHA-256', new TextEncoder().encode(nonce.rawNonce));

    vi.unstubAllGlobals();
  });
});
