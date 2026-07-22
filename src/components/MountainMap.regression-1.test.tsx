import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mountain } from '../types';
import { MountainMap } from './MountainMap';

const kakaoRegressionMocks = vi.hoisted(() => {
  const panTo = vi.fn();
  const coordsFromPoint = vi.fn((point: object) => ({ point }));
  const Point = vi.fn(function (x: number, y: number) {
    return { sdkPoint: true, x, y };
  });
  const mapInstance = {
    relayout: vi.fn(),
    getCenter: vi.fn(() => ({ latitude: 36.4, longitude: 127.8 })),
    getBounds: vi.fn(() => ({ contain: vi.fn(() => false) })),
    getProjection: vi.fn(() => ({
      pointFromCoords: vi.fn((position: { longitude?: number }) =>
        position.longitude === 126.969 ? { x: 1200, y: 350 } : { x: 500, y: 320 },
      ),
      coordsFromPoint,
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
    Point,
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

  return { coordsFromPoint, mapInstance, maps, panTo, Point };
});

vi.mock('../services/env', () => ({
  isKakaoMapConfigured: true,
}));

vi.mock('../services/kakaoLoader', () => ({
  loadKakaoMaps: vi.fn(() => Promise.resolve(kakaoRegressionMocks.maps)),
}));

class RegressionResizeObserver implements ResizeObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();

  constructor(_callback: ResizeObserverCallback) {}
}

const regressionMountains: Mountain[] = [
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

describe('MountainMap focused mountain regression', () => {
  beforeEach(() => {
    kakaoRegressionMocks.Point.mockClear();
    kakaoRegressionMocks.coordsFromPoint.mockClear();
    kakaoRegressionMocks.panTo.mockClear();
    window.kakao = { maps: kakaoRegressionMocks.maps } as unknown as Window['kakao'];
    vi.stubGlobal('ResizeObserver', RegressionResizeObserver);
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

  // Regression: ISSUE-001 - 랜덤 추천 산으로 이동할 때 일반 객체가 Kakao 좌표 변환을 중단시킴
  // Found by /qa on 2026-07-19
  // Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-07-19.md
  it('passes a Kakao Point instance when converting the adjusted map center', async () => {
    const { rerender } = render(
      <MountainMap
        mountains={regressionMountains}
        fitResultsRevision={0}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />,
    );

    await waitFor(() => expect(kakaoRegressionMocks.maps.Map).toHaveBeenCalledTimes(1));

    rerender(
      <MountainMap
        mountains={regressionMountains}
        cameraRequest={{ mountainId: 'm-2', revision: 1, reason: 'random-winner' }}
        fitResultsRevision={0}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />,
    );

    await waitFor(() => expect(kakaoRegressionMocks.Point).toHaveBeenCalledTimes(1));
    expect(kakaoRegressionMocks.coordsFromPoint).toHaveBeenCalledWith(
      expect.objectContaining({ sdkPoint: true }),
    );
    expect(kakaoRegressionMocks.panTo).toHaveBeenCalledTimes(1);
  });
});
