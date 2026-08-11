# Architecture

This repository follows the project foundation document in the root folder.

- `apps/web` renders public, cacheable, HTML-first sports news pages.
- `apps/admin` is the management UI shell.
- `apps/api` exposes the first Zod-validated RBAC-protected admin CRUD API.
- `packages/core` owns host resolution, URL generation, TDK resolution, DTOs, and cache tags.
- `packages/db` owns Prisma schema, seed data, and a memory repository used by the MVP and tests.
- `packages/seo` owns canonical, robots, sitemap, and JSON-LD helpers.
- `packages/templates` owns controlled server-rendered template packages.

Public page rendering must resolve the site from `Host` before building links, metadata, or template output.
