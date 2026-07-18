import { useEffect, useMemo, useRef, useState } from "react";
import type { MountainReview } from "../../services/mountainReviews";
import type { MountainGuideDifficulty, MountainGuideRoute } from "../../types";
import { createPhotoPreviewUrl, revokePhotoPreviewUrl } from "./reviewEditorUtils";

export type ReviewEditorPhoto = {
  id: string;
  name: string;
  url: string;
  file: File;
};

type RouteEndpoints = {
  startPoint: string;
  endPoint: string;
};

type UseReviewEditorDraftOptions = {
  routes: MountainGuideRoute[];
  defaultRouteName: string;
  manualRouteName: string;
  difficultyOptions: readonly string[];
  difficultyDefaultIndex: Record<MountainGuideDifficulty, number>;
  getDefaultDurationMinutes: (estimatedTime: string) => number;
  getRouteDisplayName: (route: MountainGuideRoute) => string;
  getRouteEndpointNames: (route: MountainGuideRoute) => RouteEndpoints;
};

export function useReviewEditorDraft({
  routes,
  defaultRouteName,
  manualRouteName,
  difficultyOptions,
  difficultyDefaultIndex,
  getDefaultDurationMinutes,
  getRouteDisplayName,
  getRouteEndpointNames,
}: UseReviewEditorDraftOptions) {
  const [selectedRouteName, setSelectedRouteName] = useState<string | null>(defaultRouteName);
  const isManualCourse = selectedRouteName === manualRouteName;
  const selectedRoute = useMemo(
    () =>
      !isManualCourse && selectedRouteName
        ? routes.find((route) => route.name === selectedRouteName)
        : undefined,
    [isManualCourse, routes, selectedRouteName],
  );
  const selectedRouteEndpoints = useMemo(
    () => (selectedRoute ? getRouteEndpointNames(selectedRoute) : null),
    [getRouteEndpointNames, selectedRoute],
  );
  const [manualStartPoint, setManualStartPoint] = useState("");
  const [manualEndPoint, setManualEndPoint] = useState("");
  const [difficultyIndex, setDifficultyIndex] = useState(
    difficultyDefaultIndex[selectedRoute?.difficulty ?? "unknown"],
  );
  const [durationMinutes, setDurationMinutes] = useState(
    getDefaultDurationMinutes(selectedRoute?.estimatedTime ?? ""),
  );
  const [reviewText, setReviewText] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<ReviewEditorPhoto[]>([]);
  const [editingExistingImageUrls, setEditingExistingImageUrls] = useState<string[]>([]);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const uploadedPhotosRef = useRef<ReviewEditorPhoto[]>([]);
  const trimmedReviewText = reviewText.trim();
  const totalSelectedPhotoCount = editingExistingImageUrls.length + uploadedPhotos.length;

  useEffect(() => {
    setSelectedRouteName((currentRouteName) => {
      if (
        currentRouteName &&
        (currentRouteName === manualRouteName || routes.some((route) => route.name === currentRouteName))
      ) {
        return currentRouteName;
      }

      return defaultRouteName;
    });
  }, [defaultRouteName, manualRouteName, routes]);

  useEffect(() => {
    uploadedPhotosRef.current = uploadedPhotos;
  }, [uploadedPhotos]);

  useEffect(() => {
    return () => {
      uploadedPhotosRef.current.forEach((photo) => revokePhotoPreviewUrl(photo.url));
    };
  }, []);

  useEffect(() => {
    if (editingReviewId) {
      return;
    }

    if (selectedRoute) {
      const endpoints = getRouteEndpointNames(selectedRoute);
      setDifficultyIndex(difficultyDefaultIndex[selectedRoute.difficulty]);
      setDurationMinutes(getDefaultDurationMinutes(selectedRoute.estimatedTime));
      setManualStartPoint(endpoints.startPoint);
      setManualEndPoint(endpoints.endPoint);
    } else {
      setDifficultyIndex(difficultyDefaultIndex.unknown);
      setDurationMinutes(180);
      setManualStartPoint("");
      setManualEndPoint("");
    }
    setReviewText("");
    setUploadedPhotos((photos) => {
      photos.forEach((photo) => revokePhotoPreviewUrl(photo.url));
      return [];
    });
  }, [
    difficultyDefaultIndex,
    editingReviewId,
    getDefaultDurationMinutes,
    getRouteEndpointNames,
    selectedRoute,
  ]);

  const clearUploadedPhotos = () => {
    setUploadedPhotos((photos) => {
      photos.forEach((photo) => revokePhotoPreviewUrl(photo.url));
      return [];
    });
  };

  const resetDraft = () => {
    const defaultRoute =
      defaultRouteName === manualRouteName ? undefined : routes.find((route) => route.name === defaultRouteName);

    setEditingReviewId(null);
    setEditingExistingImageUrls([]);
    setSelectedRouteName(defaultRouteName);
    setReviewText("");
    clearUploadedPhotos();
    if (defaultRoute) {
      setDifficultyIndex(difficultyDefaultIndex[defaultRoute.difficulty]);
      setDurationMinutes(getDefaultDurationMinutes(defaultRoute.estimatedTime));
      const endpoints = getRouteEndpointNames(defaultRoute);
      setManualStartPoint(endpoints.startPoint);
      setManualEndPoint(endpoints.endPoint);
    } else {
      setDifficultyIndex(difficultyDefaultIndex.unknown);
      setDurationMinutes(180);
      setManualStartPoint("");
      setManualEndPoint("");
    }
  };

  const handleRouteNameChange = (routeName: string) => {
    setSelectedRouteName(routeName);
    if (editingReviewId) {
      setEditingReviewId(null);
      setEditingExistingImageUrls([]);
      setReviewText("");
      clearUploadedPhotos();
    }
  };

  const addSelectedPhotos = (selectedFiles: File[]) => {
    const remainingSlots = Math.max(5 - totalSelectedPhotoCount, 0);
    const acceptedFiles = selectedFiles.filter((file) => {
      const isSupportedType = file.type === "image/jpeg" || file.type === "image/png";
      return isSupportedType && file.size <= 10 * 1024 * 1024;
    });

    if (remainingSlots <= 0) {
      return "사진은 최대 5장까지 추가할 수 있습니다.";
    }

    const nextPhotos = selectedFiles
      .filter((file) => acceptedFiles.includes(file))
      .slice(0, remainingSlots)
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        url: createPhotoPreviewUrl(file),
        file,
      }));

    if (nextPhotos.length > 0) {
      setUploadedPhotos((photos) => [...photos, ...nextPhotos]);
    }

    return acceptedFiles.length !== selectedFiles.length ? "JPG, PNG 파일만 10MB 이하로 추가할 수 있습니다." : null;
  };

  const removeUploadedPhoto = (photoId: string) => {
    setUploadedPhotos((photos) => {
      const photoToRemove = photos.find((photo) => photo.id === photoId);
      if (photoToRemove) {
        revokePhotoPreviewUrl(photoToRemove.url);
      }

      return photos.filter((photo) => photo.id !== photoId);
    });
  };

  const removeExistingImageUrl = (imageUrl: string) => {
    setEditingExistingImageUrls((imageUrls) => imageUrls.filter((currentUrl) => currentUrl !== imageUrl));
  };

  const startEditingDraft = (review: MountainReview) => {
    const routeForReview = routes.find(
      (route) => route.name === review.routeName || getRouteDisplayName(route) === review.routeName,
    );
    const reviewIsManualCourse = Boolean(review.routeStartPoint || review.routeEndPoint || !routeForReview);
    setEditingReviewId(review.id);
    setSelectedRouteName(reviewIsManualCourse ? manualRouteName : routeForReview?.name ?? manualRouteName);
    setManualStartPoint(review.routeStartPoint ?? "");
    setManualEndPoint(review.routeEndPoint ?? "");
    setDifficultyIndex(Math.max(0, difficultyOptions.indexOf(review.difficulty)));
    setDurationMinutes(review.durationMinutes);
    setReviewText(review.body);
    setEditingExistingImageUrls(review.imageUrls);
    clearUploadedPhotos();
  };

  return {
    selectedRouteName,
    setSelectedRouteName,
    isManualCourse,
    selectedRoute,
    selectedRouteEndpoints,
    manualStartPoint,
    setManualStartPoint,
    manualEndPoint,
    setManualEndPoint,
    difficultyIndex,
    setDifficultyIndex,
    durationMinutes,
    setDurationMinutes,
    reviewText,
    setReviewText,
    trimmedReviewText,
    uploadedPhotos,
    editingExistingImageUrls,
    editingReviewId,
    totalSelectedPhotoCount,
    resetDraft,
    handleRouteNameChange,
    addSelectedPhotos,
    removeUploadedPhoto,
    removeExistingImageUrl,
    startEditingDraft,
  };
}
