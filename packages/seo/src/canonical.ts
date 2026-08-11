import { buildPublicUrl, type BuildPublicUrlInput } from '@sports/core';

export function canonicalUrl(input: Omit<BuildPublicUrlInput, 'absolute'>): string {
  return buildPublicUrl({ ...input, absolute: true });
}
