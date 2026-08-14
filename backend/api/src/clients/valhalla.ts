import { AppError } from '../lib/errors.js';

export class ValhallaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 10000,
  ) {}

  async ping(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new AppError('VALHALLA_ERROR', 'status not ok', 502);
  }

  async post<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new AppError('VALHALLA_UNREACHABLE', 'routing engine unavailable', 503);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AppError(
        'VALHALLA_ERROR',
        `routing engine returned ${res.status}`,
        502,
        { detail: text.slice(0, 500) },
      );
    }
    return (await res.json()) as T;
  }
}
