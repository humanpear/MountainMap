import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleSignInDialog } from './GoogleSignInDialog';

const authMocks = vi.hoisted(() => ({
  createGoogleNonce: vi.fn(),
  loadGoogleIdentityScript: vi.fn(),
  signInWithIdToken: vi.fn()
}));

vi.mock('../services/env', () => ({
  env: { googleClientId: 'google-client-id.apps.googleusercontent.com' },
  isGoogleIdentityConfigured: true,
  isSupabaseConfigured: true
}));

vi.mock('../services/googleIdentity', () => ({
  createGoogleNonce: authMocks.createGoogleNonce,
  loadGoogleIdentityScript: authMocks.loadGoogleIdentityScript
}));

vi.mock('../services/supabase', () => ({
  supabase: { auth: { signInWithIdToken: authMocks.signInWithIdToken } }
}));

describe('GoogleSignInDialog', () => {
  let credentialCallback: ((response: GoogleCredentialResponse) => void) | undefined;
  let googleButtonClick: (() => void) | undefined;
  const initialize = vi.fn((configuration: GoogleIdentityIdConfiguration) => {
    credentialCallback = configuration.callback;
  });
  const renderButton = vi.fn((parent: HTMLElement, configuration: GoogleIdentityButtonConfiguration) => {
    googleButtonClick = configuration.click_listener;
    const button = document.createElement('button');
    button.textContent = 'Google 공식 로그인';
    button.addEventListener('click', () => configuration.click_listener?.());
    parent.append(button);
  });
  const googleIdentity = {
    accounts: { id: { initialize, renderButton, disableAutoSelect: vi.fn() } }
  } satisfies GoogleIdentityServices;

  beforeEach(() => {
    credentialCallback = undefined;
    googleButtonClick = undefined;
    initialize.mockClear();
    renderButton.mockClear();
    authMocks.createGoogleNonce.mockReset().mockResolvedValue({
      rawNonce: 'raw-nonce',
      hashedNonce: 'hashed-nonce'
    });
    authMocks.loadGoogleIdentityScript.mockReset().mockResolvedValue(googleIdentity);
    authMocks.signInWithIdToken.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  it('initializes once in Strict Mode and exchanges the original credential with the raw nonce', async () => {
    const onSuccess = vi.fn();
    render(
      <StrictMode>
        <GoogleSignInDialog isOpen onClose={vi.fn()} onSuccess={onSuccess} />
      </StrictMode>
    );

    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      client_id: 'google-client-id.apps.googleusercontent.com',
      ux_mode: 'popup',
      nonce: 'hashed-nonce'
    }));
    expect(renderButton).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: 'ko',
      width: 280
    }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('max-w-[392px]', 'px-4', 'sm:px-8');
    expect(screen.getByRole('heading', { name: '산행 기록을 계속 이어가세요' })).toHaveClass(
      'text-xl',
      'sm:text-[22px]'
    );
    expect(screen.getByText('봉우리모아')).toHaveClass('font-bold', 'text-black');
    expect(document.querySelector('img[src="/logo-mountain.png"]')).toBeInTheDocument();
    expect(screen.getByText(/어디서든 안전하게 확인할 수 있어요/)).toBeInTheDocument();
    expect(screen.queryByText(/이용약관|개인정보처리방침/)).not.toBeInTheDocument();
    const googleButtonFrame = screen.getByText('Google 공식 로그인').parentElement;
    expect(googleButtonFrame).toHaveClass(
      'shadow-[0_0_16px_2px_rgba(6,38,58,0.16)]'
    );
    expect(googleButtonFrame?.parentElement).not.toHaveClass('overflow-hidden');

    fireEvent.click(screen.getByText('Google 공식 로그인'));
    expect(screen.getByRole('status')).toHaveTextContent('Google 로그인 처리 중');

    await act(async () => {
      credentialCallback?.({ credential: 'google-id-token', select_by: 'btn' });
      await Promise.resolve();
    });
    expect(authMocks.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
      nonce: 'raw-nonce'
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty Google credential without calling Supabase', async () => {
    render(<GoogleSignInDialog isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(credentialCallback).toBeTypeOf('function'));

    await act(async () => {
      credentialCallback?.({ credential: '' });
      await Promise.resolve();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Google 인증 정보가 올바르지 않습니다.');
    expect(authMocks.signInWithIdToken).not.toHaveBeenCalled();
  });
});
