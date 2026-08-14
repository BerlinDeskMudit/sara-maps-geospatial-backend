-- Sara Maps curated schema.
-- Applied AFTER the osm2pgsql import (planet_osm_* tables must exist).
-- Provides: geocoding + POI search (sara.places) and MVT tile layers (sara.tile_*).

CREATE SCHEMA IF NOT EXISTS sara;

-- Map an OSM feature to a search category. The main category keys are
-- individual columns in the legacy osm2pgsql output; a few extra keys live in
-- the `tags` hstore (which only holds tags NOT captured as predefined columns).
CREATE OR REPLACE FUNCTION sara.feature_category(
  amenity text, shop text, leisure text, tourism text,
  office text, place text, highway text, building text, tags hstore)
RETURNS text AS $$
  SELECT CASE
    WHEN amenity IS NOT NULL THEN 'amenity'
    WHEN shop IS NOT NULL THEN 'shop'
    WHEN leisure IS NOT NULL THEN 'leisure'
    WHEN tourism IS NOT NULL THEN 'tourism'
    WHEN office IS NOT NULL THEN 'office'
    WHEN place IS NOT NULL THEN 'place'
    WHEN highway IS NOT NULL THEN 'highway'
    WHEN building IS NOT NULL THEN 'building'
    WHEN tags ? 'healthcare' THEN 'healthcare'
    WHEN tags ? 'craft' THEN 'craft'
    WHEN tags ? 'emergency' THEN 'emergency'
    WHEN tags ? 'government' THEN 'government'
    ELSE NULL END
$$ LANGUAGE sql IMMUTABLE;

-- Value of the matched category key (used as subcategory, e.g. 'cafe').
CREATE OR REPLACE FUNCTION sara.feature_value(
  amenity text, shop text, leisure text, tourism text,
  office text, place text, highway text, building text, tags hstore)
RETURNS text AS $$
  SELECT COALESCE(amenity, shop, leisure, tourism, office, place, highway, building,
                  tags -> 'healthcare', tags -> 'craft', tags -> 'emergency',
                  tags -> 'government')
$$ LANGUAGE sql IMMUTABLE;

-- Named, place-like features for forward/reverse geocoding and POI search.
DROP MATERIALIZED VIEW IF EXISTS sara.places;
CREATE MATERIALIZED VIEW sara.places AS
SELECT
  ('N' || osm_id::text)::text AS id,
  osm_id,
  'N'::text AS element_type,
  name,
  sara.feature_category(amenity, shop, leisure, tourism, office, place, highway, building, tags) AS category,
  sara.feature_value(amenity, shop, leisure, tourism, office, place, highway, building, tags) AS subcategory,
  tags,
  ST_SetSRID(way, 4326) AS way,
  ST_Y(way) AS way_lat,
  ST_X(way) AS way_lon,
  ST_GeoHash(way, 9) AS geohash
FROM planet_osm_point
WHERE name IS NOT NULL AND name <> ''
  AND sara.feature_category(amenity, shop, leisure, tourism, office, place, highway, building, tags) IS NOT NULL
UNION ALL
SELECT
  ('W' || osm_id::text)::text AS id,
  osm_id,
  'W'::text AS element_type,
  name,
  sara.feature_category(amenity, shop, leisure, tourism, office, place, highway, building, tags) AS category,
  sara.feature_value(amenity, shop, leisure, tourism, office, place, highway, building, tags) AS subcategory,
  tags,
  ST_SetSRID(ST_Centroid(way), 4326) AS way,
  ST_Y(ST_Centroid(way)) AS way_lat,
  ST_X(ST_Centroid(way)) AS way_lon,
  ST_GeoHash(ST_Centroid(way), 9) AS geohash
FROM planet_osm_polygon
WHERE name IS NOT NULL AND name <> ''
  AND sara.feature_category(amenity, shop, leisure, tourism, office, place, highway, building, tags) IS NOT NULL
WITH NO DATA;

CREATE UNIQUE INDEX places_pkey ON sara.places (id);
CREATE INDEX places_trgm_idx ON sara.places USING gin (lower(name) gin_trgm_ops);
CREATE INDEX places_tsv_idx  ON sara.places USING gin (to_tsvector('simple', name));
CREATE INDEX places_geom_idx ON sara.places USING gist (way);
CREATE INDEX places_geohash_idx ON sara.places (geohash);
CREATE INDEX places_category_idx ON sara.places (category, subcategory);

-- MVT layers consumed by Martin (auto-discovered from the `sara` schema).
CREATE OR REPLACE VIEW sara.tile_points AS
SELECT osm_id, name,
       sara.feature_category(amenity, shop, leisure, tourism, office, place, highway, building, tags) AS category,
       way
FROM planet_osm_point
WHERE name IS NOT NULL AND name <> ''
  AND sara.feature_category(amenity, shop, leisure, tourism, office, place, highway, building, tags) IS NOT NULL;

CREATE OR REPLACE VIEW sara.tile_roads AS
SELECT osm_id, name, highway AS class, way
FROM planet_osm_line
WHERE highway IS NOT NULL;

CREATE OR REPLACE VIEW sara.tile_areas AS
SELECT osm_id, name,
       sara.feature_category(amenity, shop, leisure, tourism, office, place, highway, building, tags) AS category,
       way
FROM planet_osm_polygon
WHERE name IS NOT NULL AND name <> ''
  AND (building IS NOT NULL OR landuse IS NOT NULL OR "natural" IS NOT NULL);

