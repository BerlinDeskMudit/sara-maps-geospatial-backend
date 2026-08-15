# ADR-0001: Monorepo layout & gateway stack

Status: **Accepted**

## Context
Sara Maps needs a gateway + data pipeline + docs, with a React Native client coming later.
We want one repo, shared conventions, no multi-language sprawl in phase 1.

## Decision
- Single repo `SaraMap` with `docs/`, `docker/`, `scripts/`, `backend/`.
- Gateway written in **TypeScript on Fastify** (Node 22 LTS). Rationale: client is RN/TS →
  shared types/conventions; Fastify gives OpenAPI, typed JSON schema, fast startup; huge
  ecosystem for caching/rate-limit/logging.
- Geospatial engines are separate processes (Docker), not libraries, so they stay swappable.

## Consequences
- Later ML (Python) lives in a separate service; interop via HTTP/JSON or protobuf, not in-process.
- TypeScript type defs for API DTOs can be shared with the RN client via a published package or `types/` dir.
