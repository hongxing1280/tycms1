import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import {
  adminLoginSchema,
  adminPermissionCreateSchema,
  adminPermissionUpdateSchema,
  adminRoleCreateSchema,
  adminRoleUpdateSchema,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  buildPublicOrigin,
  buildPublicUrl,
  categoryCreateSchema,
  categoryUpdateSchema,
  bulkDeleteSchema,
  groupCreateSchema,
  groupUpdateSchema,
  imageUploadSchema,
  type ImageUploadInput,
  leagueCreateSchema,
  leagueUpdateSchema,
  liveReplayCreateSchema,
  liveReplaySyncSchema,
  liveReplayUpdateSchema,
  liveProductCreateSchema,
  liveProductUpdateSchema,
  matchCreateSchema,
  matchUpdateSchema,
  newsCreateSchema,
  newsUpdateSchema,
  normalizeHost,
  paginationSchema,
  promotionLinkCreateSchema,
  promotionLinkUpdateSchema,
  promotionTypeCreateSchema,
  promotionTypeUpdateSchema,
  signalDomainCreateSchema,
  signalDomainUpdateSchema,
  signalSourceNameCreateSchema,
  signalSourceNameUpdateSchema,
  scheduledTaskCreateSchema,
  scheduledTaskUpdateSchema,
  securitySettingsUpdateSchema,
  siteCreateSchema,
  siteUpdateSchema,
  teamCreateSchema,
  teamUpdateSchema,
  tdkConfigCreateSchema,
  tdkConfigUpdateSchema,
  templateCreateSchema,
  templateUpdateSchema,
  type AdminPermissionRecord,
  type AdminRoleRecord,
  type CategoryRecord,
  type LiveReplayRecord,
  type NewsArticleRecord,
  type PromotionTypeRecord,
  type ScheduledTaskRecord,
  type SiteGroupRecord,
  type SiteRecord,
  type SportLeagueRecord,
  type SportMatchRecord,
  type SportTeamRecord,
  type TagRecord,
  type TdkConfigRecord,
  type TemplateRecord,
  type UrlConfigRecord,
  urlRules,
  urlConfigCreateSchema,
  urlConfigUpdateSchema,
} from '@sports/core';
import { cmsRepository } from '@sports/db';
import { assertPermission, getActor, getBearerToken, type Actor } from './auth';
import { parseSiteImportRows, type SiteImportRow } from './site-import';

const imageBucketDir = fileURLToPath(new URL('../../../.data/uploads/images/', import.meta.url));
const apiPort = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const imageBucketBaseUrl = (
  process.env.IMAGE_BUCKET_BASE_URL ?? `http://img.localhost:${apiPort}/uploads/images`
).replace(/\/+$/, '');
const maxImageUploadBytes = 5 * 1024 * 1024;

export function createApiServer(options: { logger?: boolean; scheduler?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 10 * 1024 * 1024 });

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const allowedOrigin =
      typeof origin === 'string' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
        ? origin
        : '*';

    reply.header('Vary', 'Origin');
    reply.header('Access-Control-Allow-Origin', allowedOrigin);
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    reply.header(
      'Access-Control-Allow-Headers',
      'Authorization,Content-Type,x-admin-role,x-admin-user',
    );
    reply.header('Access-Control-Max-Age', '600');

    if (request.method === 'OPTIONS') {
      reply.status(204).send();
      return reply;
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error.name === 'ZodError') {
      reply
        .status(400)
        .send({
          error: 'VALIDATION_ERROR',
          message: '请求参数不符合要求。',
          details: parseZodErrorDetails(error.message),
        });
      return;
    }

    if (error.name === 'ForbiddenError') {
      reply.status(403).send({ error: 'FORBIDDEN', message: error.message });
      return;
    }

    if (error.name === 'UnauthorizedError') {
      reply.status(401).send({ error: 'UNAUTHORIZED', message: error.message });
      return;
    }

    const clientErrorStatus =
      typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : undefined;

    if (clientErrorStatus) {
      reply.status(clientErrorStatus).send({ error: 'BAD_REQUEST', message: error.message });
      return;
    }

    if (
      error.message.includes('Duplicate') ||
      error.message.includes('不能重复') ||
      error.message.includes('不能删除')
    ) {
      reply.status(409).send({ error: 'CONFLICT', message: error.message });
      return;
    }

    if (error.message.includes('Invalid username or password')) {
      reply.status(401).send({ error: 'UNAUTHORIZED', message: error.message });
      return;
    }

    if (error.message.includes('Record not found')) {
      reply.status(404).send({ error: 'NOT_FOUND', message: error.message });
      return;
    }

    if (
      error.message.includes('validation') ||
      error.message.includes('must') ||
      error.message.includes('Invalid') ||
      error.message.includes('Expected') ||
      error.message.includes('Body cannot be empty')
    ) {
      reply.status(400).send({ error: 'BAD_REQUEST', message: error.message });
      return;
    }

    request.log.error({ err: error }, 'Unhandled API error');
    reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
  });

  app.get('/health', async () => ({ ok: true, service: 'sports-api' }));

  app.get('/uploads/images/:fileName', async (request, reply) => {
    const { fileName } = imageParams(request.params);
    if (!/^[a-f0-9]{64}\.(?:jpg|jpeg|png|webp|gif)$/.test(fileName)) {
      reply.status(404).send({ error: 'NOT_FOUND', message: 'Image not found' });
      return;
    }

    const filePath = join(imageBucketDir, fileName);
    if (!existsSync(filePath)) {
      reply.status(404).send({ error: 'NOT_FOUND', message: 'Image not found' });
      return;
    }

    reply
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .type(contentTypeFromFilename(fileName))
      .send(readFileSync(filePath));
  });

  app.addHook('preHandler', async (request) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (!path.startsWith('/admin') || path === '/admin/auth/login') {
      return;
    }

    getActor(request);
  });

  app.post('/admin/auth/login', async (request) => {
    const input = adminLoginSchema.parse(request.body);
    const userAgentHeader = request.headers['user-agent'];
    return cmsRepository.authenticateAdminUser(input, {
      ip: request.ip,
      userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader,
    });
  });

  app.get('/admin/auth/me', async (request) => {
    const actor = getActor(request);
    return {
      user: actor.user,
      permissions: actor.permissions,
      roles: actor.user.roles ?? [],
    };
  });

  app.post('/admin/auth/logout', async (request) => {
    const actor = getActor(request);
    const token = getBearerToken(request);
    return token ? cmsRepository.revokeAdminSession(token, actor) : { ok: true };
  });

  app.get('/admin/security-settings', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'security:write');
    return sanitizeSecuritySettings(cmsRepository.getSecuritySettings(), { includeTotpSecret: true });
  });

  app.patch('/admin/security-settings/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'security:write');
    return sanitizeSecuritySettings(
      cmsRepository.updateSecuritySettings(securitySettingsUpdateSchema.parse(request.body), actor),
      { includeTotpSecret: true },
    );
  });

  app.post('/admin/uploads/images', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    return storeUploadedImage(imageUploadSchema.parse(request.body));
  });

  app.get('/admin/users', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'user:read');
    return paginated(
      request.query,
      cmsRepository.listAdminUsers({
        ...allRowsOptions,
        includeTotpSecret: actor.permissions.includes('user:write') || actor.permissions.includes('security:write'),
      }),
    );
  });
  app.post('/admin/users', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'user:write');
    return cmsRepository.createAdminUser(adminUserCreateSchema.parse(request.body), actor);
  });
  app.patch('/admin/users/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'user:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateAdminUser(id, adminUserUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/users/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'user:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteAdminUser(id, actor);
  });
  app.post('/admin/users/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'user:write');
    return cmsRepository.bulkDeleteAdminUsers(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/roles', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'role:read');
    return paginated(request.query, cmsRepository.listAdminRoles(allRowsOptions));
  });
  app.post('/admin/roles', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'role:write');
    return cmsRepository.createAdminRole(
      withGeneratedRoleKey(adminRoleCreateSchema.parse(request.body)),
      actor,
    );
  });
  app.patch('/admin/roles/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'role:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateAdminRole(id, adminRoleUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/roles/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'role:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteAdminRole(id, actor);
  });
  app.post('/admin/roles/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'role:write');
    return cmsRepository.bulkDeleteAdminRoles(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/permissions', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'permission:read');
    return paginated(request.query, cmsRepository.listAdminPermissions(allRowsOptions));
  });
  app.post('/admin/permissions', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'permission:write');
    return cmsRepository.createAdminPermission(
      withGeneratedPermissionAction(adminPermissionCreateSchema.parse(request.body)),
      actor,
    );
  });
  app.patch('/admin/permissions/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'permission:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateAdminPermission(
      id,
      adminPermissionUpdateSchema.parse(request.body),
      actor,
    );
  });
  app.delete('/admin/permissions/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'permission:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteAdminPermission(id, actor);
  });
  app.post('/admin/permissions/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'permission:write');
    return cmsRepository.bulkDeleteAdminPermissions(
      bulkDeleteSchema.parse(request.body).ids,
      actor,
    );
  });

  app.get('/admin/sites', async (request) =>
    paginated(request.query, cmsRepository.listSites(allRowsOptions)),
  );
  app.post('/admin/sites', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    const input = siteCreateSchema.parse(request.body);
    const site = cmsRepository.createSite(
      {
        ...input,
        status: input.status,
        seoIndexStatus: 'INDEX',
        showSignalSources: input.showSignalSources,
      },
      actor,
    );
    const task = ensureSiteNewsCrawlTask(site, actor);
    if (task) {
      triggerInitialSiteNewsCrawl(task, actor, app.log);
    }
    return site;
  });
  app.post('/admin/sites/import-excel', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    const input = siteImportUploadInput(request.body);
    let rows: SiteImportRow[];
    try {
      rows = parseSiteImportRows(input.dataBase64);
    } catch (error) {
      throw siteImportClientError(messageFromImportError(error));
    }
    return importSitesFromExcelRows(rows, actor, app.log);
  });
  app.patch('/admin/sites/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    const { id } = idParams(request.params);
    const site = cmsRepository.updateSite(id, siteUpdateSchema.parse(request.body), actor);
    ensureSiteNewsCrawlTask(site, actor);
    return site;
  });
  app.delete('/admin/sites/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteSite(id, actor);
  });
  app.post('/admin/sites/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    return cmsRepository.bulkDeleteSites(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/groups', async (request) =>
    paginated(request.query, cmsRepository.listGroups(allRowsOptions)),
  );
  app.post('/admin/groups', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    return cmsRepository.createGroup(groupCreateSchema.parse(request.body), actor);
  });
  app.patch('/admin/groups/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateGroup(id, groupUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/groups/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteGroup(id, actor);
  });
  app.post('/admin/groups/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'site:write');
    return cmsRepository.bulkDeleteGroups(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/templates', async (request) =>
    paginated(request.query, cmsRepository.listTemplates(allRowsOptions)),
  );
  app.post('/admin/templates', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'template:write');
    return cmsRepository.createTemplate(
      withGeneratedTemplateKey(templateCreateSchema.parse(request.body)),
      actor,
    );
  });
  app.patch('/admin/templates/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'template:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateTemplate(id, templateUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/templates/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'template:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteTemplate(id, actor);
  });
  app.post('/admin/templates/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'template:write');
    return cmsRepository.bulkDeleteTemplates(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/url-configs', async (request) => {
    const query = siteQuery(request.query);
    return paginated(request.query, cmsRepository.listUrlConfigs(query.siteId));
  });
  app.post('/admin/url-configs', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'url-config:write');
    return cmsRepository.createUrlConfig(urlConfigCreateSchema.parse(request.body), actor);
  });
  app.patch('/admin/url-configs/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'url-config:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateUrlConfig(id, urlConfigUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/url-configs/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'url-config:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteUrlConfig(id, actor);
  });
  app.post('/admin/url-configs/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'url-config:write');
    return cmsRepository.bulkDeleteUrlConfigs(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/tdk-configs', async (request) => {
    const query = siteQuery(request.query);
    return paginated(request.query, cmsRepository.listTdkConfigs(query.siteId));
  });
  app.post('/admin/tdk-configs', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'tdk-config:write');
    return cmsRepository.createTdkConfig(tdkConfigCreateSchema.parse(request.body), actor);
  });
  app.patch('/admin/tdk-configs/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'tdk-config:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateTdkConfig(id, tdkConfigUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/tdk-configs/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'tdk-config:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteTdkConfig(id, actor);
  });
  app.post('/admin/tdk-configs/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'tdk-config:write');
    return cmsRepository.bulkDeleteTdkConfigs(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/categories', async (request) => {
    const query = siteQuery(request.query);
    return paginated(request.query, cmsRepository.listCategories(query.siteId));
  });
  app.post('/admin/categories', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'category:write');
    return cmsRepository.createCategory(
      withGeneratedCategorySlug(categoryCreateSchema.parse(request.body)),
      actor,
    );
  });
  app.patch('/admin/categories/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'category:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateCategory(id, categoryUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/categories/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'category:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteCategory(id, actor);
  });
  app.post('/admin/categories/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'category:write');
    return cmsRepository.bulkDeleteCategories(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/news', async (request) => {
    const query = siteQuery(request.query);
    const rows = query.siteId
      ? cmsRepository.store.news.filter((article) => article.siteId === query.siteId)
      : cmsRepository.store.news;
    return paginated(request.query, rows);
  });
  app.post('/admin/news', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    return cmsRepository.createNews(newsRecordInput(newsCreateSchema.parse(request.body)), actor);
  });
  app.patch('/admin/news/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateNews(id, newsRecordPatch(newsUpdateSchema.parse(request.body)), actor);
  });
  app.post('/admin/news/:id/publish', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:publish');
    const { id } = idParams(request.params);
    return cmsRepository.publishNews(id, actor);
  });
  app.delete('/admin/news/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteNews(id, actor);
  });
  app.post('/admin/news/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    return cmsRepository.bulkDeleteNews(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/live-replays', async (request) => {
    const query = siteQuery(request.query);
    return paginated(request.query, listLiveReplayArticles(query.siteId));
  });
  app.post('/admin/live-replays/sync', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    return syncExternalLiveReplays(actor, liveReplaySyncSchema.parse(request.body ?? {}));
  });
  app.post('/admin/live-replays', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    const input = liveReplayCreateSchema.parse(request.body);
    return liveReplayAdminRow(
      cmsRepository.createLiveReplay(liveReplayRecordInput(input), actor) as LiveReplayRecord,
    );
  });
  app.patch('/admin/live-replays/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    const { id } = idParams(request.params);
    const input = liveReplayUpdateSchema.parse(request.body);
    return liveReplayAdminRow(
      cmsRepository.updateLiveReplay(id, liveReplayRecordPatch(input, id), actor) as LiveReplayRecord,
    );
  });
  app.delete('/admin/live-replays/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteLiveReplay(id, actor);
  });
  app.post('/admin/live-replays/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'news:write');
    return cmsRepository.bulkDeleteLiveReplays(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/promotion-types', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:read');
    return paginated(
      request.query,
      cmsRepository.listPromotionTypes(allPromotionRowsOptions(request.query)),
    );
  });
  app.post('/admin/promotion-types', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:write');
    return cmsRepository.createPromotionType(
      withGeneratedPromotionTypeKey(promotionTypeCreateSchema.parse(request.body)),
      actor,
    );
  });
  app.patch('/admin/promotion-types/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:write');
    const { id } = idParams(request.params);
    return cmsRepository.updatePromotionType(
      id,
      promotionTypeUpdateSchema.parse(request.body),
      actor,
    );
  });
  app.delete('/admin/promotion-types/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:write');
    const { id } = idParams(request.params);
    return cmsRepository.deletePromotionType(id, actor);
  });
  app.post('/admin/promotion-types/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:write');
    return cmsRepository.bulkDeletePromotionTypes(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/promotion-links', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:read');
    return paginated(
      request.query,
      cmsRepository.listPromotionLinks(allPromotionRowsOptions(request.query)),
    );
  });
  app.post('/admin/promotion-links', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:write');
    return cmsRepository.createPromotionLink(promotionLinkCreateSchema.parse(request.body), actor);
  });
  app.patch('/admin/promotion-links/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:write');
    const { id } = idParams(request.params);
    return cmsRepository.updatePromotionLink(
      id,
      promotionLinkUpdateSchema.parse(request.body),
      actor,
    );
  });
  app.delete('/admin/promotion-links/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:write');
    const { id } = idParams(request.params);
    return cmsRepository.deletePromotionLink(id, actor);
  });
  app.post('/admin/promotion-links/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'promotion:write');
    return cmsRepository.bulkDeletePromotionLinks(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/leagues', async (request) =>
    paginated(request.query, cmsRepository.listLeagues(allRowsOptions)),
  );
  app.post('/admin/leagues/sync', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const result = await syncExternalSportsData(actor, sportsSyncOptions(request.body));
    return syncedRows(result.leagues);
  });
  app.post('/admin/leagues/sync-fake', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return syncedRows(syncFakeLeagues(actor));
  });
  app.post('/admin/leagues', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return cmsRepository.createLeague(
      withGeneratedLeagueSlug(leagueCreateSchema.parse(request.body)),
      actor,
    );
  });
  app.patch('/admin/leagues/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateLeague(id, leagueUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/leagues/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteLeague(id, actor);
  });
  app.post('/admin/leagues/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return cmsRepository.bulkDeleteLeagues(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/teams', async (request) =>
    paginated(request.query, cmsRepository.listTeams(allRowsOptions)),
  );
  app.post('/admin/teams/sync', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const result = await syncExternalSportsData(actor, sportsSyncOptions(request.body));
    return syncedRows(result.teams);
  });
  app.post('/admin/teams/sync-fake', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return syncedRows(syncFakeTeams(actor));
  });
  app.post('/admin/teams', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return cmsRepository.createTeam(
      withGeneratedTeamSlug(teamCreateSchema.parse(request.body)),
      actor,
    );
  });
  app.patch('/admin/teams/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateTeam(id, teamUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/teams/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteTeam(id, actor);
  });
  app.post('/admin/teams/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return cmsRepository.bulkDeleteTeams(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/matches', async (request) =>
    paginated(request.query, cmsRepository.listAllMatches(allRowsOptions)),
  );
  app.post('/admin/matches/sync', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const result = await syncExternalSportsData(actor, sportsSyncOptions(request.body));
    return syncedRows(result.matches);
  });
  app.post('/admin/matches/sync-fake', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return syncedRows(syncFakeMatches(actor));
  });
  app.post('/admin/matches', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return cmsRepository.createMatch(
      withGeneratedMatchSlug(matchCreateSchema.parse(request.body)),
      actor,
    );
  });
  app.patch('/admin/matches/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateMatch(id, matchUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/matches/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteMatch(id, actor);
  });
  app.post('/admin/matches/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'sports:write');
    return cmsRepository.bulkDeleteMatches(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/live-products', async (request) =>
    paginated(request.query, cmsRepository.listLiveProducts(allRowsOptions)),
  );
  app.post('/admin/live-products', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'live:write');
    return cmsRepository.createLiveProduct(liveProductCreateSchema.parse(request.body), actor);
  });
  app.patch('/admin/live-products/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'live:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateLiveProduct(id, liveProductUpdateSchema.parse(request.body), actor);
  });
  app.delete('/admin/live-products/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'live:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteLiveProduct(id, actor);
  });
  app.post('/admin/live-products/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'live:write');
    return cmsRepository.bulkDeleteLiveProducts(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/signal-domains', async (request) =>
    paginated(request.query, cmsRepository.listSignalDomains(allRowsOptions)),
  );
  app.post('/admin/signal-domains', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'signal:write');
    return cmsRepository.createSignalDomain(signalDomainCreateSchema.parse(request.body), actor);
  });
  app.patch('/admin/signal-domains/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'signal:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateSignalDomain(
      id,
      signalDomainUpdateSchema.parse(request.body),
      actor,
    );
  });
  app.delete('/admin/signal-domains/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'signal:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteSignalDomain(id, actor);
  });
  app.post('/admin/signal-domains/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'signal:write');
    return cmsRepository.bulkDeleteSignalDomains(bulkDeleteSchema.parse(request.body).ids, actor);
  });

  app.get('/admin/signal-source-names', async (request) =>
    paginated(request.query, cmsRepository.listSignalSourceNames(allRowsOptions)),
  );
  app.post('/admin/signal-source-names', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'signal:write');
    return cmsRepository.createSignalSourceName(
      signalSourceNameCreateSchema.parse(request.body),
      actor,
    );
  });
  app.patch('/admin/signal-source-names/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'signal:write');
    const { id } = idParams(request.params);
    return cmsRepository.updateSignalSourceName(
      id,
      signalSourceNameUpdateSchema.parse(request.body),
      actor,
    );
  });
  app.delete('/admin/signal-source-names/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'signal:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteSignalSourceName(id, actor);
  });
  app.post('/admin/signal-source-names/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'signal:write');
    return cmsRepository.bulkDeleteSignalSourceNames(
      bulkDeleteSchema.parse(request.body).ids,
      actor,
    );
  });

  app.get('/admin/cache/invalidation-jobs', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'cache:read');
    return paginated(request.query, cmsRepository.listInvalidationJobs());
  });

  app.get('/admin/audit-logs', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'audit:read');
    return paginated(request.query, cmsRepository.listAuditLogs());
  });

  app.get('/admin/scheduled-tasks', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'task:read');
    return paginated(request.query, cmsRepository.listScheduledTasks(allRowsOptions));
  });
  app.post('/admin/scheduled-tasks', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'task:write');
    const task = cmsRepository.createScheduledTask(scheduledTaskCreateSchema.parse(request.body), actor);
    return cmsRepository.updateScheduledTask(
      task.id,
      { nextRunAt: nextDailyRunAt(task.scheduleTime, task.timezone) },
      actor,
    );
  });
  app.patch('/admin/scheduled-tasks/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'task:write');
    const { id } = idParams(request.params);
    const input = scheduledTaskUpdateSchema.parse(request.body);
    const existing = cmsRepository.store.scheduledTasks.find((task) => task.id === id);
    const nextScheduleTime = input.scheduleTime ?? existing?.scheduleTime;
    const nextTimezone = input.timezone ?? existing?.timezone ?? 'Asia/Shanghai';
    return cmsRepository.updateScheduledTask(
      id,
      {
        ...input,
        nextRunAt: nextScheduleTime ? nextDailyRunAt(nextScheduleTime, nextTimezone) : existing?.nextRunAt,
      },
      actor,
    );
  });
  app.delete('/admin/scheduled-tasks/:id', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'task:write');
    const { id } = idParams(request.params);
    return cmsRepository.deleteScheduledTask(id, actor);
  });
  app.post('/admin/scheduled-tasks/bulk-delete', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'task:write');
    return cmsRepository.bulkDeleteScheduledTasks(bulkDeleteSchema.parse(request.body).ids, actor);
  });
  app.post('/admin/scheduled-tasks/:id/run', async (request) => {
    const actor = getActor(request);
    assertPermission(actor, 'task:write');
    const { id } = idParams(request.params);
    return runScheduledTask(id, actor);
  });

  if (options.scheduler) {
    const scheduler = createTaskScheduler(app.log);
    app.addHook('onReady', async () => {
      scheduler.start();
    });
    app.addHook('onClose', async () => {
      scheduler.stop();
    });
  }

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createApiServer({ scheduler: true });

  server.listen({ host: '127.0.0.1', port: apiPort }).catch((error) => {
    server.log.error(error);
    process.exit(1);
  });
}

type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
type AdminRoleCreateInput = CreateInput<AdminRoleRecord>;
type AdminPermissionCreateInput = CreateInput<AdminPermissionRecord>;
type CategoryCreateInput = CreateInput<CategoryRecord>;
type NewsCreateInput = CreateInput<NewsArticleRecord>;
type PromotionTypeCreateInput = CreateInput<PromotionTypeRecord>;
type LeagueCreateInput = CreateInput<SportLeagueRecord>;
type TeamCreateInput = CreateInput<SportTeamRecord>;
type MatchCreateInput = CreateInput<SportMatchRecord>;
type TemplateCreateInput = CreateInput<TemplateRecord>;
type ParsedAdminRoleCreateInput = Omit<AdminRoleCreateInput, 'key'> & { key?: string };
type ParsedAdminPermissionCreateInput = Omit<AdminPermissionCreateInput, 'action'> & {
  action?: string;
};
type ParsedCategoryCreateInput = Omit<CategoryCreateInput, 'slug'> & { slug?: string };
type ParsedNewsCreateInput = Omit<NewsCreateInput, 'slug'> & { slug?: string };
type ParsedPromotionTypeCreateInput = Omit<PromotionTypeCreateInput, 'key'> & { key?: string };
type ParsedLeagueCreateInput = Omit<LeagueCreateInput, 'slug'> & { slug?: string };
type ParsedTeamCreateInput = Omit<TeamCreateInput, 'slug'> & { slug?: string };
type ParsedTemplateCreateInput = Omit<TemplateCreateInput, 'key'> & { key?: string };

const allRowsOptions = { page: 1, pageSize: Number.MAX_SAFE_INTEGER };

type SiteImportCreatedRow = {
  rowNumber: number;
  id: string;
  name: string;
  domain: string;
  templateId?: string | null;
  urlConfigId?: string | null;
  tdkConfigId?: string | null;
};

type SiteImportSkippedRow = {
  rowNumber: number;
  domain: string;
  reason: string;
};

type SiteImportFailedRow = {
  rowNumber: number;
  domain: string;
  message: string;
};

function siteImportUploadInput(input: unknown): { filename: string; dataBase64: string } {
  if (!isRecord(input)) {
    throw siteImportClientError('导入请求不能为空。');
  }
  const filename = textFromValue(input.filename);
  const dataBase64 = textFromValue(input.dataBase64);
  if (!filename || !/\.xlsx$/i.test(filename)) {
    throw siteImportClientError('请上传 .xlsx 格式的站点导入表。');
  }
  if (!dataBase64) {
    throw siteImportClientError('导入文件内容不能为空。');
  }
  return { filename, dataBase64 };
}

function importSitesFromExcelRows(rows: SiteImportRow[], actor: Actor, logger: SchedulerLogger) {
  if (!rows.length) {
    throw siteImportClientError('表格中没有可导入的站点数据。');
  }

  const groups = cmsRepository.store.groups.filter((group) => group.status === 'ACTIVE');
  const templates = cmsRepository.store.templates.filter((template) => template.status === 'ACTIVE');
  const urlConfigs = cmsRepository.store.urlConfigs.filter((config) => config.status === 'ACTIVE');
  const tdkConfigs = cmsRepository.store.tdkConfigs.filter((config) => config.status === 'ACTIVE');
  const existingDomains = new Set(
    cmsRepository.store.sites
      .filter((site) => !site.deletedAt)
      .flatMap((site) => [site.primaryDomain, ...site.domains.map((domain) => domain.domain)])
      .flatMap(siteImportDomainAliases),
  );

  const created: SiteImportCreatedRow[] = [];
  const skipped: SiteImportSkippedRow[] = [];
  const failed: SiteImportFailedRow[] = [];

  rows.forEach((row) => {
    const domain = normalizeHost(firstImportValue(row.values, 'domainName', 'primaryDomain'));
    if (!domain) {
      failed.push({ rowNumber: row.rowNumber, domain: '', message: '域名不能为空。' });
      return;
    }

    const aliases = siteImportDomainAliases(domain);
    if (aliases.some((alias) => existingDomains.has(alias))) {
      skipped.push({ rowNumber: row.rowNumber, domain, reason: '域名或 www 别名已存在。' });
      return;
    }

    try {
      const input = siteCreateSchema.parse(
        compactObject({
          groupId: resolveImportGroupId(row.values.groupId, groups),
          name: firstImportValue(row.values, 'name', 'siteName') || domain,
          primaryDomain: domain,
          primaryProtocol: protocolFromImportDomain(firstImportValue(row.values, 'domainName', 'primaryDomain')),
          status: siteImportStatus(row.values.status),
          templateId: resolveImportTemplateId(row.values.tmplId, templates),
          urlConfigId: resolveImportUrlConfigId(row.values.urlId, urlConfigs),
          tdkConfigId: resolveImportTdkConfigId(row.values.tdkId, tdkConfigs),
          newsUpdateCount: positiveImportInteger(row.values.newsUpdateCount) ?? 10,
          showSignalSources: true,
          seoTitle: row.values.seoTitle,
          seoKeywords: firstImportValue(row.values, 'seoKeyword', 'seoKeywords'),
          seoDescription: firstImportValue(row.values, 'seoDesc', 'seoDescription'),
          analyticsCode: firstImportValue(row.values, 'statisticsCode', 'analyticsCode'),
          baiduPushToken: firstImportValue(row.values, 'baiduPush', 'baiduPushToken'),
          baiduVerifyCode: firstImportValue(row.values, 'baiduVerifyCode', 'baiduVerify'),
          remark: row.values.remark,
        }),
      );
      const site = cmsRepository.createSite(
        {
          ...input,
          status: input.status,
          seoIndexStatus: 'INDEX',
          showSignalSources: input.showSignalSources,
        },
        actor,
      );
      const task = ensureSiteNewsCrawlTask(site, actor);
      if (task) {
        triggerInitialSiteNewsCrawl(task, actor, logger);
      }
      aliases.forEach((alias) => existingDomains.add(alias));
      created.push({
        rowNumber: row.rowNumber,
        id: site.id,
        name: site.name,
        domain: site.primaryDomain,
        templateId: site.templateId,
        urlConfigId: site.urlConfigId,
        tdkConfigId: site.tdkConfigId,
      });
    } catch (error) {
      failed.push({
        rowNumber: row.rowNumber,
        domain,
        message: messageFromImportError(error),
      });
    }
  });

  return {
    totalRows: rows.length,
    created,
    skipped,
    failed,
    message: `导入完成：新增 ${created.length} 个，跳过 ${skipped.length} 个，失败 ${failed.length} 个。`,
  };
}

function firstImportValue(values: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = textFromValue(values[key]);
    if (value) return value;
  }
  return '';
}

function messageFromImportError(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

function siteImportClientError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}

function compactObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function resolveImportGroupId(raw: string | undefined, groups: SiteGroupRecord[]): string | undefined {
  const explicit = { '11': 'group-znbsgw2m' } as Record<string, string>;
  return resolveImportReference(raw, groups, explicit) ?? groups[0]?.id;
}

function resolveImportTemplateId(raw: string | undefined, templates: TemplateRecord[]): string | undefined {
  const explicit = { '1': 'template-jinqiu-live', '4': 'template-qzcad-portal' } as Record<string, string>;
  return resolveImportReference(raw, templates, explicit) ?? templates[0]?.id;
}

function resolveImportUrlConfigId(raw: string | undefined, configs: UrlConfigRecord[]): string | undefined {
  const explicit = { '5': 'url-four-column-rules' } as Record<string, string>;
  return (
    resolveImportReference(raw, configs, explicit) ??
    configs.find((config) => config.id === 'url-four-column-rules')?.id ??
    configs.find((config) => config.name.includes('四栏目'))?.id ??
    configs[0]?.id
  );
}

function resolveImportTdkConfigId(raw: string | undefined, configs: TdkConfigRecord[]): string | undefined {
  const explicit = { '4': 'tdk-default-rules' } as Record<string, string>;
  return (
    resolveImportReference(raw, configs, explicit) ??
    configs.find((config) => config.id === 'tdk-default-rules')?.id ??
    configs.find((config) => config.name.includes('默认'))?.id ??
    configs[0]?.id
  );
}

function resolveImportReference<T extends { id: string; name?: string; key?: string; folder?: string }>(
  raw: string | undefined,
  records: T[],
  explicit: Record<string, string> = {},
): string | undefined {
  const value = textFromValue(raw);
  if (!value) return undefined;
  const explicitId = explicit[value];
  if (explicitId && records.some((record) => record.id === explicitId)) {
    return explicitId;
  }
  const direct = records.find(
    (record) =>
      record.id === value ||
      record.name === value ||
      record.key === value ||
      record.folder === value,
  );
  if (direct) return direct.id;

  const numericIndex = Number(value);
  if (Number.isInteger(numericIndex) && numericIndex > 0) {
    return records[numericIndex - 1]?.id;
  }
  return undefined;
}

function siteImportStatus(raw: string | undefined): SiteRecord['status'] {
  const value = textFromValue(raw).toUpperCase();
  if (value === '2' || value === 'DISABLED' || value === '关闭' || value === '禁用') {
    return 'DISABLED';
  }
  if (value === 'MAINTENANCE' || value === '维护') {
    return 'MAINTENANCE';
  }
  return 'ACTIVE';
}

function protocolFromImportDomain(raw: string): SiteRecord['primaryProtocol'] | undefined {
  if (/^https:\/\//i.test(raw)) return 'https';
  if (/^http:\/\//i.test(raw)) return 'http';
  return undefined;
}

function positiveImportInteger(raw: string | undefined): number | undefined {
  const parsed = Number(textFromValue(raw));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function siteImportDomainAliases(domain: string | null | undefined): string[] {
  const normalized = normalizeHost(domain);
  if (!normalized) {
    return [];
  }
  if (isLocalOrPortImportDomain(normalized)) {
    return [normalized];
  }
  const bareDomain = normalized.startsWith('www.') ? normalized.slice(4) : normalized;
  return [...new Set([normalized, bareDomain, `www.${bareDomain}`])];
}

function isLocalOrPortImportDomain(domain: string): boolean {
  return /:\d+$/.test(domain) || domain === 'localhost' || domain.endsWith('.localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(domain);
}

function paginated<T>(query: unknown, items: T[]) {
  const { page, pageSize } = paginationSchema.parse(query);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    data: items.slice(start, start + pageSize),
    page: currentPage,
    pageSize,
    total,
    totalPages,
  };
}

function parseZodErrorDetails(message: string): unknown {
  try {
    return JSON.parse(message);
  } catch {
    return message;
  }
}

function syncedRows<T>(data: T[]) {
  return {
    data,
    count: data.length,
    syncedAt: new Date().toISOString(),
  };
}

function storeUploadedImage(input: ImageUploadInput) {
  const cleanBase64 = input.dataBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  const bytes = Buffer.from(cleanBase64, 'base64');

  if (!bytes.length || bytes.length > maxImageUploadBytes) {
    throw new Error('Invalid image size');
  }
  assertImageSignature(bytes, input.contentType);

  const hash = createHash('sha256').update(bytes).digest('hex');
  const extension = imageExtension(input.filename, input.contentType);
  const fileName = `${hash}.${extension}`;
  const filePath = join(imageBucketDir, fileName);
  const duplicated = existsSync(filePath);

  mkdirSync(imageBucketDir, { recursive: true });
  if (!duplicated) {
    writeFileSync(filePath, bytes);
  }

  return {
    url: `${imageBucketBaseUrl}/${fileName}`,
    fileName,
    hash,
    duplicated,
    size: bytes.length,
  };
}

function assertImageSignature(bytes: Buffer, contentType: ImageUploadInput['contentType']): void {
  const valid =
    (contentType === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (contentType === 'image/png' &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47) ||
    (contentType === 'image/gif' && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) ||
    (contentType === 'image/webp' &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP');

  if (!valid) {
    throw new Error('Invalid image content');
  }
}

function imageExtension(filename: string, contentType: ImageUploadInput['contentType']): string {
  const byType: Record<ImageUploadInput['contentType'], string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const fromFilename = extname(filename).replace(/^\./, '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromFilename)) {
    return fromFilename === 'jpeg' ? 'jpg' : fromFilename;
  }
  return byType[contentType];
}

function contentTypeFromFilename(fileName: string): string {
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  if (fileName.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function imageParams(input: unknown): { fileName: string } {
  if (
    typeof input === 'object' &&
    input !== null &&
    'fileName' in input &&
    typeof input.fileName === 'string'
  ) {
    return { fileName: input.fileName };
  }

  throw new Error('Image not found');
}

type TaskRunPayload =
  | {
      task: ScheduledTaskRecord;
      sports: Awaited<ReturnType<typeof syncExternalSportsData>>;
      message: string;
    }
  | {
      task: ScheduledTaskRecord;
      news: DongqiudiCrawlResult;
      message: string;
    }
  | {
      task: ScheduledTaskRecord;
      liveReplays: LiveReplaySyncResult;
      message: string;
    };

type DongqiudiCrawlOptions = {
  sourceUrl?: string;
  siteId?: string;
  categoryId?: string;
  limit?: number;
  minContentChars?: number;
};

type DongqiudiNewsCandidate = {
  title: string;
  url: string;
  summary?: string;
  content?: string;
  coverImageUrl?: string;
  publishedAt?: Date;
  author?: string;
};

type DongqiudiCrawlResult = {
  sourceUrl: string;
  created: number;
  skipped: number;
  articles: NewsArticleRecord[];
};

type ExternalLiveReplayRow = {
  title: string;
  createdAt: Date;
  homeTeam: string;
  awayTeam: string;
  playUrl: string;
};

type LiveReplaySyncResult = {
  sourceUrl: string;
  created: number;
  updated: number;
  skipped: number;
  data: LiveReplayAdminRow[];
};

type LiveReplayAdminRow = {
  id: string;
  title: string;
  create_time: number;
  home_team: string;
  away_team: string;
  play_url: string;
  publicUrl?: string;
};

type SchedulerLogger = {
  info: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
};

const dongqiudiApiNewsUrl = 'http://api.dongqiudi.com/app/tabs/iphone/1.json';
const liveReplayApiUrl = 'https://lmaappi.zhongxun132.cn/api/live/reply_history';
const externalFetchTimeoutMs = 18_000;
const staleRunningTaskMs = 30 * 60_000;
const missedScheduleGraceMs = 10 * 60_000;
const defaultDongqiudiMinContentChars = 160;
const maxDongqiudiCandidateMultiplier = 4;
const maxConcurrentScheduledTasks = 4;

function ensureSiteNewsCrawlTask(site: SiteRecord, actor: Actor): ScheduledTaskRecord | undefined {
  const category = resolveAutoNewsCategoryForSite(site);
  if (!category) {
    return undefined;
  }

  const existing = cmsRepository.store.scheduledTasks.find(
    (task) =>
      task.type === 'NEWS_CRAWL' &&
      isRecord(task.config) &&
      task.config.autoCreatedForSite === true &&
      task.config.siteId === site.id,
  );
  const scheduleTime = existing?.scheduleTime ?? dailySiteNewsScheduleTime(site.id);
  const timezone = existing?.timezone ?? 'Asia/Shanghai';
  const sourceUrl =
    (isRecord(existing?.config) ? safeExternalUrl(existing.config.sourceUrl) : undefined) ??
    safeExternalUrl(process.env.DONGQIUDI_NEWS_URL) ??
    dongqiudiApiNewsUrl;
  const config = {
    ...(isRecord(existing?.config) ? existing.config : {}),
    sourceUrl,
    siteId: site.id,
    categoryId: category.id,
    limit: articleLimitForSite(site, 10),
    minContentChars: defaultDongqiudiMinContentChars,
    autoCreatedForSite: true,
  };
  const input = {
    type: 'NEWS_CRAWL' as const,
    name: trimTaskName(`每日懂球帝新闻采集-${siteTaskDomain(site)}`),
    status: site.status === 'ACTIVE' ? 'ACTIVE' as const : 'PAUSED' as const,
    scheduleTime,
    timezone,
    config,
    nextRunAt: nextDailyRunAt(scheduleTime, timezone),
  };

  if (existing) {
    return cmsRepository.updateScheduledTask(existing.id, input, actor) as ScheduledTaskRecord;
  }

  const task = cmsRepository.createScheduledTask(input, actor);
  return cmsRepository.updateScheduledTask(task.id, { nextRunAt: input.nextRunAt }, actor) as ScheduledTaskRecord;
}

function triggerInitialSiteNewsCrawl(task: ScheduledTaskRecord, actor: Actor, logger: SchedulerLogger) {
  if (task.status !== 'ACTIVE' || isTestRuntime()) {
    return;
  }

  void runScheduledTask(task.id, actor).catch((error) => {
    logger.error({ taskId: task.id, err: error }, 'Initial site news crawl failed.');
  });
}

function resolveAutoNewsCategoryForSite(site: SiteRecord): CategoryRecord | undefined {
  const categories = cmsRepository.store.categories.filter(
    (category) => category.status === 'ACTIVE' && !category.deletedAt,
  );
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const configs = orderedUrlConfigsForSite(site);

  for (const config of configs) {
    for (const rule of urlRules(config)) {
      if (!urlRuleCallsNews(rule)) continue;
      const category = categoryById.get(rule.categoryId);
      if (category) {
        return category;
      }
    }
  }

  return categories.find(isNewsLikeCategoryForAutoTask) ?? categories[0];
}

function orderedUrlConfigsForSite(site: SiteRecord) {
  const activeConfigs = cmsRepository
    .listUrlConfigs(site.id)
    .filter((config) => config.status === 'ACTIVE');
  const preferredConfig = site.urlConfigId
    ? activeConfigs.find((config) => config.id === site.urlConfigId)
    : undefined;
  if (preferredConfig) {
    return [preferredConfig];
  }

  return uniqueScheduledUrlConfigs([
    ...activeConfigs.filter((config) => config.siteId === site.id),
    ...activeConfigs.filter((config) => !config.siteId),
  ]);
}

function uniqueScheduledUrlConfigs<T extends { id: string }>(configs: T[]): T[] {
  const seen = new Set<string>();
  return configs.filter((config) => {
    if (seen.has(config.id)) {
      return false;
    }
    seen.add(config.id);
    return true;
  });
}

function urlRuleCallsNews(rule: ReturnType<typeof urlRules>[number]): boolean {
  return (
    rule.pageType === 'NEWS_CATEGORY' ||
    rule.pageType === 'NEWS_DETAIL' ||
    (rule.detailRules ?? []).some((detailRule) => detailRule.pageType === 'NEWS_DETAIL')
  );
}

function isNewsLikeCategoryForAutoTask(category: CategoryRecord): boolean {
  return /新闻|资讯|快讯|文章|动态|分析|观察|情报|news|article|info|football|soccer|basketball|足球|篮球|nba|cba/i.test(
    `${category.name} ${category.slug}`,
  );
}

function dailySiteNewsScheduleTime(siteId: string): string {
  const digest = createHash('sha256').update(siteId).digest();
  const offsetMinutes = digest[0] % 120;
  const totalMinutes = 3 * 60 + 30 + offsetMinutes;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function trimTaskName(value: string): string {
  return value.length > 80 ? value.slice(0, 80) : value;
}

function siteTaskDomain(site: SiteRecord): string {
  return site.primaryDomain || site.domains.find((domain) => domain.isPrimary)?.domain || site.id;
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

function createTaskScheduler(logger: SchedulerLogger) {
  let timer: NodeJS.Timeout | undefined;
  const runningTaskIds = new Set<string>();

  async function tick() {
    const now = new Date();
    for (const task of cmsRepository.store.scheduledTasks) {
      if (task.status !== 'ACTIVE') continue;
      if (task.lastStatus === 'RUNNING' && task.lastRunAt && now.getTime() - task.lastRunAt.getTime() > staleRunningTaskMs) {
        cmsRepository.updateScheduledTaskRun(
          task.id,
          {
            lastStatus: 'FAILED',
            lastMessage: '上次任务运行超时，已自动恢复等待下次执行。',
            nextRunAt: nextDailyRunAt(task.scheduleTime, task.timezone, now),
            failureCount: task.failureCount + 1,
          },
          systemActor(),
        );
        continue;
      }
      if (!task.nextRunAt) {
        cmsRepository.updateScheduledTaskRun(
          task.id,
          { nextRunAt: nextDailyRunAt(task.scheduleTime, task.timezone, now) },
          systemActor(),
        );
        continue;
      }
      if (task.nextRunAt.getTime() < now.getTime() - missedScheduleGraceMs) {
        cmsRepository.updateScheduledTaskRun(
          task.id,
          {
            nextRunAt: nextDailyRunAt(task.scheduleTime, task.timezone, now),
            lastMessage: '上次计划时间已错过，已顺延到下一次执行。',
          },
          systemActor(),
        );
        continue;
      }
      if (task.nextRunAt.getTime() > now.getTime() || runningTaskIds.has(task.id)) {
        continue;
      }
      if (runningTaskIds.size >= maxConcurrentScheduledTasks) {
        break;
      }

      runningTaskIds.add(task.id);
      runScheduledTask(task.id, systemActor())
        .then((result) => logger.info({ taskId: task.id, result }, 'Scheduled task finished.'))
        .catch((error) => logger.error({ taskId: task.id, err: error }, 'Scheduled task failed.'))
        .finally(() => runningTaskIds.delete(task.id));
    }
  }

  return {
    start() {
      if (timer) return;
      void tick();
      timer = setInterval(() => {
        void tick();
      }, 60_000);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
    },
  };
}

async function runScheduledTask(taskId: string, actor: Actor): Promise<TaskRunPayload> {
  const task = cmsRepository.store.scheduledTasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw new Error(`Record not found: ${taskId}`);
  }

  cmsRepository.updateScheduledTaskRun(
    task.id,
    {
      lastRunAt: new Date(),
      lastStatus: 'RUNNING',
      lastMessage: '任务正在执行。',
    },
    actor,
  );

  try {
    if (task.type === 'SPORTS_SYNC') {
      const sports = await syncExternalSportsData(actor, sportsSyncOptions(task.config));
      const message = `赛事同步成功：联赛 ${sports.leagues.length} 条，球队 ${sports.teams.length} 条，赛事 ${sports.matches.length} 条。`;
      const updatedTask = cmsRepository.updateScheduledTaskRun(
        task.id,
        successTaskPatch(task, message),
        actor,
      ) as ScheduledTaskRecord;
      return { task: updatedTask, sports, message };
    }

    if (task.type === 'NEWS_CRAWL') {
      const news = await crawlDongqiudiNews(actor, dongqiudiCrawlOptions(task.config));
      const message = `懂球帝新闻采集成功：新增 ${news.created} 条，跳过 ${news.skipped} 条。`;
      const updatedTask = cmsRepository.updateScheduledTaskRun(
        task.id,
        successTaskPatch(task, message),
        actor,
      ) as ScheduledTaskRecord;
      return { task: updatedTask, news, message };
    }

    if (task.type === 'LIVE_REPLAY_SYNC') {
      const liveReplays = await syncExternalLiveReplays(actor, liveReplaySyncOptions(task.config));
      const message = `直播录像采集成功：新增 ${liveReplays.created} 条，更新 ${liveReplays.updated} 条，跳过 ${liveReplays.skipped} 条。`;
      const updatedTask = cmsRepository.updateScheduledTaskRun(
        task.id,
        successTaskPatch(task, message),
        actor,
      ) as ScheduledTaskRecord;
      return { task: updatedTask, liveReplays, message };
    }

    throw new Error(`Unsupported scheduled task type: ${task.type}`);
  } catch (error) {
    const message = messageFromUnknown(error);
    cmsRepository.updateScheduledTaskRun(
      task.id,
      {
        lastStatus: 'FAILED',
        lastMessage: message,
        nextRunAt: nextDailyRunAt(task.scheduleTime, task.timezone),
        failureCount: task.failureCount + 1,
      },
      actor,
    );
    throw error;
  }
}

function successTaskPatch(task: ScheduledTaskRecord, message: string): Partial<ScheduledTaskRecord> {
  return {
    lastStatus: 'SUCCESS',
    lastMessage: message,
    nextRunAt: nextDailyRunAt(task.scheduleTime, task.timezone),
    runCount: task.runCount + 1,
  };
}

function dongqiudiCrawlOptions(input: unknown): DongqiudiCrawlOptions {
  if (!isRecord(input)) {
    return {};
  }

  return {
    sourceUrl: safeExternalUrl(input.sourceUrl),
    siteId: textFromValue(input.siteId),
    categoryId: textFromValue(input.categoryId),
    limit: positiveLimit(input.limit),
    minContentChars: positiveInteger(input.minContentChars ?? input.minContentLength, 80, 2000),
  };
}

function liveReplaySyncOptions(input: unknown): ReturnType<typeof liveReplaySyncSchema.parse> {
  if (!isRecord(input)) {
    return liveReplaySyncSchema.parse({});
  }

  return liveReplaySyncSchema.parse({
    sourceUrl: safeExternalUrl(input.sourceUrl),
    siteId: textFromValue(input.siteId),
    categoryId: textFromValue(input.categoryId),
    limit: positiveLimit(input.limit),
  });
}

async function crawlDongqiudiNews(
  actor: Actor,
  options: DongqiudiCrawlOptions = {},
): Promise<DongqiudiCrawlResult> {
  const sourceUrl =
    options.sourceUrl ??
    safeExternalUrl(process.env.DONGQIUDI_NEWS_URL) ??
    dongqiudiApiNewsUrl;
  const minContentChars = options.minContentChars ?? defaultDongqiudiMinContentChars;
  const site = resolveNewsCrawlSite(options.siteId);
  const limit = options.limit ?? articleLimitForSite(site, 10);
  const category = resolveNewsCrawlCategory(options.categoryId);
  const candidates = await fetchDongqiudiCandidates(
    sourceUrl,
    Math.min(50, limit * maxDongqiudiCandidateMultiplier),
  );
  const articles: NewsArticleRecord[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    if (articles.length >= limit) break;

    if (hasExistingNewsInAnySite({ sourceUrl: candidate.url, title: candidate.title })) {
      skipped += 1;
      continue;
    }

    const articleInput = await resolveDongqiudiArticleInput(candidate, minContentChars);
    if (!articleInput) {
      skipped += 1;
      continue;
    }

    if (hasExistingNewsInAnySite({ sourceUrl: articleInput.url, title: articleInput.title })) {
      skipped += 1;
      continue;
    }

    const article = cmsRepository.createNews(
      withGeneratedNewsSlug({
        siteId: site.id,
        categoryId: category.id,
        title: articleInput.title,
        summary: articleInput.summary,
        content: articleInput.content,
        coverImageUrl: articleInput.coverImageUrl,
        author: articleInput.author || site.name,
        sourceUrl: articleInput.url,
        status: 'PUBLISHED',
        isTop: false,
        publishedAt: articleInput.publishedAt ?? new Date(),
        seoTitle: `${articleInput.title}_${site.name}`,
        seoKeywords: `${articleInput.title},${site.name}`,
        seoDescription: articleInput.summary,
      }),
      actor,
    ) as NewsArticleRecord;
    articles.push(article);
  }

  return {
    sourceUrl,
    created: articles.length,
    skipped,
    articles,
  };
}

function hasExistingNewsInAnySite(input: { sourceUrl?: string | null; title?: string | null }): boolean {
  const sourceUrl = input.sourceUrl?.trim();
  const title = input.title ? cleanNewsTitle(input.title) : '';

  return cmsRepository.store.news.some((article) => {
    if (article.deletedAt) {
      return false;
    }

    if (sourceUrl && article.sourceUrl === sourceUrl) {
      return true;
    }

    return Boolean(title && cleanNewsTitle(article.title) === title);
  });
}

async function syncExternalLiveReplays(
  actor: Actor,
  options: ReturnType<typeof liveReplaySyncSchema.parse>,
): Promise<LiveReplaySyncResult> {
  const sourceUrl = options.sourceUrl ?? safeExternalUrl(process.env.LIVE_REPLAY_API_URL) ?? liveReplayApiUrl;
  const site = resolveNewsCrawlSite(options.siteId);
  const category = resolveLiveReplayCategory(options.categoryId);
  const rows = await fetchExternalLiveReplayRows(sourceUrl, options.limit);
  const data: LiveReplayAdminRow[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  cmsRepository.withMutationBatch(() => {
    for (const row of rows) {
      const input = liveReplayRecordInputFromExternal(row, site.id, category.id);
      if (!input) {
        skipped += 1;
        continue;
      }

      ensureLiveReplayTags(site.id, [row.homeTeam, row.awayTeam]);

      const existing = cmsRepository.store.liveReplays.find(
        (replay) =>
          replay.siteId === site.id &&
          replay.slug === input.slug &&
          !replay.deletedAt,
      );

      if (existing) {
        const replay = cmsRepository.updateLiveReplay(
          existing.id,
          input,
          actor,
        ) as LiveReplayRecord;
        data.push(liveReplayAdminRow(replay));
        updated += 1;
        continue;
      }

      const replay = cmsRepository.createLiveReplay(input, actor) as LiveReplayRecord;
      data.push(liveReplayAdminRow(replay));
      created += 1;
    }
  });

  return {
    sourceUrl,
    created,
    updated,
    skipped,
    data,
  };
}

async function fetchExternalLiveReplayRows(sourceUrl: string, limit: number): Promise<ExternalLiveReplayRow[]> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      sourceUrl,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json,text/plain,*/*',
          'User-Agent': 'SportsCMSBot/1.0 (+live-replay-sync)',
        },
      },
      externalFetchTimeoutMs,
    );
  } catch (error) {
    throw sportsSyncError(`直播录像接口连接失败：${messageFromUnknown(error)}`);
  }

  if (!response.ok) {
    throw sportsSyncError(`直播录像接口返回 ${response.status}：${await response.text().catch(() => '')}`);
  }

  const payload = await parseJsonResponse(response, '直播录像接口');
  const records = extractLiveReplayRecordArray(payload);
  const rows = records
    .map(parseExternalLiveReplayRow)
    .filter((row): row is ExternalLiveReplayRow => Boolean(row))
    .slice(0, limit);

  if (!rows.length) {
    throw sportsSyncError('直播录像接口未返回可识别的数据，请确认字段包含 title、create_time、home_team、away_team、play_url。');
  }

  return rows;
}

async function parseJsonResponse(response: Response, label: string): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return [];
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw sportsSyncError(`${label}返回内容不是 JSON，暂时无法解析。`);
  }
}

function extractLiveReplayRecordArray(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const status = payload.status;
  if (status !== undefined && Number(status) !== 0) {
    throw sportsSyncError(`直播录像接口状态异常：${String(status)}`);
  }

  for (const key of ['data', 'list', 'rows', 'result', 'records']) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return Object.values(payload).flatMap((value) => extractLiveReplayRecordArray(value));
}

function parseExternalLiveReplayRow(row: Record<string, unknown>): ExternalLiveReplayRow | undefined {
  const title = cleanText(textFromValue(row.title));
  const createdAt = dateFromValue(row.create_time ?? row.createTime ?? row.created_at ?? row.createdAt);
  const homeTeam = cleanText(textFromValue(row.home_team ?? row.homeTeam));
  const awayTeam = cleanText(textFromValue(row.away_team ?? row.awayTeam));
  const playUrl = safeExternalUrl(row.play_url ?? row.playUrl);

  if (!title || !createdAt || !homeTeam || !awayTeam || !playUrl) {
    return undefined;
  }

  return {
    title,
    createdAt,
    homeTeam,
    awayTeam,
    playUrl,
  };
}

function liveReplayRecordInputFromExternal(
  row: ExternalLiveReplayRow,
  siteId: string,
  categoryId: string,
): Omit<LiveReplayRecord, 'id' | 'createdAt' | 'updatedAt'> | undefined {
  if (!row.title) {
    return undefined;
  }

  return {
    siteId,
    categoryId,
    title: row.title,
    slug: liveReplaySlug(row.title, row.createdAt, row.homeTeam, row.awayTeam),
    createTime: row.createdAt,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    playUrl: row.playUrl,
  };
}

function liveReplayRecordInput(
  input: ReturnType<typeof liveReplayCreateSchema.parse>,
): Omit<LiveReplayRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const site = resolveNewsCrawlSite(input.siteId);
  const category = resolveLiveReplayCategory(input.categoryId);
  const createTime = dateFromValue(input.create_time);
  if (!createTime) {
    throw new Error('create_time 必须是有效时间戳。');
  }

  ensureLiveReplayTags(site.id, [input.home_team, input.away_team]);

  return {
    siteId: site.id,
    categoryId: category.id,
    title: input.title,
    slug: liveReplaySlug(input.title, createTime, input.home_team, input.away_team),
    createTime,
    homeTeam: input.home_team,
    awayTeam: input.away_team,
    playUrl: input.play_url,
  };
}

function newsRecordInput(
  input: ReturnType<typeof newsCreateSchema.parse>,
): Omit<NewsArticleRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const site = resolveNewsCrawlSite(input.siteId);
  const category = resolveNewsCrawlCategory(input.categoryId);
  return withGeneratedNewsSlug({
    ...input,
    siteId: site.id,
    categoryId: category.id,
  });
}

function newsRecordPatch(input: ReturnType<typeof newsUpdateSchema.parse>): Partial<NewsArticleRecord> {
  const site = input.siteId ? resolveNewsCrawlSite(input.siteId) : undefined;
  const category = input.categoryId ? resolveNewsCrawlCategory(input.categoryId) : undefined;
  return compactNewsPatch({
    ...input,
    siteId: site?.id,
    categoryId: category?.id,
  });
}

function compactNewsPatch(input: Partial<NewsArticleRecord>): Partial<NewsArticleRecord> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<NewsArticleRecord>;
}

function liveReplayRecordPatch(
  input: ReturnType<typeof liveReplayUpdateSchema.parse>,
  idValue: string,
): Partial<LiveReplayRecord> {
  const existing = cmsRepository.getLiveReplayById(idValue) as LiveReplayRecord | undefined;
  if (!existing) {
    throw new Error(`Record not found: ${idValue}`);
  }

  const createTime = input.create_time === undefined ? existing.createTime : dateFromValue(input.create_time);
  if (!createTime) {
    throw new Error('create_time 必须是有效时间戳。');
  }

  const site = input.siteId ? resolveNewsCrawlSite(input.siteId) : undefined;
  const category = input.categoryId ? resolveLiveReplayCategory(input.categoryId) : undefined;
  const title = input.title ?? existing.title;
  const homeTeam = input.home_team ?? existing.homeTeam;
  const awayTeam = input.away_team ?? existing.awayTeam;

  ensureLiveReplayTags(site?.id ?? existing.siteId, [homeTeam, awayTeam]);

  return compactLiveReplayPatch({
    siteId: site?.id,
    categoryId: category?.id,
    title: input.title,
    slug: liveReplaySlug(title, createTime, homeTeam, awayTeam),
    createTime,
    homeTeam: input.home_team,
    awayTeam: input.away_team,
    playUrl: input.play_url,
  });
}

function compactLiveReplayPatch(input: Partial<LiveReplayRecord>): Partial<LiveReplayRecord> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<LiveReplayRecord>;
}

function listLiveReplayArticles(siteId?: string): LiveReplayAdminRow[] {
  return (cmsRepository.listLiveReplays({ siteId, page: 1, pageSize: Number.MAX_SAFE_INTEGER }) as LiveReplayRecord[])
    .map(liveReplayAdminRow);
}

function liveReplayAdminRow(replay: LiveReplayRecord): LiveReplayAdminRow {
  return {
    id: replay.id,
    title: replay.title,
    create_time: Math.floor(replay.createTime.getTime() / 1000),
    home_team: replay.homeTeam,
    away_team: replay.awayTeam,
    play_url: replay.playUrl,
    publicUrl: liveReplayPublicUrl(replay),
  };
}

function liveReplayPublicUrl(replay: LiveReplayRecord): string | undefined {
  const site = cmsRepository.store.sites.find((candidate) => candidate.id === replay.siteId && !candidate.deletedAt);
  const category = cmsRepository.store.categories.find((candidate) => candidate.id === replay.categoryId && !candidate.deletedAt);
  if (!site || !category) {
    return undefined;
  }

  try {
    return buildPublicUrl({
      site,
      pageType: 'VIDEO_DETAIL',
      data: {
        categorySlug: category.slug,
        videoSlug: replay.slug,
        newsSlug: replay.slug,
        slug: replay.slug,
      },
      urlConfigs: cmsRepository.listUrlConfigs(site.id),
      categoryId: category.id,
      absolute: true,
    });
  } catch {
    return `${buildPublicOrigin(site)}/video/${category.slug}/${replay.slug}.html`;
  }
}

function resolveLiveReplayCategory(categoryId?: string) {
  const category =
    (categoryId ? cmsRepository.store.categories.find((candidate) => candidate.id === categoryId && !candidate.deletedAt) : undefined) ??
    cmsRepository.store.categories.find((candidate) => isLiveReplayCategory(candidate) && !candidate.deletedAt) ??
    cmsRepository.store.categories.find((candidate) => candidate.status === 'ACTIVE' && !candidate.deletedAt);

  if (!category) {
    throw new Error('Record not found: live replay category');
  }
  if (!isLiveReplayCategory(category)) {
    throw new Error('直播录像必须保存到录像/回放栏目，请先选择 VIDEO_CATEGORY 对应栏目。');
  }
  return category;
}

function isLiveReplayCategory(category: { name: string; slug: string }): boolean {
  return /录像|回放|replay|video/i.test(`${category.name} ${category.slug}`);
}

function liveReplaySlug(title: string, createTime: Date, homeTeam?: string, awayTeam?: string): string {
  return `replay-${shortHash(`${title}:${createTime.getTime()}:${homeTeam ?? ''}:${awayTeam ?? ''}`)}`;
}

function ensureLiveReplayTags(siteId: string, names: Array<string | undefined>): TagRecord[] {
  return names
    .map((name) => cleanText(name ?? ''))
    .filter((name) => name.length >= 2)
    .map((name) => ensureTag(siteId, name));
}

function ensureTag(siteId: string, name: string): TagRecord {
  const normalizedName = normalizeTagName(name);
  const existing = cmsRepository.store.tags.find((tag) => tag.siteId === siteId && normalizeTagName(tag.name) === normalizedName);
  if (existing) {
    return existing;
  }

  const record: TagRecord = {
    id: `tag-${shortHash(`${siteId}:${name}:${Date.now()}`)}`,
    siteId,
    name,
    slug: nextUniqueIdentifier(
      normalizeIdentifier(name, 'tag'),
      cmsRepository.store.tags.filter((tag) => tag.siteId === siteId).map((tag) => tag.slug),
    ),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  cmsRepository.store.tags.push(record);
  return record;
}

function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

async function resolveDongqiudiArticleInput(
  candidate: DongqiudiNewsCandidate,
  minContentChars: number,
): Promise<DongqiudiNewsCandidate & { content: string; summary: string } | undefined> {
  if (!isUsableDongqiudiTitle(candidate.title) || !isLikelyDongqiudiArticleUrl(candidate.url)) {
    return undefined;
  }

  const detail = await fetchDongqiudiArticleDetail(candidate.url);
  const title = cleanNewsTitle(detail?.title || candidate.title);
  const content = normalizeArticleBody(detail?.content || candidate.content || '');
  const summary = cleanNewsSummary(detail?.summary || candidate.summary || summaryFromContent(content));

  if (!isUsableDongqiudiTitle(title) || !isUsableDongqiudiContent(content, minContentChars)) {
    return undefined;
  }

  return {
    title,
    url: candidate.url,
    summary,
    content,
    coverImageUrl: detail?.coverImageUrl || candidate.coverImageUrl,
    publishedAt: detail?.publishedAt ?? candidate.publishedAt,
    author: cleanNewsAuthor(detail?.author || candidate.author),
  };
}

async function fetchDongqiudiArticleDetail(url: string): Promise<Partial<DongqiudiNewsCandidate> | undefined> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'User-Agent': 'dongqiudi/8.2.0 (iPhone; iOS 17.0) SportsCMSBot/1.0',
        },
      },
      externalFetchTimeoutMs,
    );
  } catch {
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      return articleDetailFromUnknown(JSON.parse(text) as unknown, url) ?? articleDetailFromHtml(text, url);
    } catch {
      return articleDetailFromHtml(text, url);
    }
  }

  return articleDetailFromHtml(text, url);
}

async function fetchDongqiudiCandidates(sourceUrl: string, limit: number): Promise<DongqiudiNewsCandidate[]> {
  let response: Response;
  try {
    response = await fetchWithTimeout(sourceUrl, {
      headers: {
        Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        'User-Agent':
          'dongqiudi/8.2.0 (iPhone; iOS 17.0) SportsCMSBot/1.0',
      },
    }, externalFetchTimeoutMs);
  } catch (error) {
    throw sportsSyncError(`懂球帝新闻连接失败：${messageFromUnknown(error)}`);
  }

  if (!response.ok) {
    throw sportsSyncError(`懂球帝新闻返回 ${response.status}：${await response.text().catch(() => '')}`);
  }

  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const candidates = contentType.includes('json')
    ? candidatesFromJsonText(text, sourceUrl)
    : candidatesFromHtml(text, sourceUrl);

  const uniqueCandidates = uniqueNewsCandidates(candidates).slice(0, limit);
  if (!uniqueCandidates.length) {
    throw sportsSyncError('懂球帝页面没有解析到新闻链接，请检查采集地址或页面结构。');
  }

  return uniqueCandidates;
}

function articleDetailFromUnknown(value: unknown, baseUrl: string): Partial<DongqiudiNewsCandidate> | undefined {
  const details: Array<Partial<DongqiudiNewsCandidate>> = [];

  function visit(item: unknown): void {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    if (!isRecord(item)) {
      return;
    }

    const title = cleanText(textFromValue(item.title ?? item.name ?? item.article_title ?? item.headline));
    const summary = cleanText(textFromValue(item.summary ?? item.description ?? item.desc));
    const content = normalizeArticleBody(
      textFromValue(
        item.content ??
          item.body ??
          item.articleBody ??
          item.article_content ??
          item.articleContent ??
          item.content_text ??
          item.contentText ??
          item.detail,
      ),
    );
    const rawUrl = textFromValue(item.share ?? item.share_url ?? item.article_url ?? item.link ?? item.url);
    const url = rawUrl ? absoluteDongqiudiUrl(rawUrl, baseUrl) : undefined;
    const image = Array.isArray(item.image) ? item.image[0] : item.image;
    const coverImageUrl = firstExternalUrl(item.thumb, item.cover, item.cover_url, item.coverImageUrl, image);
    const publishedAt = dateFromValue(item.created_at ?? item.published_at ?? item.datePublished ?? item.sort_timestamp);
    const author = cleanText(textFromValue(item.author_name ?? (isRecord(item.author) ? item.author.name : undefined)));

    if (content) {
      details.push({
        title,
        summary,
        content,
        url,
        coverImageUrl,
        publishedAt,
        author,
      });
    }

    Object.entries(item)
      .filter(([key]) => key !== 'rawPayload')
      .forEach(([, child]) => visit(child));
  }

  visit(value);
  return details
    .filter((detail) => detail.content)
    .sort((a, b) => meaningfulTextLength(b.content ?? '') - meaningfulTextLength(a.content ?? ''))[0];
}

function articleDetailFromHtml(html: string, baseUrl: string): Partial<DongqiudiNewsCandidate> | undefined {
  const jsonLd = articleDetailFromJsonLd(html, baseUrl);
  const nextData = articleDetailFromNextData(html, baseUrl);
  const htmlDetail = articleDetailFromHtmlBlocks(html);
  const title = jsonLd?.title || nextData?.title || htmlMetaContent(html, ['og:title', 'twitter:title']) || htmlTitle(html);
  const summary =
    jsonLd?.summary ||
    nextData?.summary ||
    htmlMetaContent(html, ['description', 'og:description', 'twitter:description']);
  const coverImageUrl =
    jsonLd?.coverImageUrl ||
    nextData?.coverImageUrl ||
    htmlMetaContent(html, ['og:image', 'twitter:image']);
  const publishedAt =
    jsonLd?.publishedAt ||
    nextData?.publishedAt ||
    dateFromValue(htmlMetaContent(html, ['article:published_time', 'publishdate', 'pubdate']));
  const author =
    jsonLd?.author ||
    nextData?.author ||
    htmlMetaContent(html, ['author', 'article:author']);
  const content = [jsonLd?.content, nextData?.content, htmlDetail?.content]
    .filter(Boolean)
    .sort((a, b) => meaningfulTextLength(b ?? '') - meaningfulTextLength(a ?? ''))[0];

  if (!content) {
    return undefined;
  }

  return {
    title: cleanText(title),
    summary: cleanText(summary),
    content,
    coverImageUrl,
    publishedAt,
    author: cleanText(author),
  };
}

function articleDetailFromJsonLd(html: string, baseUrl: string): Partial<DongqiudiNewsCandidate> | undefined {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const text = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const detail = articleDetailFromUnknown(JSON.parse(decodeHtml(text)) as unknown, baseUrl);
      if (detail?.content) return detail;
    } catch {
      continue;
    }
  }
  return undefined;
}

function articleDetailFromNextData(html: string, baseUrl: string): Partial<DongqiudiNewsCandidate> | undefined {
  const match = /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match?.[1]) {
    return undefined;
  }

  try {
    return articleDetailFromUnknown(JSON.parse(decodeHtml(match[1])) as unknown, baseUrl);
  } catch {
    return undefined;
  }
}

function articleDetailFromHtmlBlocks(html: string): Partial<DongqiudiNewsCandidate> | undefined {
  const blocks: string[] = [];
  const patterns = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
    /<(?:div|section)\b[^>]*(?:class|id)=["'][^"']*(?:article|content|detail|news|rich-text)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      const content = normalizeArticleBody(match[1] ?? '');
      if (content) {
        blocks.push(content);
      }
    }
  }

  const content = blocks.sort((a, b) => meaningfulTextLength(b) - meaningfulTextLength(a))[0];
  return content ? { content } : undefined;
}

function candidatesFromJsonText(text: string, baseUrl: string): DongqiudiNewsCandidate[] {
  try {
    return candidatesFromUnknown(JSON.parse(text) as unknown, baseUrl);
  } catch {
    return candidatesFromHtml(text, baseUrl);
  }
}

function candidatesFromUnknown(value: unknown, baseUrl: string): DongqiudiNewsCandidate[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => candidatesFromUnknown(item, baseUrl));
  }

  if (!isRecord(value)) {
    return [];
  }

  const title = textFromValue(value.title ?? value.name ?? value.article_title);
  const articleId = textFromValue(value.id ?? value.articleId ?? value.article_id);
  const rawUrl = textFromValue(value.share ?? value.share_url ?? value.article_url ?? value.link ?? value.url ?? value.url1);
  const url = rawUrl
    ? absoluteDongqiudiUrl(rawUrl, baseUrl)
    : isNumericText(articleId)
      ? `https://www.dongqiudi.com/article/${articleId}`
      : '';
  const summary = textFromValue(value.summary ?? value.description ?? value.desc);
  const content = textFromValue(
    value.content ??
      value.body ??
      value.article_content ??
      value.articleContent ??
      value.content_text ??
      value.contentText ??
      value.detail,
  );
  const coverImageUrl = firstExternalUrl(
    value.thumb,
    value.cover,
    value.cover_url,
    value.coverImageUrl,
    value.image,
    firstMatchImageUrl(value.match_image_list),
  );
  const publishedAt = dateFromValue(value.created_at ?? value.published_at ?? value.sort_timestamp);
  const author = textFromValue(value.author_name ?? (isRecord(value.author) ? value.author.name : undefined));
  const direct = title && url && isLikelyDongqiudiArticleUrl(url)
    ? [
        {
          title: cleanText(title),
          url,
          summary: cleanText(summary),
          content: normalizeArticleBody(content),
          coverImageUrl,
          publishedAt,
          author: cleanText(author),
        },
      ]
    : [];

  return [
    ...direct,
    ...Object.entries(value)
      .filter(([key]) => key !== 'rawPayload')
      .flatMap(([, item]) => candidatesFromUnknown(item, baseUrl)),
  ];
}

function candidatesFromHtml(html: string, baseUrl: string): DongqiudiNewsCandidate[] {
  const candidates: DongqiudiNewsCandidate[] = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let anchorMatch: RegExpExecArray | null;
  while ((anchorMatch = anchorPattern.exec(html))) {
    const url = absoluteDongqiudiUrl(anchorMatch[1] ?? '', baseUrl);
    const title = cleanText(anchorMatch[2] ?? '');
    if (isLikelyDongqiudiArticleUrl(url) && title.length >= 6) {
      candidates.push({ title, url });
    }
  }

  const jsonLinkPattern =
    /"(?<title>[^"]{6,80})"[^{}]{0,240}"(?<url>(?:https?:\\?\/\\?\/[^"]+|\/(?:article|articles|news)\/[^"]+))"/gi;
  let jsonMatch: RegExpExecArray | null;
  while ((jsonMatch = jsonLinkPattern.exec(html))) {
    const title = cleanText(jsonMatch.groups?.title ?? '');
    const url = absoluteDongqiudiUrl((jsonMatch.groups?.url ?? '').replace(/\\\//g, '/'), baseUrl);
    if (isLikelyDongqiudiArticleUrl(url) && title.length >= 6) {
      candidates.push({ title, url });
    }
  }

  return candidates;
}

function uniqueNewsCandidates(candidates: DongqiudiNewsCandidate[]): DongqiudiNewsCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.url}::${candidate.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(candidate.title && candidate.url);
  });
}

function resolveNewsCrawlSite(siteId?: string) {
  const activeSites = cmsRepository.store.sites.filter(
    (candidate) => candidate.status === 'ACTIVE' && !candidate.deletedAt,
  );
  const requestedSiteId = siteId?.trim();

  if (requestedSiteId) {
    const site = activeSites.find((candidate) => candidate.id === requestedSiteId);
    if (site) {
      return site;
    }
    if (activeSites.length === 1) {
      return activeSites[0];
    }
    throw new Error(`站点不存在或未启用：${requestedSiteId}。多站点模式必须选择正确的所属站点。`);
  }

  if (activeSites.length === 1) {
    return activeSites[0];
  }
  if (activeSites.length > 1) {
    throw new Error('多站点模式必须选择所属站点，不能留空。');
  }
  throw new Error('没有可用的启用站点，请先创建并启用站点。');
}

function articleLimitForSite(site: SiteRecord, fallback: number): number {
  const configured = site.newsUpdateCount && site.newsUpdateCount > 0
    ? site.newsUpdateCount
    : site.group?.newsUpdateCount;
  const parsed = Number(configured);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(50, Math.floor(parsed)) : fallback;
}

function resolveNewsCrawlCategory(categoryId?: string) {
  const requestedCategoryId = categoryId?.trim();
  const category =
    (requestedCategoryId
      ? cmsRepository.store.categories.find((candidate) => candidate.id === requestedCategoryId && !candidate.deletedAt)
      : undefined) ??
    cmsRepository.store.categories.find((candidate) => /新闻|资讯|news/i.test(`${candidate.name} ${candidate.slug}`)) ??
    cmsRepository.store.categories.find((candidate) => candidate.status === 'ACTIVE') ??
    cmsRepository.store.categories[0];
  if (!category) {
    throw new Error('Record not found: active category');
  }
  return category;
}

function summaryFromContent(content: string): string {
  return cleanNewsSummary(content.split(/\n{2,}/)[0] ?? '').slice(0, 120);
}

function isUsableDongqiudiTitle(title: string): boolean {
  const normalized = cleanNewsTitle(title);
  if (normalized.length < 8) return false;
  return ![
    /^不喜欢/,
    /^内容质量不佳$/,
    /^举报$/,
    /^评论$/,
    /^分享$/,
    /^收藏$/,
    /^关注$/,
    /^已关注$/,
    /^登录$/,
  ].some((pattern) => pattern.test(normalized));
}

function isUsableDongqiudiContent(content: string, minContentChars: number): boolean {
  const text = meaningfulArticleText(content);
  const sentenceCount = (text.match(/[。！？!?]/g) ?? []).length;
  return text.length >= minContentChars && sentenceCount >= 2;
}

function normalizeArticleBody(value: string): string {
  const withoutNoise = value
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(?:p|br|div|section|article|li|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');

  const lines = decodeHtml(withoutNoise)
    .split(/\n+/)
    .map(cleanNewsContentLine)
    .filter((line) => line && !isBoilerplateArticleLine(line));

  return Array.from(new Set(lines)).join('\n\n').trim();
}

function meaningfulTextLength(content: string): number {
  return meaningfulArticleText(content).length;
}

function meaningfulArticleText(content: string): string {
  return content
    .split(/\n+/)
    .filter((line) => !isBoilerplateArticleLine(line))
    .join('')
    .replace(/\s+/g, '');
}

function cleanNewsTitle(value: string): string {
  const cleaned = cleanText(value)
    .split(/[|｜]/)[0]
    ?.replace(/\s*[-_]\s*懂球帝.*$/i, '')
    .replace(/懂球帝(?:独家|原创|报道|资讯|新闻)?/gi, '')
    .trim();
  return cleaned || cleanText(value);
}

function cleanNewsSummary(value: string): string {
  return stripNewsAttribution(cleanText(value)).slice(0, 240);
}

function cleanNewsAuthor(value?: string): string {
  const cleaned = cleanText(value ?? '')
    .replace(/懂球帝(?:资讯|新闻|编辑部|采集)?/gi, '')
    .replace(/^(?:作者|编辑|主编|责编|责任编辑|来源|撰文|记者)[:：]\s*/i, '')
    .trim();
  return isBoilerplateArticleLine(cleaned) ? '' : cleaned;
}

function cleanNewsContentLine(line: string): string {
  return stripNewsAttribution(
    line
      .replace(/\s+/g, ' ')
      .replace(/^懂球帝\s*(?:讯|消息|报道|独家)[，,。:：\s]*/i, '')
      .replace(/懂球帝(?:独家|原创|报道|资讯|新闻|客户端|App|APP)?/g, '')
      .trim(),
  );
}

function stripNewsAttribution(value: string): string {
  return value
    .replace(/\|+\s*手机客户端[，,][\s\S]*$/i, '')
    .replace(/手机客户端[，,].*(?:必备的神器|积分赛程|足球赛事专业的资讯).*$/i, '')
    .replace(/^懂球帝\s*(?:讯|消息|报道|独家)[，,。:：\s]*/i, '')
    .replace(/懂球帝(?:独家|原创|报道|资讯|新闻|客户端|App|APP)?/g, '')
    .replace(/(?:本文)?(?:来源|作者|编辑|主编|责编|责任编辑|撰文|记者)[:：][^。！？!?]*$/i, '')
    .replace(/（\s*(?:来源|作者|编辑|主编|责编|责任编辑|撰文|记者)[:：][^）]*）\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBoilerplateArticleLine(line: string): boolean {
  return [
    /^【来源】/,
    /^来源[:：]/,
    /^作者[:：]/,
    /^编辑[:：]/,
    /^主编[:：]/,
    /^责编[:：]/,
    /^责任编辑[:：]/,
    /^撰文[:：]/,
    /^记者[:：]/,
    /^发布[:：]/,
    /^原文链接[:：]/,
    /^免责声明/,
    /^版权/,
    /^懂球帝(?:资讯|新闻|编辑部|客户端|App|APP)?$/,
    /懂球帝.*(?:下载|客户端|App|APP|版权|举报|评论|点赞|关注)/,
    /手机客户端.*(?:必备的神器|积分赛程|足球赛事专业的资讯)/,
    /^举报$/,
    /^分享$/,
    /^收藏$/,
    /^评论/,
    /本站已保留原文链接/,
    /自动采集为资讯索引/,
    /建议编辑.*补充/,
  ].some((pattern) => pattern.test(line));
}

function htmlMetaContent(html: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `<meta\\b[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
      'i',
    );
    const reversedPattern = new RegExp(
      `<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`,
      'i',
    );
    const match = pattern.exec(html) ?? reversedPattern.exec(html);
    if (match?.[1]) return cleanText(match[1]);
  }

  return '';
}

function htmlTitle(html: string): string {
  return cleanText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '');
}

function isNumericText(value: string): boolean {
  return /^\d+$/.test(value);
}

function absoluteDongqiudiUrl(value: string, baseUrl: string): string {
  const normalized = value.trim().replace(/\\\//g, '/');
  if (!normalized) return '';
  try {
    return new URL(normalized, baseUrl).toString();
  } catch {
    return '';
  }
}

function isLikelyDongqiudiArticleUrl(value: string): boolean {
  return /^https?:\/\/(?:www\.)?dongqiudi\.com\/(?:article|articles|news)\/\d+(?:\.html)?(?:[?#].*)?$/i.test(value);
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function positiveLimit(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
}

function positiveInteger(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function nextDailyRunAt(scheduleTime: string, timezone = 'Asia/Shanghai', from = new Date()): Date {
  const [hourRaw, minuteRaw] = scheduleTime.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const parts = zonedDateParts(from, timezone);
  let candidate = zonedTimeToUtc(parts.year, parts.month, parts.day, hour, minute, timezone);
  if (candidate.getTime() <= from.getTime() + 1000) {
    candidate = zonedTimeToUtc(parts.year, parts.month, parts.day + 1, hour, minute, timezone);
  }
  return candidate;
}

function zonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const guessParts = zonedDateParts(utcGuess, timeZone);
  const actualLocalAsUtc = Date.UTC(
    guessParts.year,
    guessParts.month - 1,
    guessParts.day,
    guessParts.hour,
    guessParts.minute,
  );
  const wantedLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(utcGuess.getTime() + (wantedLocalAsUtc - actualLocalAsUtc));
}

function systemActor(): Actor {
  const admin = cmsRepository.store.adminUsers.find((candidate) => candidate.username === 'admin') ?? cmsRepository.store.adminUsers[0];
  const publicAdmin = admin
    ? cmsRepository.store.adminRoles
        ? cmsRepository.listAdminUsers(allRowsOptions).find((candidate) => candidate.id === admin.id)
        : undefined
    : undefined;
  const userRecord = publicAdmin ?? {
    id: 'system-scheduler',
    username: 'scheduler',
    email: 'scheduler@sports.local',
    displayName: '计划任务',
    status: 'ACTIVE',
    roleIds: [],
    permissions: ['sports:write', 'news:write', 'news:publish', 'task:write', 'task:read'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    userId: userRecord.id,
    username: userRecord.username,
    displayName: userRecord.displayName,
    roleIds: userRecord.roleIds,
    roleNames: userRecord.roles?.map((role) => role.name) ?? ['系统任务'],
    permissions: Array.from(
      new Set([
        ...(userRecord.permissions ?? []),
        'sports:write',
        'news:write',
        'news:publish',
        'task:write',
        'task:read',
      ]),
    ),
    user: userRecord,
  };
}

type SportsSyncOptions = {
  sourceUrl?: string;
  typeId?: string;
};

type ExternalSportsRow = {
  typeId: string;
  leagueName: string;
  matchId: string;
  homeName: string;
  awayName: string;
  startTime: Date;
  className?: string;
  liveUrl?: string;
  competitionLogo?: string;
  homeLogo?: string;
  awayLogo?: string;
  rawPayload: Record<string, unknown>;
};

const externalSportsSource = 'jktgedc-match-api';
const externalSportsApiUrl =
  process.env.SPORTS_MATCH_API_URL ??
  'https://jk.jktgedc.com/app/encryptionMatchOther?check_type=17';

function sportsSyncOptions(input: unknown): SportsSyncOptions {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const record = input as Record<string, unknown>;
  const typeId = textFromValue(record.type_id ?? record.typeId);
  const sourceUrl = safeExternalUrl(record.sourceUrl);
  return {
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(typeId ? { typeId } : {}),
  };
}

async function syncExternalSportsData(actor: Actor, options: SportsSyncOptions = {}) {
  const rows = await fetchExternalSportsRows(options);
  const leaguesByKey = new Map<string, SportLeagueRecord>();
  const teamsByKey = new Map<string, SportTeamRecord>();
  const matches: SportMatchRecord[] = [];

  cmsRepository.withMutationBatch(() => {
    for (const row of rows) {
      const sport = inferSport(row);
      const league = upsertExternalLeague(
        {
          sport,
          name: row.leagueName,
          logoUrl: row.competitionLogo,
          isHot: true,
          externalSource: externalSportsSource,
          externalId: externalLeagueId(row),
          lastSyncedAt: new Date(),
        },
        actor,
      );
      leaguesByKey.set(league.externalId ?? league.id, league);

      const homeTeam = upsertExternalTeam(
        {
          sport,
          leagueId: league.id,
          name: row.homeName,
          logoUrl: row.homeLogo,
          isHot: false,
          externalSource: externalSportsSource,
          externalId: externalTeamId(row.typeId, row.homeName),
          lastSyncedAt: new Date(),
        },
        actor,
      );
      teamsByKey.set(homeTeam.externalId ?? homeTeam.id, homeTeam);

      const awayTeam = upsertExternalTeam(
        {
          sport,
          leagueId: league.id,
          name: row.awayName,
          logoUrl: row.awayLogo,
          isHot: false,
          externalSource: externalSportsSource,
          externalId: externalTeamId(row.typeId, row.awayName),
          lastSyncedAt: new Date(),
        },
        actor,
      );
      teamsByKey.set(awayTeam.externalId ?? awayTeam.id, awayTeam);

      matches.push(
        upsertExternalMatch(
          {
            sport,
            title: `${row.leagueName}：${row.homeName} vs ${row.awayName}`,
            leagueId: league.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            isTop: false,
            status: statusFromStartTime(row.startTime),
            startTime: row.startTime,
            liveUrl: row.liveUrl,
            externalSource: externalSportsSource,
            externalId: externalMatchId(row),
            rawPayload: row.rawPayload,
            lastSyncedAt: new Date(),
          },
          actor,
        ),
      );
    }
  });

  return {
    leagues: Array.from(leaguesByKey.values()),
    teams: Array.from(teamsByKey.values()),
    matches,
  };
}

async function fetchExternalSportsRows(options: SportsSyncOptions): Promise<ExternalSportsRow[]> {
  const url = new URL(options.sourceUrl ?? externalSportsApiUrl);
  if (options.typeId) {
    if (url.searchParams.has('check_type')) {
      url.searchParams.set('check_type', options.typeId);
    } else {
      url.searchParams.set('type_id', options.typeId);
    }
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json,text/plain,*/*' },
    }, externalFetchTimeoutMs);
  } catch (error) {
    throw sportsSyncError(`赛事接口连接失败：${messageFromUnknown(error)}`);
  }

  if (!response.ok) {
    throw sportsSyncError(
      `赛事接口返回 ${response.status}：${await response.text().catch(() => '')}`,
    );
  }

  const payload = await parseExternalSportsPayload(response);
  const records = extractSportsRecordArray(payload);
  const rows = records
    .map(parseExternalSportsRow)
    .filter((row): row is ExternalSportsRow => Boolean(row));

  if (!rows.length) {
    throw sportsSyncError(
      '赛事接口未返回可识别的数据，请确认字段包含 type_id、short_name_zh、home_name、away_name、match_time、match_id。',
    );
  }

  return rows;
}

async function parseExternalSportsPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return [];
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw sportsSyncError('赛事接口返回内容不是 JSON，暂时无法解析。');
  }
}

function extractSportsRecordArray(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const directKeys = ['data', 'list', 'rows', 'result', 'matches', 'match_list'];
  for (const key of directKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      const rows = value.filter(isRecord);
      if (rows.length) return rows;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        const rows = extractSportsRecordArray(parsed);
        if (rows.length) return rows;
      } catch {
        // Keep searching other keys.
      }
    }
  }

  return Object.values(payload)
    .flatMap((value) => extractSportsRecordArray(value))
    .filter((row) => rowHasSportsFields(row));
}

function parseExternalSportsRow(row: Record<string, unknown>): ExternalSportsRow | undefined {
  const typeId = textFromValue(row.type_id ?? row.typeId ?? row.type);
  const leagueName = textFromValue(
    row.short_name_zh ?? row.league_name ?? row.competition_name ?? row.competition_short_name_zh,
  );
  const homeName = textFromValue(row.home_name ?? row.homeName);
  const awayName = textFromValue(row.away_name ?? row.awayName);
  const matchId = textFromValue(row.match_id ?? row.matchId ?? row.id);
  const startTime = dateFromValue(
    row.match_time ?? row.matchTime ?? row.start_time ?? row.startTime,
  );

  if (!typeId || !leagueName || !homeName || !awayName || !matchId || !startTime) {
    return undefined;
  }

  return {
    typeId,
    leagueName,
    matchId,
    homeName,
    awayName,
    startTime,
    className: textFromValue(row.class_name ?? row.className),
    liveUrl: safeExternalUrl(row.url ?? row.live_url ?? row.liveUrl),
    competitionLogo: safeExternalUrl(row.competition_logo ?? row.competitionLogo),
    homeLogo: safeExternalUrl(row.home_logo ?? row.homeLogo),
    awayLogo: safeExternalUrl(row.away_logo ?? row.awayLogo),
    rawPayload: row,
  };
}

function upsertExternalLeague(input: ParsedLeagueCreateInput, actor: Actor): SportLeagueRecord {
  const existing = cmsRepository.store.leagues.find(
    (league) =>
      league.externalSource === input.externalSource && league.externalId === input.externalId,
  );

  if (existing) {
    return cmsRepository.updateLeague(existing.id, input, actor) as SportLeagueRecord;
  }

  return cmsRepository.createLeague(withGeneratedLeagueSlug(input), actor) as SportLeagueRecord;
}

function upsertExternalTeam(input: ParsedTeamCreateInput, actor: Actor): SportTeamRecord {
  const existing = cmsRepository.store.teams.find(
    (team) => team.externalSource === input.externalSource && team.externalId === input.externalId,
  );

  if (existing) {
    return cmsRepository.updateTeam(existing.id, input, actor) as SportTeamRecord;
  }

  return cmsRepository.createTeam(withGeneratedTeamSlug(input), actor) as SportTeamRecord;
}

function upsertExternalMatch(input: MatchCreateInput, actor: Actor): SportMatchRecord {
  const existing = cmsRepository.store.matches.find(
    (match) =>
      match.externalSource === input.externalSource && match.externalId === input.externalId,
  );

  if (existing) {
    return cmsRepository.updateMatch(existing.id, input, actor) as SportMatchRecord;
  }

  return cmsRepository.createMatch(withGeneratedMatchSlug(input), actor) as SportMatchRecord;
}

function externalLeagueId(row: ExternalSportsRow): string {
  return `type:${row.typeId}:league:${row.leagueName}`;
}

function externalTeamId(typeId: string, teamName: string): string {
  return `type:${typeId}:team:${teamName}`;
}

function externalMatchId(row: ExternalSportsRow): string {
  return String(
    row.matchId ||
      shortHash(
        `${row.typeId}:${row.leagueName}:${row.homeName}:${row.awayName}:${row.startTime.toISOString()}`,
      ),
  );
}

function statusFromStartTime(startTime: Date): SportMatchRecord['status'] {
  const diffMs = startTime.getTime() - Date.now();
  if (diffMs > 15 * 60 * 1000) return 'SCHEDULED';
  if (diffMs < -2 * 60 * 60 * 1000) return 'FINISHED';
  return 'LIVE';
}

function inferSport(row: ExternalSportsRow): SportLeagueRecord['sport'] {
  const text =
    `${row.typeId} ${row.className ?? ''} ${row.leagueName} ${row.homeName} ${row.awayName}`.toLowerCase();
  if (/(篮球|男篮|女篮|nba|cba|wnba|basket)/i.test(text)) {
    return 'BASKETBALL';
  }
  return 'FOOTBALL';
}

function dateFromValue(value: unknown): Date | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const timestamp = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const raw = textFromValue(value);
  if (!raw) return undefined;

  if (/^\d+$/.test(raw)) {
    return dateFromValue(Number(raw));
  }

  const directDate = new Date(raw);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const compatibleDate = new Date(raw.replace(/-/g, '/'));
  return Number.isNaN(compatibleDate.getTime()) ? undefined : compatibleDate;
}

function textFromValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function safeExternalUrl(value: unknown): string | undefined {
  const raw = textFromValue(value);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return undefined;
}

function firstExternalUrl(...values: unknown[]): string | undefined {
  for (const value of values) {
    const url = safeExternalUrl(value);
    if (url) return url;
  }
  return undefined;
}

function firstMatchImageUrl(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    if (!isRecord(item)) continue;
    const url = firstExternalUrl(item.url, item.thumb, item.api_url, item.apithumb);
    if (url) return url;
  }
  return undefined;
}

async function fetchWithTimeout(input: string | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowHasSportsFields(row: Record<string, unknown>): boolean {
  return Boolean(
    row.type_id ??
      row.short_name_zh ??
      row.home_name ??
      row.away_name ??
      row.match_time ??
      row.match_id ??
      row.home_logo ??
      row.away_logo ??
      row.competition_logo,
  );
}

function sportsSyncError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 502;
  return error;
}

function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

function syncFakeLeagues(actor: Actor): SportLeagueRecord[] {
  const lastSyncedAt = new Date();
  const payloads: ParsedLeagueCreateInput[] = [
    {
      sport: 'FOOTBALL',
      name: '英格兰超级联赛',
      englishName: 'Premier League',
      pinyin: 'yingchao',
      logoUrl: 'https://img.xinghuosports.com/leagues/premier-league.png',
      country: '英国',
      isHot: true,
      externalSource: 'fake-sports-api',
      externalId: 'fake-league-premier',
      lastSyncedAt,
    },
    {
      sport: 'BASKETBALL',
      name: '中国男子篮球职业联赛',
      englishName: 'CBA League',
      pinyin: 'lanqiu-liansai',
      logoUrl: 'https://img.xinghuosports.com/leagues/cba.png',
      country: '中国',
      isHot: true,
      externalSource: 'fake-sports-api',
      externalId: 'fake-league-basketball',
      lastSyncedAt,
    },
  ];

  return payloads.map((payload) => upsertFakeLeague(payload, actor));
}

function syncFakeTeams(actor: Actor): SportTeamRecord[] {
  const leagues = syncFakeLeagues(actor);
  const leagueIdByExternalId = new Map(leagues.map((league) => [league.externalId, league.id]));
  const lastSyncedAt = new Date();
  const payloads: ParsedTeamCreateInput[] = [
    {
      sport: 'FOOTBALL',
      leagueId: leagueIdByExternalId.get('fake-league-premier'),
      name: '上海海港',
      englishName: 'Shanghai Port',
      pinyin: 'haigang',
      country: '中国',
      logoUrl: 'https://img.xinghuosports.com/teams/shanghai-port.png',
      isHot: true,
      externalSource: 'fake-sports-api',
      externalId: 'fake-team-harbor',
      lastSyncedAt,
    },
    {
      sport: 'FOOTBALL',
      leagueId: leagueIdByExternalId.get('fake-league-premier'),
      name: '北京国安',
      englishName: 'Beijing Guoan',
      pinyin: 'chengji',
      country: '中国',
      logoUrl: 'https://img.xinghuosports.com/teams/beijing-guoan.png',
      isHot: true,
      externalSource: 'fake-sports-api',
      externalId: 'fake-team-city',
      lastSyncedAt,
    },
    {
      sport: 'BASKETBALL',
      leagueId: leagueIdByExternalId.get('fake-league-basketball'),
      name: '辽宁男篮',
      englishName: 'Liaoning Flying Leopards',
      pinyin: 'feiying',
      country: '中国',
      logoUrl: 'https://img.xinghuosports.com/teams/liaoning-flying-leopards.png',
      isHot: true,
      externalSource: 'fake-sports-api',
      externalId: 'fake-team-eagles',
      lastSyncedAt,
    },
    {
      sport: 'BASKETBALL',
      leagueId: leagueIdByExternalId.get('fake-league-basketball'),
      name: '广东男篮',
      englishName: 'Guangdong Southern Tigers',
      pinyin: 'lanjing',
      country: '中国',
      logoUrl: 'https://img.xinghuosports.com/teams/guangdong-southern-tigers.png',
      isHot: true,
      externalSource: 'fake-sports-api',
      externalId: 'fake-team-whales',
      lastSyncedAt,
    },
  ];

  return payloads.map((payload) => upsertFakeTeam(payload, actor));
}

function syncFakeMatches(actor: Actor): SportMatchRecord[] {
  const leagues = syncFakeLeagues(actor);
  const teams = syncFakeTeams(actor);
  const leagueIdByExternalId = new Map(leagues.map((league) => [league.externalId, league.id]));
  const teamIdByExternalId = new Map(teams.map((team) => [team.externalId, team.id]));
  const now = new Date();
  const dayStamp = now.toISOString().slice(0, 10);
  const payloads: MatchCreateInput[] = [
    {
      sport: 'FOOTBALL',
      title: '中超焦点战：上海海港 vs 北京国安',
      leagueId: leagueIdByExternalId.get('fake-league-premier'),
      homeTeamId: teamIdByExternalId.get('fake-team-harbor'),
      awayTeamId: teamIdByExternalId.get('fake-team-city'),
      isTop: true,
      status: 'LIVE',
      startTime: new Date(now.getTime() - 35 * 60 * 1000),
      liveUrl: 'https://live.xinghuosports.com/football/shanghai-port-beijing-guoan',
      replayUrl: 'https://replay.xinghuosports.com/football/shanghai-port-beijing-guoan',
      externalSource: 'fake-sports-api',
      externalId: `global:fake-football-live:${dayStamp}`,
      rawPayload: { fake: true, dailyKey: dayStamp },
      lastSyncedAt: now,
    },
    {
      sport: 'BASKETBALL',
      title: 'CBA 常规赛：辽宁男篮 vs 广东男篮',
      leagueId: leagueIdByExternalId.get('fake-league-basketball'),
      homeTeamId: teamIdByExternalId.get('fake-team-eagles'),
      awayTeamId: teamIdByExternalId.get('fake-team-whales'),
      isTop: false,
      status: 'SCHEDULED',
      startTime: new Date(now.getTime() + 55 * 60 * 1000),
      liveUrl: 'https://live.xinghuosports.com/basketball/liaoning-guangdong',
      replayUrl: 'https://replay.xinghuosports.com/basketball/liaoning-guangdong',
      externalSource: 'fake-sports-api',
      externalId: `global:fake-basketball-upcoming:${dayStamp}`,
      rawPayload: { fake: true, dailyKey: dayStamp },
      lastSyncedAt: now,
    },
  ];

  return payloads.map((payload) => upsertFakeMatch(payload, actor));
}

function upsertFakeLeague(input: ParsedLeagueCreateInput, actor: Actor): SportLeagueRecord {
  const existing = cmsRepository.store.leagues.find(
    (league) =>
      league.externalSource === input.externalSource && league.externalId === input.externalId,
  );

  if (existing) {
    return cmsRepository.updateLeague(existing.id, input, actor) as SportLeagueRecord;
  }

  return cmsRepository.createLeague(withGeneratedLeagueSlug(input), actor) as SportLeagueRecord;
}

function upsertFakeTeam(input: ParsedTeamCreateInput, actor: Actor): SportTeamRecord {
  const existing = cmsRepository.store.teams.find(
    (team) => team.externalSource === input.externalSource && team.externalId === input.externalId,
  );

  if (existing) {
    return cmsRepository.updateTeam(existing.id, input, actor) as SportTeamRecord;
  }

  return cmsRepository.createTeam(withGeneratedTeamSlug(input), actor) as SportTeamRecord;
}

function upsertFakeMatch(input: MatchCreateInput, actor: Actor): SportMatchRecord {
  const existing = cmsRepository.store.matches.find(
    (match) =>
      match.externalSource === input.externalSource && match.externalId === input.externalId,
  );

  if (existing) {
    return cmsRepository.updateMatch(existing.id, input, actor) as SportMatchRecord;
  }

  return cmsRepository.createMatch(withGeneratedMatchSlug(input), actor) as SportMatchRecord;
}

function allPromotionRowsOptions(query: unknown) {
  return {
    ...promotionQuery(query),
    ...allRowsOptions,
  };
}

function withGeneratedRoleKey(input: ParsedAdminRoleCreateInput): AdminRoleCreateInput {
  return {
    ...input,
    key: nextUniqueIdentifier(
      normalizeIdentifier(input.key ?? input.name, 'role'),
      cmsRepository.store.adminRoles.map((role) => role.key),
    ),
  };
}

function withGeneratedPermissionAction(
  input: ParsedAdminPermissionCreateInput,
): AdminPermissionCreateInput {
  return {
    ...input,
    action: input.action ?? nextPermissionAction(input.group, input.label),
  };
}

function withGeneratedCategorySlug(input: ParsedCategoryCreateInput): CategoryCreateInput {
  return {
    ...input,
    slug: nextUniqueIdentifier(
      normalizeIdentifier(input.slug ?? input.name, 'category'),
      cmsRepository.store.categories.map((category) => category.slug),
    ),
  };
}

function withGeneratedNewsSlug(input: ParsedNewsCreateInput): NewsCreateInput {
  return {
    ...input,
    slug: nextUniqueIdentifier(
      normalizeIdentifier(input.slug ?? input.title, 'news'),
      cmsRepository.store.news
        .filter((article) => article.siteId === input.siteId)
        .map((article) => article.slug),
    ),
  };
}

function withGeneratedPromotionTypeKey(
  input: ParsedPromotionTypeCreateInput,
): PromotionTypeCreateInput {
  return {
    ...input,
    key: nextUniqueIdentifier(
      normalizeIdentifier(input.key ?? input.name, 'promotion-type'),
      cmsRepository.store.promotionTypes
        .filter((type) => (type.siteId ?? null) === (input.siteId ?? null))
        .map((type) => type.key),
    ),
  };
}

function withGeneratedLeagueSlug(input: ParsedLeagueCreateInput): LeagueCreateInput {
  return {
    ...input,
    slug: nextUniqueIdentifier(
      normalizeIdentifier(input.slug ?? input.pinyin ?? input.englishName ?? input.name, 'league'),
      cmsRepository.store.leagues.map((league) => league.slug),
    ),
  };
}

function withGeneratedTeamSlug(input: ParsedTeamCreateInput): TeamCreateInput {
  return {
    ...input,
    slug: nextUniqueIdentifier(
      normalizeIdentifier(input.slug ?? input.pinyin ?? input.englishName ?? input.name, 'team'),
      cmsRepository.store.teams.map((team) => team.slug),
    ),
  };
}

function withGeneratedMatchSlug(input: MatchCreateInput): MatchCreateInput {
  return {
    ...input,
    slug:
      input.slug ??
      nextUniqueIdentifier(
        normalizeIdentifier(input.title, 'match'),
        cmsRepository.store.matches
          .map((match) => match.slug)
          .filter((slug): slug is string => Boolean(slug)),
      ),
  };
}

function withGeneratedTemplateKey(input: ParsedTemplateCreateInput): TemplateCreateInput {
  return {
    ...input,
    key: nextUniqueIdentifier(
      normalizeIdentifier((input.key ?? input.folder) || input.name, 'template'),
      cmsRepository.store.templates.map((template) => template.key),
    ),
  };
}

function nextPermissionAction(group: string, label: string): string {
  const resource = normalizeIdentifier(group, 'permission');
  const actionBase = normalizeIdentifier(label, 'item');
  const usedActions = new Set(
    cmsRepository.store.adminPermissions.map((permission) => permission.action),
  );
  let action = truncateIdentifier(actionBase, 80 - resource.length - 1);
  let candidate = `${resource}:${action}`;
  let suffix = 2;

  while (usedActions.has(candidate)) {
    const suffixText = `-${suffix}`;
    action = `${truncateIdentifier(actionBase, 80 - resource.length - 1 - suffixText.length)}${suffixText}`;
    candidate = `${resource}:${action}`;
    suffix += 1;
  }

  return candidate;
}

function normalizeIdentifier(value: string | null | undefined, fallback: string): string {
  const rawValue = value?.trim() ?? '';
  const normalized = rawValue
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (normalized && normalized.length >= 2) {
    return normalized;
  }

  return rawValue ? `${fallback}-${shortHash(rawValue)}` : fallback;
}

function shortHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function nextUniqueIdentifier(base: string, usedValues: string[]): string {
  const used = new Set(usedValues);
  let candidate = truncateIdentifier(base, 80);
  let suffix = 2;

  while (used.has(candidate)) {
    const suffixText = `-${suffix}`;
    candidate = `${truncateIdentifier(base, 80 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

function truncateIdentifier(base: string, maxLength: number): string {
  const truncated = base.slice(0, Math.max(2, maxLength)).replace(/-+$/g, '');
  return truncated.length >= 2 ? truncated : 'item';
}

function idParams(input: unknown): { id: string } {
  if (
    typeof input === 'object' &&
    input !== null &&
    'id' in input &&
    typeof input.id === 'string'
  ) {
    return { id: input.id };
  }

  throw new Error('Record not found: missing id');
}

function siteQuery(input: unknown): { siteId?: string } {
  if (
    typeof input === 'object' &&
    input !== null &&
    'siteId' in input &&
    typeof input.siteId === 'string'
  ) {
    return { siteId: input.siteId };
  }

  return {};
}

function promotionQuery(input: unknown): {
  siteId?: string;
  categoryId?: string;
  slot?: ReturnType<typeof promotionTypeCreateSchema.parse>['slot'];
  page?: number;
  pageSize?: number;
} {
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  const query = input as Record<string, unknown>;
  return {
    siteId: typeof query.siteId === 'string' ? query.siteId : undefined,
    categoryId: typeof query.categoryId === 'string' ? query.categoryId : undefined,
    slot: isPromotionSlot(query.slot) ? query.slot : undefined,
    page: parsePositiveInteger(query.page),
    pageSize: parsePositiveInteger(query.pageSize),
  };
}

function parsePositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function sanitizeSecuritySettings(
  settings: unknown,
  options: { includeTotpSecret?: boolean } = {},
): unknown {
  if (!settings || typeof settings !== 'object') {
    return settings;
  }
  const record = settings as Record<string, unknown>;
  return {
    ...record,
    totpSecret: options.includeTotpSecret ? record.totpSecret : '',
    totpSecretConfigured: Boolean(record.totpSecret),
  };
}

function isPromotionSlot(
  value: unknown,
): value is ReturnType<typeof promotionTypeCreateSchema.parse>['slot'] {
  return (
    typeof value === 'string' &&
    [
      'HOME_HERO',
      'HOME_AFTER_NEWS',
      'CATEGORY_TOP',
      'CATEGORY_SIDEBAR',
      'NEWS_TOP',
      'NEWS_INLINE',
      'NEWS_BOTTOM',
      'GLOBAL_FLOAT',
    ].includes(value)
  );
}
