import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
} from 'react';
import { cn } from '../lib/classNames';

type CompletionButtonPhase = 'idle' | 'saving' | 'celebrating' | 'revealing';

type CompletionButtonProps = {
  completionKey: string;
  mountainName: string;
  isCompleted: boolean;
  isPending: boolean;
  onComplete?: () => Promise<boolean>;
  onRequestComplete?: () => void;
  variant?: 'surface' | 'hero';
  restingWidth?: number;
  restingHeight?: number;
};

const minimumSavingDurationMs = 250;
const celebrationFallbackMs = 900;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function CompletionButton({
  completionKey,
  mountainName,
  isCompleted,
  isPending,
  onComplete,
  onRequestComplete,
  variant = 'surface',
  restingWidth,
  restingHeight,
}: CompletionButtonProps) {
  const [phase, setPhase] = useState<CompletionButtonPhase>('idle');
  const requestTokenRef = useRef(0);
  const delayTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const previousCompletedRef = useRef(isCompleted);
  const previousCompletionKeyRef = useRef(completionKey);

  const clearTimers = useCallback(() => {
    if (delayTimerRef.current !== null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const revealCompletion = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    setPhase('revealing');
  }, []);

  useEffect(() => {
    requestTokenRef.current += 1;
    clearTimers();
    setPhase('idle');

    return () => {
      requestTokenRef.current += 1;
      clearTimers();
    };
  }, [clearTimers, completionKey]);

  useEffect(() => {
    if (previousCompletionKeyRef.current !== completionKey) {
      previousCompletionKeyRef.current = completionKey;
      previousCompletedRef.current = isCompleted;
      return;
    }
    const wasCompleted = previousCompletedRef.current;
    previousCompletedRef.current = isCompleted;
    if (!wasCompleted && isCompleted && phase === 'idle' && !prefersReducedMotion()) {
      setPhase('celebrating');
    }
  }, [completionKey, isCompleted, phase]);

  useEffect(() => {
    if (phase !== 'celebrating') {
      return;
    }

    fallbackTimerRef.current = window.setTimeout(revealCompletion, celebrationFallbackMs);
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [phase, revealCompletion]);

  const handleClick = async () => {
    if (phase !== 'idle' || isCompleted || isPending) {
      return;
    }

    if (onRequestComplete) {
      onRequestComplete();
      return;
    }

    if (!onComplete) {
      return;
    }

    const requestToken = ++requestTokenRef.current;
    const startedAt = window.performance.now();
    setPhase('saving');

    const didComplete = await onComplete();
    if (requestToken !== requestTokenRef.current) {
      return;
    }

    if (prefersReducedMotion()) {
      setPhase('idle');
      return;
    }

    const remainingDelay = Math.max(0, minimumSavingDurationMs - (window.performance.now() - startedAt));
    if (remainingDelay > 0) {
      await new Promise<void>((resolve) => {
        delayTimerRef.current = window.setTimeout(resolve, remainingDelay);
      });
    }

    if (requestToken !== requestTokenRef.current) {
      return;
    }

    delayTimerRef.current = null;

    if (!didComplete) {
      setPhase('idle');
      return;
    }

    setPhase('celebrating');
  };

  const handleAnimationEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (
      phase === 'celebrating' &&
      event.currentTarget === event.target
    ) {
      revealCompletion();
    }
  };

  const visualPhase = phase === 'idle' && isPending ? 'saving' : phase;
  const showCompleted =
    visualPhase === 'celebrating' ||
    visualPhase === 'revealing' ||
    (visualPhase === 'idle' && isCompleted);
  const isSaving = visualPhase === 'saving';
  const isIconOnly = isSaving || visualPhase === 'celebrating';
  const isDisabled = isCompleted || isPending || phase !== 'idle';
  const accessibleLabel = isSaving
    ? `${mountainName} 등반 완료 저장 중`
    : showCompleted
      ? `${mountainName} 등반 완료됨`
      : `${mountainName} 등반 완료로 기록`;
  const sizeStyle = {
    ...(restingWidth ? { '--completion-button-resting-width': `${restingWidth}px` } : {}),
    ...(restingHeight ? { '--completion-button-resting-height': `${restingHeight}px` } : {}),
  } as CSSProperties;

  return (
    <button
      className={cn(
        'completion-button',
        variant === 'hero' ? 'completion-button--hero' : 'completion-button--surface',
        showCompleted && 'completion-button--completed',
        isSaving && 'completion-button--saving',
        isIconOnly && 'completion-button--icon-only',
        !showCompleted && !isIconOnly && 'completion-button--incomplete',
        visualPhase === 'revealing' && 'completion-button--revealing',
      )}
      type="button"
      disabled={isDisabled}
      style={sizeStyle}
      aria-busy={isSaving || undefined}
      aria-label={accessibleLabel}
      onClick={() => void handleClick()}
    >
      <span className="completion-button__content">
        {isIconOnly || showCompleted ? (
          <span className="completion-button__icon" aria-hidden="true">
            {isSaving ? (
              <svg className="completion-button__spinner" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
            ) : (
              <span className="completion-button__success" onAnimationEnd={handleAnimationEnd}>
                <svg viewBox="0 0 24 24">
                  <circle className="completion-button__success-ring" cx="12" cy="12" r="9" />
                  <path className="completion-button__success-check" d="m7.5 12.2 3 3.1 6.2-6.6" />
                </svg>
              </span>
            )}
          </span>
        ) : null}
        {!isIconOnly ? (
          <span className="completion-button__label">
            {showCompleted ? '등반 완료' : '미등반'}
          </span>
        ) : null}
      </span>
    </button>
  );
}
