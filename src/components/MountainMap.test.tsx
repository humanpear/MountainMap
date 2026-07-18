import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mountain } from '../types';
import { MountainMap } from './MountainMap';

const kakaoMocks = vi.hoisted(() => {
  const relayout = vi.fn();
  const setCenter = vi.fn();
  const setLevel = vi.fn();
  const setBounds = vi.fn();
  const panTo = vi.fn();
  const boundsContain = vi.fn(() => true);
  const pointFromCoords = vi.fn((position: { latitude?: number; longitude?: number }) => ({
    x: position.longitude === 126.969 ? 1200 : position.longitude === 127.8 ? 500 : 520,
    y: position.latitude === 36.4 ? 350 : 320
  }));
  const coordsFromPoint = vi.fn((point: { x: number; y: number }) => ({ point }));
  const boundsExtend = vi.fn();
  const setZoomable = vi.fn();
  const addControl = vi.fn();
  const overlayInstances: Array<{
    setMap: ReturnType<typeof vi.fn>;
    setZIndex: ReturnType<typeof vi.fn>;
  }> = [];
  const mapInstance = {
    relayout,
    getCenter: vi.fn(() => ({ latitude: 36.4, longitude: 127.8 })),
    getBounds: vi.fn(() => ({ contain: boundsContain })),
    getProjection: vi.fn(() => ({ pointFromCoords, coordsFromPoint })),
    setCenter,
    panTo,
    setLevel,
    setBounds,
    getLevel: vi.fn(() => 12),
    setZoomable,
    addControl
  };
  const Map = vi.fn(function (_container: HTMLElement, _options: unknown) {
    return mapInstance;
  });
  const CustomOverlay = vi.fn(function () {
    const overlay = { setMap: vi.fn(), setZIndex: vi.fn() };
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
    LatLngBounds: vi.fn(function () {
      return { extend: boundsExtend, contain: boundsContain };
    }),
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
    boundsContain,
    boundsExtend,
    coordsFromPoint,
    panTo,
    pointFromCoords,
    relayout,
    setCenter,
    setBounds,
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
    regionCodes: ['gangwon'],
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
    regionCodes: ['seoul-gyeonggi'],
    city: 'Paju',
    latitude: 37.941,
    longitude: 126.969,
    elevationMeters: 675,
    address: 'Gyeonggi Paju',
    shortDescription: 'Test mountain',
    selectionReason: 'Test'
  }
];

type MountainMapTestProps = {
  mountains?: readonly Mountain[];
  focusedMountainId?: string;
  highlightedId?: string;
  fitResultsRevision?: number;
  layoutKey?: string;
};

function renderMountainMap(overrides: MountainMapTestProps = {}) {
  return render(
    <MountainMap
      mountains={overrides.mountains ?? mountains}
      focusedMountainId={overrides.focusedMountainId}
      highlightedId={overrides.highlightedId}
      fitResultsRevision={overrides.fitResultsRevision ?? 0}
      layoutKey={overrides.layoutKey}
      completedIds={new Set()}
      completionCounts={new Map()}
      onMountainSelect={() => undefined}
    />
  );
}

function createMatchMedia(matchingQuery?: string) {
  return vi.fn((query: string) => ({
    matches: query === matchingQuery,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as typeof window.matchMedia;
}

describe('MountainMap', () => {
  beforeEach(() => {
    resizeCallback = null;
    kakaoMocks.Map.mockClear();
    kakaoMocks.CustomOverlay.mockClear();
    kakaoMocks.overlayInstances.length = 0;
    kakaoMocks.relayout.mockClear();
    kakaoMocks.setCenter.mockClear();
    kakaoMocks.setBounds.mockClear();
    kakaoMocks.setLevel.mockClear();
    kakaoMocks.panTo.mockClear();
    kakaoMocks.boundsContain.mockReset();
    kakaoMocks.boundsContain.mockReturnValue(true);
    kakaoMocks.boundsExtend.mockClear();
    kakaoMocks.pointFromCoords.mockClear();
    kakaoMocks.coordsFromPoint.mockClear();
    kakaoMocks.setZoomable.mockClear();
    kakaoMocks.addControl.mockClear();
    window.kakao = { maps: kakaoMocks.maps } as unknown as Window['kakao'];
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('matchMedia', createMatchMedia());
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 700,
      width: 1000,
      height: 700,
      toJSON: () => ({})
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

  it('uses the desktop initial map level by default', async () => {
    renderMountainMap();

    await waitFor(() => {
      expect(kakaoMocks.Map).toHaveBeenCalledTimes(1);
    });

    expect(kakaoMocks.Map.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ level: 12 }));
  });

  it('uses the wider mobile initial map level on narrow screens', async () => {
    vi.stubGlobal('matchMedia', createMatchMedia('(max-width: 900px)'));

    renderMountainMap();

    await waitFor(() => {
      expect(kakaoMocks.Map).toHaveBeenCalledTimes(1);
    });

    expect(kakaoMocks.Map.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ level: 13 }));
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

  it('removes old overlays and creates only the filtered marker set', async () => {
    const completedIds = new Set<string>();
    const completionCounts = new Map<string, number>();
    const { rerender } = render(
      <MountainMap
        mountains={mountains}
        fitResultsRevision={0}
        completedIds={completedIds}
        completionCounts={completionCounts}
        onMountainSelect={() => undefined}
      />
    );
    await waitFor(() => expect(kakaoMocks.overlayInstances).toHaveLength(2));
    const previousOverlays = [...kakaoMocks.overlayInstances];

    rerender(
      <MountainMap
        mountains={[mountains[0]]}
        fitResultsRevision={1}
        completedIds={completedIds}
        completionCounts={completionCounts}
        onMountainSelect={() => undefined}
      />
    );

    await waitFor(() => expect(kakaoMocks.overlayInstances).toHaveLength(3));
    previousOverlays.forEach((overlay) => {
      expect(overlay.setMap).toHaveBeenCalledWith(null);
    });
  });

  it('does not recreate overlays when only result sorting changes', async () => {
    const completedIds = new Set<string>();
    const completionCounts = new Map<string, number>();
    const onMountainSelect = () => undefined;
    const { rerender } = render(
      <MountainMap
        mountains={mountains}
        fitResultsRevision={0}
        completedIds={completedIds}
        completionCounts={completionCounts}
        onMountainSelect={onMountainSelect}
      />
    );
    await waitFor(() => expect(kakaoMocks.CustomOverlay).toHaveBeenCalledTimes(2));

    rerender(
      <MountainMap
        mountains={[...mountains].reverse()}
        fitResultsRevision={0}
        completedIds={completedIds}
        completionCounts={completionCounts}
        onMountainSelect={onMountainSelect}
      />
    );

    expect(kakaoMocks.CustomOverlay).toHaveBeenCalledTimes(2);
    expect(kakaoMocks.setBounds).not.toHaveBeenCalled();
  });

  it('updates random recommendation highlighting without recreating overlays', async () => {
    const { rerender } = renderMountainMap({ highlightedId: 'm-1' });
    await waitFor(() => expect(kakaoMocks.CustomOverlay).toHaveBeenCalledTimes(2));

    kakaoMocks.overlayInstances.forEach((overlay) => overlay.setZIndex.mockClear());
    rerender(
      <MountainMap
        mountains={mountains}
        highlightedId="m-2"
        fitResultsRevision={0}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />
    );

    expect(kakaoMocks.CustomOverlay).toHaveBeenCalledTimes(2);
    expect(kakaoMocks.overlayInstances[0].setZIndex).toHaveBeenLastCalledWith(1);
    expect(kakaoMocks.overlayInstances[1].setZIndex).toHaveBeenLastCalledWith(10);
  });

  it('fits all result markers only when fitResultsRevision increases', async () => {
    const { rerender } = renderMountainMap();
    await waitFor(() => expect(kakaoMocks.Map).toHaveBeenCalledTimes(1));
    expect(kakaoMocks.setBounds).not.toHaveBeenCalled();

    rerender(
      <MountainMap
        mountains={mountains}
        fitResultsRevision={1}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />
    );

    expect(kakaoMocks.boundsExtend).toHaveBeenCalledTimes(2);
    expect(kakaoMocks.setBounds).toHaveBeenCalledTimes(1);

    rerender(
      <MountainMap
        mountains={[...mountains].reverse()}
        fitResultsRevision={1}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />
    );

    expect(kakaoMocks.setBounds).toHaveBeenCalledTimes(1);
  });

  it('keeps the current camera when an applied filter has no results', async () => {
    const { rerender } = renderMountainMap();
    await waitFor(() => expect(kakaoMocks.Map).toHaveBeenCalledTimes(1));

    rerender(
      <MountainMap
        mountains={[]}
        fitResultsRevision={1}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />
    );

    expect(kakaoMocks.setBounds).not.toHaveBeenCalled();
    expect(kakaoMocks.panTo).not.toHaveBeenCalled();
    expect(kakaoMocks.setLevel).not.toHaveBeenCalled();
  });

  it('centers a single applied result with a bounded zoom level', async () => {
    const { rerender } = renderMountainMap();
    await waitFor(() => expect(kakaoMocks.Map).toHaveBeenCalledTimes(1));

    rerender(
      <MountainMap
        mountains={[mountains[0]]}
        fitResultsRevision={1}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />
    );

    expect(kakaoMocks.panTo).toHaveBeenCalledTimes(1);
    expect(kakaoMocks.setLevel).toHaveBeenCalledWith(7, { animate: true });
  });

  it('does not pan when the selected mountain is already visible', async () => {
    const { rerender } = renderMountainMap();
    await waitFor(() => expect(kakaoMocks.Map).toHaveBeenCalledTimes(1));

    rerender(
      <MountainMap
        mountains={mountains}
        focusedMountainId="m-1"
        fitResultsRevision={0}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />
    );

    expect(kakaoMocks.panTo).not.toHaveBeenCalled();
    expect(kakaoMocks.setLevel).not.toHaveBeenCalled();
  });

  it('pans once without changing zoom when the selected mountain is outside the visible area', async () => {
    const { rerender } = renderMountainMap();
    await waitFor(() => expect(kakaoMocks.Map).toHaveBeenCalledTimes(1));
    kakaoMocks.boundsContain.mockReturnValue(false);

    rerender(
      <MountainMap
        mountains={mountains}
        focusedMountainId="m-2"
        fitResultsRevision={0}
        completedIds={new Set()}
        completionCounts={new Map()}
        onMountainSelect={() => undefined}
      />
    );

    expect(kakaoMocks.panTo).toHaveBeenCalledTimes(1);
    expect(kakaoMocks.setLevel).not.toHaveBeenCalled();

    act(() => resizeCallback?.([], new TestResizeObserver(() => undefined)));
    expect(kakaoMocks.panTo).toHaveBeenCalledTimes(1);
    expect(kakaoMocks.setCenter).not.toHaveBeenCalled();
  });
});
