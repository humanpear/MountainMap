import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mountains } from "../data/mountains";
import { CompletionRecordModal } from "./CompletionRecordModal";

describe("CompletionRecordModal", () => {
  it("submits without a photo and closes after the exit animation", () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <CompletionRecordModal
        mountain={mountains[0]}
        isSubmitting={false}
        errorMessage={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("등반 날짜"), { target: { value: "2026-05-24" } });
    fireEvent.click(screen.getByRole("button", { name: "등반 완료" }));

    expect(onSubmit).toHaveBeenCalledWith({ climbedOn: "2026-05-24", photoFile: null });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveClass("completion-record-modal--closing");

    act(() => vi.advanceTimersByTime(180));
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
