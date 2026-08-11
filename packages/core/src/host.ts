export function normalizeHost(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  const withoutProtocol = input.replace(/^https?:\/\//i, '');
  const host = withoutProtocol.split('/')[0] ?? '';

  return host.trim().toLowerCase();
}

export function domainMatchesHost(domain: string, host: string): boolean {
  const normalizedDomain = normalizeHost(domain);
  const normalizedHost = normalizeHost(host);
  if (normalizedDomain === normalizedHost) {
    return true;
  }

  if (isEquivalentLocalHost(normalizedDomain, normalizedHost)) {
    return true;
  }

  if (hasPort(normalizedDomain)) {
    return false;
  }

  return stripPort(normalizedDomain) === stripPort(normalizedHost);
}

export function stripPort(input: string): string {
  return normalizeHost(input).replace(/:\d+$/, '');
}

export function hasPort(input: string): boolean {
  return /:\d+$/.test(normalizeHost(input));
}

export function isLocalHost(input: string): boolean {
  const hostname = stripPort(input);
  return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function isEquivalentLocalHost(left: string, right: string): boolean {
  if (!isLocalHost(left) || !isLocalHost(right)) {
    return false;
  }

  const leftPort = portFromHost(left);
  const rightPort = portFromHost(right);
  return !leftPort || !rightPort || leftPort === rightPort;
}

function portFromHost(input: string): string | undefined {
  return normalizeHost(input).match(/:(\d+)$/)?.[1];
}

export function protocolFromUrlInput(input: string | null | undefined, fallback: 'http' | 'https' = 'http'): 'http' | 'https' {
  const raw = input?.trim() ?? '';
  if (/^https:\/\//i.test(raw)) return 'https';
  if (/^http:\/\//i.test(raw)) return 'http';
  return fallback;
}
