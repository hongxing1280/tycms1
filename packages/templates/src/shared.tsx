import type {
  CategoryRecord,
  PromotionLinkRecord,
  PromotionSlot,
} from '@sports/core';

export type CategoryNavItem = {
  category: CategoryRecord;
  children: CategoryRecord[];
};

export function buildCategoryNavItems(categories: CategoryRecord[]): CategoryNavItem[] {
  const displayCategories = uniqueCategoriesByDisplayName(categories);
  const categoryById = new Map(displayCategories.map((category) => [category.id, category]));
  const childrenByParentId = new Map<string, CategoryRecord[]>();
  const topLevelCategories: CategoryRecord[] = [];

  for (const category of displayCategories) {
    if (category.parentId && categoryById.has(category.parentId)) {
      const children = childrenByParentId.get(category.parentId) ?? [];
      children.push(category);
      childrenByParentId.set(category.parentId, children);
      continue;
    }

    topLevelCategories.push(category);
  }

  return topLevelCategories.map((category) => ({
    category,
    children: uniqueCategoriesByDisplayName(childrenByParentId.get(category.id) ?? []),
  }));
}

function uniqueCategoriesByDisplayName(categories: CategoryRecord[]): CategoryRecord[] {
  const selected = new Map<string, CategoryRecord>();
  for (const category of categories) {
    const key = category.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const existing = selected.get(key);
    if (!existing || category.sortOrder < existing.sortOrder) {
      selected.set(key, category);
    }
  }
  return [...selected.values()].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function PromotionBlocks(props: { promotions: PromotionLinkRecord[]; slot: PromotionSlot; limit?: number }) {
  const items = props.promotions
    .filter((promotion) => promotion.promotionType?.slot === props.slot)
    .slice(0, props.limit ?? 3);

  if (!items.length) {
    return null;
  }

  return (
    <aside className={`promotion-blocks promotion-${props.slot.toLowerCase().replaceAll('_', '-')}`}>
      {items.map((promotion) => {
        const rel = [
          promotion.relNofollow ? 'nofollow' : undefined,
          promotion.relSponsored ? 'sponsored' : undefined,
          promotion.openInNewTab ? 'noopener noreferrer' : undefined,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <a
            className={`promotion-card promotion-style-${promotion.promotionType?.renderStyle.toLowerCase().replaceAll('_', '-') ?? 'text-link'} promotion-device-${promotion.device.toLowerCase()}`}
            href={promotion.targetUrl}
            key={promotion.id}
            rel={rel || undefined}
            target={promotion.openInNewTab ? '_blank' : undefined}
          >
            {promotion.imageUrl ? (
              <img src={promotion.imageUrl} alt={`${promotion.title}推广图`} width={1200} height={360} loading="lazy" />
            ) : null}
            <span>
              <strong>{promotion.title}</strong>
              {promotion.subtitle ? <small>{promotion.subtitle}</small> : null}
            </span>
          </a>
        );
      })}
    </aside>
  );
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
