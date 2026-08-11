import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { LiveProductRecord, SignalDomainRecord, SportType } from './types';

export type SignalUrlMode = 'live' | 'replay';

export type SignalUrlVariables = {
  matchId?: string;
  slug?: string;
  videoSlug?: string;
  newsSlug?: string;
};

export type SignalJumpPayload = SignalUrlVariables & {
  productId: string;
  mode: SignalUrlMode;
  sport?: SportType;
};

const SIGNAL_JUMP_VERSION = 1;
const SIGNAL_JUMP_FALLBACK_SECRET = 'sports-platform-local-signal-jump-secret';

export function createSignalJumpToken(payload: SignalJumpPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', signalJumpKey(), iv);
  const plaintext = Buffer.from(JSON.stringify({ v: SIGNAL_JUMP_VERSION, ...payload }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function resolveSignalJumpToken(token: string): SignalJumpPayload | undefined {
  try {
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.length <= 28) return undefined;
    const iv = bytes.subarray(0, 12);
    const tag = bytes.subarray(12, 28);
    const encrypted = bytes.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', signalJumpKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const payload = JSON.parse(plaintext) as Partial<SignalJumpPayload> & { v?: number };
    if (payload.v !== SIGNAL_JUMP_VERSION || !payload.productId || !isSignalUrlMode(payload.mode)) {
      return undefined;
    }
    if (payload.sport && payload.sport !== 'FOOTBALL' && payload.sport !== 'BASKETBALL') {
      return undefined;
    }
    return {
      productId: payload.productId,
      mode: payload.mode,
      sport: payload.sport,
      matchId: payload.matchId,
      slug: payload.slug,
      videoSlug: payload.videoSlug,
      newsSlug: payload.newsSlug,
    };
  } catch {
    return undefined;
  }
}

export function buildSignalTargetUrl(input: {
  product: LiveProductRecord;
  signalDomains?: SignalDomainRecord[];
  mode: SignalUrlMode;
  sport?: SportType;
  variables?: SignalUrlVariables;
}): string {
  const rawBase = input.product.jumpUrl;
  const signalDomain = selectSignalDomain(input.signalDomains ?? [], input.sport);
  const base = signalDomain
    ? applySignalDomain(rawBase, signalDomain)
    : applyProductWildcard(rawBase, input.product);
  const suffix = input.mode === 'live'
    ? resolveLiveRoomSuffix(input.product, input.variables ?? {})
    : '';

  return joinSignalUrl(base, suffix);
}

function signalJumpKey(): Buffer {
  const secret =
    process.env.SIGNAL_JUMP_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    SIGNAL_JUMP_FALLBACK_SECRET;
  return createHash('sha256').update(secret).digest();
}

function isSignalUrlMode(value: unknown): value is SignalUrlMode {
  return value === 'live' || value === 'replay';
}

function selectSignalDomain(signalDomains: SignalDomainRecord[], sport: SportType | undefined): SignalDomainRecord | undefined {
  const activeDomains = signalDomains.filter((domain) => domain.status === 'ACTIVE' && domain.name);
  if (!activeDomains.length) return undefined;

  const sportPattern = sport === 'BASKETBALL' ? /篮球|basketball|nba|cba/i : sport === 'FOOTBALL' ? /足球|football|soccer/i : undefined;
  return sportPattern
    ? activeDomains.find((domain) => sportPattern.test(`${domain.category ?? ''} ${domain.name}`)) ?? activeDomains[0]
    : activeDomains[0];
}

function applySignalDomain(base: string, signalDomain: SignalDomainRecord): string {
  try {
    const target = new URL(normalizeSignalBaseUrl(base));
    const domainUrl = new URL(normalizeSignalBaseUrl(signalDomain.name));
    target.hostname = withWildcardPrefix(domainUrl.hostname, signalDomain.supportWildcard, signalDomain.wildcardPrefixCount);
    target.port = domainUrl.port;
    return target.toString();
  } catch {
    return base;
  }
}

function applyProductWildcard(base: string, product: LiveProductRecord): string {
  try {
    const target = new URL(normalizeSignalBaseUrl(base));
    target.hostname = withWildcardPrefix(target.hostname, product.supportWildcard, product.wildcardLength);
    return target.toString();
  } catch {
    return base;
  }
}

function withWildcardPrefix(hostname: string, enabled: boolean, length: number | null | undefined): string {
  if (!enabled) return hostname;
  const prefixLength = Math.max(0, Math.floor(length ?? 0));
  if (!prefixLength) return hostname;
  return `${randomLowerAlphaNumeric(prefixLength)}.${hostname}`;
}

function randomLowerAlphaNumeric(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return output;
}

function normalizeSignalBaseUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value) ? `http://${value}` : `https://${value}`;
}

function joinSignalUrl(base: string, suffix: string): string {
  if (!suffix) return base;
  if (base.endsWith('/') && suffix.startsWith('/')) return `${base.slice(0, -1)}${suffix}`;
  if (!base.endsWith('/') && !suffix.startsWith('/')) return `${base}/${suffix}`;
  return `${base}${suffix}`;
}

function resolveLiveRoomSuffix(product: LiveProductRecord, variables: SignalUrlVariables): string {
  const rawSuffix = product.roomSuffix?.trim();
  if (!product.appendRoomSuffix || !rawSuffix || rawSuffix === '/') return '';

  const filledSuffix = fillSignalVariables(rawSuffix, variables);
  if (containsSignalVariable(rawSuffix)) return filledSuffix;

  const matchId = variables.matchId?.trim();
  return matchId ? joinSignalUrl(filledSuffix, encodeURIComponent(matchId)) : filledSuffix;
}

function containsSignalVariable(value: string): boolean {
  return /\{(?:matchId|slug|videoSlug|newsSlug)\}/.test(value);
}

function fillSignalVariables(value: string, variables: SignalUrlVariables): string {
  return value
    .replaceAll('{matchId}', encodeURIComponent(variables.matchId ?? ''))
    .replaceAll('{slug}', encodeURIComponent(variables.slug ?? variables.matchId ?? ''))
    .replaceAll('{videoSlug}', encodeURIComponent(variables.videoSlug ?? variables.slug ?? variables.newsSlug ?? ''))
    .replaceAll('{newsSlug}', encodeURIComponent(variables.newsSlug ?? variables.slug ?? variables.videoSlug ?? ''));
}
