const MTWEATHER_ENDPOINT = 'https://mtweather.nifos.go.kr/famous/mountainOne';

type ApiRequest = {
  method?: string;
  query: {
    stnId?: string | string[];
  };
};

type ApiResponse = {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  send(body: string): void;
  end(): void;
};

function getStationId(value: string | string[] | undefined) {
  const stationId = Array.isArray(value) ? value[0] : value;

  if (!stationId || !/^\d{1,3}$/.test(stationId)) {
    return undefined;
  }

  return stationId;
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  const stationId = getStationId(request.query.stnId);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method && request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!stationId) {
    response.status(400).json({ error: 'Missing or invalid stnId' });
    return;
  }

  const upstreamUrl = `${MTWEATHER_ENDPOINT}?stnId=${encodeURIComponent(stationId)}`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        Referer: `https://mtweather.nifos.go.kr/famous?stnId=${encodeURIComponent(stationId)}`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
      }
    });

    const body = await upstreamResponse.text();

    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    response.setHeader(
      'Content-Type',
      upstreamResponse.headers.get('content-type') ?? 'application/json; charset=utf-8'
    );
    response.status(upstreamResponse.status).send(body);
  } catch {
    response.status(502).json({ error: 'Mountain weather upstream request failed' });
  }
}
