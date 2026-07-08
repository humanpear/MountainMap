import { env } from './env';

export const normalizeOAuthRedirectUrl = (url: string | undefined) => {
  const trimmedUrl = url?.trim();

  if (!trimmedUrl) {
    return undefined;
  }

  const urlWithProtocol = /^https?:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  try {
    const parsedUrl = new URL(urlWithProtocol);
    if (parsedUrl.hostname === 'supabase.co' || parsedUrl.hostname.endsWith('.supabase.co')) {
      return undefined;
    }
    return `${parsedUrl.origin}/`;
  } catch {
    return undefined;
  }
};

export const getOAuthRedirectUrl = (fallbackOrigin = window.location.origin) => {
  return (
    normalizeOAuthRedirectUrl(env.siteUrl) ??
    normalizeOAuthRedirectUrl(env.vercelUrl) ??
    normalizeOAuthRedirectUrl(fallbackOrigin) ??
    fallbackOrigin
  );
};
