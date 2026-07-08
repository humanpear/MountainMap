import { mountains } from "../data/mountains";
import type { CompletionRecord, Mountain } from "../types";
import { fetchPublicProfiles } from "./profiles";
import { supabase } from "./supabase";

export type UserCompletedMountain = CompletionRecord & {
  mountain: Mountain | null;
};

export type UserReviewSummary = {
  id: string;
  userId: string;
  mountainId: string;
  mountainName: string;
  routeName: string;
  routeStartPoint: string | null;
  routeEndPoint: string | null;
  authorName: string;
  difficulty: string;
  durationMinutes: number;
  durationLabel: string;
  body: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
};

type CompletedMountainRow = {
  id?: string;
  mountain_id: string;
  completed_at: string;
};

type ReviewRow = {
  id: string;
  user_id: string;
  mountain_id: string;
  route_name: string;
  route_start_point?: string | null;
  route_end_point?: string | null;
  author_name: string | null;
  difficulty: string;
  duration_minutes: number;
  duration_label: string;
  body: string;
  image_urls: string[] | null;
  created_at: string;
  updated_at: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase 설정이 필요합니다.");
  }

  return supabase;
}

export async function fetchUserCompletedMountains(userId: string): Promise<UserCompletedMountain[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("completed_mountains")
    .select("id,mountain_id,completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as CompletedMountainRow[]).map((row) => {
    const mountain = mountains.find((candidate) => candidate.id === row.mountain_id) ?? null;
    return {
      id: row.id,
      mountainId: row.mountain_id,
      completedAt: row.completed_at,
      mountain,
    };
  });
}

export async function deleteCompletedMountain(userId: string, mountainId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from("completed_mountains")
    .delete()
    .eq("user_id", userId)
    .eq("mountain_id", mountainId);

  if (error) {
    throw error;
  }
}

export async function fetchUserReviews(userId: string): Promise<UserReviewSummary[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("mountain_reviews")
    .select(
      "id,user_id,mountain_id,route_name,route_start_point,route_end_point,author_name,difficulty,duration_minutes,duration_label,body,image_urls,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const profileMap = await fetchPublicProfiles([userId]);
  const profile = profileMap.get(userId);

  return ((data ?? []) as ReviewRow[]).map((row) => {
    const mountain = mountains.find((candidate) => candidate.id === row.mountain_id);
    return {
      id: row.id,
      userId: row.user_id,
      mountainId: row.mountain_id,
      mountainName: mountain?.name ?? row.mountain_id,
      routeName: row.route_name,
      routeStartPoint: row.route_start_point ?? null,
      routeEndPoint: row.route_end_point ?? null,
      authorName: profile?.displayName || row.author_name?.trim() || "등산객",
      difficulty: row.difficulty,
      durationMinutes: row.duration_minutes,
      durationLabel: row.duration_label,
      body: row.body,
      imageUrls: row.image_urls ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}
