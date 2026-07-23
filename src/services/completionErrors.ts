type CompletionOperation = 'load' | 'save' | 'delete';

type CompletionErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
};

const operationLabels: Record<CompletionOperation, string> = {
  load: '불러오기',
  save: '저장',
  delete: '삭제'
};

export function getCompletionErrorMessage(error: CompletionErrorLike, operation: CompletionOperation) {
  const rawMessage = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  const isMissingMountainReference =
    error.code === '23503' ||
    rawMessage.includes('completed_mountains_mountain_id_fkey') ||
    rawMessage.includes('foreign key');

  if (isMissingMountainReference) {
    return '등반 기록 저장에 실패했습니다. Supabase에서 completed_mountains의 mountain_id 외래 키를 제거하는 마이그레이션을 실행해야 합니다.';
  }

  const isMissingCompletionUniqueness =
    error.code === '42P10' ||
    rawMessage.includes('no unique or exclusion constraint matching the on conflict specification');

  if (isMissingCompletionUniqueness) {
    return '등반 기록 저장에 실패했습니다. Supabase에서 enforce_unique_completed_mountains 마이그레이션을 먼저 실행해 주세요.';
  }

  const isMissingCompletionDetails =
    error.code === '42703' &&
    (rawMessage.includes('climbed_on') || rawMessage.includes('photo_url'));

  if (isMissingCompletionDetails) {
    return '등반 기록 저장에 실패했습니다. Supabase에서 completion_record_details 마이그레이션을 먼저 실행해 주세요.';
  }

  return `등반 기록 ${operationLabels[operation]}에 실패했습니다. 다시 시도하세요.`;
}
