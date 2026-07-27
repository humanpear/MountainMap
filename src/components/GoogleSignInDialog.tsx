import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { env, isGoogleIdentityConfigured, isSupabaseConfigured } from '../services/env';
import { createGoogleNonce, loadGoogleIdentityScript } from '../services/googleIdentity';
import { supabase } from '../services/supabase';

type GoogleSignInDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const googleButtonOptions: GoogleIdentityButtonConfiguration = {
  type: 'standard',
  theme: 'outline',
  size: 'large',
  text: 'signin_with',
  shape: 'rectangular',
  logo_alignment: 'left',
  locale: 'ko'
};

export function GoogleSignInDialog({ isOpen, onClose, onSuccess }: GoogleSignInDialogProps) {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const signInPhaseRef = useRef<'idle' | 'google' | 'supabase'>('idle');
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initializationAttempt, setInitializationAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen || !isGoogleIdentityConfigured || !isSupabaseConfigured || !supabase) {
      return;
    }

    const supabaseClient = supabase;
    let isActive = true;
    setIsScriptReady(false);
    setErrorMessage(null);

    const initializeGoogleButton = async () => {
      try {
        const [googleIdentity, nonce] = await Promise.all([
          loadGoogleIdentityScript(),
          createGoogleNonce()
        ]);
        if (!isActive || !buttonContainerRef.current) {
          return;
        }

        const handleCredentialResponse = async (response: GoogleCredentialResponse) => {
          if (!response.credential) {
            signInPhaseRef.current = 'idle';
            setIsSigningIn(false);
            setErrorMessage('Google 인증 정보가 올바르지 않습니다.');
            return;
          }

          signInPhaseRef.current = 'supabase';
          setIsSigningIn(true);
          setErrorMessage(null);

          try {
            const { error } = await supabaseClient.auth.signInWithIdToken({
              provider: 'google',
              token: response.credential,
              nonce: nonce.rawNonce
            });
            if (error) {
              throw error;
            }

            signInPhaseRef.current = 'idle';
            setIsSigningIn(false);
            onSuccess();
          } catch (error) {
            console.error('Supabase Google ID token sign-in failed.', error);
            signInPhaseRef.current = 'idle';
            setIsSigningIn(false);
            setErrorMessage('로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
          }
        };

        googleIdentity.accounts.id.initialize({
          client_id: env.googleClientId!,
          callback: handleCredentialResponse,
          ux_mode: 'popup',
          nonce: nonce.hashedNonce
        });

        buttonContainerRef.current.replaceChildren();
        const availableButtonWidth = Math.floor(buttonContainerRef.current.getBoundingClientRect().width);
        googleIdentity.accounts.id.renderButton(buttonContainerRef.current, {
          ...googleButtonOptions,
          width: Math.min(280, availableButtonWidth || 280),
          click_listener: () => {
            signInPhaseRef.current = 'google';
            setIsSigningIn(true);
            setErrorMessage(null);
          }
        });
        setIsScriptReady(true);
      } catch (error) {
        if (!isActive) {
          return;
        }
        console.error('Google Identity Services initialization failed.', error);
        setErrorMessage('Google 로그인 정보를 불러오지 못했습니다.');
      }
    };

    void initializeGoogleButton();

    return () => {
      isActive = false;
      buttonContainerRef.current?.replaceChildren();
    };
  }, [initializationAttempt, isOpen, onSuccess]);

  useEffect(() => {
    if (!isSigningIn || signInPhaseRef.current !== 'google') {
      return;
    }

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (signInPhaseRef.current === 'google') {
          signInPhaseRef.current = 'idle';
          setIsSigningIn(false);
        }
      }, 300);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWindowFocus();
      }
    };
    const cancellationFallback = window.setTimeout(() => {
      if (signInPhaseRef.current === 'google') {
        signInPhaseRef.current = 'idle';
        setIsSigningIn(false);
      }
    }, 60_000);

    window.addEventListener('focus', handleWindowFocus, { once: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(cancellationFallback);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSigningIn]);

  const configurationError = !isSupabaseConfigured
    ? 'Google 로그인을 사용하려면 Supabase 설정이 필요합니다.'
    : !isGoogleIdentityConfigured
      ? 'Google 로그인 설정이 없습니다. VITE_GOOGLE_CLIENT_ID를 확인해 주세요.'
      : null;

  return (
    <div
      className={isOpen ? 'fixed inset-0 z-50 grid place-items-center bg-[#00172b]/55 p-6 sm:p-5' : 'hidden'}
      role={isOpen ? 'presentation' : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSigningIn) {
          onClose();
        }
      }}
    >
      <section
        className="relative w-full max-w-[392px] rounded-2xl border border-[#d8e0da] bg-white px-4 pb-5 pt-6 text-center text-[#18221d] shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:px-8 sm:pb-6 sm:pt-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-sign-in-title"
      >
        <button
          className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-lg border-0 bg-transparent text-[#5d6a62] transition-colors hover:bg-[#eef3f0] hover:text-[#18221d] disabled:cursor-not-allowed disabled:opacity-50 sm:right-2 sm:top-2"
          type="button"
          aria-label="로그인 창 닫기"
          disabled={isSigningIn}
          onClick={onClose}
        >
          <X size={24} strokeWidth={2} />
        </button>

        <div className="mx-auto flex w-fit flex-col items-center" aria-label="봉우리모아">
          <img
            className="h-9 w-[72px] object-contain sm:h-10 sm:w-[78px]"
            src="/logo-mountain.png"
            alt=""
            aria-hidden="true"
          />
          <p className="mb-0 mt-1 text-base font-bold leading-5 text-black sm:text-lg sm:leading-6">
            봉우리모아
          </p>
        </div>
        <h2
          id="google-sign-in-title"
          className="mb-0 mt-3 text-xl font-semibold leading-6 text-[#245c46] sm:text-[22px] sm:leading-7"
        >
          산행 기록을 계속 이어가세요
        </h2>
        <p className="mx-auto mb-0 mt-2 max-w-[310px] text-base leading-6 text-[#5d6a62]">
          로그인하면 등반 기록과 후기를<br className="hidden sm:block" /> 어디서든 안전하게 확인할 수 있어요.
        </p>

        <div className="relative mx-auto mt-4 min-h-11 w-full max-w-[280px] sm:mt-5">
          <div
            ref={buttonContainerRef}
            className={[
              'flex justify-center rounded',
              isSigningIn ? 'pointer-events-none opacity-60' : '',
              isScriptReady && !configurationError
                ? 'shadow-[0_0_16px_2px_rgba(6,38,58,0.16)]'
                : ''
            ].filter(Boolean).join(' ')}
            aria-hidden={!isScriptReady || Boolean(configurationError)}
          />
          {!isScriptReady && !configurationError && !errorMessage ? (
            <div className="grid min-h-11 place-items-center rounded border border-[#d8e0da] text-sm text-[#5d6a62]">
              Google 로그인 준비 중…
            </div>
          ) : null}
        </div>

        {isSigningIn ? (
          <p className="mb-0 mt-4 text-sm font-semibold text-[#245c46]" role="status">
            Google 로그인 처리 중…
          </p>
        ) : null}
        {configurationError || errorMessage ? (
          <p className="mb-0 mt-4 text-sm font-semibold leading-5 text-[#b14a3d]" role="alert">
            {configurationError ?? errorMessage}
          </p>
        ) : null}
        {!configurationError && errorMessage && !isSigningIn ? (
          <button
            className="mt-4 min-h-11 rounded-lg border border-[#245c46] bg-white px-4 text-sm font-semibold text-[#245c46]"
            type="button"
            onClick={() => setInitializationAttempt((attempt) => attempt + 1)}
          >
            다시 시도
          </button>
        ) : null}
      </section>
    </div>
  );
}
