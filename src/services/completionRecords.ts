import type { CompletionRecord } from "../types";
import { supabase } from "./supabase";

export const completionImageBucket = "mountain-completion-images";

type SaveCompletionInput = {
  userId: string;
  mountainId: string;
  climbedOn: string;
  photoFile: File | null;
};

type CompletionRow = {
  id: string;
  mountain_id: string;
  completed_at: string;
  climbed_on: string;
  photo_url: string | null;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase 설정이 필요합니다.");
  }
  return supabase;
}

export async function saveCompletionRecord(input: SaveCompletionInput): Promise<CompletionRecord> {
  const client = requireSupabase();
  let path: string | null = null;
  let photoUrl: string | null = null;
  const storage = input.photoFile ? client.storage.from(completionImageBucket) : null;

  if (input.photoFile && storage) {
    const optimizedImage = await resizeCompletionImage(input.photoFile);
    path = `${input.userId}/${input.mountainId}/${Date.now()}.jpg`;
    const uploadResult = await storage.upload(path, optimizedImage, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    photoUrl = storage.getPublicUrl(path).data.publicUrl;
  }

  try {
    const { data, error } = await client
      .from("completed_mountains")
      .upsert(
        {
          user_id: input.userId,
          mountain_id: input.mountainId,
          climbed_on: input.climbedOn,
          photo_url: photoUrl,
        },
        { onConflict: "user_id,mountain_id" },
      )
      .select("id,mountain_id,completed_at,climbed_on,photo_url")
      .single();

    if (error || !data) {
      throw error ?? new Error("완료 기록 응답이 없습니다.");
    }

    const row = data as CompletionRow;
    return {
      id: row.id,
      mountainId: row.mountain_id,
      completedAt: row.completed_at,
      climbedOn: row.climbed_on,
      photoUrl: row.photo_url,
    };
  } catch (error) {
    if (storage && path) {
      await storage.remove([path]).catch(() => undefined);
    }
    throw error;
  }
}

export async function deleteCompletionPhoto(photoUrl: string) {
  const path = getCompletionPhotoPath(photoUrl);
  if (!path) {
    return false;
  }

  const { error } = await requireSupabase().storage.from(completionImageBucket).remove([path]);
  if (error) {
    throw error;
  }
  return true;
}

function getCompletionPhotoPath(url: string) {
  const marker = `/storage/v1/object/public/${completionImageBucket}/`;
  const markerIndex = url.indexOf(marker);
  return markerIndex === -1 ? null : decodeURIComponent(url.slice(markerIndex + marker.length));
}

async function resizeCompletionImage(file: File) {
  if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
    throw new Error("JPG, PNG, WEBP 이미지만 10MB 이하로 등록할 수 있습니다.");
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("사진을 처리할 수 없습니다.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("사진 압축에 실패했습니다.")),
      "image/jpeg",
      0.82,
    );
  });
}
