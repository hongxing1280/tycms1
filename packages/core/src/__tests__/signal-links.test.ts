import { describe, expect, it } from 'vitest';
import { buildSignalTargetUrl } from '../signal-links';
import type { LiveProductRecord, SignalDomainRecord } from '../types';

const now = new Date('2026-06-04T00:00:00.000Z');

describe('signal links', () => {
  it('appends the manual live room path and match external id only when enabled', () => {
    const product: LiveProductRecord = {
      id: 'product-live',
      name: '测试直播',
      jumpUrl: 'https://121311.com',
      supportWildcard: false,
      appendRoomSuffix: true,
      roomSuffix: '/liveMatchesTwo',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const url = buildSignalTargetUrl({
      product,
      mode: 'live',
      variables: { matchId: '542057' },
    });

    expect(url).toBe('https://121311.com/liveMatchesTwo/542057');
  });

  it('keeps live product jump URL untouched when room suffix append is disabled', () => {
    const product: LiveProductRecord = {
      id: 'product-live-off',
      name: '测试直播',
      jumpUrl: 'https://121311.com',
      supportWildcard: false,
      appendRoomSuffix: false,
      roomSuffix: '/liveMatchesTwo',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const url = buildSignalTargetUrl({
      product,
      mode: 'live',
      variables: { matchId: '542057' },
    });

    expect(url).toBe('https://121311.com/');
  });

  it('sends replay jumps to the live product home URL without room suffixes', () => {
    const product: LiveProductRecord = {
      id: 'product-replay',
      name: '测试直播',
      jumpUrl: 'https://121311.com',
      supportWildcard: false,
      enableReplayJumpDomain: true,
      replayJumpDomain: 'https://replay.example.com/play',
      appendRoomSuffix: true,
      roomSuffix: '/liveMatchesTwo',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const url = buildSignalTargetUrl({
      product,
      mode: 'replay',
      variables: { matchId: '542057' },
    });

    expect(url).toBe('https://121311.com/');
  });

  it('adds configured four-character wildcard prefix to signal domain', () => {
    const product: LiveProductRecord = {
      id: 'product-1',
      name: '测试直播',
      jumpUrl: 'https://live.example.com/jump',
      supportWildcard: false,
      appendRoomSuffix: true,
      roomSuffix: '/room/{matchId}',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    const domain: SignalDomainRecord = {
      id: 'domain-1',
      category: '足球直播',
      name: 'signal.example.com',
      supportWildcard: true,
      wildcardPrefixCount: 4,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const url = buildSignalTargetUrl({
      product,
      signalDomains: [domain],
      mode: 'live',
      sport: 'FOOTBALL',
      variables: { matchId: 'abc123', slug: 'abc123' },
    });

    expect(url).toMatch(/^https:\/\/[a-z0-9]{4}\.signal\.example\.com\/jump\/room\/abc123$/);
  });
});
