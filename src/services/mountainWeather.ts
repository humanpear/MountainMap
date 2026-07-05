import { getMountainWeatherStationId } from '../data/mountainWeatherStations';
import { env } from './env';

const MTWEATHER_ENDPOINT = 'https://mtweather.nifos.go.kr/famous/mountainOne';
const MTWEATHER_ICON_BASE = '/weather-icons';

type MountainWeatherApiResponse = {
  famousMTSDTO?: {
    stnName?: string;
    forestAWS10Min?: {
      tm?: string;
      tm2m?: string | number;
      rn?: string | number;
      hm2m?: string | number;
      ws2m?: string | number;
    };
  };
  others?: {
    senseTemp?: string | number;
    iconCode?: string | number;
  };
  mountainClimbIdxValue?: string;
  mountainClimbIdxTm?: string;
};

export type MountainWeather = {
  stationId: string;
  stationName: string;
  observedAt: string;
  temperature: string;
  feelsLike: string;
  precipitation: string;
  humidity: string;
  windSpeed: string;
  climbIndex: string;
  climbIndexUpdatedAt: string;
  iconUrl: string;
  iconCode: string;
};

function normalizeNumber(value: string | number | undefined, digits = 1) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toFixed(digits);
}

function formatValue(value: string | number | undefined, unit: string, digits = 1) {
  const normalized = normalizeNumber(value, digits);
  return normalized ? `${normalized}${unit}` : '--';
}

function padIconCode(value: string | number | undefined) {
  return String(value ?? '1').padStart(2, '0');
}

function buildMountainWeatherUrl(stationId: string) {
  const proxyUrl = env.mountainWeatherProxyUrl?.trim();
  const defaultProxyUrl = '/api/mtweather';
  const selectedProxyUrl = proxyUrl || defaultProxyUrl;

  if (selectedProxyUrl.includes('{stnId}')) {
    return selectedProxyUrl.replace('{stnId}', encodeURIComponent(stationId));
  }

  const separator = selectedProxyUrl.includes('?') ? '&' : '?';
  return `${selectedProxyUrl}${separator}stnId=${encodeURIComponent(stationId)}`;
}

export function getMountainWeatherPageUrl(stationId: string) {
  return `https://mtweather.nifos.go.kr/famous?stnId=${encodeURIComponent(stationId)}`;
}

export function getMountainWeatherStationForName(mountainName: string) {
  return getMountainWeatherStationId(mountainName);
}

export async function fetchMountainWeather(mountainName: string, signal?: AbortSignal): Promise<MountainWeather | null> {
  const stationId = getMountainWeatherStationId(mountainName);

  if (!stationId) {
    return null;
  }

  const response = await fetch(buildMountainWeatherUrl(stationId), {
    headers: {
      Accept: 'application/json'
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`산악기상 응답 오류: ${response.status}`);
  }

  const payload = (await response.json()) as MountainWeatherApiResponse;
  const current = payload.famousMTSDTO?.forestAWS10Min;
  const iconCode = padIconCode(payload.others?.iconCode);

  return {
    stationId,
    stationName: payload.famousMTSDTO?.stnName ?? mountainName,
    observedAt: current?.tm ?? '',
    temperature: formatValue(current?.tm2m, '°C'),
    feelsLike: formatValue(payload.others?.senseTemp, '°C'),
    precipitation: formatValue(current?.rn, 'mm'),
    humidity: formatValue(current?.hm2m, '%', 0),
    windSpeed: formatValue(current?.ws2m, 'm/s'),
    climbIndex: payload.mountainClimbIdxValue ?? '--',
    climbIndexUpdatedAt: payload.mountainClimbIdxTm ?? '',
    iconUrl: `${MTWEATHER_ICON_BASE}/icon_${iconCode}.png`,
    iconCode
  };
}
