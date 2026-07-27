const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_IDENTITY_SCRIPT_ATTRIBUTE = 'data-google-identity-script';

let googleIdentityScriptPromise: Promise<GoogleIdentityServices> | null = null;

function getLoadedGoogleIdentity() {
  return window.google?.accounts?.id ? window.google : null;
}

export function loadGoogleIdentityScript(): Promise<GoogleIdentityServices> {
  const loadedGoogleIdentity = getLoadedGoogleIdentity();
  if (loadedGoogleIdentity) {
    return Promise.resolve(loadedGoogleIdentity);
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[${GOOGLE_IDENTITY_SCRIPT_ATTRIBUTE}]`
    );
    const script = existingScript ?? document.createElement('script');

    const handleLoad = () => {
      const googleIdentity = getLoadedGoogleIdentity();
      if (googleIdentity) {
        resolve(googleIdentity);
        return;
      }

      googleIdentityScriptPromise = null;
      script.remove();
      reject(new Error('Google Identity Services did not initialize.'));
    };
    const handleError = () => {
      googleIdentityScriptPromise = null;
      script.remove();
      reject(new Error('Failed to load Google Identity Services.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.src = GOOGLE_IDENTITY_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.setAttribute(GOOGLE_IDENTITY_SCRIPT_ATTRIBUTE, 'true');
      document.head.append(script);
    }
  });

  return googleIdentityScriptPromise;
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createGoogleNonce() {
  const rawNonce = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const encodedNonce = new TextEncoder().encode(rawNonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce);

  return {
    rawNonce,
    hashedNonce: bytesToHex(new Uint8Array(hashBuffer))
  };
}
