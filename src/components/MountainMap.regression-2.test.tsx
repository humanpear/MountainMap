import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mountain } from '../types';
import { MountainMap } from './MountainMap';

const kakaoContainerProjectionMocks = vi.hoisted(() => {
  const pointFromCoords = vi.fn(() => ({ x: 9000, y: 9000 }));
  const coordsFromPoint = vi.fn((point: object) => ({ point, coordinateSpace: 'world' }));
  const containerPointFromCoords = vi.fn((position: { longitude?: number }) =>
    position.longitude === 126.969 ? { x: 1200, y: 350 } : { x: 500, y: 320 },
  );
  const coordsFromContainerPoint = vi.fn((point: object) => ({ point, coordinateSpace: 'container' }));
  const panTo = vi.fn();
  const mapInstance = {
    relayout: vi.fn(),
    getCenter: vi.fn(() => ({ latitude: 36.4, longitude: 127.8 })),
    getBounds: vi.fn(() => ({ contain: vi.fn(() => false) })),
    getProjection: vi.fn(() => ({
      pointFromCoords,
      coordsFromPoint,
      containerPointFromCoords,
      coordsFromContainerPoint,
    })),
    setCenter: vi.fn(),
    panTo,
    setLevel: vi.fn(),
    setBounds: vi.fn(),
    getLevel: vi.fn(() => 12),
    setZoomable: vi.fn(),
    addControl: vi.fn(),
  };
  const maps = {
    load: vi.fn((callback: () => void) => callback()),
    LatLng: vi.fn(function (latitude: number, longitude: number) {
      return { latitude, longitude };
    }),
    Point: vi.fn(function (x: number, y: number) {
      return { x, y, sdkPoint: true };
    }),
    Map: vi.fn(function () {
      return mapInstance;
    }),
    CustomOverlay: vi.fn(function () {
      return { setMap: vi.fn() };
    }),
    Marker: vi.fn(),
    Polyline: vi.fn(),
    LatLngBounds: vi.fn(function () {
      return { extend: vi.fn(), contain: vi.fn(() => false) };
    }),
    ZoomControl: vi.fn(function () {
      return {};
    }),
    ControlPosition: { RIGHT: 1 },
  };

  return {
    containerPointFromCoords,
    coordsFromContainerPoint,
    coordsFromPoint,
    maps,
    panTo,
    pointFromCoords,
  };
});

vi.mock('../services/env', () => ({ isKakaoMapConfigured: true }));
vi.mock('../services/kakaoLoader', () => ({
  loadKakaoMaps: vi.fn(() => Promise.resolve(kakaoContainerProjectionMocks.maps)),
}));

class ContainerProjectionResizeObserver implements ResizeObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();

  constructor(_callback: ResizeObserverCallback) {}
}

const mountains: Mountain[] = [
  {
    id: 'm-1',
    name: 'Mountain One',
    province: 'Gangwon',
    regionCodes: ['gangwon'],
    city: 'Hongcheon',
    latitude: 37.871,
    longitude: 127.961,
    elevationMeters: 1051,
    address: 'Gangwon Hongcheon',
    shortDescription: 'Test mountain',
    selectionReason: 'Test',
  },
  {
    id: 'm-2',
    name: 'Mountain Two',
    province: 'Gyeonggi',
    regionCodes: ['seoul-gyeonggi'],
    city: 'Paju',
    latitude: 37.941,
    longitude: 126.969,
    elevationMeters: 675,
    address: 'Gyeonggi Paju',
    shortDescription: 'Test mountain',
    selectionReason: 'Test',
  },
];

describe('MountainMap container projection regression', () => {
  beforeEach(() => {
    Object.values(kakaoContainerProjectionMocks).forEach((value) => {
      if (typeof value === 'function' && 'mockClear' in value) value.mockClear();
    });
    window.kakao = { maps: kakaoContainerProjectionMocks.maps } as unknown as Window['kakao'];
    vi.stubGlobal('ResizeObserver', ContainerProjectionResizeObserver);
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 700,
      width: 1000,
      height: 700,
      toJSON: () => ({}),
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Regression: FINDING-002 - 지도 패널의 픽셀 범위와 월드 투영 좌표를 비교해 선택 산이 다른 지역으로 이동함
  // Found by /design-review on 2026-07-19
  // Report: .gstack/design-reports/design-audit-127-0-0-1-2026-07-19.md
  it('uses container projection coordinates to keep the selected mountain in the visible map area', async () => {
    const { rerender } = render(
      <MountainMap
        mountains={mountains}
        fitResultsRevision={0}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />,
    );

    await waitFor(() => expect(kakaoContainerProjectionMocks.maps.Map).toHaveBeenCalledTimes(1));

    rerender(
      <MountainMap
        mountains={mountains}
        focusedMountainId="m-2"
        fitResultsRevision={0}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />,
    );

    await waitFor(() => expect(kakaoContainerProjectionMocks.panTo).toHaveBeenCalledTimes(1));
    expect(kakaoContainerProjectionMocks.containerPointFromCoords).toHaveBeenCalled();
    expect(kakaoContainerProjectionMocks.coordsFromContainerPoint).toHaveBeenCalledWith(
      expect.objectContaining({ sdkPoint: true, x: 748, y: 320 }),
    );
    expect(kakaoContainerProjectionMocks.pointFromCoords).not.toHaveBeenCalled();
    expect(kakaoContainerProjectionMocks.coordsFromPoint).not.toHaveBeenCalled();
  });
});
