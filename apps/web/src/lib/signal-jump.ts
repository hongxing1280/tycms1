import { buildSignalTargetUrl, resolveSignalJumpToken } from '@sports/core';
import { cmsRepository } from '@sports/db';

const SIGNAL_JUMP_PATH_PATTERN = /^\/?video\/([A-Za-z0-9_-]+)\.html$/;

export function signalJumpTokenFromPath(path: string): string | undefined {
  return SIGNAL_JUMP_PATH_PATTERN.exec(path)?.[1];
}

export function resolveSignalJumpTarget(token: string): string | undefined {
  const payload = resolveSignalJumpToken(token);
  if (!payload) return undefined;

  const product = cmsRepository.listLiveProductsByIds([payload.productId], 1)[0];
  if (!product) return undefined;

  return buildSignalTargetUrl({
    product,
    mode: payload.mode,
    sport: payload.sport,
    variables: {
      matchId: payload.matchId,
      slug: payload.slug,
      newsSlug: payload.newsSlug,
      videoSlug: payload.videoSlug,
    },
  });
}
