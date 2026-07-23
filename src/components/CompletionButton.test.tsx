import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompletionButton } from './CompletionButton';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CompletionButton', () => {
  it('shows saving feedback and blocks rapid duplicate clicks', async () => {
    const deferred = createDeferred<boolean>();
    const onComplete = vi.fn(() => deferred.promise);
    const { container } = render(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted={false}
        isPending={false}
        onComplete={onComplete}
      />,
    );

    const button = screen.getByRole('button', { name: '가리산 등반 완료로 기록' });
    expect(screen.getByText('미등반')).toBeInTheDocument();
    expect(container.querySelector('.completion-button__icon')).toBeNull();
    expect(button).toHaveClass('completion-button--incomplete');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '가리산 등반 완료 저장 중' })).toBeDisabled();
    expect(screen.queryByText('저장 중')).not.toBeInTheDocument();
    expect(button).toHaveClass('completion-button--icon-only');

    await act(async () => deferred.resolve(false));
    expect(screen.getByRole('button', { name: '가리산 등반 완료 저장 중' })).toBeDisabled();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });
    expect(screen.getByRole('button', { name: '가리산 등반 완료로 기록' })).toBeEnabled();
    expect(screen.getByText('미등반')).toBeInTheDocument();
  });

  it('uses the measured resting size supplied by the elevation badge', () => {
    render(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted={false}
        isPending={false}
        onComplete={async () => true}
        variant="hero"
        restingWidth={86.5}
        restingHeight={42}
      />,
    );

    expect(screen.getByRole('button', { name: '가리산 등반 완료로 기록' })).toHaveStyle({
      '--completion-button-resting-width': '86.5px',
      '--completion-button-resting-height': '42px',
    });
  });

  it('plays the success phase when a modal submission completes externally', async () => {
    stubReducedMotion(false);
    const onRequestComplete = vi.fn();
    const { container, rerender } = render(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted={false}
        isPending={false}
        onRequestComplete={onRequestComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '가리산 등반 완료로 기록' }));
    expect(onRequestComplete).toHaveBeenCalledOnce();
    expect(screen.getByText('미등반')).toBeInTheDocument();

    rerender(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted
        isPending={false}
        onRequestComplete={onRequestComplete}
      />,
    );
    await act(async () => Promise.resolve());

    expect(container.querySelector('.completion-button__success')).not.toBeNull();
    expect(container.querySelector('.completion-button--icon-only')).not.toBeNull();
  });

  it('waits for the minimum saving duration and settles after the check animation', async () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    const onComplete = vi.fn(async () => true);
    const { container, rerender } = render(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted={false}
        isPending={false}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '가리산 등반 완료로 기록' }));
    rerender(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted
        isPending={false}
        onComplete={onComplete}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(249);
    });
    expect(screen.queryByText('저장 중')).not.toBeInTheDocument();
    expect(container.querySelector('.completion-button--icon-only')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    const success = container.querySelector('.completion-button__success');
    expect(success).not.toBeNull();
    expect(screen.queryByText('등반 완료')).not.toBeInTheDocument();

    fireEvent.animationEnd(success!, { animationName: 'completion-check-pop' });
    expect(screen.getByRole('button', { name: '가리산 등반 완료됨' })).toBeDisabled();
    expect(screen.getByText('등반 완료')).toBeInTheDocument();
    expect(container.querySelector('.completion-button--revealing')).not.toBeNull();
    expect(container.querySelector('.completion-button--icon-only')).toBeNull();
  });

  it('skips the motion delay when reduced motion is requested', async () => {
    vi.useFakeTimers();
    stubReducedMotion(true);
    const onComplete = vi.fn(async () => true);
    const { container, rerender } = render(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted={false}
        isPending={false}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '가리산 등반 완료로 기록' }));
    rerender(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted
        isPending={false}
        onComplete={onComplete}
      />,
    );
    await act(async () => Promise.resolve());

    expect(container.querySelector('.completion-button__success')).not.toBeNull();
    expect(screen.getByText('등반 완료')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '가리산 등반 완료됨' })).toBeDisabled();
  });

  it('ignores a stale completion after the target mountain changes', async () => {
    const deferred = createDeferred<boolean>();
    const onComplete = vi.fn(() => deferred.promise);
    const { rerender } = render(
      <CompletionButton
        completionKey="mountain-1"
        mountainName="가리산"
        isCompleted={false}
        isPending={false}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '가리산 등반 완료로 기록' }));
    rerender(
      <CompletionButton
        completionKey="mountain-2"
        mountainName="설악산"
        isCompleted={false}
        isPending={false}
        onComplete={onComplete}
      />,
    );
    await act(async () => deferred.resolve(true));

    expect(screen.getByRole('button', { name: '설악산 등반 완료로 기록' })).toBeEnabled();
    expect(screen.getByText('미등반')).toBeInTheDocument();
  });
});
