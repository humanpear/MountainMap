export {};

declare global {
  interface Window {
    kakao: {
      maps: {
        load(callback: () => void): void;
        LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
        Point?: new (x: number, y: number) => KakaoPoint;
        Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap;
        CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay;
        Marker: new (options: KakaoMarkerOptions) => KakaoMarker;
        Polyline: new (options: KakaoPolylineOptions) => KakaoPolyline;
        LatLngBounds: new () => KakaoLatLngBounds;
        ZoomControl: new () => KakaoZoomControl;
        ControlPosition: {
          RIGHT: KakaoControlPosition;
        };
      };
    };
  }

  type KakaoLatLng = object;

  type KakaoMapOptions = {
    center: KakaoLatLng;
    level: number;
    tileAnimation?: boolean;
  };

  type KakaoMapSetLevelOptions = {
    animate?: boolean | { duration: number };
  };

  type KakaoMap = {
    relayout(): void;
    getCenter(): KakaoLatLng;
    getBounds(): KakaoLatLngBounds;
    getProjection(): KakaoMapProjection;
    setCenter(position: KakaoLatLng): void;
    panTo(position: KakaoLatLng): void;
    setLevel(level: number, options?: KakaoMapSetLevelOptions): void;
    setBounds(
      bounds: KakaoLatLngBounds,
      paddingTop?: number,
      paddingRight?: number,
      paddingBottom?: number,
      paddingLeft?: number,
    ): void;
    getLevel(): number;
    setZoomable(zoomable: boolean): void;
    addControl(control: KakaoZoomControl, position: KakaoControlPosition): void;
  };

  type KakaoLatLngBounds = {
    extend(position: KakaoLatLng): void;
    contain(position: KakaoLatLng): boolean;
  };

  type KakaoPoint = { x: number; y: number };

  type KakaoMapProjection = {
    pointFromCoords(position: KakaoLatLng): KakaoPoint;
    coordsFromPoint(point: KakaoPoint): KakaoLatLng;
  };

  type KakaoZoomControl = object;
  type KakaoControlPosition = number;

  type KakaoCustomOverlayOptions = {
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor?: number;
    zIndex?: number;
  };

  type KakaoCustomOverlay = {
    setMap(map: KakaoMap | null): void;
  };

  type KakaoMarkerOptions = {
    position: KakaoLatLng;
    map?: KakaoMap | null;
    title?: string;
  };

  type KakaoMarker = {
    setMap(map: KakaoMap | null): void;
  };

  type KakaoPolylineOptions = {
    map?: KakaoMap | null;
    path: KakaoLatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
  };

  type KakaoPolyline = {
    setMap(map: KakaoMap | null): void;
  };
}
