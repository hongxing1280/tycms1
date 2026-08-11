import { describe, expect, it } from 'vitest';
import { createSignalJumpToken } from '@sports/core';
import { cmsRepository } from '@sports/db';
import { resolveSignalJumpTarget, signalJumpTokenFromPath } from './signal-jump';

describe('signal jump routes', () => {
  it('extracts encrypted tokens from site-internal video paths', () => {
    expect(signalJumpTokenFromPath('/video/Abc_123-def.html')).toBe('Abc_123-def');
    expect(signalJumpTokenFromPath('video/Abc_123-def.html')).toBe('Abc_123-def');
    expect(signalJumpTokenFromPath('/video/match-replay/replay-a.html')).toBeUndefined();
  });

  it('resolves site-internal live jumps from the live product URL and match external id', () => {
    const originalProducts = [...cmsRepository.store.liveProducts];
    const originalSignalDomains = [...cmsRepository.store.signalDomains];
    try {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        liveProducts: [
          {
            id: 'product-livematches-two',
            name: '测试直播产品',
            jumpUrl: 'https://121311.com',
            supportWildcard: false,
            appendRoomSuffix: true,
            roomSuffix: '/liveMatchesTwo',
            status: 'ACTIVE',
            createdAt: new Date('2026-06-04T00:00:00.000Z'),
            updatedAt: new Date('2026-06-04T00:00:00.000Z'),
          },
        ],
        signalDomains: [
          {
            id: 'signal-domain-ignored',
            category: '足球直播',
            name: 'signal.example.com',
            supportWildcard: true,
            wildcardPrefixCount: 4,
            status: 'ACTIVE',
            createdAt: new Date('2026-06-04T00:00:00.000Z'),
            updatedAt: new Date('2026-06-04T00:00:00.000Z'),
          },
        ],
      });

      const token = createSignalJumpToken({
        productId: 'product-livematches-two',
        mode: 'live',
        sport: 'FOOTBALL',
        matchId: '542057',
      });

      expect(resolveSignalJumpTarget(token)).toBe('https://121311.com/liveMatchesTwo/542057');
    } finally {
      Object.assign(cmsRepository.store, {
        ...cmsRepository.store,
        liveProducts: originalProducts,
        signalDomains: originalSignalDomains,
      });
    }
  });
});
