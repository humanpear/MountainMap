import { Camera, ImagePlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { Mountain } from "../types";

export type CompletionRecordDraft = {
  climbedOn: string;
  photoFile: File | null;
};

type CompletionRecordModalProps = {
  mountain: Mountain;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (draft: CompletionRecordDraft) => void;
};

function getTodayValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CompletionRecordModal({
  mountain,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: CompletionRecordModalProps) {
  const today = getTodayValue();
  const [climbedOn, setClimbedOn] = useState(today);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startClose = useCallback(() => {
    if (isClosing) {
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = setTimeout(onClose, 180);
  }, [isClosing, onClose]);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  }, []);

  useEffect(() => () => {
    if (photoPreviewUrl) {
      URL.revokeObjectURL?.(photoPreviewUrl);
    }
  }, [photoPreviewUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting && !isClosing) {
        startClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isClosing, isSubmitting, startClose]);

  const selectPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setValidationMessage("JPG, PNG, WEBP 이미지만 10MB 이하로 등록할 수 있습니다.");
      event.target.value = "";
      return;
    }

    if (photoPreviewUrl) {
      URL.revokeObjectURL?.(photoPreviewUrl);
    }
    setPhotoFile(file);
    setPhotoPreviewUrl(typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null);
    setValidationMessage(null);
  };

  const submit = () => {
    if (!climbedOn || climbedOn > today) {
      setValidationMessage("오늘 이전의 등반 날짜를 선택해 주세요.");
      return;
    }
    setValidationMessage(null);
    onSubmit({ climbedOn, photoFile });
    startClose();
  };

  return (
    <div
      className={`completion-record-modal-backdrop fixed inset-0 z-20 grid place-items-center bg-black/55 p-4${isClosing ? " completion-record-modal-backdrop--closing" : ""}`}
      role="presentation"
      onClick={() => !isSubmitting && !isClosing && startClose()}
    >
      <section
        className={`completion-record-modal relative grid w-[min(500px,100%)] gap-5 rounded-xl border border-[#d8e0da] bg-white p-6 shadow-[0_26px_90px_rgba(0,0,0,0.34)] max-[560px]:gap-4 max-[560px]:p-4${isClosing ? " completion-record-modal--closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-record-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg border-0 bg-transparent p-0 text-[#18221d]"
          type="button"
          aria-label="등반 기록 닫기"
          disabled={isSubmitting || isClosing}
          onClick={startClose}
        >
          <X size={15} />
        </button>

        <header className="pr-12">
          <p className="m-0 text-[13px] font-semibold text-[#245c46]">등반 완료 기록</p>
          <h2 id="completion-record-modal-title" className="m-0 mt-1 text-[19px] font-semibold leading-7 text-[#18221d] max-[560px]:text-[17px]">
            {mountain.name}의 순간을 남겨주세요
          </h2>
        </header>

        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#18221d]" htmlFor="completion-photo">
            등반 사진 <span className="font-normal text-[#5d6a62]" aria-hidden="true">(선택)</span>
          </label>
          <input
            ref={fileInputRef}
            className="sr-only"
            id="completion-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isSubmitting || isClosing}
            onChange={selectPhoto}
          />
          <button
            className="relative grid min-h-[210px] w-full place-items-center overflow-hidden rounded-lg border border-dashed border-[#9fb2a7] bg-[#f5f7f4] p-0 text-[#245c46]"
            type="button"
            disabled={isSubmitting || isClosing}
            onClick={() => fileInputRef.current?.click()}
          >
            {photoPreviewUrl ? (
              <img className="absolute inset-0 h-full w-full object-cover" src={photoPreviewUrl} alt="선택한 등반 사진 미리보기" />
            ) : (
              <span className="grid justify-items-center gap-2 px-4 text-sm font-semibold">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e5efe9]"><ImagePlus size={24} /></span>
                사진 선택
                <small className="font-medium text-[#5d6a62]">JPG, PNG, WEBP · 최대 10MB</small>
              </span>
            )}
            {photoPreviewUrl ? (
              <span className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-black/65 px-3 text-[13px] font-semibold text-white">
                <Camera size={16} /> 사진 변경
              </span>
            ) : null}
          </button>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#18221d]" htmlFor="completion-date">등반 날짜</label>
          <input
            className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-3 text-sm text-[#18221d] outline-none focus:border-[#245c46]"
            id="completion-date"
            type="date"
            max={today}
            value={climbedOn}
            disabled={isSubmitting || isClosing}
            onChange={(event) => setClimbedOn(event.target.value)}
          />
        </div>

        {validationMessage || errorMessage ? (
          <p className="m-0 rounded-lg bg-[#fff1ee] px-3 py-2.5 text-sm font-semibold leading-5 text-[#b14a3d]" role="alert">
            {validationMessage ?? errorMessage}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            className="min-h-11 rounded-lg border border-[#d8e0da] bg-white px-4 text-sm font-semibold text-[#18221d]"
            type="button"
            disabled={isSubmitting || isClosing}
            onClick={startClose}
          >
            취소
          </button>
          <button
            className="min-h-11 rounded-lg border border-[#245c46] bg-[#245c46] px-4 text-sm font-semibold text-white disabled:cursor-progress disabled:border-[#8aa699] disabled:bg-[#8aa699]"
            type="button"
            disabled={isSubmitting || isClosing}
            onClick={submit}
          >
            등반 완료
          </button>
        </div>
      </section>
    </div>
  );
}
