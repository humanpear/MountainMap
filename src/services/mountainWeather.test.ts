import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/mountainWeatherStations', () => ({
  getMountainWeatherStationId: vi.fn((mountainName: string) =>
    mountainName === 'mapped-mountain' ? '77' : undefined
  )
}));

vi.mock('./env', () => ({
  env: {
    mountainWeatherProxyUrl: undefined
  }
}));

const weatherPayload = {
  famousMTSDTO: {
    stnName: 'mapped-mountain',
    forestAWS10Min: {
      tm: '2026-07-05 15:00:00',
      tm2m: '24.2',
      rn: '4.5',
      hm2m: '90.3',
      ws2m: '0.0'
    }
  },
  others: {
    senseTemp: '24.2',
    iconCode: '4'
  },
  mountainClimbIdxValue: 'fair',
  mountainClimbIdxTm: '2026-07-05 14:00:00'
};

describe('fetchMountainWeather', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => weatherPayload
      }))
    );
  });

  it('uses the same-origin weather proxy by default', async () => {
    const { fetchMountainWeather } = await import('./mountainWeather');

    await fetchMountainWeather('mapped-mountain');

    expect(fetch).toHaveBeenCalledWith('/api/mtweather?stnId=77', {
      headers: {
        Accept: 'application/json'
      },
      signal: undefined
    });
  });

  it('returns null before calling fetch when no station id is mapped', async () => {
    const { fetchMountainWeather } = await import('./mountainWeather');

    await expect(fetchMountainWeather('unknown-mountain')).resolves.toBeNull();

    expect(fetch).not.toHaveBeenCalled();
  });
});
