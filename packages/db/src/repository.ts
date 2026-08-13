import {
  buildNewsInvalidationTags,
  buildPublicUrl,
  categoryCacheTag,
  normalizeHost,
  pageCacheTag,
  resolveSiteByHost,
  siteCacheTag,
  templateCacheTag,
  tdkRules,
  urlRules,
  type AdminPermissionAction,
  type AdminPermissionRecord,
  type AdminRoleRecord,
  type AdminUserPublicRecord,
  type AdminUserRecord,
  type AuditLogRecord,
  type CacheInvalidationJobRecord,
  type CategoryRecord,
  type LiveReplayRecord,
  type LiveProductRecord,
  type NewsArticleRecord,
  type PageType,
  type PromotionLinkRecord,
  type PromotionSlot,
  type PromotionTypeRecord,
  type ScheduledTaskRecord,
  type SecuritySettingsRecord,
  type SignalDomainRecord,
  type SignalSourceNameRecord,
  type SiteGroupRecord,
  type SiteRecord,
  type SportLeagueRecord,
  type SportMatchRecord,
  type SportTeamRecord,
  type TagRecord,
  type TdkConfigRecord,
  type TdkDetailRuleRecord,
  type TdkRuleRecord,
  type TemplateRecord,
  type UrlConfigRecord,
  type UrlDetailRuleRecord,
  type UrlRuleRecord,
  generateTotpSecret,
  verifyTotpCode,
} from '@sports/core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAccessToken, hashAccessToken, hashPassword, verifyPassword } from './auth-crypto';
import { createSeedData, type CmsStore } from './seed-data';

type ListOptions = {
  page?: number;
  pageSize?: number;
};

type AdminUserListOptions = ListOptions & {
  includeTotpSecret?: boolean;
};

type NewsListOptions = ListOptions & {
  siteId: string;
  categoryId?: string;
  status?: NewsArticleRecord['status'];
  limit?: number;
};

type MatchListOptions = {
  sport?: SportMatchRecord['sport'];
  status?: SportMatchRecord['status'];
  recentHours?: number;
  upcomingHours?: number;
  limit?: number;
};

type PromotionListOptions = ListOptions & {
  siteId?: string;
  categoryId?: string;
  slot?: PromotionSlot;
};

type LiveReplayListOptions = ListOptions & {
  siteId?: string;
  categoryId?: string;
  limit?: number;
};

type Actor = {
  userId?: string;
  permissions?: Array<AdminPermissionAction | string>;
  ip?: string;
  userAgent?: string;
};

type UrlDetailRuleInput = {
  id?: string;
  label: string;
  pageType: PageType;
  pattern: string;
};

type UrlRuleInput = {
  id?: string;
  categoryId: string;
  pageType: PageType;
  pattern: string;
  detailRules?: UrlDetailRuleInput[];
};

type UrlConfigWriteInput = {
  siteId?: string | null;
  name?: string;
  status?: string;
  pageType?: PageType;
  pattern?: string;
  description?: string | null;
  categoryIds?: string[];
  rules?: UrlRuleInput[];
};

type TdkDetailRuleInput = {
  id?: string;
  label: string;
  pageType: PageType;
  titleTemplate: string;
  keywordsTemplate?: string | null;
  descriptionTemplate?: string | null;
};

type TdkRuleInput = {
  id?: string;
  categoryId: string;
  pageType: PageType;
  titleTemplate: string;
  keywordsTemplate?: string | null;
  descriptionTemplate?: string | null;
  detailRules?: TdkDetailRuleInput[];
};

type TdkConfigWriteInput = {
  siteId?: string | null;
  name?: string;
  status?: string;
  pageType?: PageType;
  titleTemplate?: string;
  keywordsTemplate?: string | null;
  descriptionTemplate?: string | null;
  categoryIds?: string[];
  rules?: TdkRuleInput[];
};

type RepositoryShape = {
  store: CmsStore;
  syncFromDisk?: (input?: { force?: boolean }) => void;
  withMutationBatch?: <T>(callback: () => T) => T;
  [key: string]: unknown;
};

const mutatingMethodPattern = /^(create|update|delete|bulkDelete|publish|authenticate|revoke)/;
const securitySettingsId = 'security-settings';
let lastLoadedMtime = 0;
let resolvedStoreFilePath: string | undefined;
let cachedStoreVersion = '';
let cachedStoreVersionCheckedAt = 0;
let lastDiskSyncCheckedAt = 0;
let storeWriteLockDepth = 0;

export function createMemoryCmsRepository(initialStore: CmsStore = createSeedData()) {
  const store = normalizePersistedStore(loadPersistedStore(initialStore));
  ensureGlobalSeoDefaults(store);
  if (shouldPersistStore()) {
    persistStore(store);
  }

  const repository = {
    store,
    syncFromDisk: (input?: { force?: boolean }) => syncStoreFromDisk(store, input),
    withMutationBatch: <T>(callback: () => T): T => callback(),
    listAdminUsers: (options?: AdminUserListOptions) =>
      paginate(
        store.adminUsers
          .filter((user) => !user.deletedAt)
          .map((user) => serializeAdminUser(store, user, { includeTotpSecret: options?.includeTotpSecret })),
        options,
      ),
    createAdminUser: (
      input: {
        username: string;
        email: string;
        displayName: string;
        password: string;
        totpEnabled?: boolean;
        totpSecret?: string | null;
        status: AdminUserRecord['status'];
        roleIds: string[];
      },
      actor?: Actor,
    ) => {
      ensureUnique(store.adminUsers, 'username', input.username);
      ensureUnique(store.adminUsers, 'email', input.email);
      ensureRoleIds(store, input.roleIds);
      const securitySettings = effectiveSecuritySettings(store);
      const totpEnabled = securitySettings.totpRequired || Boolean(input.totpEnabled);
      const totpSecret = normalizeNullableString(input.totpSecret) ?? (totpEnabled ? generateTotpSecret() : null);

      const record: AdminUserRecord = {
        id: id('user'),
        username: input.username,
        email: input.email,
        displayName: input.displayName,
        passwordHash: hashPassword(input.password),
        totpEnabled,
        totpSecret,
        status: input.status,
        roleIds: input.roleIds,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.adminUsers.push(record);
      const serialized = serializeAdminUser(store, record, { includeTotpSecret: true });
      audit(store, actor, 'adminUser.create', 'AdminUser', record.id, undefined, serializeAdminUser(store, record));
      return serialized;
    },
    updateAdminUser: (
      idValue: string,
      input: Partial<{
        username: string;
        email: string;
        displayName: string;
        password: string;
        totpEnabled: boolean;
        totpSecret: string | null;
        status: AdminUserRecord['status'];
        roleIds: string[];
      }>,
      actor?: Actor,
    ) => {
      const record = findRecord(store.adminUsers, idValue);
      if (input.username && store.adminUsers.some((user) => user.id !== idValue && user.username === input.username)) {
        throw new Error(`Duplicate value for username: ${input.username}`);
      }
      if (input.email && store.adminUsers.some((user) => user.id !== idValue && user.email === input.email)) {
        throw new Error(`Duplicate value for email: ${input.email}`);
      }
      if (input.roleIds) {
        ensureRoleIds(store, input.roleIds);
      }

      const before = serializeAdminUser(store, record);
      const { password, totpSecret, ...rest } = input;
      const nextTotpEnabled = input.totpEnabled ?? Boolean(record.totpEnabled);
      const requestedTotpSecret =
        totpSecret !== undefined ? normalizeNullableString(totpSecret) : normalizeNullableString(record.totpSecret);
      const nextTotpSecret =
        requestedTotpSecret ?? (nextTotpEnabled && record.username !== 'admin' ? generateTotpSecret() : null);
      Object.assign(
        record,
        rest,
        { totpEnabled: nextTotpEnabled, totpSecret: nextTotpSecret },
        password ? { passwordHash: hashPassword(password) } : {},
        { updatedAt: new Date() },
      );
      const serialized = serializeAdminUser(store, record, { includeTotpSecret: true });
      audit(store, actor, 'adminUser.update', 'AdminUser', record.id, before, serializeAdminUser(store, record));
      return serialized;
    },
    deleteAdminUser: (idValue: string, actor?: Actor) => {
      const record = findRecord(store.adminUsers, idValue);
      const before = serializeAdminUser(store, record);
      record.deletedAt = new Date();
      record.updatedAt = new Date();
      store.adminSessions = store.adminSessions.filter((session) => session.userId !== idValue);
      const serialized = serializeAdminUser(store, record);
      audit(store, actor, 'adminUser.delete', 'AdminUser', record.id, before, serialized);
      return serialized;
    },
    bulkDeleteAdminUsers: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => {
        const record = findRecord(store.adminUsers, idValue);
        const before = serializeAdminUser(store, record);
        record.deletedAt = new Date();
        record.updatedAt = new Date();
        store.adminSessions = store.adminSessions.filter((session) => session.userId !== idValue);
        const serialized = serializeAdminUser(store, record);
        audit(store, actor, 'adminUser.delete', 'AdminUser', record.id, before, serialized);
        return serialized;
      }),

    listAdminRoles: (options?: ListOptions) =>
      paginate(store.adminRoles.filter((role) => !role.deletedAt), options),
    createAdminRole: (input: Omit<AdminRoleRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      ensureUnique(store.adminRoles, 'key', input.key);
      ensurePermissionActions(store, input.permissionActions);
      const record: AdminRoleRecord = { ...input, id: id('role'), createdAt: new Date(), updatedAt: new Date() };
      store.adminRoles.push(record);
      audit(store, actor, 'adminRole.create', 'AdminRole', record.id, undefined, record);
      return record;
    },
    updateAdminRole: (idValue: string, input: Partial<AdminRoleRecord>, actor?: Actor) => {
      findRecord(store.adminRoles, idValue);
      if (input.key && store.adminRoles.some((role) => role.id !== idValue && role.key === input.key)) {
        throw new Error(`Duplicate value for key: ${input.key}`);
      }
      if (input.permissionActions) {
        ensurePermissionActions(store, input.permissionActions);
      }
      return updateRecord(store, store.adminRoles, idValue, input, actor, 'adminRole.update', 'AdminRole');
    },
    deleteAdminRole: (idValue: string, actor?: Actor) => {
      const record = softDeleteRecord(store, store.adminRoles, idValue, actor, 'adminRole.delete', 'AdminRole');
      store.adminUsers.forEach((user) => {
        user.roleIds = user.roleIds.filter((roleId) => roleId !== idValue);
      });
      return record;
    },
    bulkDeleteAdminRoles: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => {
        const record = softDeleteRecord(store, store.adminRoles, idValue, actor, 'adminRole.delete', 'AdminRole');
        store.adminUsers.forEach((user) => {
          user.roleIds = user.roleIds.filter((roleId) => roleId !== idValue);
        });
        return record;
      }),

    listAdminPermissions: (options?: ListOptions) => paginate(store.adminPermissions, options),
    createAdminPermission: (
      input: Omit<AdminPermissionRecord, 'id' | 'createdAt' | 'updatedAt'>,
      actor?: Actor,
    ) => {
      ensureUnique(store.adminPermissions, 'action', input.action);
      const record: AdminPermissionRecord = { ...input, id: id('permission'), createdAt: new Date(), updatedAt: new Date() };
      store.adminPermissions.push(record);
      audit(store, actor, 'adminPermission.create', 'AdminPermission', record.id, undefined, record);
      return record;
    },
    updateAdminPermission: (idValue: string, input: Partial<AdminPermissionRecord>, actor?: Actor) => {
      const record = findRecord(store.adminPermissions, idValue);
      if (
        input.action &&
        store.adminPermissions.some((permission) => permission.id !== idValue && permission.action === input.action)
      ) {
        throw new Error(`Duplicate value for action: ${input.action}`);
      }
      const oldAction = record.action;
      const updated = updateRecord(
        store,
        store.adminPermissions,
        idValue,
        input,
        actor,
        'adminPermission.update',
        'AdminPermission',
      );
      if (input.action && input.action !== oldAction) {
        store.adminRoles.forEach((role) => {
          role.permissionActions = role.permissionActions.map((action) =>
            action === oldAction ? String(input.action) : action,
          );
        });
      }
      return updated;
    },
    deleteAdminPermission: (idValue: string, actor?: Actor) => {
      const record = deleteRecord(
        store,
        store.adminPermissions,
        idValue,
        actor,
        'adminPermission.delete',
        'AdminPermission',
      );
      store.adminRoles.forEach((role) => {
        role.permissionActions = role.permissionActions.filter((action) => action !== record.action);
      });
      return record;
    },
    bulkDeleteAdminPermissions: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => {
        const record = deleteRecord(
          store,
          store.adminPermissions,
          idValue,
          actor,
          'adminPermission.delete',
          'AdminPermission',
        );
        store.adminRoles.forEach((role) => {
          role.permissionActions = role.permissionActions.filter((action) => action !== record.action);
        });
        return record;
      }),

    getSecuritySettings: () => effectiveSecuritySettings(store),
    updateSecuritySettings: (input: Partial<SecuritySettingsRecord>, actor?: Actor) => {
      const before = effectiveSecuritySettings(store);
      const current = ensureSecuritySettings(store);
      Object.assign(current, normalizeSecuritySettingsInput(input), {
        id: securitySettingsId,
        adminManaged: true,
        updatedAt: new Date(),
      });
      const serialized = effectiveSecuritySettings(store);
      audit(
        store,
        actor,
        'security.update',
        'SecuritySettings',
        securitySettingsId,
        redactSecuritySettings(before),
        redactSecuritySettings(serialized),
      );
      return serialized;
    },

    authenticateAdminUser: (
      input: { identity: string; password: string; safeEntry?: string; totpCode?: string },
      meta?: Pick<Actor, 'ip' | 'userAgent'>,
    ) => {
      assertAdminSafeEntry(store, input.safeEntry);
      const identity = input.identity.trim().toLowerCase();
      const user = store.adminUsers.find(
        (candidate) =>
          !candidate.deletedAt &&
          candidate.status === 'ACTIVE' &&
          (candidate.username.toLowerCase() === identity || candidate.email.toLowerCase() === identity),
      );

      if (!user || !verifyPassword(input.password, user.passwordHash)) {
        const error = new Error('Invalid username or password');
        error.name = 'UnauthorizedError';
        throw error;
      }

      assertAdminTotp(store, user, input.totpCode);

      const accessToken = createAccessToken();
      const session = {
        id: id('session'),
        userId: user.id,
        tokenHash: hashAccessToken(accessToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8),
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };

      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
      store.adminSessions.push(session);
      const serialized = serializeAdminUser(store, user);
      audit(store, { userId: user.id, ...meta }, 'auth.login', 'AdminSession', session.id, undefined, {
        userId: user.id,
        expiresAt: session.expiresAt,
      });

      return {
        accessToken,
        tokenType: 'Bearer',
        expiresAt: session.expiresAt,
        user: serialized,
      };
    },
    getAdminActorByToken: (token: string) => {
      const tokenHash = hashAccessToken(token);
      const session = store.adminSessions.find((candidate) => candidate.tokenHash === tokenHash);
      if (!session || session.expiresAt.getTime() < Date.now()) {
        if (session) {
          store.adminSessions = store.adminSessions.filter((candidate) => candidate.id !== session.id);
        }
        return undefined;
      }

      const user = store.adminUsers.find(
        (candidate) => candidate.id === session.userId && candidate.status === 'ACTIVE' && !candidate.deletedAt,
      );
      if (!user) {
        return undefined;
      }

      session.lastSeenAt = new Date();
      const serialized = serializeAdminUser(store, user);
      return {
        userId: serialized.id,
        username: serialized.username,
        displayName: serialized.displayName,
        roleIds: serialized.roleIds,
        roleNames: serialized.roles?.map((role) => role.name) ?? [],
        permissions: serialized.permissions,
        user: serialized,
      };
    },
    revokeAdminSession: (token: string, actor?: Actor) => {
      const tokenHash = hashAccessToken(token);
      const session = store.adminSessions.find((candidate) => candidate.tokenHash === tokenHash);
      store.adminSessions = store.adminSessions.filter((candidate) => candidate.tokenHash !== tokenHash);
      if (session) {
        audit(store, actor, 'auth.logout', 'AdminSession', session.id, session, undefined);
      }
      return { ok: true };
    },

    listGroups: (options?: ListOptions) => paginate(store.groups, options),
    getGroup: (id: string) => store.groups.find((group) => group.id === id),
    createGroup: (input: Omit<SiteGroupRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      const record: SiteGroupRecord = { ...input, id: id('group'), createdAt: new Date(), updatedAt: new Date() };
      store.groups.push(record);
      audit(store, actor, 'group.create', 'SiteGroup', record.id, undefined, record);
      return record;
    },
    updateGroup: (idValue: string, input: Partial<SiteGroupRecord>, actor?: Actor) => {
      const updated = updateRecord(store, store.groups, idValue, input, actor, 'group.update', 'SiteGroup');
      store.sites.forEach((site) => {
        if (site.groupId === idValue) {
          site.group = updated;
        }
      });
      return updated;
    },
    deleteGroup: (idValue: string, actor?: Actor) => {
      assertGroupCanBeDeleted(store, idValue);
      return deleteRecord(store, store.groups, idValue, actor, 'group.delete', 'SiteGroup');
    },
    bulkDeleteGroups: (ids: string[], actor?: Actor) => {
      ids.forEach((idValue) => assertGroupCanBeDeleted(store, idValue));
      return ids.map((idValue) => deleteRecord(store, store.groups, idValue, actor, 'group.delete', 'SiteGroup'));
    },

    listTemplates: (options?: ListOptions) => paginate(store.templates, options),
    createTemplate: (input: Omit<TemplateRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      ensureUnique(store.templates, 'key', input.key);
      const record: TemplateRecord = { ...input, id: id('template'), createdAt: new Date(), updatedAt: new Date() };
      store.templates.push(record);
      audit(store, actor, 'template.create', 'Template', record.id, undefined, record);
      return record;
    },
    updateTemplate: (idValue: string, input: Partial<TemplateRecord>, actor?: Actor) => {
      const updated = updateRecord(store, store.templates, idValue, input, actor, 'template.update', 'Template');
      store.sites.forEach((site) => {
        if (site.templateId === idValue) {
          site.template = updated;
          createSiteConfigInvalidationJob(store, site, `template.update:${idValue}`);
        }
      });
      return updated;
    },
    deleteTemplate: (idValue: string, actor?: Actor) => {
      assertTemplateCanBeDeleted(store, idValue);
      return deleteRecord(store, store.templates, idValue, actor, 'template.delete', 'Template');
    },
    bulkDeleteTemplates: (ids: string[], actor?: Actor) => {
      ids.forEach((idValue) => assertTemplateCanBeDeleted(store, idValue));
      return ids.map((idValue) => deleteRecord(store, store.templates, idValue, actor, 'template.delete', 'Template'));
    },

    listSites: (options?: ListOptions) => paginate(store.sites.filter((site) => !site.deletedAt), options),
    getSiteById: (idValue: string) => store.sites.find((site) => site.id === idValue && !site.deletedAt),
    resolveSite: (host: string) => resolveSiteByHost(host, store.sites),
    createSite: (
      input: Omit<SiteRecord, 'id' | 'domains' | 'createdAt' | 'updatedAt'>,
      actor?: Actor,
    ) => {
      ensureUniqueSiteDomains(store, siteDomainAliases(input.primaryDomain));
      ensureSiteTemplateSelection(store, input.templateId);
      ensureSiteScopedUrlConfig(store, input.urlConfigId);
      ensureSiteScopedTdkConfig(store, input.tdkConfigId);
      const template = input.templateId ? findActiveTemplate(store, input.templateId) : null;
      const group = store.groups.find((item) => item.id === input.groupId) ?? null;
      const record: SiteRecord = {
        ...input,
        id: id('site'),
        urlConfigId: input.urlConfigId ?? defaultUrlConfigId(store),
        tdkConfigId: input.tdkConfigId ?? defaultTdkConfigId(store),
        group,
        template,
        domains: buildPrimaryDomainRecords(input.primaryDomain, ''),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      record.domains.forEach((domain) => {
        domain.siteId = record.id;
      });
      store.sites.push(record);
      audit(store, actor, 'site.create', 'Site', record.id, undefined, record);
      return record;
    },
    updateSite: (idValue: string, input: Partial<SiteRecord>, actor?: Actor) => {
      const record = findRecord(store.sites, idValue);
      const oldPrimaryDomain = record.primaryDomain;
      if (input.primaryDomain) {
        ensureUniqueSiteDomains(store, siteDomainAliases(input.primaryDomain), idValue);
      }

      const before = { ...record, domains: [...record.domains] };
      ensureSiteTemplateSelection(store, input.templateId);
      ensureSiteScopedUrlConfig(store, input.urlConfigId, idValue);
      ensureSiteScopedTdkConfig(store, input.tdkConfigId, idValue);
      const template =
        input.templateId === undefined
          ? record.template
          : input.templateId
            ? findActiveTemplate(store, input.templateId)
            : null;
      const group =
        input.groupId === undefined ? record.group : store.groups.find((item) => item.id === input.groupId) ?? null;

      Object.assign(record, input, { group, template, updatedAt: new Date() });

      if (input.primaryDomain) {
        record.domains = syncPrimaryDomainRecords(record, input.primaryDomain, oldPrimaryDomain);
      }

      audit(store, actor, 'site.update', 'Site', record.id, before, record);
      createSiteConfigInvalidationJob(store, record, `site.update:${record.id}`);
      return record;
    },
    deleteSite: (idValue: string, actor?: Actor) =>
      deleteSiteWithScheduledTasks(store, idValue, actor),
    bulkDeleteSites: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => deleteSiteWithScheduledTasks(store, idValue, actor)),

    listUrlConfigs: (siteId?: string) =>
      store.urlConfigs.filter((config) => !siteId || config.siteId === siteId || !config.siteId),
    createUrlConfig: (input: UrlConfigWriteInput & { name: string; rules: UrlRuleInput[] }, actor?: Actor) => {
      const record: UrlConfigRecord = {
        ...(normalizeUrlConfig(input) as UrlConfigRecord),
        id: id('url'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.urlConfigs.push(record);
      audit(store, actor, 'urlConfig.create', 'UrlConfig', record.id, undefined, record);
      return record;
    },
    updateUrlConfig: (idValue: string, input: Partial<UrlConfigWriteInput>, actor?: Actor) => {
      const updated = updateRecord(
        store,
        store.urlConfigs,
        idValue,
        normalizeUrlConfig(input) as Partial<UrlConfigRecord>,
        actor,
        'urlConfig.update',
        'UrlConfig',
      );
      store.sites
        .filter((site) => !site.deletedAt && site.urlConfigId === idValue)
        .forEach((site) => createSiteConfigInvalidationJob(store, site, `urlConfig.update:${idValue}`));
      return updated;
    },
    deleteUrlConfig: (idValue: string, actor?: Actor) => {
      assertUrlConfigCanBeDeleted(store, idValue);
      return deleteRecord(store, store.urlConfigs, idValue, actor, 'urlConfig.delete', 'UrlConfig');
    },
    bulkDeleteUrlConfigs: (ids: string[], actor?: Actor) => {
      ids.forEach((idValue) => assertUrlConfigCanBeDeleted(store, idValue));
      return ids.map((idValue) => deleteRecord(store, store.urlConfigs, idValue, actor, 'urlConfig.delete', 'UrlConfig'));
    },

    listTdkConfigs: (siteId?: string) =>
      store.tdkConfigs.filter((config) => !siteId || config.siteId === siteId || !config.siteId),
    createTdkConfig: (input: TdkConfigWriteInput & { name: string; rules: TdkRuleInput[] }, actor?: Actor) => {
      const record: TdkConfigRecord = {
        ...(normalizeTdkConfig(input) as TdkConfigRecord),
        id: id('tdk'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.tdkConfigs.push(record);
      audit(store, actor, 'tdkConfig.create', 'TdkConfig', record.id, undefined, record);
      return record;
    },
    updateTdkConfig: (idValue: string, input: Partial<TdkConfigWriteInput>, actor?: Actor) => {
      const updated = updateRecord(
        store,
        store.tdkConfigs,
        idValue,
        normalizeTdkConfig(input) as Partial<TdkConfigRecord>,
        actor,
        'tdkConfig.update',
        'TdkConfig',
      );
      store.sites
        .filter((site) => !site.deletedAt && site.tdkConfigId === idValue)
        .forEach((site) => createSiteConfigInvalidationJob(store, site, `tdkConfig.update:${idValue}`));
      return updated;
    },
    deleteTdkConfig: (idValue: string, actor?: Actor) => {
      assertTdkConfigCanBeDeleted(store, idValue);
      return deleteRecord(store, store.tdkConfigs, idValue, actor, 'tdkConfig.delete', 'TdkConfig');
    },
    bulkDeleteTdkConfigs: (ids: string[], actor?: Actor) => {
      ids.forEach((idValue) => assertTdkConfigCanBeDeleted(store, idValue));
      return ids.map((idValue) => deleteRecord(store, store.tdkConfigs, idValue, actor, 'tdkConfig.delete', 'TdkConfig'));
    },

    listCategories: (_siteId?: string) =>
      store.categories
        .filter((category) => !category.deletedAt && category.status === 'ACTIVE')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    getCategoryBySlug: (_siteId: string, slug: string) =>
      repository.listCategories().find((category) => category.slug === slug && !category.deletedAt),
    createCategory: (input: Omit<CategoryRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      ensureUniqueCategorySlug(store.categories, input.slug);
      ensureUniqueSiblingCategoryName(store.categories, {
        parentId: input.parentId,
        name: input.name,
      });
      const record: CategoryRecord = { ...input, id: id('category'), createdAt: new Date(), updatedAt: new Date() };
      store.categories.push(record);
      const seoRuleSync = syncChildCategorySeoRules(store, record, actor);
      syncDefaultSeoConfigRules(store, activeSortedCategories(store), new Date(), actor);
      audit(store, actor, 'category.create', 'Category', record.id, undefined, record);
      return withCategorySeoRuleNotice(record, seoRuleSync);
    },
    updateCategory: (idValue: string, input: Partial<CategoryRecord>, actor?: Actor) => {
      const record = findRecord(store.categories, idValue);
      ensureUniqueCategorySlug(store.categories, input.slug, idValue);
      ensureUniqueSiblingCategoryName(store.categories, {
        id: idValue,
        parentId: input.parentId === undefined ? record.parentId : input.parentId,
        name: input.name ?? record.name,
      });
      const updated = updateRecord(store, store.categories, idValue, input, actor, 'category.update', 'Category');
      const seoRuleSync = syncChildCategorySeoRules(store, updated, actor);
      syncDefaultSeoConfigRules(store, activeSortedCategories(store), new Date(), actor);
      return withCategorySeoRuleNotice(updated, seoRuleSync);
    },
    deleteCategory: (idValue: string, actor?: Actor) => {
      assertCategoryCanBeDeleted(store, idValue);
      return softDeleteRecord(store, store.categories, idValue, actor, 'category.delete', 'Category');
    },
    bulkDeleteCategories: (ids: string[], actor?: Actor) => {
      ids.forEach((idValue) => assertCategoryCanBeDeleted(store, idValue));
      return ids.map((idValue) => softDeleteRecord(store, store.categories, idValue, actor, 'category.delete', 'Category'));
    },

    listNews: (options: NewsListOptions) => {
      const filtered = store.news
        .filter((article) => article.siteId === options.siteId)
        .filter((article) => !options.categoryId || article.categoryId === options.categoryId)
        .filter((article) => !options.status || article.status === options.status)
        .filter((article) => !article.deletedAt)
        .map((article) => hydrateArticle(store, article))
        .sort(sortNews);

      return options.limit ? filtered.slice(0, options.limit) : paginate(filtered, options);
    },
    getNewsBySlug: (siteId: string, slug: string) => {
      const article = store.news.find(
        (candidate) => candidate.siteId === siteId && candidate.slug === slug && !candidate.deletedAt,
      );
      return article ? hydrateArticle(store, article) : undefined;
    },
    getNewsById: (idValue: string) => {
      const article = store.news.find((candidate) => candidate.id === idValue);
      return article ? hydrateArticle(store, article) : undefined;
    },
    createNews: (input: Omit<NewsArticleRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      ensureScopedSlug(store.news, input.siteId, input.slug);
      const record: NewsArticleRecord = {
        ...input,
        id: id('news'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.news.push(record);
      audit(store, actor, 'news.create', 'NewsArticle', record.id, undefined, record);
      return hydrateArticle(store, record);
    },
    updateNews: (idValue: string, input: Partial<NewsArticleRecord>, actor?: Actor) =>
      hydrateArticle(
        store,
        updateRecord(store, store.news, idValue, input, actor, 'news.update', 'NewsArticle'),
      ),
    publishNews: (idValue: string, actor?: Actor) => {
      const article = store.news.find((candidate) => candidate.id === idValue);
      if (!article) {
        throw new Error(`Record not found: ${idValue}`);
      }
      const before = { ...article };
      article.status = 'PUBLISHED';
      article.publishedAt = article.publishedAt ?? new Date();
      article.updatedAt = new Date();
      const hydrated = hydrateArticle(store, article);
      const site = store.sites.find((candidate) => candidate.id === article.siteId);
      const category = store.categories.find((candidate) => candidate.id === article.categoryId);
      if (site && category) {
        const job = createNewsInvalidationJob(store, site, hydrated, category);
        audit(store, actor, 'news.publish', 'NewsArticle', article.id, before, hydrated);
        return { article: hydrated, invalidationJob: job };
      }
      audit(store, actor, 'news.publish', 'NewsArticle', article.id, before, hydrated);
      return { article: hydrated, invalidationJob: undefined };
    },
    deleteNews: (idValue: string, actor?: Actor) =>
      softDeleteRecord(store, store.news, idValue, actor, 'news.delete', 'NewsArticle'),
    bulkDeleteNews: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => softDeleteRecord(store, store.news, idValue, actor, 'news.delete', 'NewsArticle')),

    listLiveReplays: (options?: LiveReplayListOptions) => {
      const rows = store.liveReplays
        .filter((replay) => !replay.deletedAt)
        .filter((replay) => !options?.siteId || replay.siteId === options.siteId)
        .filter((replay) => !options?.categoryId || replay.categoryId === options.categoryId)
        .sort((a, b) => b.createTime.getTime() - a.createTime.getTime());

      return options?.limit ? rows.slice(0, options.limit) : paginate(rows, options);
    },
    getLiveReplayBySlug: (siteId: string, slug: string) =>
      store.liveReplays.find((replay) => replay.siteId === siteId && replay.slug === slug && !replay.deletedAt),
    getLiveReplayById: (idValue: string) =>
      store.liveReplays.find((replay) => replay.id === idValue && !replay.deletedAt),
    createLiveReplay: (input: Omit<LiveReplayRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      ensureScopedSlug(store.liveReplays, input.siteId, input.slug);
      const record: LiveReplayRecord = {
        ...input,
        id: id('live-replay'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.liveReplays.push(record);
      audit(store, actor, 'liveReplay.create', 'LiveReplay', record.id, undefined, record);
      return record;
    },
    updateLiveReplay: (idValue: string, input: Partial<LiveReplayRecord>, actor?: Actor) => {
      const record = findRecord(store.liveReplays, idValue);
      const nextSiteId = input.siteId ?? record.siteId;
      const nextSlug = input.slug ?? record.slug;
      if (
        (input.siteId || input.slug) &&
        store.liveReplays.some(
          (replay) => replay.id !== idValue && replay.siteId === nextSiteId && replay.slug === nextSlug && !replay.deletedAt,
        )
      ) {
        throw new Error(`Duplicate slug in site ${nextSiteId}: ${nextSlug}`);
      }
      return updateRecord(store, store.liveReplays, idValue, input, actor, 'liveReplay.update', 'LiveReplay');
    },
    deleteLiveReplay: (idValue: string, actor?: Actor) =>
      softDeleteRecord(store, store.liveReplays, idValue, actor, 'liveReplay.delete', 'LiveReplay'),
    bulkDeleteLiveReplays: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => softDeleteRecord(store, store.liveReplays, idValue, actor, 'liveReplay.delete', 'LiveReplay')),

    listPromotionTypes: (options?: PromotionListOptions) => {
      const records = store.promotionTypes
        .filter((type) => !type.deletedAt)
        .filter((type) => !options?.siteId || type.siteId === options.siteId || !type.siteId)
        .filter((type) => !options?.slot || type.slot === options.slot)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      return paginate(records, options);
    },
    createPromotionType: (
      input: Omit<PromotionTypeRecord, 'id' | 'createdAt' | 'updatedAt'>,
      actor?: Actor,
    ) => {
      ensureScopedKey(store.promotionTypes, input.siteId ?? null, input.key);
      const record: PromotionTypeRecord = {
        ...input,
        id: id('promotion-type'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.promotionTypes.push(record);
      audit(store, actor, 'promotionType.create', 'PromotionType', record.id, undefined, record);
      return record;
    },
    updatePromotionType: (idValue: string, input: Partial<PromotionTypeRecord>, actor?: Actor) => {
      const record = findRecord(store.promotionTypes, idValue);
      const nextSiteId = input.siteId === undefined ? record.siteId : input.siteId;
      const nextKey = input.key ?? record.key;
      if (
        (input.key || input.siteId !== undefined) &&
        store.promotionTypes.some(
          (type) => type.id !== idValue && (type.siteId ?? null) === (nextSiteId ?? null) && type.key === nextKey,
        )
      ) {
        throw new Error(`Duplicate promotion key in site ${nextSiteId ?? 'global'}: ${nextKey}`);
      }

      return updateRecord(store, store.promotionTypes, idValue, input, actor, 'promotionType.update', 'PromotionType');
    },
    deletePromotionType: (idValue: string, actor?: Actor) =>
      softDeleteRecord(store, store.promotionTypes, idValue, actor, 'promotionType.delete', 'PromotionType'),
    bulkDeletePromotionTypes: (ids: string[], actor?: Actor) =>
      ids.map((idValue) =>
        softDeleteRecord(store, store.promotionTypes, idValue, actor, 'promotionType.delete', 'PromotionType'),
      ),

    listPromotionLinks: (options?: PromotionListOptions) => {
      const records = store.promotionLinks
        .filter((link) => !link.deletedAt)
        .filter((link) => !options?.siteId || link.siteId === options.siteId)
        .filter((link) => !options?.categoryId || link.categoryId === options.categoryId)
        .map((link) => hydratePromotionLink(store, link))
        .filter((link) => !options?.slot || link.promotionType?.slot === options.slot)
        .sort(sortPromotionLinks);

      return paginate(records, options);
    },
    listActivePromotionLinks: (options: PromotionListOptions & { siteId: string; now?: Date }) => {
      const nowValue = options.now ?? new Date();
      return store.promotionLinks
        .filter((link) => link.siteId === options.siteId)
        .filter((link) => !link.deletedAt && link.status === 'ACTIVE')
        .filter((link) => !link.startAt || link.startAt.getTime() <= nowValue.getTime())
        .filter((link) => !link.endAt || link.endAt.getTime() >= nowValue.getTime())
        .map((link) => hydratePromotionLink(store, link))
        .filter((link) => link.promotionType?.status === 'ACTIVE' && !link.promotionType.deletedAt)
        .filter((link) => !options.slot || link.promotionType?.slot === options.slot)
        .filter((link) => !options.categoryId || !link.categoryId || link.categoryId === options.categoryId)
        .sort(sortPromotionLinks);
    },
    createPromotionLink: (
      input: Omit<PromotionLinkRecord, 'id' | 'promotionType' | 'createdAt' | 'updatedAt'>,
      actor?: Actor,
    ) => {
      ensurePromotionLinkReferences(store, input);
      const record: PromotionLinkRecord = {
        ...input,
        id: id('promotion-link'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.promotionLinks.push(record);
      const hydrated = hydratePromotionLink(store, record);
      audit(store, actor, 'promotionLink.create', 'PromotionLink', record.id, undefined, hydrated);
      return hydrated;
    },
    updatePromotionLink: (idValue: string, input: Partial<PromotionLinkRecord>, actor?: Actor) => {
      const record = findRecord(store.promotionLinks, idValue);
      const before = hydratePromotionLink(store, record);
      const next = { ...record, ...input };
      ensurePromotionLinkReferences(store, next);
      Object.assign(record, input, { updatedAt: new Date() });
      const hydrated = hydratePromotionLink(store, record);
      audit(store, actor, 'promotionLink.update', 'PromotionLink', record.id, before, hydrated);
      return hydrated;
    },
    deletePromotionLink: (idValue: string, actor?: Actor) =>
      softDeleteRecord(store, store.promotionLinks, idValue, actor, 'promotionLink.delete', 'PromotionLink'),
    bulkDeletePromotionLinks: (ids: string[], actor?: Actor) =>
      ids.map((idValue) =>
        softDeleteRecord(store, store.promotionLinks, idValue, actor, 'promotionLink.delete', 'PromotionLink'),
      ),

    listLeagues: (options?: ListOptions) => paginate(store.leagues, options),
    createLeague: (input: Omit<SportLeagueRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      ensureUnique(store.leagues, 'slug', input.slug);
      const record: SportLeagueRecord = { ...input, id: id('league'), createdAt: new Date(), updatedAt: new Date() };
      store.leagues.push(record);
      audit(store, actor, 'league.create', 'SportLeague', record.id, undefined, record);
      return record;
    },
    updateLeague: (idValue: string, input: Partial<SportLeagueRecord>, actor?: Actor) =>
      updateRecord(store, store.leagues, idValue, input, actor, 'league.update', 'SportLeague'),
    deleteLeague: (idValue: string, actor?: Actor) =>
      deleteRecord(store, store.leagues, idValue, actor, 'league.delete', 'SportLeague'),
    bulkDeleteLeagues: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => deleteRecord(store, store.leagues, idValue, actor, 'league.delete', 'SportLeague')),
    listTeams: (options?: ListOptions) => paginate(store.teams, options),
    createTeam: (input: Omit<SportTeamRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      ensureUnique(store.teams, 'slug', input.slug);
      const record: SportTeamRecord = { ...input, id: id('team'), createdAt: new Date(), updatedAt: new Date() };
      store.teams.push(record);
      audit(store, actor, 'team.create', 'SportTeam', record.id, undefined, record);
      return record;
    },
    updateTeam: (idValue: string, input: Partial<SportTeamRecord>, actor?: Actor) =>
      updateRecord(store, store.teams, idValue, input, actor, 'team.update', 'SportTeam'),
    deleteTeam: (idValue: string, actor?: Actor) =>
      deleteRecord(store, store.teams, idValue, actor, 'team.delete', 'SportTeam'),
    bulkDeleteTeams: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => deleteRecord(store, store.teams, idValue, actor, 'team.delete', 'SportTeam')),
    listMatches: (siteId: string, options: MatchListOptions = {}) => {
      const now = Date.now();
      const recentWindowMs = (options.recentHours ?? 2) * 60 * 60 * 1000;
      const upcomingWindowMs = (options.upcomingHours ?? 2) * 60 * 60 * 1000;
      const leagueById = new Map(store.leagues.map((league) => [league.id, league]));
      const teamById = new Map(store.teams.map((team) => [team.id, team]));

      const matches = store.matches
        .filter(
          (match) =>
            (!match.siteId || match.siteId === siteId) &&
            (!options.sport || match.sport === options.sport) &&
            (!options.status || match.status === options.status) &&
            match.startTime.getTime() >= now - recentWindowMs &&
            match.startTime.getTime() <= now + upcomingWindowMs,
        )
        .map((match) => hydrateMatch(store, match, { leagueById, teamById }))
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      return options.limit ? matches.slice(0, options.limit) : matches;
    },
    listAllMatches: (options?: ListOptions) => paginate(store.matches.map((match) => hydrateMatch(store, match)), options),
    createMatch: (input: Omit<SportMatchRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      const record: SportMatchRecord = { ...input, id: id('match'), createdAt: new Date(), updatedAt: new Date() };
      store.matches.push(record);
      audit(store, actor, 'match.create', 'SportMatch', record.id, undefined, record);
      return hydrateMatch(store, record);
    },
    updateMatch: (idValue: string, input: Partial<SportMatchRecord>, actor?: Actor) =>
      hydrateMatch(store, updateRecord(store, store.matches, idValue, input, actor, 'match.update', 'SportMatch')),
    deleteMatch: (idValue: string, actor?: Actor) =>
      deleteRecord(store, store.matches, idValue, actor, 'match.delete', 'SportMatch'),
    bulkDeleteMatches: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => deleteRecord(store, store.matches, idValue, actor, 'match.delete', 'SportMatch')),
    listLiveProducts: (options?: ListOptions) => paginate(store.liveProducts, options),
    listActiveLiveProducts: (limit = 4) =>
      store.liveProducts
        .filter((product) => product.status === 'ACTIVE')
        .slice(0, limit),
    listLiveProductsByIds: (ids: string[], limit = 4) =>
      ids
        .map((idValue) => store.liveProducts.find((product) => product.id === idValue && product.status === 'ACTIVE'))
        .filter((product): product is LiveProductRecord => Boolean(product))
        .slice(0, limit),
    createLiveProduct: (input: Omit<LiveProductRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      const record: LiveProductRecord = { ...input, id: id('live-product'), createdAt: new Date(), updatedAt: new Date() };
      store.liveProducts.push(record);
      audit(store, actor, 'liveProduct.create', 'LiveProduct', record.id, undefined, record);
      return record;
    },
    updateLiveProduct: (idValue: string, input: Partial<LiveProductRecord>, actor?: Actor) =>
      updateRecord(store, store.liveProducts, idValue, input, actor, 'liveProduct.update', 'LiveProduct'),
    deleteLiveProduct: (idValue: string, actor?: Actor) =>
      deleteRecord(store, store.liveProducts, idValue, actor, 'liveProduct.delete', 'LiveProduct'),
    bulkDeleteLiveProducts: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => deleteRecord(store, store.liveProducts, idValue, actor, 'liveProduct.delete', 'LiveProduct')),
    listSignalDomains: (options?: ListOptions) => paginate(store.signalDomains, options),
    listActiveSignalDomains: (ids?: string[]) =>
      filterActiveByOptionalIds(store.signalDomains, ids),
    listSignalDomainsByIds: (ids: string[]) => filterActiveByOptionalIds(store.signalDomains, ids),
    createSignalDomain: (input: Omit<SignalDomainRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      const record: SignalDomainRecord = { ...input, id: id('signal-domain'), createdAt: new Date(), updatedAt: new Date() };
      store.signalDomains.push(record);
      audit(store, actor, 'signalDomain.create', 'SignalDomain', record.id, undefined, record);
      return record;
    },
    updateSignalDomain: (idValue: string, input: Partial<SignalDomainRecord>, actor?: Actor) =>
      updateRecord(store, store.signalDomains, idValue, input, actor, 'signalDomain.update', 'SignalDomain'),
    deleteSignalDomain: (idValue: string, actor?: Actor) =>
      deleteRecord(store, store.signalDomains, idValue, actor, 'signalDomain.delete', 'SignalDomain'),
    bulkDeleteSignalDomains: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => deleteRecord(store, store.signalDomains, idValue, actor, 'signalDomain.delete', 'SignalDomain')),
    listSignalSourceNames: (options?: ListOptions) => paginate(store.signalSourceNames, options),
    listActiveSignalSourceNames: (ids?: string[]) =>
      filterActiveByOptionalIds(store.signalSourceNames, ids),
    listSignalSourceNamesByIds: (ids: string[]) => filterActiveByOptionalIds(store.signalSourceNames, ids),
    createSignalSourceName: (input: Omit<SignalSourceNameRecord, 'id' | 'createdAt' | 'updatedAt'>, actor?: Actor) => {
      const record: SignalSourceNameRecord = { ...input, id: id('signal-source'), createdAt: new Date(), updatedAt: new Date() };
      store.signalSourceNames.push(record);
      audit(store, actor, 'signalSourceName.create', 'SignalSourceName', record.id, undefined, record);
      return record;
    },
    updateSignalSourceName: (idValue: string, input: Partial<SignalSourceNameRecord>, actor?: Actor) =>
      updateRecord(store, store.signalSourceNames, idValue, input, actor, 'signalSourceName.update', 'SignalSourceName'),
    deleteSignalSourceName: (idValue: string, actor?: Actor) =>
      deleteRecord(store, store.signalSourceNames, idValue, actor, 'signalSourceName.delete', 'SignalSourceName'),
    bulkDeleteSignalSourceNames: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => deleteRecord(store, store.signalSourceNames, idValue, actor, 'signalSourceName.delete', 'SignalSourceName')),
    listScheduledTasks: (options?: ListOptions) =>
      paginate(
        store.scheduledTasks
          .slice()
          .sort((a, b) => `${a.type}:${a.scheduleTime}`.localeCompare(`${b.type}:${b.scheduleTime}`)),
        options,
      ),
    createScheduledTask: (
      input: Pick<ScheduledTaskRecord, 'type' | 'name' | 'status' | 'scheduleTime' | 'timezone'> &
        Partial<Pick<ScheduledTaskRecord, 'config'>>,
      actor?: Actor,
    ) => {
      const record: ScheduledTaskRecord = {
        ...input,
        id: id('task'),
        lastRunAt: null,
        nextRunAt: null,
        lastStatus: 'IDLE',
        lastMessage: '任务已创建，等待调度器执行。',
        runCount: 0,
        failureCount: 0,
        config: input.config ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.scheduledTasks.push(record);
      audit(store, actor, 'scheduledTask.create', 'ScheduledTask', record.id, undefined, record);
      return record;
    },
    updateScheduledTask: (idValue: string, input: Partial<ScheduledTaskRecord>, actor?: Actor) =>
      updateRecord(store, store.scheduledTasks, idValue, input, actor, 'scheduledTask.update', 'ScheduledTask'),
    updateScheduledTaskRun: (idValue: string, input: Partial<ScheduledTaskRecord>, actor?: Actor) =>
      updateRecord(store, store.scheduledTasks, idValue, input, actor, 'scheduledTask.run', 'ScheduledTask'),
    deleteScheduledTask: (idValue: string, actor?: Actor) =>
      deleteRecord(store, store.scheduledTasks, idValue, actor, 'scheduledTask.delete', 'ScheduledTask'),
    bulkDeleteScheduledTasks: (ids: string[], actor?: Actor) =>
      ids.map((idValue) => deleteRecord(store, store.scheduledTasks, idValue, actor, 'scheduledTask.delete', 'ScheduledTask')),
    listInvalidationJobs: () => store.invalidationJobs,
    listAuditLogs: () => store.auditLogs,
  };

  return withPersistence(repository, store);
}

export function getCmsStoreVersion(): string {
  if (!shouldPersistStore()) {
    return `volatile:${Date.now()}`;
  }

  const now = Date.now();
  const cacheTtlMs = nonNegativeIntegerEnv('SPORTS_CMS_VERSION_CACHE_TTL_MS', 1000);
  if (cachedStoreVersion && now - cachedStoreVersionCheckedAt < cacheTtlMs) {
    return cachedStoreVersion;
  }

  try {
    const stat = fs.statSync(getStoreFilePath());
    cachedStoreVersion = `${stat.mtimeMs}:${stat.size}`;
  } catch {
    cachedStoreVersion = `memory:${lastLoadedMtime}`;
  }
  cachedStoreVersionCheckedAt = now;
  return cachedStoreVersion;
}

export const cmsRepository = createMemoryCmsRepository();

function ensureGlobalSeoDefaults(store: CmsStore): void {
  const now = new Date();
  store.urlConfigs = store.urlConfigs.filter((config) => !isLegacyDefaultUrlConfig(config.id));
  store.tdkConfigs = store.tdkConfigs.filter((config) => !isLegacyDefaultTdkConfig(config.id));

  const categories = store.categories
    .filter((category) => !category.deletedAt && category.status === 'ACTIVE')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!store.urlConfigs.some((config) => config.id === 'url-default-rules')) {
    store.urlConfigs.push(normalizeUrlConfig(buildDefaultUrlConfig(categories, now)) as UrlConfigRecord);
  }
  if (!store.tdkConfigs.some((config) => config.id === 'tdk-default-rules')) {
    store.tdkConfigs.push(normalizeTdkConfig(buildDefaultTdkConfig(categories, now)) as TdkConfigRecord);
  }
  syncDefaultSeoConfigRules(store, categories, now);
  ensureFourColumnUrlConfig(store, categories, now);

  const fallbackUrlConfigId = defaultUrlConfigId(store);
  const fallbackTdkConfigId = defaultTdkConfigId(store);
  store.sites.forEach((site) => {
    if (!site.urlConfigId) {
      site.urlConfigId = fallbackUrlConfigId;
    }
    if (!site.tdkConfigId) {
      site.tdkConfigId = fallbackTdkConfigId;
    }
  });

  normalizePersistedStore(store);
}

function syncDefaultSeoConfigRules(
  store: CmsStore,
  categories = activeSortedCategories(store),
  nowValue = new Date(),
  actor?: Actor,
): void {
  const urlConfig = store.urlConfigs.find((config) => config.id === 'url-default-rules');
  if (urlConfig && syncDefaultUrlConfigRules(urlConfig, categories, nowValue)) {
    audit(store, actor, 'urlConfig.update', 'UrlConfig', urlConfig.id, undefined, urlConfig);
  }

  const tdkConfig = store.tdkConfigs.find((config) => config.id === 'tdk-default-rules');
  if (tdkConfig && syncDefaultTdkConfigRules(tdkConfig, categories, nowValue)) {
    audit(store, actor, 'tdkConfig.update', 'TdkConfig', tdkConfig.id, undefined, tdkConfig);
  }
}

function activeSortedCategories(store: CmsStore): CategoryRecord[] {
  return store.categories
    .filter((category) => !category.deletedAt && category.status === 'ACTIVE')
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function syncDefaultUrlConfigRules(config: UrlConfigRecord, categories: CategoryRecord[], nowValue: Date): boolean {
  const before = JSON.stringify({
    categoryIds: config.categoryIds ?? [],
    rules: config.rules ?? [],
  });
  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const existingRules = urlRules(config);
  const existingCategoryRules = new Map(
    existingRules
      .filter((rule) => rule.categoryId && activeCategoryIds.has(rule.categoryId))
      .map((rule) => [rule.categoryId, rule]),
  );
  const homeRule = existingRules.find((rule) => rule.pageType === 'HOME' && !rule.categoryId) ?? buildDefaultUrlConfig([], nowValue).rules[0];
  const leagueRule = normalizeDefaultLeagueUrlRule(
    existingRules.find((rule) => rule.pageType === 'LEAGUE' && !rule.categoryId),
  );

  config.rules = dedupeUrlRules([
    {
      ...homeRule,
      categoryId: '',
      pageType: 'HOME',
      pattern: homeRule.pattern || '/',
      detailRules: [],
    },
    leagueRule,
    ...categories.map((category) => normalizeDefaultUrlRuleForCategory(existingCategoryRules.get(category.id), category)),
  ]);
  refreshUrlConfigRuleSummary(config);

  const after = JSON.stringify({
    categoryIds: config.categoryIds ?? [],
    rules: config.rules ?? [],
  });
  if (before === after) {
    return false;
  }

  config.updatedAt = nowValue;
  return true;
}

function syncDefaultTdkConfigRules(config: TdkConfigRecord, categories: CategoryRecord[], nowValue: Date): boolean {
  const before = JSON.stringify({
    categoryIds: config.categoryIds ?? [],
    rules: config.rules ?? [],
  });
  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const existingRules = tdkRules(config);
  const existingCategoryRules = new Map(
    existingRules
      .filter((rule) => rule.categoryId && activeCategoryIds.has(rule.categoryId))
      .map((rule) => [rule.categoryId, rule]),
  );
  const homeRule = existingRules.find((rule) => rule.pageType === 'HOME' && !rule.categoryId) ?? buildDefaultTdkConfig([], nowValue).rules[0];
  const leagueRule = normalizeDefaultLeagueTdkRule(
    existingRules.find((rule) => rule.pageType === 'LEAGUE' && !rule.categoryId),
  );

  config.rules = dedupeTdkRules([
    {
      ...homeRule,
      categoryId: '',
      pageType: 'HOME',
      detailRules: [],
    },
    leagueRule,
    ...categories.map((category) => normalizeDefaultTdkRuleForCategory(existingCategoryRules.get(category.id), category)),
  ]);
  refreshTdkConfigRuleSummary(config);

  const after = JSON.stringify({
    categoryIds: config.categoryIds ?? [],
    rules: config.rules ?? [],
  });
  if (before === after) {
    return false;
  }

  config.updatedAt = nowValue;
  return true;
}

function ensureFourColumnUrlConfig(store: CmsStore, categories: CategoryRecord[], nowValue: Date): void {
  const selectedCategories = selectFourColumnCategories(categories);
  if (!selectedCategories.length) {
    return;
  }

  const existing = store.urlConfigs.find((config) => config.id === 'url-four-column-rules');
  if (existing) {
    const before = JSON.stringify(existing.rules ?? []);
    existing.rules = dedupeUrlRules([...urlRules(existing), buildDefaultLeagueUrlRule()]);
    refreshUrlConfigRuleSummary(existing);
    if (before !== JSON.stringify(existing.rules ?? [])) {
      existing.updatedAt = nowValue;
    }
    return;
  }

  const nextRules = buildFourColumnUrlRules(selectedCategories);
  {
    store.urlConfigs.push({
      id: 'url-four-column-rules',
      siteId: null,
      categoryIds: selectedCategories.map((category) => category.id),
      rules: nextRules,
      name: '四栏目 URL 规则',
      status: 'ACTIVE',
      pageType: 'HOME',
      pattern: '/',
      description: '只维护足球直播、体育新闻、CBA赛程、赛事录像四个核心栏目，适合站点只展示四栏目时绑定。',
      createdAt: nowValue,
      updatedAt: nowValue,
    });
  }
}

function selectFourColumnCategories(categories: CategoryRecord[]): CategoryRecord[] {
  const selectors: Array<(category: CategoryRecord) => boolean> = [
    (category) => category.id === 'cat-frontline-football' || category.slug === 'football-live' || category.name === '足球直播',
    (category) => category.id === 'cat-frontline-news' || category.slug === 'sports-news' || category.name === '体育新闻',
    (category) => category.id === 'cat-courtside-cba' || category.slug === 'cba-schedule' || category.name === 'CBA 赛程',
    (category) => category.id === 'cat-frontline-replay' || category.slug === 'match-replay' || category.name === '赛事录像',
  ];

  return selectors
    .map((selector) => categories.find(selector))
    .filter((category): category is CategoryRecord => Boolean(category));
}

function buildFourColumnUrlRules(categories: CategoryRecord[]): UrlRuleRecord[] {
  return dedupeUrlRules([
    {
      id: 'rule-url-four-column-home',
      categoryId: '',
      pageType: 'HOME',
      pattern: '/',
      detailRules: [],
    },
    buildDefaultLeagueUrlRule(),
    ...categories.map((category) => buildDefaultUrlRule(category)),
  ]);
}

function normalizeDefaultUrlRuleForCategory(rule: UrlRuleRecord | undefined, category: CategoryRecord): UrlRuleRecord {
  const expected = buildDefaultUrlRule(category);
  if (!rule) {
    return expected;
  }

  if (rule.pageType !== expected.pageType && isDefaultUrlRuleShape(rule)) {
    return expected;
  }

  const expectedDetailRules = expected.detailRules ?? [];
  const expectedDetailPageType = expectedDetailRules[0]?.pageType;
  const expectedDetailPattern = expectedDetailRules[0]?.pattern;
  const hasExpectedDetailRule = (rule.detailRules ?? []).some(
    (detailRule) => detailRule.pageType === expectedDetailPageType && detailRule.pattern === expectedDetailPattern,
  );

  if (!hasExpectedDetailRule && !(rule.detailRules ?? []).length) {
    return {
      ...rule,
      detailRules: dedupeUrlDetailRules([...(rule.detailRules ?? []), ...expectedDetailRules]),
    };
  }

  return rule;
}

function buildDefaultLeagueUrlRule(): UrlRuleRecord {
  return {
    id: 'rule-url-league',
    categoryId: '',
    pageType: 'LEAGUE',
    pattern: '/league/{leagueSlug}.html',
    detailRules: [],
  };
}

function normalizeDefaultLeagueUrlRule(rule: UrlRuleRecord | undefined): UrlRuleRecord {
  if (!rule) {
    return buildDefaultLeagueUrlRule();
  }

  return {
    ...rule,
    categoryId: '',
    pageType: 'LEAGUE',
    pattern: rule.pattern || '/league/{leagueSlug}.html',
    detailRules: [],
  };
}

function isDefaultUrlRuleShape(rule: UrlRuleRecord): boolean {
  const patterns = [rule.pattern, ...(rule.detailRules ?? []).map((detailRule) => detailRule.pattern)].join(' ');
  return /\/(?:news|zhibo|video)\//i.test(patterns);
}

function normalizeDefaultTdkRuleForCategory(rule: TdkRuleRecord | undefined, category: CategoryRecord): TdkRuleRecord {
  const expected = buildDefaultTdkRule(category);
  if (!rule) {
    return expected;
  }

  if (rule.pageType !== expected.pageType && isDefaultTdkRuleShape(rule)) {
    return expected;
  }

  const expectedDetailRules = expected.detailRules ?? [];
  const expectedDetailPageType = expectedDetailRules[0]?.pageType;
  const hasExpectedDetailRule = (rule.detailRules ?? []).some((detailRule) => detailRule.pageType === expectedDetailPageType);

  if (!hasExpectedDetailRule && !(rule.detailRules ?? []).length) {
    return {
      ...rule,
      detailRules: dedupeTdkDetailRules([...(rule.detailRules ?? []), ...expectedDetailRules]),
    };
  }

  return rule;
}

function buildDefaultLeagueTdkRule(): TdkRuleRecord {
  return {
    id: 'rule-tdk-league',
    categoryId: '',
    pageType: 'LEAGUE',
    titleTemplate: '{leagueName}直播赛程_{siteName}',
    keywordsTemplate: '{leagueName}直播,{leagueName}赛程,{siteName}',
    descriptionTemplate: '{siteName}提供{leagueName}直播赛程、比赛时间、对阵信息和相关赛事入口。',
    detailRules: [],
  };
}

function normalizeDefaultLeagueTdkRule(rule: TdkRuleRecord | undefined): TdkRuleRecord {
  if (!rule) {
    return buildDefaultLeagueTdkRule();
  }

  return {
    ...rule,
    categoryId: '',
    pageType: 'LEAGUE',
    titleTemplate: rule.titleTemplate || '{leagueName}直播赛程_{siteName}',
    keywordsTemplate: rule.keywordsTemplate || '{leagueName}直播,{leagueName}赛程,{siteName}',
    descriptionTemplate: rule.descriptionTemplate || '{siteName}提供{leagueName}直播赛程、比赛时间、对阵信息和相关赛事入口。',
    detailRules: [],
  };
}

function isDefaultTdkRuleShape(rule: TdkRuleRecord): boolean {
  const text = [
    rule.titleTemplate,
    rule.keywordsTemplate,
    rule.descriptionTemplate,
    ...(rule.detailRules ?? []).flatMap((detailRule) => [
      detailRule.titleTemplate,
      detailRule.keywordsTemplate,
      detailRule.descriptionTemplate,
    ]),
  ]
    .filter(Boolean)
    .join(' ');
  return /高清直播|比赛回放|最新\{columnName\}|体育新闻/i.test(text);
}

function isLegacyDefaultUrlConfig(idValue: string): boolean {
  return [
    'url-default-home',
    'url-default-news',
    'url-default-live',
    'url-default-video',
    'url-default-news-category',
    'url-default-news-detail',
    'url-default-live-category',
    'url-default-live-detail',
    'url-default-video-category',
    'url-default-video-detail',
  ].some((legacyId) => idValue === legacyId || idValue.startsWith(`${legacyId}-site-`));
}

function isLegacyDefaultTdkConfig(idValue: string): boolean {
  return [
    'tdk-default-home',
    'tdk-default-news',
    'tdk-default-live',
    'tdk-default-video',
    'tdk-default-news-category',
    'tdk-default-news-detail',
    'tdk-default-live-category',
    'tdk-default-live-detail',
    'tdk-default-video-category',
    'tdk-default-video-detail',
  ].some((legacyId) => idValue === legacyId || idValue.startsWith(`${legacyId}-site-`));
}

function buildDefaultUrlConfig(categories: CategoryRecord[], nowValue: Date): UrlConfigRecord {
  const rules: UrlConfigRecord['rules'] = [
    {
      id: 'rule-url-home',
      categoryId: '',
      pageType: 'HOME',
      pattern: '/',
      detailRules: [],
    },
    buildDefaultLeagueUrlRule(),
    ...categories.map((category) => buildDefaultUrlRule(category)),
  ];

  return {
    id: 'url-default-rules',
    siteId: null,
    categoryIds: categories.map((category) => category.id),
    rules,
    name: '默认全站 URL 规则',
    status: 'ACTIVE',
    pageType: 'HOME',
    pattern: '/',
    description: '一个配置内维护首页、直播、新闻、录像栏目的栏目链接与内页链接规则。',
    createdAt: nowValue,
    updatedAt: nowValue,
  };
}

function buildDefaultTdkConfig(categories: CategoryRecord[], nowValue: Date): TdkConfigRecord {
  const rules: TdkConfigRecord['rules'] = [
    {
      id: 'rule-tdk-home',
      categoryId: '',
      pageType: 'HOME',
      titleTemplate: '{siteName} - 今日体育新闻、直播赛程与赛事分析',
      keywordsTemplate: '{siteName},体育新闻,赛事直播,足球赛程,篮球赛程',
      descriptionTemplate: '{siteName}实时整理足球、篮球、热门赛事、球队动态和直播信息。',
      detailRules: [],
    },
    buildDefaultLeagueTdkRule(),
    ...categories.map((category) => buildDefaultTdkRule(category)),
  ];

  return {
    id: 'tdk-default-rules',
    siteId: null,
    categoryIds: categories.map((category) => category.id),
    rules,
    name: '默认全站 TDK 规则',
    status: 'ACTIVE',
    pageType: 'HOME',
    titleTemplate: '{siteName} - 今日体育新闻、直播赛程与赛事分析',
    keywordsTemplate: '{siteName},体育新闻,赛事直播,足球赛程,篮球赛程',
    descriptionTemplate: '{siteName}实时整理足球、篮球、热门赛事、球队动态和直播信息。',
    createdAt: nowValue,
    updatedAt: nowValue,
  };
}

function buildDefaultUrlRule(category: CategoryRecord): UrlRuleRecord {
  const pageType = inferCategoryListPageType(category);
  const detailPageType = detailPageTypeForCategory(category);
  const pattern = pageType === 'MATCH_CATEGORY'
    ? '/zhibo/{categorySlug}.html'
    : pageType === 'VIDEO_CATEGORY'
      ? '/video/{categorySlug}.html'
      : '/news/{categorySlug}.html';
  const detailPattern = pageType === 'MATCH_CATEGORY'
    ? '/zhibo/{categorySlug}/{newsSlug}.html'
    : pageType === 'VIDEO_CATEGORY'
      ? '/video/{categorySlug}/{videoSlug}.html'
      : '/news/{categorySlug}/{newsSlug}.html';

  return {
    id: `rule-url-${category.id}`,
    categoryId: category.id,
    pageType,
    pattern,
    detailRules: [
      {
        id: `rule-url-detail-${category.id}`,
        label: `${category.name}内页`,
        pageType: detailPageType,
        pattern: detailPattern,
      },
    ],
  };
}

function buildDefaultTdkRule(category: CategoryRecord): TdkRuleRecord {
  const pageType = inferCategoryListPageType(category);
  const detailPageType = detailPageTypeForCategory(category);
  const templates = defaultTdkTemplatesForPageType(pageType);

  return {
    id: `rule-tdk-${category.id}`,
    categoryId: category.id,
    pageType,
    titleTemplate: templates.titleTemplate,
    keywordsTemplate: templates.keywordsTemplate,
    descriptionTemplate: templates.descriptionTemplate,
    detailRules: [
      {
        id: `rule-tdk-detail-${category.id}`,
        label: `${category.name}内页`,
        pageType: detailPageType,
        titleTemplate: templates.detailTitleTemplate,
        keywordsTemplate: templates.detailKeywordsTemplate,
        descriptionTemplate: templates.detailDescriptionTemplate,
      },
    ],
  };
}

type CategorySeoRuleSyncResult = {
  parentName?: string;
  urlRuleCount: number;
  tdkRuleCount: number;
};

function syncChildCategorySeoRules(
  store: CmsStore,
  category: CategoryRecord,
  actor?: Actor,
): CategorySeoRuleSyncResult {
  const result: CategorySeoRuleSyncResult = { urlRuleCount: 0, tdkRuleCount: 0 };
  if (!category.parentId || category.deletedAt) {
    return result;
  }

  const parent = store.categories.find((candidate) => candidate.id === category.parentId && !candidate.deletedAt);
  if (!parent) {
    return result;
  }

  result.parentName = parent.name;

  store.urlConfigs.forEach((config) => {
    if (config.status !== 'ACTIVE' || !urlConfigReferencesCategory(config, parent.id) || urlConfigReferencesCategory(config, category.id)) {
      return;
    }

    const before = { ...config, rules: [...urlRules(config)] };
    const parentRule = urlRules(config).find((rule) => rule.categoryId === parent.id);
    config.rules = dedupeUrlRules([
      ...urlRules(config),
      parentRule ? cloneUrlRuleForCategory(parentRule, category) : buildDefaultChildUrlRule(category, parent),
    ]);
    refreshUrlConfigRuleSummary(config);
    config.updatedAt = new Date();
    result.urlRuleCount += 1;
    audit(store, actor, 'urlConfig.update', 'UrlConfig', config.id, before, config);
  });

  store.tdkConfigs.forEach((config) => {
    if (config.status !== 'ACTIVE' || !tdkConfigReferencesCategory(config, parent.id) || tdkConfigReferencesCategory(config, category.id)) {
      return;
    }

    const before = { ...config, rules: [...tdkRules(config)] };
    const parentRule = tdkRules(config).find((rule) => rule.categoryId === parent.id);
    config.rules = dedupeTdkRules([
      ...tdkRules(config),
      parentRule ? cloneTdkRuleForCategory(parentRule, category) : buildDefaultChildTdkRule(category, parent),
    ]);
    refreshTdkConfigRuleSummary(config);
    config.updatedAt = new Date();
    result.tdkRuleCount += 1;
    audit(store, actor, 'tdkConfig.update', 'TdkConfig', config.id, before, config);
  });

  return result;
}

function cloneUrlRuleForCategory(rule: UrlRuleRecord, category: CategoryRecord): UrlRuleRecord {
  return {
    id: `rule-url-${category.id}`,
    categoryId: category.id,
    pageType: categoryListPageType(rule.pageType),
    pattern: rule.pattern,
    detailRules: cloneUrlDetailRules(rule, category),
  };
}

function cloneUrlDetailRules(rule: UrlRuleRecord, category: CategoryRecord): UrlDetailRuleRecord[] {
  const detailRules = rule.detailRules?.length
    ? rule.detailRules
    : [buildDefaultUrlDetailRule(category, categoryListPageType(rule.pageType))];

  return detailRules.map((detail, index) => ({
    id: `rule-url-detail-${category.id}-${index + 1}`,
    label: `${category.name}内页`,
    pageType: categoryDetailPageType(detail.pageType),
    pattern: detail.pattern,
  }));
}

function cloneTdkRuleForCategory(rule: TdkRuleRecord, category: CategoryRecord): TdkRuleRecord {
  return {
    id: `rule-tdk-${category.id}`,
    categoryId: category.id,
    pageType: categoryListPageType(rule.pageType),
    titleTemplate: rule.titleTemplate,
    keywordsTemplate: rule.keywordsTemplate,
    descriptionTemplate: rule.descriptionTemplate,
    detailRules: cloneTdkDetailRules(rule, category),
  };
}

function cloneTdkDetailRules(rule: TdkRuleRecord, category: CategoryRecord): TdkDetailRuleRecord[] {
  const detailRules = rule.detailRules?.length
    ? rule.detailRules
    : [buildDefaultTdkDetailRule(category, categoryListPageType(rule.pageType))];

  return detailRules.map((detail, index) => ({
    id: `rule-tdk-detail-${category.id}-${index + 1}`,
    label: `${category.name}内页`,
    pageType: categoryDetailPageType(detail.pageType),
    titleTemplate: detail.titleTemplate,
    keywordsTemplate: detail.keywordsTemplate,
    descriptionTemplate: detail.descriptionTemplate,
  }));
}

function buildDefaultChildUrlRule(category: CategoryRecord, parent: CategoryRecord): UrlRuleRecord {
  const pageType = inferCategoryListPageType(parent);
  return {
    id: `rule-url-${category.id}`,
    categoryId: category.id,
    pageType,
    pattern: urlPatternForListPageType(pageType),
    detailRules: [buildDefaultUrlDetailRule(category, pageType)],
  };
}

function buildDefaultChildTdkRule(category: CategoryRecord, parent: CategoryRecord): TdkRuleRecord {
  const pageType = inferCategoryListPageType(parent);
  const templates = defaultTdkTemplatesForPageType(pageType);

  return {
    id: `rule-tdk-${category.id}`,
    categoryId: category.id,
    pageType,
    titleTemplate: templates.titleTemplate,
    keywordsTemplate: templates.keywordsTemplate,
    descriptionTemplate: templates.descriptionTemplate,
    detailRules: [buildDefaultTdkDetailRule(category, pageType)],
  };
}

function buildDefaultUrlDetailRule(category: CategoryRecord, pageType: PageType): UrlDetailRuleRecord {
  const detailPageType = detailPageTypeForListPageType(pageType);
  return {
    id: `rule-url-detail-${category.id}`,
    label: `${category.name}内页`,
    pageType: detailPageType,
    pattern: urlPatternForDetailPageType(detailPageType),
  };
}

function buildDefaultTdkDetailRule(category: CategoryRecord, pageType: PageType): TdkDetailRuleRecord {
  const detailPageType = detailPageTypeForListPageType(pageType);
  const templates = defaultTdkTemplatesForPageType(pageType);
  return {
    id: `rule-tdk-detail-${category.id}`,
    label: `${category.name}内页`,
    pageType: detailPageType,
    titleTemplate: templates.detailTitleTemplate,
    keywordsTemplate: templates.detailKeywordsTemplate,
    descriptionTemplate: templates.detailDescriptionTemplate,
  };
}

function categoryListPageType(pageType: PageType): PageType {
  if (pageType === 'MATCH_CATEGORY' || pageType === 'MATCH_DETAIL') return 'MATCH_CATEGORY';
  if (pageType === 'VIDEO_CATEGORY' || pageType === 'VIDEO_DETAIL') return 'VIDEO_CATEGORY';
  return 'NEWS_CATEGORY';
}

function categoryDetailPageType(pageType: PageType): PageType {
  if (pageType === 'MATCH_CATEGORY' || pageType === 'MATCH_DETAIL') return 'MATCH_DETAIL';
  if (pageType === 'VIDEO_CATEGORY' || pageType === 'VIDEO_DETAIL') return 'VIDEO_DETAIL';
  return 'NEWS_DETAIL';
}

function detailPageTypeForListPageType(pageType: PageType): PageType {
  if (pageType === 'MATCH_CATEGORY') return 'MATCH_DETAIL';
  if (pageType === 'VIDEO_CATEGORY') return 'VIDEO_DETAIL';
  return 'NEWS_DETAIL';
}

function urlPatternForListPageType(pageType: PageType): string {
  if (pageType === 'MATCH_CATEGORY') return '/zhibo/{categorySlug}.html';
  if (pageType === 'VIDEO_CATEGORY') return '/video/{categorySlug}.html';
  return '/news/{categorySlug}.html';
}

function urlPatternForDetailPageType(pageType: PageType): string {
  if (pageType === 'MATCH_DETAIL') return '/zhibo/{categorySlug}/{newsSlug}.html';
  if (pageType === 'VIDEO_DETAIL') return '/video/{categorySlug}/{videoSlug}.html';
  return '/news/{categorySlug}/{newsSlug}.html';
}

function refreshUrlConfigRuleSummary(config: UrlConfigRecord): void {
  config.categoryIds = uniqueStrings((config.rules ?? []).map((rule) => rule.categoryId));
  config.pageType = config.rules?.[0]?.pageType;
  config.pattern = config.rules?.[0]?.pattern;
}

function refreshTdkConfigRuleSummary(config: TdkConfigRecord): void {
  config.categoryIds = uniqueStrings((config.rules ?? []).map((rule) => rule.categoryId));
  config.pageType = config.rules?.[0]?.pageType;
  config.titleTemplate = config.rules?.[0]?.titleTemplate;
  config.keywordsTemplate = config.rules?.[0]?.keywordsTemplate;
  config.descriptionTemplate = config.rules?.[0]?.descriptionTemplate;
}

function withCategorySeoRuleNotice(
  record: CategoryRecord,
  result: CategorySeoRuleSyncResult,
): CategoryRecord & {
  seoRuleNotice?: string;
  seoRuleSync?: CategorySeoRuleSyncResult;
} {
  if (!result.urlRuleCount && !result.tdkRuleCount) {
    return record;
  }

  return {
    ...record,
    seoRuleNotice: `已根据父栏目「${result.parentName ?? record.parentId}」自动添加 ${result.urlRuleCount} 套 URL 规则、${result.tdkRuleCount} 套 TDK 规则。请立即设置并检查 TDK 和 URL 规则，确认路径、标题和内页规则符合当前模板。`,
    seoRuleSync: result,
  };
}

function inferCategoryListPageType(category: CategoryRecord): PageType {
  const value = `${category.name} ${category.slug}`.toLowerCase();
  if (value.includes('录像') || value.includes('回放') || value.includes('replay') || value.includes('video')) {
    return 'VIDEO_CATEGORY';
  }
  if (/新闻|资讯|快讯|动态|分析|观察|情报|news|article|info|analysis|insight|update/i.test(value)) {
    return 'NEWS_CATEGORY';
  }
  if (
    value.includes('直播') ||
    value.includes('赛程') ||
    value.includes('live') ||
    value.includes('schedule') ||
    value.includes('zhibo')
  ) {
    return 'MATCH_CATEGORY';
  }
  return 'NEWS_CATEGORY';
}

function detailPageTypeForCategory(category: CategoryRecord): PageType {
  const pageType = inferCategoryListPageType(category);
  if (pageType === 'MATCH_CATEGORY') return 'MATCH_DETAIL';
  if (pageType === 'VIDEO_CATEGORY') return 'VIDEO_DETAIL';
  return 'NEWS_DETAIL';
}

function defaultTdkTemplatesForPageType(pageType: PageType): {
  titleTemplate: string;
  keywordsTemplate: string;
  descriptionTemplate: string;
  detailTitleTemplate: string;
  detailKeywordsTemplate: string;
  detailDescriptionTemplate: string;
} {
  if (pageType === 'MATCH_CATEGORY') {
    return {
      titleTemplate: '{columnName}_高清直播在线_{siteName}',
      keywordsTemplate: '{columnName},高清直播,{siteName}',
      descriptionTemplate: '{siteName}提供{columnName}、赛程、球队动态和多线路直播入口。',
      detailTitleTemplate: '{title}_{columnName}_{siteName}',
      detailKeywordsTemplate: '{title},{columnName},{siteName}',
      detailDescriptionTemplate: '{summary}',
    };
  }
  if (pageType === 'VIDEO_CATEGORY') {
    return {
      titleTemplate: '{columnName}_比赛回放_{siteName}',
      keywordsTemplate: '{columnName},比赛回放,{siteName}',
      descriptionTemplate: '{siteName}整理{columnName}录像回放、比赛集锦和赛后资讯。',
      detailTitleTemplate: '{title}录像回放_{siteName}',
      detailKeywordsTemplate: '{title}录像,{title}回放,{siteName}',
      detailDescriptionTemplate: '观看{title}录像回放、比赛集锦和赛后数据。',
    };
  }
  return {
    titleTemplate: '最新{columnName}-{siteName}',
    keywordsTemplate: '{columnName},体育新闻,{siteName}',
    descriptionTemplate: '{siteName}{columnName}栏目提供最新体育资讯、赛事动态和直播信息。',
    detailTitleTemplate: '{title}_{siteName}',
    detailKeywordsTemplate: '{title},{columnName},{siteName}',
    detailDescriptionTemplate: '{summary}',
  };
}

function normalizePersistedStore(store: CmsStore): CmsStore {
  const mutableStore = store as CmsStore & { liveReplays?: LiveReplayRecord[] };
  mutableStore.liveReplays ??= [];
  ensureSecuritySettings(store);
  const deleteKeys = (record: object, keys: string[]) => {
    const mutable = record as Record<string, unknown>;
    keys.forEach((key) => {
      delete mutable[key];
    });
  };

  store.sites.forEach((site) => {
    site.primaryProtocol = site.primaryProtocol ?? 'http';
    site.newsUpdateCount = normalizeNewsUpdateCount(site.newsUpdateCount);
    deleteKeys(site, ['defaultTdkId', 'defaultUrlId']);
  });
  store.groups.forEach((group) =>
    deleteKeys(group, [
      'defaultTdkId',
      'defaultUrlId',
      'liveJumpMode',
      'liveSecondLevelJumpUrl',
      'liveIframeJumpUrl',
      'liveProductName',
      'liveProductNames',
    ]),
  );
  store.groups.forEach((group) => {
    group.liveProductIds = group.liveProductIds ?? [];
    deleteKeys(group, ['signalDomainIds', 'signalSourceNameIds']);
  });
  store.categories.forEach((category) =>
    deleteKeys(category, ['siteId', 'categoryUrlConfigId', 'detailUrlConfigId', 'categoryTdkConfigId', 'detailTdkConfigId']),
  );
  store.liveProducts.forEach((product) => deleteKeys(product, ['siteId']));
  store.signalDomains.forEach((domain) => deleteKeys(domain, ['siteId']));
  store.signalSourceNames.forEach((source) => deleteKeys(source, ['siteId']));
  ensureTemplateDefaults(store);
  refreshSiteReferences(store);
  ensureAdminPermissionDefaults(store);
  ensureScheduledTaskDefaults(store);
  store.urlConfigs = store.urlConfigs.map((config) => normalizeUrlConfig(config) as UrlConfigRecord);
  store.tdkConfigs = store.tdkConfigs.map((config) => normalizeTdkConfig(config) as TdkConfigRecord);
  const duplicateCategoryReplacements = cleanupDuplicateSiblingCategories(store);
  const deletedCategorySlugReplacements = buildDeletedCategorySlugReplacements(store);
  remapCategoryReferences(store, mergeReplacementMaps(duplicateCategoryReplacements, deletedCategorySlugReplacements));
  normalizeSingleSiteContentOwnership(store);
  store.tags = cleanupDuplicateTags(store.tags);
  cleanupLegacyLiveReplayNews(store);

  return store;
}

function ensureSecuritySettings(store: CmsStore): SecuritySettingsRecord {
  const mutableStore = store as CmsStore & { securitySettings?: SecuritySettingsRecord };
  const envDefaults = envSecuritySettingsDefaults();
  mutableStore.securitySettings ??= {
    id: securitySettingsId,
    adminSafeEntry: envDefaults.adminSafeEntry,
    totpRequired: envDefaults.totpRequired,
    totpSecret: envDefaults.totpSecret,
    adminManaged: false,
    updatedAt: new Date(),
  };
  const hadAdminManagedFlag = typeof mutableStore.securitySettings.adminManaged === 'boolean';
  const isAdminManaged = hadAdminManagedFlag
    ? Boolean(mutableStore.securitySettings.adminManaged)
    : hasConfiguredSecurityValue(mutableStore.securitySettings);
  mutableStore.securitySettings.id = securitySettingsId;
  mutableStore.securitySettings.adminSafeEntry = normalizeSafeEntry(mutableStore.securitySettings.adminSafeEntry);
  mutableStore.securitySettings.totpRequired = Boolean(mutableStore.securitySettings.totpRequired);
  mutableStore.securitySettings.totpSecret = normalizeNullableString(mutableStore.securitySettings.totpSecret);
  if (!isAdminManaged) {
    mutableStore.securitySettings.adminSafeEntry = envDefaults.adminSafeEntry;
    mutableStore.securitySettings.totpRequired = envDefaults.totpRequired;
    mutableStore.securitySettings.totpSecret = envDefaults.totpSecret;
  }
  mutableStore.securitySettings.adminManaged = isAdminManaged;
  mutableStore.securitySettings.updatedAt = mutableStore.securitySettings.updatedAt ?? new Date();
  return mutableStore.securitySettings;
}

function effectiveSecuritySettings(store: CmsStore): SecuritySettingsRecord {
  return ensureSecuritySettings(store);
}

function envSecuritySettingsDefaults(): Pick<SecuritySettingsRecord, 'adminSafeEntry' | 'totpRequired' | 'totpSecret'> {
  const envSafeEntry = normalizeSafeEntry(process.env.ADMIN_SAFE_ENTRY);
  const envTotpSecret = normalizeNullableString(process.env.ADMIN_TOTP_SECRET);
  const envTotpRequired = process.env.ADMIN_TOTP_REQUIRED;
  return {
    adminSafeEntry: envSafeEntry,
    totpRequired: booleanEnv(envTotpRequired) ?? Boolean(envTotpSecret),
    totpSecret: envTotpSecret,
  };
}

function hasConfiguredSecurityValue(settings: Partial<SecuritySettingsRecord>): boolean {
  return Boolean(
    normalizeSafeEntry(settings.adminSafeEntry) ||
      normalizeNullableString(settings.totpSecret) ||
      settings.totpRequired,
  );
}

function redactSecuritySettings(settings: SecuritySettingsRecord): SecuritySettingsRecord & { totpSecretConfigured: boolean } {
  return {
    ...settings,
    totpSecret: null,
    totpSecretConfigured: Boolean(settings.totpSecret),
  };
}

function normalizeSecuritySettingsInput(input: Partial<SecuritySettingsRecord>): Partial<SecuritySettingsRecord> {
  return {
    ...(input.adminSafeEntry !== undefined ? { adminSafeEntry: normalizeSafeEntry(input.adminSafeEntry) } : {}),
    ...(input.totpRequired !== undefined ? { totpRequired: Boolean(input.totpRequired) } : {}),
    ...(input.totpSecret !== undefined ? { totpSecret: normalizeNullableString(input.totpSecret) } : {}),
  };
}

function assertAdminSafeEntry(store: CmsStore, safeEntry?: string): void {
  const requiredEntry = effectiveSecuritySettings(store).adminSafeEntry;
  if (!requiredEntry) {
    return;
  }
  if (normalizeSafeEntry(safeEntry) !== requiredEntry) {
    const error = new Error('安全入口不正确。');
    error.name = 'UnauthorizedError';
    throw error;
  }
}

function assertAdminTotp(store: CmsStore, user: AdminUserRecord, code?: string): void {
  const settings = effectiveSecuritySettings(store);
  const requiresTotp = settings.totpRequired || Boolean(user.totpEnabled);
  if (!requiresTotp) {
    return;
  }
  const userSecret = user.totpEnabled ? normalizeNullableString(user.totpSecret) : null;
  const secret = userSecret ?? settings.totpSecret;
  if (!secret || !safeVerifyTotpCode(secret, code)) {
    const error = new Error('Google 验证码不正确。');
    error.name = 'UnauthorizedError';
    throw error;
  }
}

function safeVerifyTotpCode(secret: string, code?: string): boolean {
  try {
    return verifyTotpCode({ secret, code });
  } catch {
    return false;
  }
}

function normalizeSafeEntry(value?: string | null): string | null {
  const trimmed = normalizeNullableString(value);
  return trimmed && /^[A-Za-z0-9_-]{3,80}$/.test(trimmed) ? trimmed : null;
}

function normalizeNullableString(value?: string | null): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

function booleanEnv(value?: string): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  if (/^(1|true|yes|on)$/i.test(value)) return true;
  if (/^(0|false|no|off)$/i.test(value)) return false;
  return undefined;
}

function normalizeSingleSiteContentOwnership(store: CmsStore): void {
  const activeSites = store.sites.filter((site) => site.status === 'ACTIVE' && !site.deletedAt);
  if (activeSites.length !== 1) {
    return;
  }

  const siteId = activeSites[0].id;
  const now = new Date();
  store.news.forEach((article) => {
    if (!article.deletedAt && article.siteId !== siteId) {
      article.siteId = siteId;
      article.updatedAt = now;
    }
  });
  store.liveReplays.forEach((replay) => {
    if (!replay.deletedAt && replay.siteId !== siteId) {
      replay.siteId = siteId;
      replay.updatedAt = now;
    }
  });
  store.tags.forEach((tag) => {
    if (tag.siteId !== siteId) {
      tag.siteId = siteId;
      tag.updatedAt = now;
    }
  });
}

function normalizeNewsUpdateCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(200, Math.floor(parsed)) : 0;
}

function cleanupDuplicateTags(tags: TagRecord[]): TagRecord[] {
  const selected = new Map<string, TagRecord>();
  for (const tag of tags) {
    const key = `${tag.siteId}:${normalizeCategoryName(tag.name)}`;
    const existing = selected.get(key);
    if (!existing || tag.createdAt.getTime() < existing.createdAt.getTime()) {
      selected.set(key, tag);
    }
  }
  return [...selected.values()];
}

function cleanupDuplicateSiblingCategories(store: CmsStore): Map<string, string> {
  const replacements = new Map<string, string>();
  const duplicateGroups = new Map<string, CategoryRecord[]>();
  const now = new Date();

  store.categories
    .filter((category) => !category.deletedAt)
    .forEach((category) => {
      const key = categorySiblingKey(category.parentId, category.name);
      const group = duplicateGroups.get(key);
      if (group) {
        group.push(category);
      } else {
        duplicateGroups.set(key, [category]);
      }
    });

  duplicateGroups.forEach((group) => {
    if (group.length < 2) return;
    const canonical = pickCanonicalCategory(store, group);
    group.forEach((category) => {
      if (category.id === canonical.id) return;
      replacements.set(category.id, canonical.id);
      category.deletedAt ??= now;
      category.updatedAt = now;
    });
  });

  return replacements;
}

function buildDeletedCategorySlugReplacements(store: CmsStore): Map<string, string> {
  const activeCategoryBySlug = new Map(
    store.categories
      .filter((category) => !category.deletedAt && category.status === 'ACTIVE')
      .map((category) => [category.slug, category]),
  );
  const replacements = new Map<string, string>();

  store.categories.forEach((category) => {
    if (!category.deletedAt) return;
    const activeCategory = activeCategoryBySlug.get(category.slug);
    if (activeCategory && activeCategory.id !== category.id) {
      replacements.set(category.id, activeCategory.id);
    }
  });

  return replacements;
}

function remapCategoryReferences(store: CmsStore, replacements: Map<string, string>): void {
  if (!replacements.size) return;

  store.categories.forEach((category) => {
    if (category.parentId) {
      category.parentId = replacements.get(category.parentId) ?? category.parentId;
    }
  });

  store.urlConfigs.forEach((config) => {
    config.categoryIds = uniqueStrings((config.categoryIds ?? []).map((categoryId) => replacements.get(categoryId) ?? categoryId));
    config.rules = dedupeUrlRules(
      (config.rules ?? []).map((rule) => ({
        ...rule,
        categoryId: replacements.get(rule.categoryId) ?? rule.categoryId,
      })),
    );
  });

  store.tdkConfigs.forEach((config) => {
    config.categoryIds = uniqueStrings((config.categoryIds ?? []).map((categoryId) => replacements.get(categoryId) ?? categoryId));
    config.rules = dedupeTdkRules(
      (config.rules ?? []).map((rule) => ({
        ...rule,
        categoryId: replacements.get(rule.categoryId) ?? rule.categoryId,
      })),
    );
  });

  store.liveReplays.forEach((replay) => {
    replay.categoryId = replacements.get(replay.categoryId) ?? replay.categoryId;
  });

  store.news.forEach((article) => {
    article.categoryId = replacements.get(article.categoryId) ?? article.categoryId;
  });

  store.promotionLinks.forEach((link) => {
    if (link.categoryId) {
      link.categoryId = replacements.get(link.categoryId) ?? link.categoryId;
    }
  });

  store.scheduledTasks.forEach((task) => {
    if (!isPersistedRecord(task.config)) {
      return;
    }
    const categoryId = safePersistedText(task.config.categoryId);
    if (!categoryId) {
      return;
    }
    task.config = {
      ...task.config,
      categoryId: replacements.get(categoryId) ?? categoryId,
    };
  });
}

function cleanupLegacyLiveReplayNews(store: CmsStore): void {
  const now = new Date();
  const replayCategoryIds = new Set(
    store.categories
      .filter((category) => isReplayCategoryName(category.name, category.slug))
      .map((category) => category.id),
  );

  store.news.forEach((article) => {
    if (article.deletedAt) return;
    const sourceUrl = safePersistedText(article.sourceUrl);
    const legacyReplayArticle =
      sourceUrl.includes('/api/live/reply_history') ||
      (replayCategoryIds.has(article.categoryId) && /^replay-[a-z0-9]+$/i.test(article.slug) && article.content.includes('播放流地址由外部接口提供'));
    if (!legacyReplayArticle) return;

    const persisted = article as NewsArticleRecord & Record<string, unknown>;
    const playUrl = safePersistedText(persisted.play_url ?? persisted.playUrl);
    const homeTeam = safePersistedText(persisted.home_team ?? persisted.homeTeam);
    const awayTeam = safePersistedText(persisted.away_team ?? persisted.awayTeam);
    const createTime = article.publishedAt ?? article.createdAt ?? now;
    const activeReplayCategory =
      store.categories.find((category) => category.id === article.categoryId && !category.deletedAt) ??
      store.categories.find((category) => !category.deletedAt && isReplayCategoryName(category.name, category.slug));

    if (playUrl && homeTeam && awayTeam && activeReplayCategory) {
      const exists = store.liveReplays.some(
        (replay) => replay.siteId === article.siteId && replay.slug === article.slug && !replay.deletedAt,
      );
      if (!exists) {
        store.liveReplays.push({
          id: id('live-replay'),
          siteId: article.siteId,
          categoryId: activeReplayCategory.id,
          title: article.title,
          slug: article.slug,
          createTime,
          homeTeam,
          awayTeam,
          playUrl,
          createdAt: article.createdAt,
          updatedAt: now,
        });
      }
    }

    article.deletedAt = now;
    article.updatedAt = now;
  });
}

function dedupeUrlRules(rules: UrlRuleRecord[]): UrlRuleRecord[] {
  const seen = new Map<string, UrlRuleRecord>();
  rules.forEach((rule) => {
    const key = `${rule.categoryId}|${rule.pageType}|${rule.pattern}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        ...rule,
        detailRules: dedupeUrlDetailRules(rule.detailRules ?? []),
      });
      return;
    }
    existing.detailRules = dedupeUrlDetailRules([...(existing.detailRules ?? []), ...(rule.detailRules ?? [])]);
  });
  return [...seen.values()];
}

function dedupeUrlDetailRules(rules: UrlDetailRuleRecord[]): UrlDetailRuleRecord[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = `${rule.pageType}|${rule.pattern}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeTdkRules(rules: TdkRuleRecord[]): TdkRuleRecord[] {
  const seen = new Map<string, TdkRuleRecord>();
  rules.forEach((rule) => {
    const key = `${rule.categoryId}|${rule.pageType}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        ...rule,
        detailRules: dedupeTdkDetailRules(rule.detailRules ?? []),
      });
      return;
    }
    existing.detailRules = dedupeTdkDetailRules([...(existing.detailRules ?? []), ...(rule.detailRules ?? [])]);
  });
  return [...seen.values()];
}

function dedupeTdkDetailRules(rules: TdkDetailRuleRecord[]): TdkDetailRuleRecord[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = `${rule.pageType}|${rule.titleTemplate}|${rule.keywordsTemplate ?? ''}|${rule.descriptionTemplate ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isReplayCategoryName(name: string, slug: string): boolean {
  return /录像|回放|replay|video/i.test(`${name} ${slug}`);
}

function refreshSiteReferences(store: CmsStore): void {
  store.sites.forEach((site) => {
    site.group = site.groupId ? store.groups.find((group) => group.id === site.groupId) ?? null : null;
    site.template = site.templateId
      ? store.templates.find((template) => template.id === site.templateId) ?? null
      : null;
  });
}

function assertGroupCanBeDeleted(store: CmsStore, groupId: string): void {
  const group = findRecord(store.groups, groupId);
  const activeSites = store.sites
    .filter((site) => !site.deletedAt && site.groupId === groupId)
    .map(siteUsageName);

  throwIfRecordInUse('分组', group.name, [
    usageMessage('站点', activeSites),
  ]);
}

function assertTemplateCanBeDeleted(store: CmsStore, templateId: string): void {
  const template = findRecord(store.templates, templateId);
  const activeSites = store.sites
    .filter((site) => !site.deletedAt && site.templateId === templateId)
    .map(siteUsageName);

  throwIfRecordInUse('模板', template.name, [
    usageMessage('站点', activeSites),
  ]);
}

function assertUrlConfigCanBeDeleted(store: CmsStore, urlConfigId: string): void {
  const config = findRecord(store.urlConfigs, urlConfigId);
  const activeSites = store.sites
    .filter((site) => !site.deletedAt && site.urlConfigId === urlConfigId)
    .map(siteUsageName);

  throwIfRecordInUse('URL配置', config.name, [
    usageMessage('站点', activeSites),
  ]);
}

function assertTdkConfigCanBeDeleted(store: CmsStore, tdkConfigId: string): void {
  const config = findRecord(store.tdkConfigs, tdkConfigId);
  const activeSites = store.sites
    .filter((site) => !site.deletedAt && site.tdkConfigId === tdkConfigId)
    .map(siteUsageName);

  throwIfRecordInUse('TDK配置', config.name, [
    usageMessage('站点', activeSites),
  ]);
}

function assertCategoryCanBeDeleted(store: CmsStore, categoryId: string): void {
  const category = findRecord(store.categories, categoryId);
  const childCategories = store.categories
    .filter((child) => !child.deletedAt && child.parentId === categoryId)
    .map((child) => child.name);
  const sites = store.sites
    .filter((site) => !site.deletedAt && siteUsesCategory(store, site, categoryId))
    .map(siteUsageName);
  const news = store.news
    .filter((article) => !article.deletedAt && article.categoryId === categoryId)
    .map((article) => article.title);
  const liveReplays = store.liveReplays
    .filter((replay) => !replay.deletedAt && replay.categoryId === categoryId)
    .map((replay) => replay.title);
  const promotionLinks = store.promotionLinks
    .filter((link) => !link.deletedAt && link.categoryId === categoryId)
    .map((link) => link.title);
  const urlConfigs = store.urlConfigs
    .filter((config) => urlConfigReferencesCategory(config, categoryId))
    .map((config) => config.name);
  const tdkConfigs = store.tdkConfigs
    .filter((config) => tdkConfigReferencesCategory(config, categoryId))
    .map((config) => config.name);
  const scheduledTasks = store.scheduledTasks
    .filter((task) => isPersistedRecord(task.config) && safePersistedText(task.config.categoryId) === categoryId)
    .map((task) => task.name);

  throwIfRecordInUse('栏目', category.name, [
    usageMessage('子栏目', childCategories),
    usageMessage('站点', sites),
    usageMessage('新闻', news),
    usageMessage('赛事录像', liveReplays),
    usageMessage('推广链接', promotionLinks),
    usageMessage('URL配置', urlConfigs),
    usageMessage('TDK配置', tdkConfigs),
    usageMessage('计划任务', scheduledTasks),
  ]);
}

function siteUsesCategory(store: CmsStore, site: SiteRecord, categoryId: string): boolean {
  const siteUrlConfig = site.urlConfigId
    ? store.urlConfigs.find((config) => config.id === site.urlConfigId)
    : undefined;
  const siteTdkConfig = site.tdkConfigId
    ? store.tdkConfigs.find((config) => config.id === site.tdkConfigId)
    : undefined;

  return (
    Boolean(siteUrlConfig && urlConfigReferencesCategory(siteUrlConfig, categoryId)) ||
    Boolean(siteTdkConfig && tdkConfigReferencesCategory(siteTdkConfig, categoryId)) ||
    store.urlConfigs.some(
      (config) => config.siteId === site.id && config.status === 'ACTIVE' && urlConfigReferencesCategory(config, categoryId),
    ) ||
    store.tdkConfigs.some(
      (config) => config.siteId === site.id && config.status === 'ACTIVE' && tdkConfigReferencesCategory(config, categoryId),
    ) ||
    (!site.urlConfigId &&
      store.urlConfigs.some(
        (config) => !config.siteId && config.status === 'ACTIVE' && urlConfigReferencesCategory(config, categoryId),
      )) ||
    (!site.tdkConfigId &&
      store.tdkConfigs.some(
        (config) => !config.siteId && config.status === 'ACTIVE' && tdkConfigReferencesCategory(config, categoryId),
      ))
  );
}

function urlConfigReferencesCategory(config: UrlConfigRecord, categoryId: string): boolean {
  return (
    uniqueStrings(config.categoryIds ?? []).includes(categoryId) ||
    urlRules(config).some((rule) => rule.categoryId === categoryId)
  );
}

function tdkConfigReferencesCategory(config: TdkConfigRecord, categoryId: string): boolean {
  return (
    uniqueStrings(config.categoryIds ?? []).includes(categoryId) ||
    tdkRules(config).some((rule) => rule.categoryId === categoryId)
  );
}

function throwIfRecordInUse(entityLabel: string, recordName: string, usages: Array<string | undefined>): void {
  const activeUsages = usages.filter((usage): usage is string => Boolean(usage));
  if (!activeUsages.length) {
    return;
  }

  throw new Error(
    `不能删除${entityLabel}「${recordName}」：${activeUsages.join('、')}正在使用。请先修改或删除绑定关系。`,
  );
}

function usageMessage(label: string, names: string[]): string | undefined {
  const uniqueNames = uniqueStrings(names.map((name) => name.trim()).filter(Boolean));
  if (!uniqueNames.length) {
    return undefined;
  }

  return `${label}（${summarizeUsageNames(uniqueNames)}）`;
}

function summarizeUsageNames(names: string[]): string {
  const visible = names.slice(0, 3).join('、');
  return names.length > 3 ? `${visible}等${names.length}个` : visible;
}

function siteUsageName(site: SiteRecord): string {
  return site.name || site.primaryDomain || site.id;
}

function ensureTemplateDefaults(store: CmsStore): void {
  const defaults = createSeedData().templates;
  const existingKeys = new Set(store.templates.map((template) => template.key));
  defaults.forEach((template) => {
    if (!existingKeys.has(template.key)) {
      store.templates.push(template);
      existingKeys.add(template.key);
    }
  });
}

function ensureAdminPermissionDefaults(store: CmsStore): void {
  const defaults = createSeedData();
  const existingActions = new Set(store.adminPermissions.map((permission) => permission.action));
  defaults.adminPermissions.forEach((permission) => {
    if (!existingActions.has(permission.action)) {
      store.adminPermissions.push(permission);
      existingActions.add(permission.action);
    }
  });

  store.adminRoles.forEach((role) => {
    if (role.key === 'super-admin') {
      role.permissionActions = Array.from(
        new Set([...role.permissionActions, ...store.adminPermissions.map((permission) => permission.action)]),
      );
    }
    if (role.key === 'site-admin') {
      role.permissionActions = Array.from(new Set([...role.permissionActions, 'task:read', 'task:write']));
    }
    if (role.key === 'seo-manager') {
      role.permissionActions = Array.from(new Set([...role.permissionActions, 'task:read']));
    }
  });
}

function ensureScheduledTaskDefaults(store: CmsStore): void {
  const mutableStore = store as CmsStore & { scheduledTasks?: ScheduledTaskRecord[] };
  mutableStore.scheduledTasks ??= [];
  const defaults = createSeedData().scheduledTasks;
  const existingIds = new Set(mutableStore.scheduledTasks.map((task) => task.id));
  defaults.forEach((task) => {
    if (!existingIds.has(task.id)) {
      mutableStore.scheduledTasks?.push(task);
      existingIds.add(task.id);
      return;
    }

    const existing = mutableStore.scheduledTasks?.find((taskRecord) => taskRecord.id === task.id);
    if (
      existing?.id === 'task-daily-sports-sync' &&
      isPersistedRecord(existing.config) &&
      safePersistedText(existing.config.sourceUrl) !== 'https://jk.jktgedc.com/app/encryptionMatchOther?check_type=17'
    ) {
      existing.config = {
        ...existing.config,
        sourceUrl: 'https://jk.jktgedc.com/app/encryptionMatchOther?check_type=17',
      };
    }

    if (
      existing?.id === 'task-daily-sports-sync' &&
      isPersistedRecord(existing.config) &&
      safePersistedText(existing.config.typeId) !== '17'
    ) {
      existing.config = {
        ...existing.config,
        typeId: '17',
      };
    }

    const defaultSourceUrl = safePersistedText(task.config?.sourceUrl);
    if (
      existing?.id === 'task-daily-dongqiudi-news' &&
      isPersistedRecord(existing.config) &&
      defaultSourceUrl &&
      safePersistedText(existing.config.sourceUrl) !== defaultSourceUrl
    ) {
      existing.config = { ...existing.config, sourceUrl: defaultSourceUrl };
    }

    if (
      existing?.id === 'task-daily-dongqiudi-news' &&
      isPersistedRecord(existing.config) &&
      existing.config.minContentChars === undefined
    ) {
      existing.config = { ...existing.config, minContentChars: 160 };
    }
  });
}

function safePersistedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPersistedRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUrlConfig<T extends UrlConfigWriteInput>(input: T): T {
  const rules: UrlRuleRecord[] | undefined =
    input.rules?.map((rule) => ({
      ...rule,
      id: rule.id || id('url-rule'),
      detailRules: (rule.detailRules ?? []).map(
        (detailRule): UrlDetailRuleRecord => ({
          ...detailRule,
          id: detailRule.id || id('url-detail-rule'),
        }),
      ),
    })) ??
    (input.pageType && input.pattern
      ? (input.categoryIds?.length ? input.categoryIds : ['']).map((categoryId) => ({
          id: id('url-rule'),
          categoryId,
          pageType: input.pageType as PageType,
          pattern: input.pattern as string,
          detailRules: [] as UrlDetailRuleRecord[],
        }))
      : undefined);

  const normalized = { ...input } as T & Partial<UrlConfigRecord>;
  if (rules) {
    normalized.rules = rules;
    normalized.categoryIds = rules.map((rule) => rule.categoryId).filter(Boolean);
    normalized.pageType = rules[0]?.pageType;
    normalized.pattern = rules[0]?.pattern;
  }

  return normalized;
}

function normalizeTdkConfig<T extends TdkConfigWriteInput>(input: T): T {
  const rules: TdkRuleRecord[] | undefined =
    input.rules?.map((rule) => ({
      ...rule,
      id: rule.id || id('tdk-rule'),
      detailRules: (rule.detailRules ?? []).map(
        (detailRule): TdkDetailRuleRecord => ({
          ...detailRule,
          id: detailRule.id || id('tdk-detail-rule'),
        }),
      ),
    })) ??
    (input.pageType && input.titleTemplate
      ? (input.categoryIds?.length ? input.categoryIds : ['']).map((categoryId) => ({
          id: id('tdk-rule'),
          categoryId,
          pageType: input.pageType as PageType,
          titleTemplate: input.titleTemplate as string,
          keywordsTemplate: input.keywordsTemplate,
          descriptionTemplate: input.descriptionTemplate,
          detailRules: [] as TdkDetailRuleRecord[],
        }))
      : undefined);

  const normalized = { ...input } as T & Partial<TdkConfigRecord>;
  if (rules) {
    normalized.rules = rules;
    normalized.categoryIds = rules.map((rule) => rule.categoryId).filter(Boolean);
    normalized.pageType = rules[0]?.pageType;
    normalized.titleTemplate = rules[0]?.titleTemplate;
    normalized.keywordsTemplate = rules[0]?.keywordsTemplate;
    normalized.descriptionTemplate = rules[0]?.descriptionTemplate;
  }

  return normalized;
}

function withPersistence<T extends RepositoryShape>(repository: T, store: CmsStore): T {
  let mutationBatchDepth = 0;
  let hasPendingPersist = false;

  const flushPendingPersist = () => {
    if (!hasPendingPersist || mutationBatchDepth > 0) return;
    hasPendingPersist = false;
    persistStore(store);
  };

  return new Proxy(repository, {
    get(target, property, receiver) {
      if (property === 'store') {
        if (mutationBatchDepth === 0) {
          syncStoreFromDisk(store);
        }
        return store;
      }

      if (property === 'syncFromDisk') {
        return (input?: { force?: boolean }) => syncStoreFromDisk(store, input);
      }

      if (property === 'withMutationBatch') {
        return <R>(callback: () => R): R => {
          return withStoreWriteLock(() => {
            syncStoreFromDisk(store, { force: true });
            mutationBatchDepth += 1;
            try {
              return callback();
            } finally {
              mutationBatchDepth -= 1;
              flushPendingPersist();
            }
          });
        };
      }

      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') {
        return value;
      }

      return (...args: unknown[]) => {
        const isMutatingMethod = mutatingMethodPattern.test(String(property));
        if (isMutatingMethod && mutationBatchDepth === 0) {
          return withStoreWriteLock(() => {
            syncStoreFromDisk(store, { force: true });
            const result = value.apply(target, args);
            persistStore(store);
            return result;
          });
        }

        if (mutationBatchDepth === 0) {
          syncStoreFromDisk(store);
        }
        const result = value.apply(target, args);
        if (isMutatingMethod) {
          if (mutationBatchDepth > 0) {
            hasPendingPersist = true;
          } else {
            persistStore(store);
          }
        }
        return result;
      };
    },
  });
}

function loadPersistedStore(fallback: CmsStore): CmsStore {
  if (!shouldPersistStore()) {
    return fallback;
  }

  const storeFilePath = getStoreFilePath();
  if (!fs.existsSync(storeFilePath)) {
    persistStore(fallback);
    return fallback;
  }

  try {
    const stat = fs.statSync(storeFilePath);
    const parsed = JSON.parse(fs.readFileSync(storeFilePath, 'utf8')) as CmsStore;
    lastLoadedMtime = stat.mtimeMs;
    return reviveDates(parsed) as CmsStore;
  } catch {
    return fallback;
  }
}

function syncStoreFromDisk(store: CmsStore, input: { force?: boolean } = {}): void {
  if (!shouldPersistStore()) return;

  const now = Date.now();
  const syncIntervalMs = nonNegativeIntegerEnv('SPORTS_CMS_DISK_SYNC_INTERVAL_MS', 1000);
  if (!input.force && now - lastDiskSyncCheckedAt < syncIntervalMs) return;
  lastDiskSyncCheckedAt = now;

  const storeFilePath = getStoreFilePath();
  if (!fs.existsSync(storeFilePath)) return;
  const stat = fs.statSync(storeFilePath);
  if (stat.mtimeMs <= lastLoadedMtime) {
    cachedStoreVersion = `${stat.mtimeMs}:${stat.size}`;
    cachedStoreVersionCheckedAt = now;
    return;
  }

  const parsed = reviveDates(JSON.parse(fs.readFileSync(storeFilePath, 'utf8'))) as CmsStore;
  for (const key of Object.keys(store) as Array<keyof CmsStore>) {
    store[key] = parsed[key] as never;
  }
  lastLoadedMtime = stat.mtimeMs;
  cachedStoreVersion = `${stat.mtimeMs}:${stat.size}`;
  cachedStoreVersionCheckedAt = now;
}

function persistStore(store: CmsStore): void {
  if (!shouldPersistStore()) return;

  const storeFilePath = getStoreFilePath();
  fs.mkdirSync(path.dirname(storeFilePath), { recursive: true });
  const temporaryStoreFilePath = `${storeFilePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryStoreFilePath, JSON.stringify(store, null, 2));
  fs.renameSync(temporaryStoreFilePath, storeFilePath);
  const stat = fs.statSync(storeFilePath);
  lastLoadedMtime = stat.mtimeMs;
  cachedStoreVersion = `${stat.mtimeMs}:${stat.size}`;
  cachedStoreVersionCheckedAt = Date.now();
  lastDiskSyncCheckedAt = cachedStoreVersionCheckedAt;
}

function withStoreWriteLock<T>(callback: () => T): T {
  if (!shouldPersistStore() || storeWriteLockDepth > 0) {
    return callback();
  }

  const lockDir = `${getStoreFilePath()}.lock`;
  const timeoutMs = nonNegativeIntegerEnv('SPORTS_CMS_STORE_LOCK_TIMEOUT_MS', 10_000);
  const staleMs = nonNegativeIntegerEnv('SPORTS_CMS_STORE_LOCK_STALE_MS', 30_000);
  const startedAt = Date.now();

  while (true) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(
        path.join(lockDir, 'owner.json'),
        JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
      );
      break;
    } catch (error) {
      removeStaleStoreWriteLock(lockDir, staleMs);
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Store write lock timeout: ${lockDir}`);
      }
      sleepSync(25);
    }
  }

  storeWriteLockDepth += 1;
  try {
    return callback();
  } finally {
    storeWriteLockDepth -= 1;
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}

function removeStaleStoreWriteLock(lockDir: string, staleMs: number): void {
  try {
    const stat = fs.statSync(lockDir);
    if (Date.now() - stat.mtimeMs > staleMs) {
      fs.rmSync(lockDir, { recursive: true, force: true });
    }
  } catch {
    // Lock disappeared between mkdir attempts.
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function reviveDates(value: unknown, key = ''): unknown {
  if (typeof value === 'string' && (key.endsWith('At') || key === 'startTime' || key === 'createTime')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }

  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, reviveDates(entryValue, entryKey)]),
    );
  }

  return value;
}

function getStoreFilePath(): string {
  resolvedStoreFilePath ??=
    process.env.SPORTS_CMS_STORE_PATH ??
    path.join(findWorkspaceRoot(path.dirname(fileURLToPath(import.meta.url))), '.data', 'cms-store.json');
  return resolvedStoreFilePath;
}

function shouldPersistStore(): boolean {
  return process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true';
}

function nonNegativeIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function findWorkspaceRoot(startDir: string): string {
  let current = startDir;
  while (current !== path.dirname(current)) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string };
        if (pkg.name === 'sports-news-platform') {
          return current;
        }
      } catch {
        return current;
      }
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

function paginate<T>(items: T[], options: ListOptions = {}): T[] {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  return items.slice((page - 1) * pageSize, page * pageSize);
}

function findRecord<T extends { id: string }>(records: T[], idValue: string): T {
  const record = records.find((candidate) => candidate.id === idValue);
  if (!record) {
    throw new Error(`Record not found: ${idValue}`);
  }
  return record;
}

function serializeAdminUser(
  store: CmsStore,
  user: AdminUserRecord,
  options: { includeTotpSecret?: boolean } = {},
): AdminUserPublicRecord {
  const roles = user.roleIds
    .map((roleId) => store.adminRoles.find((role) => role.id === roleId && !role.deletedAt && role.status === 'ACTIVE'))
    .filter((role): role is AdminRoleRecord => Boolean(role));
  const activePermissionActions = new Set(
    store.adminPermissions
      .filter((permission) => permission.status === 'ACTIVE')
      .map((permission) => permission.action),
  );
  const permissions = Array.from(
    new Set(
      roles
        .flatMap((role) => role.permissionActions)
        .filter((action) => activePermissionActions.has(action)),
    ),
  );
  const { passwordHash, totpSecret, ...safeUser } = user;
  void passwordHash;

  return {
    ...safeUser,
    ...(options.includeTotpSecret ? { totpSecret: normalizeNullableString(totpSecret) } : {}),
    totpSecretConfigured: Boolean(normalizeNullableString(totpSecret)),
    roles,
    permissions,
  };
}

function ensureRoleIds(store: CmsStore, roleIds: string[]): void {
  const missingRole = roleIds.find(
    (roleId) => !store.adminRoles.some((role) => role.id === roleId && !role.deletedAt && role.status === 'ACTIVE'),
  );
  if (missingRole) {
    throw new Error(`Record not found: ${missingRole}`);
  }
}

function ensurePermissionActions(store: CmsStore, permissionActions: Array<AdminPermissionAction | string>): void {
  const missingPermission = permissionActions.find(
    (action) =>
      !store.adminPermissions.some((permission) => permission.action === action && permission.status === 'ACTIVE'),
  );
  if (missingPermission) {
    throw new Error(`Record not found: ${missingPermission}`);
  }
}

function updateRecord<T extends { id: string; updatedAt: Date }>(
  store: CmsStore,
  records: T[],
  idValue: string,
  input: Partial<T>,
  actor: Actor | undefined,
  action: string,
  entityType: string,
): T {
  const record = records.find((candidate) => candidate.id === idValue);
  if (!record) {
    throw new Error(`Record not found: ${idValue}`);
  }
  const before = { ...record };
  Object.assign(record, input, { updatedAt: new Date() });
  audit(store, actor, action, entityType, record.id, before, record);
  return record;
}

function softDeleteRecord<T extends { id: string; updatedAt: Date; deletedAt?: Date | null }>(
  store: CmsStore,
  records: T[],
  idValue: string,
  actor: Actor | undefined,
  action: string,
  entityType: string,
): T {
  const record = records.find((candidate) => candidate.id === idValue);
  if (!record) {
    throw new Error(`Record not found: ${idValue}`);
  }
  const before = { ...record };
  record.deletedAt = new Date();
  record.updatedAt = new Date();
  audit(store, actor, action, entityType, record.id, before, record);
  return record;
}

function deleteSiteWithScheduledTasks(store: CmsStore, idValue: string, actor?: Actor): SiteRecord {
  findRecord(store.sites, idValue);
  const taskIds = store.scheduledTasks
    .filter((task) => isScheduledTaskBoundToSite(task, idValue))
    .map((task) => task.id);

  taskIds.forEach((taskId) =>
    deleteRecord(store, store.scheduledTasks, taskId, actor, 'scheduledTask.delete', 'ScheduledTask'),
  );

  return softDeleteRecord(store, store.sites, idValue, actor, 'site.delete', 'Site');
}

function isScheduledTaskBoundToSite(task: ScheduledTaskRecord, siteId: string): boolean {
  return isPersistedRecord(task.config) && safePersistedText(task.config.siteId) === siteId;
}

function deleteRecord<T extends { id: string }>(
  store: CmsStore,
  records: T[],
  idValue: string,
  actor: Actor | undefined,
  action: string,
  entityType: string,
): T {
  const index = records.findIndex((candidate) => candidate.id === idValue);
  if (index === -1) {
    throw new Error(`Record not found: ${idValue}`);
  }
  const [record] = records.splice(index, 1);
  audit(store, actor, action, entityType, record.id, record, undefined);
  return record;
}

function ensureUnique<T extends Record<string, unknown>>(records: T[], key: keyof T, value: unknown): void {
  if (records.some((record) => record[key] === value)) {
    throw new Error(`Duplicate value for ${String(key)}: ${String(value)}`);
  }
}

function ensureUniqueCategorySlug(
  records: Array<CategoryRecord | Pick<CategoryRecord, 'id' | 'slug' | 'deletedAt'>>,
  slug: string | undefined,
  currentId?: string,
): void {
  if (!slug) {
    return;
  }

  const duplicate = records.find(
    (record) => record.id !== currentId && !record.deletedAt && record.slug === slug,
  );
  if (duplicate) {
    throw new Error(`Duplicate value for slug: ${slug}`);
  }
}

function ensureUniqueSiblingCategoryName(
  records: Array<Pick<CategoryRecord, 'id' | 'parentId' | 'name' | 'deletedAt'>>,
  input: {
    id?: string;
    parentId?: string | null;
    name: string;
  },
): void {
  const duplicate = records.find(
    (record) =>
      record.id !== input.id &&
      !record.deletedAt &&
      categorySiblingKey(record.parentId, record.name) === categorySiblingKey(input.parentId, input.name),
  );

  if (duplicate) {
    throw new Error(`栏目名不能重复：${input.name}`);
  }
}

function categorySiblingKey(parentId: string | null | undefined, name: string): string {
  return `${parentId ?? ''}::${normalizeCategoryName(name)}`;
}

function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function mergeReplacementMaps(primary: Map<string, string>, fallback: Map<string, string>): Map<string, string> {
  const merged = new Map(primary);
  fallback.forEach((value, key) => {
    if (!merged.has(key)) {
      merged.set(key, value);
    }
  });
  return merged;
}

function pickCanonicalCategory(store: CmsStore, categories: CategoryRecord[]): CategoryRecord {
  const referenceCounts = buildCategoryReferenceCounts(store);
  const deletedSlugMatchCounts = buildDeletedCategorySlugMatchCounts(store);
  return [...categories].sort((left, right) => {
    const referenceDelta = (referenceCounts.get(right.id) ?? 0) - (referenceCounts.get(left.id) ?? 0);
    if (referenceDelta !== 0) {
      return referenceDelta;
    }

    const deletedSlugMatchDelta = (deletedSlugMatchCounts.get(right.slug) ?? 0) - (deletedSlugMatchCounts.get(left.slug) ?? 0);
    if (deletedSlugMatchDelta !== 0) {
      return deletedSlugMatchDelta;
    }

    const slugLengthDelta = left.slug.length - right.slug.length;
    if (slugLengthDelta !== 0) {
      return slugLengthDelta;
    }

    const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    const sortOrderDelta = left.sortOrder - right.sortOrder;
    if (sortOrderDelta !== 0) {
      return sortOrderDelta;
    }

    return left.id.localeCompare(right.id);
  })[0];
}

function buildCategoryReferenceCounts(store: CmsStore): Map<string, number> {
  const counts = new Map<string, number>();
  const increment = (categoryId: string | null | undefined, amount = 1) => {
    if (!categoryId) return;
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + amount);
  };

  store.categories.forEach((category) => {
    if (!category.deletedAt) {
      increment(category.parentId, 3);
    }
  });
  store.news.forEach((article) => {
    if (!article.deletedAt) {
      increment(article.categoryId, 5);
    }
  });
  store.liveReplays.forEach((replay) => {
    if (!replay.deletedAt) {
      increment(replay.categoryId, 5);
    }
  });
  store.promotionLinks.forEach((link) => {
    if (!link.deletedAt) {
      increment(link.categoryId, 2);
    }
  });
  store.urlConfigs.forEach((config) => {
    uniqueStrings(config.categoryIds ?? []).forEach((categoryId) => increment(categoryId, 2));
    config.rules.forEach((rule) => increment(rule.categoryId, 2));
  });
  store.tdkConfigs.forEach((config) => {
    uniqueStrings(config.categoryIds ?? []).forEach((categoryId) => increment(categoryId, 2));
    config.rules.forEach((rule) => increment(rule.categoryId, 2));
  });
  store.scheduledTasks.forEach((task) => {
    if (!isPersistedRecord(task.config)) {
      return;
    }
    increment(safePersistedText(task.config.categoryId), 1);
  });

  return counts;
}

function buildDeletedCategorySlugMatchCounts(store: CmsStore): Map<string, number> {
  const counts = new Map<string, number>();
  store.categories.forEach((category) => {
    if (!category.deletedAt) {
      return;
    }
    counts.set(category.slug, (counts.get(category.slug) ?? 0) + 1);
  });
  return counts;
}

function ensureUniqueSiteDomains(store: CmsStore, domains: string[], currentSiteId?: string): void {
  const incomingDomains = new Set(domains.map(normalizeHost).filter(Boolean));
  const duplicate = store.sites
    .filter((site) => site.id !== currentSiteId && !site.deletedAt)
    .find((site) => siteAllDomainAliases(site).some((domain) => incomingDomains.has(domain)));

  if (duplicate) {
    throw new Error(`Duplicate site domain alias: ${[...incomingDomains].join(', ')}`);
  }
}

function siteAllDomainAliases(site: SiteRecord): string[] {
  return uniqueStrings([site.primaryDomain, ...site.domains.map((domain) => domain.domain)].flatMap(siteDomainAliases));
}

function siteDomainAliases(domain: string | null | undefined): string[] {
  const normalized = normalizeHost(domain);
  if (!normalized) {
    return [];
  }

  if (isLocalOrPortDomain(normalized)) {
    return [normalized];
  }

  const bareDomain = normalized.startsWith('www.') ? normalized.slice(4) : normalized;
  return uniqueStrings([normalized, bareDomain, `www.${bareDomain}`]);
}

function buildPrimaryDomainRecords(domain: string, siteId: string): SiteRecord['domains'] {
  const primaryDomain = normalizeHost(domain);
  return siteDomainAliases(primaryDomain).map((alias) => ({
    id: id('domain'),
    siteId,
    domain: alias,
    isPrimary: alias === primaryDomain,
    status: 'ACTIVE',
  }));
}

function syncPrimaryDomainRecords(site: SiteRecord, nextPrimaryDomain: string, previousPrimaryDomain: string): SiteRecord['domains'] {
  const nextAliases = new Set(siteDomainAliases(nextPrimaryDomain));
  const previousAliases = new Set(siteDomainAliases(previousPrimaryDomain));
  const existingByDomain = new Map(site.domains.map((domain) => [normalizeHost(domain.domain), domain]));
  const primaryRecords = buildPrimaryDomainRecords(nextPrimaryDomain, site.id).map((domain) => ({
    ...domain,
    id: existingByDomain.get(domain.domain)?.id ?? domain.id,
  }));
  const preservedDomains = site.domains.filter((domain) => {
    const normalized = normalizeHost(domain.domain);
    return !domain.isPrimary && !previousAliases.has(normalized) && !nextAliases.has(normalized);
  });

  return [...primaryRecords, ...preservedDomains];
}

function isLocalOrPortDomain(domain: string): boolean {
  return /:\d+$/.test(domain) || domain === 'localhost' || domain.endsWith('.localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(domain);
}

function ensureOptionalRecord<T extends { id: string }>(
  records: T[],
  idValue: string | null | undefined,
  fieldName: string,
): void {
  if (!idValue) {
    return;
  }
  if (!records.some((record) => record.id === idValue)) {
    throw new Error(`Record not found for ${fieldName}: ${idValue}`);
  }
}

function ensureSiteTemplateSelection(store: CmsStore, templateId: string | null | undefined): void {
  if (!templateId) {
    return;
  }
  findActiveTemplate(store, templateId);
}

function findActiveTemplate(store: CmsStore, templateId: string): TemplateRecord {
  const template = store.templates.find((record) => record.id === templateId);
  if (!template || template.status !== 'ACTIVE') {
    throw new Error(`Record not found for templateId: ${templateId}`);
  }
  return template;
}

function ensureSiteScopedUrlConfig(store: CmsStore, urlConfigId: string | null | undefined, siteId?: string): void {
  ensureSiteScopedConfig(store.urlConfigs, urlConfigId, siteId, 'urlConfigId');
}

function ensureSiteScopedTdkConfig(store: CmsStore, tdkConfigId: string | null | undefined, siteId?: string): void {
  ensureSiteScopedConfig(store.tdkConfigs, tdkConfigId, siteId, 'tdkConfigId');
}

function ensureSiteScopedConfig<T extends { id: string; siteId?: string | null; status: string }>(
  records: T[],
  idValue: string | null | undefined,
  siteId: string | undefined,
  fieldName: string,
): void {
  if (!idValue) {
    return;
  }

  const record = records.find((candidate) => candidate.id === idValue);
  if (!record || record.status !== 'ACTIVE') {
    throw new Error(`Record not found for ${fieldName}: ${idValue}`);
  }

  if (record.siteId && record.siteId !== siteId) {
    throw new Error(`${fieldName} belongs to another site: ${idValue}`);
  }
}

function filterActiveByOptionalIds<T extends { id: string; status: string }>(records: T[], ids?: string[]): T[] {
  const activeRecords = records.filter((record) => record.status === 'ACTIVE');
  if (!ids?.length) {
    return activeRecords;
  }
  return ids
    .map((idValue) => activeRecords.find((record) => record.id === idValue))
    .filter((record): record is T => Boolean(record));
}

function defaultUrlConfigId(store: CmsStore): string | undefined {
  return (
    store.urlConfigs.find((config) => config.id === 'url-default-rules' && config.status === 'ACTIVE') ??
    store.urlConfigs.find((config) => !config.siteId && config.status === 'ACTIVE' && urlRules(config).length > 0)
  )?.id;
}

function defaultTdkConfigId(store: CmsStore): string | undefined {
  return (
    store.tdkConfigs.find((config) => config.id === 'tdk-default-rules' && config.status === 'ACTIVE') ??
    store.tdkConfigs.find((config) => !config.siteId && config.status === 'ACTIVE' && tdkRules(config).length > 0)
  )?.id;
}

function ensureScopedSlug<T extends { siteId: string; slug: string }>(
  records: T[],
  siteId: string,
  slug: string,
): void {
  if (records.some((record) => record.siteId === siteId && record.slug === slug)) {
    throw new Error(`Duplicate slug in site ${siteId}: ${slug}`);
  }
}

function ensureScopedKey<T extends { siteId?: string | null; key: string }>(
  records: T[],
  siteId: string | null,
  key: string,
): void {
  if (records.some((record) => (record.siteId ?? null) === siteId && record.key === key)) {
    throw new Error(`Duplicate promotion key in site ${siteId ?? 'global'}: ${key}`);
  }
}

function ensurePromotionLinkReferences(
  store: CmsStore,
  input: Pick<PromotionLinkRecord, 'siteId' | 'promotionTypeId'> & { categoryId?: string | null },
): void {
  const site = store.sites.find((candidate) => candidate.id === input.siteId && !candidate.deletedAt);
  if (!site) {
    throw new Error(`Record not found: ${input.siteId}`);
  }

  if (input.categoryId) {
    const category = store.categories.find((candidate) => candidate.id === input.categoryId && !candidate.deletedAt);
    if (!category) {
      throw new Error(`Record not found: ${input.categoryId}`);
    }
  }

  const promotionType = store.promotionTypes.find(
    (candidate) => candidate.id === input.promotionTypeId && !candidate.deletedAt,
  );
  if (!promotionType) {
    throw new Error(`Record not found: ${input.promotionTypeId}`);
  }
  if (promotionType.siteId && promotionType.siteId !== input.siteId) {
    throw new Error(`Record not found: ${input.promotionTypeId} is not available for site ${input.siteId}`);
  }
}

function hydrateArticle(store: CmsStore, article: NewsArticleRecord): NewsArticleRecord {
  return {
    ...article,
    category: store.categories.find((category) => category.id === article.categoryId),
    tags: store.tags.filter((tag) => tag.siteId === article.siteId && article.title.includes(tag.name)),
  };
}

function hydratePromotionLink(store: CmsStore, link: PromotionLinkRecord): PromotionLinkRecord {
  return {
    ...link,
    promotionType: store.promotionTypes.find((promotionType) => promotionType.id === link.promotionTypeId) ?? null,
  };
}

function hydrateMatch(
  store: CmsStore,
  match: SportMatchRecord,
  lookups?: {
    leagueById: Map<string, SportLeagueRecord>;
    teamById: Map<string, SportTeamRecord>;
  },
): SportMatchRecord {
  const league = match.leagueId ? (lookups?.leagueById.get(match.leagueId) ?? store.leagues.find((item) => item.id === match.leagueId)) : null;
  const homeTeam = match.homeTeamId ? (lookups?.teamById.get(match.homeTeamId) ?? store.teams.find((item) => item.id === match.homeTeamId)) : null;
  const awayTeam = match.awayTeamId ? (lookups?.teamById.get(match.awayTeamId) ?? store.teams.find((item) => item.id === match.awayTeamId)) : null;

  return {
    ...match,
    league: league ?? null,
    homeTeam: homeTeam ?? null,
    awayTeam: awayTeam ?? null,
  };
}

function sortNews(a: NewsArticleRecord, b: NewsArticleRecord): number {
  if (a.isTop !== b.isTop) {
    return a.isTop ? -1 : 1;
  }
  return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
}

function sortPromotionLinks(a: PromotionLinkRecord, b: PromotionLinkRecord): number {
  const typeOrder = (a.promotionType?.sortOrder ?? 0) - (b.promotionType?.sortOrder ?? 0);
  if (typeOrder !== 0) {
    return typeOrder;
  }
  const linkOrder = a.sortOrder - b.sortOrder;
  if (linkOrder !== 0) {
    return linkOrder;
  }
  return b.weight - a.weight;
}

function createNewsInvalidationJob(
  store: CmsStore,
  site: SiteRecord,
  article: NewsArticleRecord,
  category: CategoryRecord,
): CacheInvalidationJobRecord {
  const urlConfigs = store.urlConfigs.filter((config) => config.siteId === site.id || !config.siteId);
  const paths = [
    buildPublicUrl({ site, pageType: 'HOME', urlConfigs }),
    buildPublicUrl({ site, pageType: 'NEWS_CATEGORY', data: { categorySlug: category.slug }, urlConfigs, categoryId: category.id }),
    buildPublicUrl({
      site,
      pageType: 'NEWS_DETAIL',
      data: { categorySlug: category.slug, newsSlug: article.slug, articleSlug: article.slug, videoSlug: article.slug, slug: article.slug },
      urlConfigs,
      categoryId: category.id,
    }),
    '/sitemap.xml',
  ];

  const job: CacheInvalidationJobRecord = {
    id: id('cache-job'),
    siteId: site.id,
    tags: buildNewsInvalidationTags(site, article, category),
    paths,
    reason: `news.publish:${article.id}`,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.invalidationJobs.push(job);
  return job;
}

function createSiteConfigInvalidationJob(
  store: CmsStore,
  site: SiteRecord,
  reason: string,
): CacheInvalidationJobRecord {
  const urlConfigs = store.urlConfigs.filter((config) => config.siteId === site.id || !config.siteId);
  const selectedUrlConfig = site.urlConfigId
    ? urlConfigs.find((config) => config.id === site.urlConfigId && config.status === 'ACTIVE')
    : undefined;
  const categoryById = new Map(
    store.categories
      .filter((category) => !category.deletedAt && category.status === 'ACTIVE')
      .map((category) => [category.id, category]),
  );
  const categoryRules = selectedUrlConfig
    ? urlRules(selectedUrlConfig).filter((rule) => rule.categoryId && categoryById.has(rule.categoryId))
    : [];
  const categoryPaths = categoryRules
    .map((rule) => {
      const category = categoryById.get(rule.categoryId);
      if (!category) {
        return undefined;
      }
      return safeBuildPublicPath({
        site,
        pageType: rule.pageType,
        category,
        urlConfigs,
        preferredConfigId: selectedUrlConfig?.id,
      });
    })
    .filter((pathValue): pathValue is string => Boolean(pathValue));
  const paths = uniqueStrings([
    safeBuildPublicPath({ site, pageType: 'HOME', urlConfigs, preferredConfigId: selectedUrlConfig?.id }) ?? '/',
    ...categoryPaths,
    '/sitemap.xml',
    '/robots.txt',
  ]);
  const tags = uniqueStrings([
    siteCacheTag(site.id),
    pageCacheTag(site.id, 'HOME'),
    pageCacheTag(site.id, 'NEWS_CATEGORY'),
    pageCacheTag(site.id, 'MATCH_CATEGORY'),
    pageCacheTag(site.id, 'VIDEO_CATEGORY'),
    ...(site.template ? [templateCacheTag(site.template.key)] : []),
    ...categoryRules.map((rule) => categoryCacheTag(rule.categoryId)),
    site.urlConfigId ? `urlConfig:${site.urlConfigId}` : '',
    site.tdkConfigId ? `tdkConfig:${site.tdkConfigId}` : '',
  ]);

  const job: CacheInvalidationJobRecord = {
    id: id('cache-job'),
    siteId: site.id,
    tags,
    paths,
    reason,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.invalidationJobs.push(job);
  return job;
}

function safeBuildPublicPath(input: {
  site: SiteRecord;
  pageType: PageType;
  urlConfigs: UrlConfigRecord[];
  preferredConfigId?: string | null;
  category?: CategoryRecord;
}): string | undefined {
  try {
    return buildPublicUrl({
      site: input.site,
      pageType: input.pageType,
      data: input.category
        ? {
            categorySlug: input.category.slug,
            sport: input.category.slug,
            slug: input.category.slug,
            categoryName: input.category.name,
            columnName: input.category.name,
          }
        : undefined,
      urlConfigs: input.urlConfigs,
      preferredConfigId: input.preferredConfigId,
      categoryId: input.category?.id,
    });
  } catch {
    return undefined;
  }
}

function audit(
  store: CmsStore,
  actor: Actor | undefined,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
): AuditLogRecord {
  const record: AuditLogRecord = {
    id: id('audit'),
    userId: actor?.userId,
    action,
    entityType,
    entityId,
    before,
    after,
    ip: actor?.ip,
    userAgent: actor?.userAgent,
    createdAt: new Date(),
  };
  store.auditLogs.push(record);
  return record;
}

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export type CmsRepository = ReturnType<typeof createMemoryCmsRepository>;
export type { PageType };
