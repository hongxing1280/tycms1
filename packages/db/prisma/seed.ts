import { PrismaClient } from '@prisma/client';
import { createSeedData } from '../src/seed-data';

const prisma = new PrismaClient();
const seed = createSeedData();

async function main() {
  await prisma.newsTag.deleteMany();
  await prisma.newsArticle.deleteMany();
  await (prisma as unknown as { liveReplay: { deleteMany: () => Promise<unknown> } }).liveReplay.deleteMany();
  await prisma.promotionLink.deleteMany();
  await prisma.promotionType.deleteMany();
  await prisma.category.deleteMany();
  await prisma.siteDomain.deleteMany();
  await prisma.urlConfig.deleteMany();
  await prisma.tdkConfig.deleteMany();
  await prisma.sportMatch.deleteMany();
  await prisma.sportTeam.deleteMany();
  await prisma.sportLeague.deleteMany();
  await prisma.liveProduct.deleteMany();
  await prisma.signalDomain.deleteMany();
  await prisma.signalSourceName.deleteMany();
  await prisma.site.deleteMany();
  await prisma.template.deleteMany();
  await prisma.siteGroup.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();

  for (const permission of seed.adminPermissions) {
    await prisma.permission.create({
      data: {
        id: permission.id,
        action: permission.action,
        label: permission.label,
        group: permission.group,
        description: permission.description,
        status: permission.status,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
      },
    });
  }

  for (const role of seed.adminRoles) {
    await prisma.role.create({
      data: {
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        status: role.status,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        permissions: {
          create: role.permissionActions.map((action) => ({
            permission: {
              connect: { action },
            },
          })),
        },
      },
    });
  }

  for (const user of seed.adminUsers) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles: {
          create: user.roleIds.map((roleId) => ({
            role: {
              connect: { id: roleId },
            },
          })),
        },
      },
    });
  }

  for (const group of seed.groups) {
    await prisma.siteGroup.create({
      data: {
        id: group.id,
        name: group.name,
        status: group.status,
        remark: group.remark,
        newsUpdateCount: group.newsUpdateCount,
        liveProductIds: group.liveProductIds ?? [],
        enableDeviceSignalCheck: group.enableDeviceSignalCheck ?? true,
        pcSignalSourceEnabled: group.pcSignalSourceEnabled ?? true,
        mobileSignalSourceEnabled: group.mobileSignalSourceEnabled ?? true,
        randomSignalSourceEnabled: group.randomSignalSourceEnabled ?? false,
        randomProductNames: group.randomProductNames ?? [],
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  }

  for (const template of seed.templates) {
    await prisma.template.create({
      data: {
        id: template.id,
        name: template.name,
        key: template.key,
        folder: template.folder,
        author: template.author,
        coverUrl: template.coverUrl,
        status: template.status,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  }

  for (const site of seed.sites) {
    await prisma.site.create({
      data: {
        id: site.id,
        groupId: site.groupId,
        name: site.name,
        primaryDomain: site.primaryDomain,
        primaryProtocol: site.primaryProtocol ?? 'http',
        status: site.status,
        templateId: site.templateId,
        newsUpdateCount: site.newsUpdateCount ?? 0,
        showSignalSources: site.showSignalSources,
        seoTitle: site.seoTitle,
        seoKeywords: site.seoKeywords,
        seoDescription: site.seoDescription,
        seoIndexStatus: site.seoIndexStatus,
        analyticsCode: site.analyticsCode,
        baiduPushToken: site.baiduPushToken,
        baiduVerifyCode: site.baiduVerifyCode,
        remark: site.remark,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
      },
    });

    for (const domain of site.domains) {
      await prisma.siteDomain.create({
        data: {
          id: domain.id,
          siteId: site.id,
          domain: domain.domain,
          isPrimary: domain.isPrimary,
          status: domain.status,
        },
      });
    }
  }

  for (const config of seed.urlConfigs) {
    await prisma.urlConfig.create({
      data: {
        id: config.id,
        siteId: config.siteId,
        categoryIds: config.categoryIds ?? [],
        rules: config.rules,
        name: config.name,
        status: config.status,
        ...(config.pageType ? { pageType: config.pageType } : {}),
        ...(config.pattern ? { pattern: config.pattern } : {}),
        ...(config.description ? { description: config.description } : {}),
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  }

  for (const config of seed.tdkConfigs) {
    await prisma.tdkConfig.create({
      data: {
        id: config.id,
        siteId: config.siteId,
        categoryIds: config.categoryIds ?? [],
        rules: config.rules,
        name: config.name,
        status: config.status,
        ...(config.pageType ? { pageType: config.pageType } : {}),
        ...(config.titleTemplate ? { titleTemplate: config.titleTemplate } : {}),
        ...(config.keywordsTemplate ? { keywordsTemplate: config.keywordsTemplate } : {}),
        ...(config.descriptionTemplate ? { descriptionTemplate: config.descriptionTemplate } : {}),
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  }

  for (const category of seed.categories) {
    await prisma.category.create({
      data: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        language: category.language,
        status: category.status,
        ...(category.description ? { description: category.description } : {}),
        sortOrder: category.sortOrder,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  }

  for (const type of seed.promotionTypes) {
    await prisma.promotionType.create({
      data: {
        id: type.id,
        siteId: type.siteId,
        key: type.key,
        name: type.name,
        slot: type.slot,
        renderStyle: type.renderStyle,
        description: type.description,
        status: type.status,
        sortOrder: type.sortOrder,
        createdAt: type.createdAt,
        updatedAt: type.updatedAt,
      },
    });
  }

  for (const link of seed.promotionLinks) {
    await prisma.promotionLink.create({
      data: {
        id: link.id,
        siteId: link.siteId,
        categoryId: link.categoryId,
        promotionTypeId: link.promotionTypeId,
        title: link.title,
        subtitle: link.subtitle,
        targetUrl: link.targetUrl,
        imageUrl: link.imageUrl,
        relNofollow: link.relNofollow,
        relSponsored: link.relSponsored,
        openInNewTab: link.openInNewTab,
        device: link.device,
        weight: link.weight,
        startAt: link.startAt,
        endAt: link.endAt,
        status: link.status,
        sortOrder: link.sortOrder,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      },
    });
  }

  for (const tag of seed.tags) {
    await prisma.tag.create({
      data: {
        id: tag.id,
        siteId: tag.siteId,
        name: tag.name,
        slug: tag.slug,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      },
    });
  }

  for (const article of seed.news) {
    await prisma.newsArticle.create({
      data: {
        id: article.id,
        siteId: article.siteId,
        categoryId: article.categoryId,
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        content: article.content,
        coverImageUrl: article.coverImageUrl,
        coverImageWidth: article.coverImageWidth,
        coverImageHeight: article.coverImageHeight,
        author: article.author,
        sourceName: article.sourceName,
        sourceUrl: article.sourceUrl,
        status: article.status,
        isTop: article.isTop,
        publishedAt: article.publishedAt,
        seoTitle: article.seoTitle,
        seoKeywords: article.seoKeywords,
        seoDescription: article.seoDescription,
        canonicalUrl: article.canonicalUrl,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      },
    });
  }

  for (const league of seed.leagues) {
    await prisma.sportLeague.create({
      data: {
        id: league.id,
        sport: league.sport,
        name: league.name,
        slug: league.slug,
        englishName: league.englishName,
        pinyin: league.pinyin,
        logoUrl: league.logoUrl,
        country: league.country,
        isHot: league.isHot,
        createdAt: league.createdAt,
        updatedAt: league.updatedAt,
      },
    });
  }

  for (const team of seed.teams) {
    await prisma.sportTeam.create({
      data: {
        id: team.id,
        sport: team.sport,
        leagueId: team.leagueId,
        name: team.name,
        slug: team.slug,
        englishName: team.englishName,
        pinyin: team.pinyin,
        country: team.country,
        logoUrl: team.logoUrl,
        isHot: team.isHot,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
    });
  }

  for (const match of seed.matches) {
    await prisma.sportMatch.create({
      data: {
        id: match.id,
        siteId: match.siteId,
        sport: match.sport,
        title: match.title,
        slug: match.slug,
        leagueId: match.leagueId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        isTop: match.isTop,
        status: match.status,
        startTime: match.startTime,
        liveUrl: match.liveUrl,
        replayUrl: match.replayUrl,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      },
    });
  }

  for (const product of seed.liveProducts) {
    await prisma.liveProduct.create({
      data: {
        id: product.id,
        name: product.name,
        jumpUrl: product.jumpUrl,
        ownerUserId: product.ownerUserId,
        supportWildcard: product.supportWildcard,
        wildcardLength: product.wildcardLength,
        enableReplayJumpDomain: product.enableReplayJumpDomain ?? false,
        replayJumpDomain: product.replayJumpDomain,
        roomSuffix: product.roomSuffix,
        appendRoomSuffix: product.appendRoomSuffix ?? false,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  }

  for (const domain of seed.signalDomains) {
    await prisma.signalDomain.create({
      data: {
        id: domain.id,
        category: domain.category,
        name: domain.name,
        supportWildcard: domain.supportWildcard,
        wildcardPrefixCount: domain.wildcardPrefixCount,
        status: domain.status,
        createdAt: domain.createdAt,
        updatedAt: domain.updatedAt,
      },
    });
  }

  for (const name of seed.signalSourceNames) {
    await prisma.signalSourceName.create({
      data: {
        id: name.id,
        name: name.name,
        status: name.status,
        createdAt: name.createdAt,
        updatedAt: name.updatedAt,
      },
    });
  }

  console.log('Seeded sports news platform MVP data.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
