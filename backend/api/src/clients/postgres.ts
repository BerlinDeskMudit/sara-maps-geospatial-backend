import pg from 'pg';

const { Pool } = pg;

export interface PlaceRow {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  lat: number;
  lon: number;
  score?: number;
  distance_m?: number;
}

export interface GeocodeFilter {
  center?: { lat: number; lon: number };
  radius?: number;
  limit: number;
}

export class PgClient {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10 });
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async geocode(q: string, filter: GeocodeFilter): Promise<PlaceRow[]> {
    const { center, radius, limit } = filter;
    const { rows } = await this.pool.query(
      `SELECT id, name, category, subcategory,
              way_lat AS lat, way_lon AS lon,
              similarity(lower(name), lower($1)) AS score,
              CASE WHEN $4::float8 IS NULL THEN NULL
                   ELSE ST_Distance(way::geography,
                                    ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography)
              END AS distance_m
         FROM sara.places
        WHERE (lower(name) % lower($1) OR name ILIKE '%' || $1 || '%')
          AND ($4::float8 IS NULL
               OR ST_DWithin(way::geography,
                             ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
                             $3))
        ORDER BY score DESC,
                 (way <-> ST_SetSRID(ST_MakePoint($5, $4), 4326))
        LIMIT $2`,
      [q, limit, radius ?? null, center?.lat ?? null, center?.lon ?? null],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      subcategory: r.subcategory,
      lat: Number(r.lat),
      lon: Number(r.lon),
      score: Number(r.score),
      distance_m: r.distance_m === null ? undefined : Math.round(Number(r.distance_m)),
    }));
  }

  async reverseGeocode(lat: number, lon: number, radius: number): Promise<PlaceRow | null> {
    const { rows } = await this.pool.query(
      `SELECT id, name, category, subcategory,
              way_lat AS lat, way_lon AS lon,
              ST_Distance(way::geography,
                          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance_m
         FROM sara.places
        WHERE ST_DWithin(way::geography,
                         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
        ORDER BY way <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
        LIMIT 1`,
      [lat, lon, radius],
    );
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      name: rows[0].name,
      category: rows[0].category,
      subcategory: rows[0].subcategory,
      lat: Number(rows[0].lat),
      lon: Number(rows[0].lon),
      distance_m: Math.round(Number(rows[0].distance_m)),
    };
  }

  async nearby(params: {
    lat: number;
    lon: number;
    radius: number;
    category?: string;
    subcategory?: string;
    limit: number;
  }): Promise<PlaceRow[]> {
    const { lat, lon, radius, category, subcategory, limit } = params;
    const { rows } = await this.pool.query(
      `SELECT p.id, p.name, p.category, p.subcategory,
              p.way_lat AS lat, p.way_lon AS lon,
              ST_Distance(p.way::geography, c.pt::geography) AS distance_m
         FROM sara.places p,
              LATERAL (SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326) AS pt) AS c
        WHERE ST_DWithin(p.way::geography, c.pt::geography, $3)
          AND ($4::text IS NULL OR p.category = $4)
          AND ($5::text IS NULL OR p.subcategory = $5)
        ORDER BY p.way <-> c.pt
        LIMIT $6`,
      [lat, lon, radius, category ?? null, subcategory ?? null, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      subcategory: r.subcategory,
      lat: Number(r.lat),
      lon: Number(r.lon),
      distance_m: Math.round(Number(r.distance_m)),
    }));
  }
}
