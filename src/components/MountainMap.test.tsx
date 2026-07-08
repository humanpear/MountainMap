import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mountain } from '../types';
import { MountainMap } from './MountainMap';

const kakaoMocks = vi.hoisted(() => {
  const relayout = vi.fn();
  const setCenter = vi.fn();
  const setLevel = vi.fn();
  const setZoomable = vi.fn();
  const addControl = vi.fn();
  const overlayInstances: Array<{ setMap: ReturnType<typeof vi.fn> }> = [];
  const mapInstance = {
    relayout,
    setCenter,
    setLevel,
    setBounds: vi.fn(),
    getLevel: vi.fn(() => 12),
    setZoomable,
    addControl
  };
  const Map = vi.fn(function () {
    return mapInstance;
  });
  const CustomOverlay = vi.fn(function () {
    const overlay = { setMap: vi.fn() };
    overlayInstances.push(overlay);
    return overlay;
  });
  const maps = {
    load: vi.fn((callback: () => void) => callback()),
    LatLng: vi.fn(function (latitude: number, longitude: number) {
      return { latitude, longitude };
    }),
    Map,
    CustomOverlay,
    Marker: vi.fn(),
    Polyline: vi.fn(),
    LatLngBounds: vi.fn(),
    ZoomControl: vi.fn(function () {
      return {};
    }),
    ControlPosition: {
      RIGHT: 1
    }
  };

  return {
    addControl,
    CustomOverlay,
    Map,
    mapInstance,
    maps,
    overlayInstances,
    relayout,
    setCenter,
    setLevel,
    setZoomable
  };
});

vi.mock('../services/env', () => ({
  isKakaoMapConfigured: true
}));

vi.mock('../services/kakaoLoader', () => ({
  loadKakaoMaps: vi.fn(() => Promise.resolve(kakaoMocks.maps))
}));

let resizeCallback: ResizeObserverCallback | null = null;

class TestResizeObserver implements ResizeObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
}

const mountains: Mountain[] = [
  {
    id: 'm-1',
    name: 'Mountain One',
    province: 'Gangwon',
    city: 'Hongcheon',
    latitude: 37.871,
    longitude: 127.961,
    elevationMeters: 1051,
    address: 'Gangwon Hongcheon',
    shortDescription: 'Test mountain',
    selectionReason: 'Test'
  },
  {
    id: 'm-2',
    name: 'Mountain Two',
    province: 'Gyeonggi',
    city: 'Paju',
    latitude: 37.941,
    longitude: 126.969,
    elevationMeters: 675,
    address: 'Gyeonggi Paju',
    shortDescription: 'Test mountain',
    selectionReason: 'Test'
  }
];

function renderMountainMap() {
  return render(
    <MountainMap
      mountains={mountains}
      completedIds={new Set()}
      completionCounts={new Map()}
      candidateIds={new Set()}
      selectionMode={false}
      onMountainSelect={() => undefined}
      onCandidateToggle={() => undefined}
    />
  );
}

describe('MountainMap', () => {
  beforeEach(() => {
    resizeCallback = null;
    kakaoMocks.Map.mockClear();
    kakaoMocks.CustomOverlay.mockClear();
    kakaoMocks.overlayInstances.length = 0;
    kakaoMocks.relayout.mockClear();
    kakaoMocks.setCenter.mockClear();
    kakaoMocks.setLevel.mockClear();
    kakaoMocks.setZoomable.mockClear();
    kakaoMocks.addControl.mockClear();
    window.kakao = { maps: kakaoMocks.maps } as unknown as Window['kakao'];
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
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

  it('relayouts the Kakao map when the map container size changes after mount', async () => {
    renderMountainMap();

    await waitFor(() => {
      expect(kakaoMocks.Map).toHaveBeenCalledTimes(1);
      expect(kakaoMocks.CustomOverlay).toHaveBeenCalledTimes(mountains.length);
      expect(resizeCallback).not.toBeNull();
    });

    kakaoMocks.relayout.mockClear();

    act(() => {
      resizeCallback?.([], new TestResizeObserver(() => undefined));
    });

    expect(kakaoMocks.relayout).toHaveBeenCalledTimes(1);
  });

  it('detaches Kakao marker overlays when the map unmounts', async () => {
    const { unmount } = renderMountainMap();

    await waitFor(() => {
      expect(kakaoMocks.overlayInstances).toHaveLength(mountains.length);
    });

    const overlays = [...kakaoMocks.overlayInstances];
    unmount();

    overlays.forEach((overlay) => {
      expect(overlay.setMap).toHaveBeenCalledWith(null);
    });
  });
});
