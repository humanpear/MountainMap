import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export const profileImageBucket = "profile-images";

export const defaultProfileAvatars = [
  { id: "default-1", label: "초록 능선", url: "/profile-avatars/avatar-1.svg" },
  { id: "default-2", label: "붉은 일출", url: "/profile-avatars/avatar-2.svg" },
  { id: "default-3", label: "푸른 계곡", url: "/profile-avatars/avatar-3.svg" },
  { id: "default-4", label: "노란 표지", url: "/profile-avatars/avatar-4.svg" },
  { id: "default-5", label: "밤 산행", url: "/profile-avatars/avatar-5.svg" },
] as const;

export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string;
  displayNameNormalized: string;
  avatarUrl: string;
  avatarKind: string;
  updatedAt?: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  display_name_normalized?: string | null;
  avatar_url: string | null;
  avatar_kind?: string | null;
  updated_at?: string | null;
};

type PublicProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_kind?: string | null;
  updated_at?: string | null;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase 설정이 필요합니다.");
  }

  return supabase;
}

export function normalizeDisplayName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function sanitizeDisplayName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function getDefaultDisplayName(user: Pick<User, "email" | "user_metadata">) {
  const metadata = user.user_metadata;
  const metadataName =
    typeof metadata?.full_name === "string"
      ? metadata.full_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : "";
  const emailName = user.email?.split("@")[0] ?? "";

  return sanitizeDisplayName(metadataName || emailName || "등산객");
}

export function getDefaultAvatarUrl(avatarKind = "default-1") {
  return defaultProfileAvatars.find((avatar) => avatar.id === avatarKind)?.url ?? defaultProfileAvatars[0].url;
}

function mapProfile(row: ProfileRow, fallbackUser?: Pick<User, "email" | "user_metadata">): UserProfile {
  const avatarKind = row.avatar_kind || "default-1";
  const displayName = sanitizeDisplayName(row.display_name || (fallbackUser ? getDefaultDisplayName(fallbackUser) : "등산객"));

  return {
    id: row.id,
    email: row.email,
    displayName,
    displayNameNormalized: row.display_name_normalized || normalizeDisplayName(displayName),
    avatarUrl: row.avatar_url || getDefaultAvatarUrl(avatarKind),
    avatarKind,
    updatedAt: row.updated_at ?? null,
  };
}

export async function fetchOrCreateUserProfile(user: User) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("id,email,display_name,display_name_normalized,avatar_url,avatar_kind,updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return mapProfile(data as ProfileRow, user);
  }

  const displayName = getDefaultDisplayName(user);
  const avatarKind = "default-1";
  const { data: inserted, error: insertError } = await client
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      display_name: displayName,
      display_name_normalized: normalizeDisplayName(displayName),
      avatar_url: getDefaultAvatarUrl(avatarKind),
      avatar_kind: avatarKind,
    })
    .select("id,email,display_name,display_name_normalized,avatar_url,avatar_kind,updated_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  return mapProfile(inserted as ProfileRow, user);
}

export async function isDisplayNameAvailable(displayName: string, userId: string) {
  const normalized = normalizeDisplayName(displayName);

  if (!normalized) {
    return false;
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("display_name_normalized", normalized)
    .neq("id", userId)
    .limit(1);

  if (error) {
    throw error;
  }

  return (data ?? []).length === 0;
}

export async function saveUserProfile(profile: Pick<UserProfile, "id" | "email" | "displayName" | "avatarUrl" | "avatarKind">) {
  const displayName = sanitizeDisplayName(profile.displayName);

  if (displayName.length < 2 || displayName.length > 20) {
    throw new Error("닉네임은 2~20자로 입력해 주세요.");
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("profiles")
    .upsert({
      id: profile.id,
      email: profile.email,
      display_name: displayName,
      display_name_normalized: normalizeDisplayName(displayName),
      avatar_url: profile.avatarUrl,
      avatar_kind: profile.avatarKind,
    })
    .select("id,email,display_name,display_name_normalized,avatar_url,avatar_kind,updated_at")
    .single();

  if (error) {
    if (isDisplayNameConflictError(error)) {
      throw new Error("이미 사용 중인 닉네임입니다.");
    }
    throw error;
  }

  return mapProfile(data as ProfileRow);
}

export async function fetchPublicProfiles(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return new Map<string, Pick<UserProfile, "id" | "displayName" | "avatarUrl" | "avatarKind">>();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("public_profiles")
    .select("id,display_name,avatar_url,avatar_kind,updated_at")
    .in("id", uniqueUserIds);

  if (error) {
    return new Map();
  }

  return new Map(
    ((data ?? []) as PublicProfileRow[]).map((row) => [
      row.id,
      {
        id: row.id,
        displayName: sanitizeDisplayName(row.display_name || "등산객"),
        avatarUrl: row.avatar_url || getDefaultAvatarUrl(row.avatar_kind || "default-1"),
        avatarKind: row.avatar_kind || "default-1",
      },
    ]),
  );
}

export async function uploadProfileAvatar(userId: string, file: File) {
  const client = requireSupabase();
  const optimizedImage = await resizeImageForUpload(file);
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await client.storage.from(profileImageBucket).upload(path, optimizedImage, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from(profileImageBucket).getPublicUrl(path);
  return data.publicUrl;
}

export function isDisplayNameConflictError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const supabaseError = error as { code?: string; message?: string };
  return supabaseError.code === "23505" || Boolean(supabaseError.message?.includes("profiles_display_name_normalized_key"));
}

async function resizeImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = 900;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const size = Math.max(1, Math.round(Math.min(bitmap.width, bitmap.height) * scale));
  const sourceX = Math.max(0, (bitmap.width - Math.min(bitmap.width, bitmap.height)) / 2);
  const sourceY = Math.max(0, (bitmap.height - Math.min(bitmap.width, bitmap.height)) / 2);
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("이미지를 처리할 수 없습니다.");
  }

  context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("이미지 압축에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.82,
    );
  });
}
