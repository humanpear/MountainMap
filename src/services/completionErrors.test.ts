import { describe, expect, it } from 'vitest';
import { getCompletionErrorMessage } from './completionErrors';

describe('getCompletionErrorMessage', () => {
  it('explains the Supabase mountain foreign key setup issue', () => {
    expect(
      getCompletionErrorMessage(
        {
          code: '23503',
          message: 'insert or update on table "completed_mountains" violates foreign key constraint'
        },
        'save'
      )
    ).toContain('mountain_id 외래 키');
  });

  it('falls back to an operation-specific generic message', () => {
    expect(getCompletionErrorMessage({ message: 'network error' }, 'delete')).toContain('삭제에 실패');
  });

  it('explains the unique completion migration required by upsert', () => {
    expect(
      getCompletionErrorMessage(
        {
          code: '42P10',
          message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
        },
        'save',
      ),
    ).toContain('enforce_unique_completed_mountains');
  });

  it('explains the completion details migration required by climb records', () => {
    expect(
      getCompletionErrorMessage(
        { code: '42703', message: 'column completed_mountains.climbed_on does not exist' },
        'save',
      ),
    ).toContain('completion_record_details');
  });

  it('does not direct users to the deprecated multiple-completion migration', () => {
    expect(
      getCompletionErrorMessage(
        {
          code: '23505',
          message: 'duplicate key value violates unique constraint "completed_mountains_pkey"'
        },
        'save'
      )
    ).toBe('등반 기록 저장에 실패했습니다. 다시 시도하세요.');
  });
});
