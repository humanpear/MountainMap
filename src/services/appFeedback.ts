import { supabase } from './supabase';

type CreateAppFeedbackInput = {
  body: string;
  contact?: string;
  pageContext: string;
  pageUrl: string;
  userId?: string;
  userEmail?: string;
};

export async function createAppFeedback(input: CreateAppFeedbackInput) {
  if (!supabase) {
    throw new Error('Supabase 설정이 필요합니다.');
  }

  const { error } = await supabase.from('app_feedback').insert({
    body: input.body.trim(),
    contact: input.contact?.trim() || null,
    page_context: input.pageContext,
    page_url: input.pageUrl,
    user_id: input.userId ?? null,
    user_email: input.userEmail ?? null
  });

  if (error) {
    throw error;
  }
}
