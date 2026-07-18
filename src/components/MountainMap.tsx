import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/classNames';
import { isKakaoMapConfigured } from '../services/env';
import { loadKakaoMaps } from '../services/kakaoLoader';
import type { Mountain } from '../types';

type MountainMapProps = {
  mountains: readonly Mountain[];
  selectedMountainId?: string;
  focusedMountainId?: string;
  fitResultsRevision: number;
  layoutKey?: string;
  completedIds: ReadonlySet<string>;
  completionCounts: ReadonlyMap<string, number>;
  highlightedId?: string;
  onMountainSelect: (mountain: Mountain) => void;
};

const KOREA_BOUNDS = {
  minLat: 33,
  maxLat: 39,
  minLng: 124,
  maxLng: 132
};

const INITIAL_MAP_CENTER = {
  latitude: 36.4,
  longitude: 127.8
};

const INITIAL_MAP_LEVEL = 12;
const MOBILE_INITIAL_MAP_LEVEL = 13;
const MOBILE_MAP_QUERY = '(max-width: 900px)';
const SINGLE_RESULT_MAP_LEVEL = 7;
const MAP_VISIBLE_MARGIN = 48;

function getInitialMapLevel() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return INITIAL_MAP_LEVEL;
  }

  return window.matchMedia(MOBILE_MAP_QUERY).matches ? MOBILE_INITIAL_MAP_LEVEL : INITIAL_MAP_LEVEL;
}

const markerClass = {
  map: 'absolute inset-0 overflow-hidden',
  fallback:
    'absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_50%,rgba(47,107,79,0.08),transparent_28%),linear-gradient(135deg,#e8eee9_0%,#f9fbfa_50%,#dde8e1_100%)]',
  grid:
    'absolute inset-0 bg-[linear-gradient(rgba(47,107,79,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(47,107,79,0.08)_1px,transparent_1px)] bg-[length:56px_56px]',
  label:
    'absolute bottom-[92px] left-5 max-w-[300px] rounded-lg border border-[#d8e0da] bg-white/90 px-3 py-2.5 text-[13px] leading-[18px] text-[#627168] max-[560px]:left-3 max-[560px]:right-3 max-[560px]:max-w-none',
  marker:
    'absolute block h-9 w-9 -translate-x-1/2 -translate-y-1/2 overflow-visible rounded-full border-2 border-[#2f6b4f] bg-white p-0 text-[#2f6b4f] shadow-[0_8px_20px_rgba(24,34,29,0.18)] transition-[transform,box-shadow,background,border-color] duration-150 ease-out',
  kakaoMarker:
    'relative block h-9 w-9 overflow-visible rounded-full border-2 border-[#2f6b4f] bg-white p-0 text-[#2f6b4f] shadow-[0_8px_20px_rgba(24,34,29,0.18)] transition-[transform,box-shadow,background,border-color] duration-150 ease-out',
  selected:
    'z-[6] scale-105 border-[#d7922b] bg-[#fff9ed] shadow-[0_0_0_4px_rgba(255,255,255,0.94),0_0_0_9px_rgba(215,146,43,0.42),0_12px_28px_rgba(24,34,29,0.2)]',
  kakaoSelected:
    'z-[6] scale-110 border-[#d7922b] bg-[#fff9ed] shadow-[0_0_0_4px_rgba(255,255,255,0.94),0_0_0_9px_rgba(215,146,43,0.42),0_12px_28px_rgba(24,34,29,0.2)]',
  completed: 'border-[#1f8a5b]',
  triangleBack: 'absolute bottom-[7px] left-1 z-[2] h-0 w-0 border-x-8 border-b-[14px] border-x-transparent',
  triangleFront: 'absolute bottom-[7px] left-2 z-[1] h-0 w-0 border-x-[10px] border-b-[20px] border-x-transparent',
  medals: 'pointer-events-none absolute -top-[11px] left-1/2 z-[4] flex -translate-x-1/2 items-center justify-center gap-px',
  medal:
    'relative h-[11px] w-[11px] rounded-full border border-[#9b6a16] bg-[linear-gradient(135deg,#ffe08a_0%,#d7922b_72%)] shadow-[0_1px_3px_rgba(24,34,29,0.22)] before:absolute before:left-px before:top-[7px] before:h-[7px] before:w-[5px] before:rotate-[14deg] before:bg-[#c95345] before:content-[\'\'] after:absolute after:right-px after:top-[7px] after:h-[7px] after:w-[5px] after:-rotate-[14deg] after:bg-[#c95345] after:content-[\'\']',
  name:
    'pointer-events-none absolute left-1/2 top-[37px] z-[3] max-w-[84px] -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-[#d8e0da]/90 bg-white/95 px-1.5 py-0.5 text-[11px] font-extrabold leading-[14px] text-[#18221d] shadow-[0_4px_10px_rgba(24,34,29,0.12)]',
  selectedName: 'border-[#d7922b]/75 bg-[#fff7e8] text-[#1f4e39] shadow-[0_7px_16px_rgba(24,34,29,0.18)]'
};

export function MountainMap(props: MountainMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const lastFitResultsRevisionRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const focusedMountain = useMemo(
    () => props.mountains.find((mountain) => mountain.id === props.focusedMountainId),
    [props.mountains, props.focusedMountainId]
  );
  const mountainIdsKey = useMemo(
    () => props.mountains.map((mountain) => mountain.id).sort().join('|'),
    [props.mountains],
  );

  useEffect(() => {
    if (!isKakaoMapConfigured || !containerRef.current) {
      return;
    }

    let isActive = true;

    loadKakaoMaps()
      .then((maps) => {
        if (!isActive || !containerRef.current) {
          return;
        }

        mapRef.current = new maps.Map(containerRef.current, {
          center: new maps.LatLng(INITIAL_MAP_CENTER.latitude, INITIAL_MAP_CENTER.longitude),
          level: getInitialMapLevel(),
          tileAnimation: true
        });
        mapRef.current.setZoomable(true);
        mapRef.current.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
        setMapReady(true);
      })
      .catch(() => {
        if (isActive) {
          setMapError('Kakao Maps를 불러오지 못했습니다.');
        }
      });
    return () => {
      isActive = false;
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao?.maps) {
      return;
    }

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    const nextOverlays = props.mountains.map((mountain) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = getMarkerClass(mountain, props, true);
      element.setAttribute('aria-label', `${mountain.name} 선택`);
      appendMarkerGlyph(element, getMarkerTone(mountain, props));
      appendMedals(element, props.completionCounts.get(mountain.id) ?? 0);
      appendLabel(element, mountain.name, isMarkerActive(mountain, props));
      element.addEventListener('click', () => {
        props.onMountainSelect(mountain);
      });

      const overlay = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(mountain.latitude, mountain.longitude),
        content: element,
        yAnchor: 0.9,
        zIndex: props.highlightedId === mountain.id ? 10 : 1
      });
      overlay.setMap(mapRef.current);
      return overlay;
    });
    overlaysRef.current = nextOverlays;

    return () => {
      nextOverlays.forEach((overlay) => overlay.setMap(null));
      if (overlaysRef.current === nextOverlays) {
        overlaysRef.current = [];
      }
    };
  }, [
    mapReady,
    mountainIdsKey,
    props.selectedMountainId,
    props.completedIds,
    props.completionCounts,
    props.highlightedId,
  ]);

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      !containerRef.current ||
      !window.kakao?.maps ||
      props.fitResultsRevision === lastFitResultsRevisionRef.current
    ) {
      return;
    }

    lastFitResultsRevisionRef.current = props.fitResultsRevision;
    if (props.mountains.length === 0) {
      return;
    }

    const map = mapRef.current;
    if (props.mountains.length === 1) {
      const mountain = props.mountains[0];
      const position = new window.kakao.maps.LatLng(mountain.latitude, mountain.longitude);
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        map.setCenter(position);
      } else {
        map.panTo(position);
      }
      map.setLevel(SINGLE_RESULT_MAP_LEVEL, { animate: !prefersReducedMotion });
      return;
    }

    const bounds = new window.kakao.maps.LatLngBounds();
    props.mountains.forEach((mountain) => {
      bounds.extend(new window.kakao.maps.LatLng(mountain.latitude, mountain.longitude));
    });

    const isMobile = window.matchMedia?.(MOBILE_MAP_QUERY).matches;
    const mapHeight = containerRef.current.getBoundingClientRect().height || window.innerHeight;
    map.setBounds(
      bounds,
      isMobile ? 88 : 64,
      isMobile ? 32 : 64,
      isMobile ? Math.min(320, Math.round(mapHeight * 0.42)) : 64,
      isMobile ? 32 : 64,
    );
  }, [mapReady, mountainIdsKey, props.fitResultsRevision, props.mountains]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !containerRef.current) {
      return;
    }

    let frameId: number | null = null;
    const refreshMapLayout = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        mapRef.current?.relayout();
      });
    };

    refreshMapLayout();

    window.addEventListener('resize', refreshMapLayout);
    window.addEventListener('orientationchange', refreshMapLayout);
    window.visualViewport?.addEventListener('resize', refreshMapLayout);
    window.visualViewport?.addEventListener('scroll', refreshMapLayout);

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshMapLayout);
    resizeObserver?.observe(containerRef.current);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', refreshMapLayout);
      window.removeEventListener('orientationchange', refreshMapLayout);
      window.visualViewport?.removeEventListener('resize', refreshMapLayout);
      window.visualViewport?.removeEventListener('scroll', refreshMapLayout);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.kakao?.maps) {
      return;
    }

    const refreshMapLayout = () => {
      mapRef.current?.relayout();
    };

    const frameId = window.requestAnimationFrame(refreshMapLayout);
    const timeoutId = window.setTimeout(refreshMapLayout, 240);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [mapReady, props.layoutKey]);

  useEffect(() => {
    if (!mapReady || !focusedMountain || !mapRef.current || !window.kakao?.maps) {
      return;
    }

    const map = mapRef.current;
    const position = new window.kakao.maps.LatLng(focusedMountain.latitude, focusedMountain.longitude);
    const projection = map.getProjection();
    const usesContainerProjection = Boolean(
      projection.containerPointFromCoords && projection.coordsFromContainerPoint,
    );
    const markerPoint = usesContainerProjection
      ? projection.containerPointFromCoords!(position)
      : projection.pointFromCoords(position);
    const containerRect = containerRef.current?.getBoundingClientRect();
    const mapBounds = map.getBounds();

    if (!containerRect) {
      return;
    }

    let visibleRight = containerRect.width - MAP_VISIBLE_MARGIN;
    let visibleBottom = containerRect.height - MAP_VISIBLE_MARGIN;
    const detailPanel = document.querySelector<HTMLElement>('[aria-label="선택한 산 정보"]');
    const panelRect = detailPanel?.getBoundingClientRect();

    if (panelRect) {
      const overlapsHorizontally = panelRect.left < containerRect.right && panelRect.right > containerRect.left;
      const overlapsVertically = panelRect.top < containerRect.bottom && panelRect.bottom > containerRect.top;
      if (overlapsHorizontally && overlapsVertically) {
        if (panelRect.left > containerRect.left + containerRect.width / 2) {
          visibleRight = Math.min(visibleRight, panelRect.left - containerRect.left - MAP_VISIBLE_MARGIN);
        }
        if (panelRect.top > containerRect.top) {
          visibleBottom = Math.min(visibleBottom, panelRect.top - containerRect.top - MAP_VISIBLE_MARGIN);
        }
      }
    }

    const desiredPoint = {
      x: Math.min(Math.max(markerPoint.x, MAP_VISIBLE_MARGIN), Math.max(MAP_VISIBLE_MARGIN, visibleRight)),
      y: Math.min(Math.max(markerPoint.y, MAP_VISIBLE_MARGIN), Math.max(MAP_VISIBLE_MARGIN, visibleBottom)),
    };
    const isVisible =
      mapBounds.contain(position) &&
      markerPoint.x === desiredPoint.x &&
      markerPoint.y === desiredPoint.y;

    if (isVisible) {
      return;
    }

    const centerPoint = usesContainerProjection
      ? projection.containerPointFromCoords!(map.getCenter())
      : projection.pointFromCoords(map.getCenter());
    const nextCenterPoint = window.kakao.maps.Point
      ? new window.kakao.maps.Point(
          centerPoint.x + markerPoint.x - desiredPoint.x,
          centerPoint.y + markerPoint.y - desiredPoint.y,
        )
      : {
          x: centerPoint.x + markerPoint.x - desiredPoint.x,
          y: centerPoint.y + markerPoint.y - desiredPoint.y,
        };
    const nextCenter = usesContainerProjection
      ? projection.coordsFromContainerPoint!(nextCenterPoint)
      : projection.coordsFromPoint(nextCenterPoint);
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      map.setCenter(nextCenter);
    } else {
      map.panTo(nextCenter);
    }
  }, [mapReady, focusedMountain]);

  if (!isKakaoMapConfigured || mapError) {
    return <FallbackMap {...props} mapError={mapError} />;
  }

  return <div ref={containerRef} className={markerClass.map} aria-label="카카오 지도" />;
}

function FallbackMap(props: MountainMapProps & { mapError?: string | null }) {
  return (
    <div className={markerClass.fallback} role="img" aria-label="개발용 100대 명산 지도">
      <div className={markerClass.grid} />
      <div className={markerClass.label}>{props.mapError ?? 'Kakao Maps 키가 없어 개발용 지도를 표시합니다.'}</div>
      {props.mountains.map((mountain) => {
        const left = ((mountain.longitude - KOREA_BOUNDS.minLng) / (KOREA_BOUNDS.maxLng - KOREA_BOUNDS.minLng)) * 100;
        const top = (1 - (mountain.latitude - KOREA_BOUNDS.minLat) / (KOREA_BOUNDS.maxLat - KOREA_BOUNDS.minLat)) * 100;
        const active = isMarkerActive(mountain, props);
        return (
          <button
            key={mountain.id}
            type="button"
            className={getMarkerClass(mountain, props)}
            style={{ left: `${left}%`, top: `${top}%` }}
            onClick={() => props.onMountainSelect(mountain)}
            aria-label={`${mountain.name} 선택`}
            title={mountain.name}
          >
            <MarkerGlyph tone={getMarkerTone(mountain, props)} />
            <MarkerMedals count={props.completionCounts.get(mountain.id) ?? 0} />
            <span className={cn(markerClass.name, active && markerClass.selectedName)}>{mountain.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function MarkerGlyph({ tone }: { tone: MarkerTone }) {
  return (
    <>
      <span className={cn(markerClass.triangleBack, tone.back)} aria-hidden="true" />
      <span className={cn(markerClass.triangleFront, tone.front)} aria-hidden="true" />
    </>
  );
}

function MarkerMedals({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <span className={markerClass.medals} aria-hidden="true">
      <span className={markerClass.medal} />
    </span>
  );
}

function appendMarkerGlyph(element: HTMLElement, tone: MarkerTone) {
  for (const className of [cn(markerClass.triangleBack, tone.back), cn(markerClass.triangleFront, tone.front)]) {
    const shape = document.createElement('span');
    shape.className = className;
    shape.setAttribute('aria-hidden', 'true');
    element.appendChild(shape);
  }
}

function appendMedals(element: HTMLElement, count: number) {
  if (count === 0) {
    return;
  }

  const medals = document.createElement('span');
  medals.className = markerClass.medals;
  medals.setAttribute('aria-hidden', 'true');

  const medal = document.createElement('span');
  medal.className = markerClass.medal;
  medals.appendChild(medal);

  element.appendChild(medals);
}

function appendLabel(element: HTMLElement, name: string, active: boolean) {
  const label = document.createElement('span');
  label.className = cn(markerClass.name, active && markerClass.selectedName);
  label.textContent = name;
  element.appendChild(label);
}

type MarkerTone = {
  back: string;
  front: string;
};

function getMarkerTone(mountain: Mountain, props: Pick<MountainMapProps, 'completedIds' | 'highlightedId' | 'selectedMountainId'>): MarkerTone {
  if (isMarkerActive(mountain, props)) {
    return { back: 'border-b-[#d7922b]', front: 'border-b-[#c77a1a]' };
  }
  if (props.completedIds.has(mountain.id)) {
    return { back: 'border-b-[#1f8a5b]', front: 'border-b-[#2f6b4f]' };
  }
  return { back: 'border-b-[#1f4e39]', front: 'border-b-[#2f6b4f]' };
}

function isMarkerActive(mountain: Mountain, props: Pick<MountainMapProps, 'selectedMountainId' | 'highlightedId'>) {
  return props.selectedMountainId === mountain.id || props.highlightedId === mountain.id;
}

function getMarkerClass(
  mountain: Mountain,
  props: Pick<MountainMapProps, 'selectedMountainId' | 'completedIds' | 'highlightedId'>,
  isKakaoOverlay = false
) {
  const active = isMarkerActive(mountain, props);
  return cn(
    isKakaoOverlay ? markerClass.kakaoMarker : markerClass.marker,
    props.completedIds.has(mountain.id) && markerClass.completed,
    active && (isKakaoOverlay ? markerClass.kakaoSelected : markerClass.selected)
  );
}
