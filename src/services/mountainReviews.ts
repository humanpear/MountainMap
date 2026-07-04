import { supabase } from "./supabase";

export const mountainReviewImageBucket = "mountain-review-images";

export type MountainReview = {
  id: string;
  userId: string;
  mountainId: string;
  routeName: string;
  routeStartPoint?: string | null;
  routeEndPoint?: string | null;
  authorName: string;
  difficulty: string;
  durationMinutes: number;
  durationLabel: string;
  body: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
};

type MountainReviewRow = {
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

const mountainReviewSelectColumns =
  "id,user_id,mountain_id,route_name,route_start_point,route_end_point,author_name,difficulty,duration_minutes,duration_label,body,image_urls,created_at,updated_at";

const legacyMountainReviewSelectColumns =
  "id,user_id,mountain_id,route_name,author_name,difficulty,duration_minutes,duration_label,body,image_urls,created_at,updated_at";

type CreateMountainReviewInput = {
  userId: string;
  mountainId: string;
  routeName: string;
  routeStartPoint?: string | null;
  routeEndPoint?: string | null;
  authorName: string;
  difficulty: string;
  durationMinutes: number;
  durationLabel: string;
  body: string;
  imageFiles: File[];
};

type UpdateMountainReviewInput = {
  id: string;
  userId: string;
  mountainId: string;
  difficulty: string;
  durationMinutes: number;
  durationLabel: string;
  body: string;
  existingImageUrls: string[];
  imageFiles: File[];
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase 설정이 필요합니다.");
  }

  return supabase;
}

function mapMountainReview(row: MountainReviewRow): MountainReview {
  return {
    id: row.id,
    userId: row.user_id,
    mountainId: row.mountain_id,
    routeName: row.route_name,
    routeStartPoint: row.route_start_point ?? null,
    routeEndPoint: row.route_end_point ?? null,
    authorName: row.author_name?.trim() || "등산객",
    difficulty: row.difficulty,
    durationMinutes: row.duration_minutes,
    durationLabel: row.duration_label,
    body: row.body,
    imageUrls: row.image_urls ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchMountainReviews(mountainId: string) {
  const client = requireSupabase();

  const query = (selectColumns: string) =>
    client
      .from("mountain_reviews")
      .select(selectColumns)
      .eq("mountain_id", mountainId)
      .order("created_at", { ascending: false })
      .limit(50);
  const initialResult = await query(mountainReviewSelectColumns);
  let data: unknown = initialResult.data;
  let error: unknown = initialResult.error;

  if (isMissingRouteEndpointColumnError(error)) {
    const legacyResult = await query(legacyMountainReviewSelectColumns);
    data = legacyResult.data as unknown;
    error = legacyResult.error;
  }

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  return (rows as MountainReviewRow[]).map(mapMountainReview);
}

function isMissingRouteEndpointColumnError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const supabaseError = error as { code?: string; message?: string };

  return (
    supabaseError.code === "42703" &&
    (supabaseError.message?.includes("route_start_point") ||
      supabaseError.message?.includes("route_end_point"))
  );
}

export async function createMountainReview(input: CreateMountainReviewInput) {
  const client = requireSupabase();
  const draftId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const uploadedPaths: string[] = [];

  try {
    const imageUrls = await uploadReviewImages({
      userId: input.userId,
      mountainId: input.mountainId,
      reviewDraftId: draftId,
      files: input.imageFiles,
      uploadedPaths,
    });

    const { data, error } = await client
      .from("mountain_reviews")
      .insert({
        user_id: input.userId,
        mountain_id: input.mountainId,
        route_name: input.routeName,
        route_start_point: input.routeStartPoint?.trim() || null,
        route_end_point: input.routeEndPoint?.trim() || null,
        author_name: input.authorName.trim() || "등산객",
        difficulty: input.difficulty,
        duration_minutes: input.durationMinutes,
        duration_label: input.durationLabel,
        body: input.body.trim(),
        image_urls: imageUrls,
      })
      .select(
        "id,user_id,mountain_id,route_name,route_start_point,route_end_point,author_name,difficulty,duration_minutes,duration_label,body,image_urls,created_at,updated_at",
      )
      .single();

    if (error) {
      throw error;
    }

    return mapMountainReview(data as MountainReviewRow);
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await client.storage
        .from(mountainReviewImageBucket)
        .remove(uploadedPaths)
        .catch(() => undefined);
    }
    throw error;
  }
}

export async function updateMountainReview(input: UpdateMountainReviewInput) {
  const client = requireSupabase();

  const existingResult = await client
    .from("mountain_reviews")
    .select("image_urls")
    .eq("id", input.id)
    .single();

  if (existingResult.error) {
    throw existingResult.error;
  }

  const previousImageUrls = Array.isArray(
    (existingResult.data as { image_urls?: unknown } | null)?.image_urls,
  )
    ? ((existingResult.data as { image_urls: string[] }).image_urls ?? [])
    : [];
  const uploadedPaths: string[] = [];

  try {
    const uploadedImageUrls = await uploadReviewImages({
      userId: input.userId,
      mountainId: input.mountainId,
      reviewDraftId: input.id,
      files: input.imageFiles,
      uploadedPaths,
    });
    const imageUrls = [...input.existingImageUrls, ...uploadedImageUrls];

    const { data, error } = await client
    .from("mountain_reviews")
    .update({
      difficulty: input.difficulty,
      duration_minutes: input.durationMinutes,
      duration_label: input.durationLabel,
      body: input.body.trim(),
      image_urls: imageUrls,
    })
    .eq("id", input.id)
    .select(
      "id,user_id,mountain_id,route_name,route_start_point,route_end_point,author_name,difficulty,duration_minutes,duration_label,body,image_urls,created_at,updated_at",
    )
    .single();

    if (error) {
      throw error;
    }

    const removedPaths = previousImageUrls
      .filter((url) => !imageUrls.includes(url))
      .map(getReviewImagePathFromPublicUrl)
      .filter((path): path is string => Boolean(path));

    if (removedPaths.length > 0) {
      await client.storage
        .from(mountainReviewImageBucket)
        .remove(removedPaths)
        .catch(() => undefined);
    }

    return mapMountainReview(data as MountainReviewRow);
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await client.storage
        .from(mountainReviewImageBucket)
        .remove(uploadedPaths)
        .catch(() => undefined);
    }
    throw error;
  }
}

export async function deleteMountainReview(review: MountainReview) {
  const client = requireSupabase();
  const { error } = await client.from("mountain_reviews").delete().eq("id", review.id);

  if (error) {
    throw error;
  }

  const paths = review.imageUrls
    .map(getReviewImagePathFromPublicUrl)
    .filter((path): path is string => Boolean(path));

  if (paths.length > 0) {
    await client.storage
      .from(mountainReviewImageBucket)
      .remove(paths)
      .catch(() => undefined);
  }
}

async function uploadReviewImages({
  userId,
  mountainId,
  reviewDraftId,
  files,
  uploadedPaths,
}: {
  userId: string;
  mountainId: string;
  reviewDraftId: string;
  files: File[];
  uploadedPaths: string[];
}) {
  const client = requireSupabase();
  const urls: string[] = [];

  for (const [index, file] of files.entries()) {
    const optimizedImage = await resizeImageForUpload(file);
    const path = `${userId}/${mountainId}/${reviewDraftId}/${index}-${Date.now()}.jpg`;
    const { error } = await client.storage
      .from(mountainReviewImageBucket)
      .upload(path, optimizedImage, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    uploadedPaths.push(path);
    const { data } = client.storage.from(mountainReviewImageBucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

async function resizeImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("이미지를 처리할 수 없습니다.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
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
      0.78,
    );
  });
}

function getReviewImagePathFromPublicUrl(url: string) {
  const marker = `/storage/v1/object/public/${mountainReviewImageBucket}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeURIComponent(url.slice(markerIndex + marker.length));
}
