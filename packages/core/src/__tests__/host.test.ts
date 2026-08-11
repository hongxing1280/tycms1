import { describe, expect, it } from 'vitest';
import { domainMatchesHost } from '../host';

describe('domainMatchesHost', () => {
  it('treats local development host aliases as the same host when ports match', () => {
    expect(domainMatchesHost('127.0.0.1:3000', 'localhost:3000')).toBe(true);
    expect(domainMatchesHost('localhost:3000', '127.0.0.1:3000')).toBe(true);
  });

  it('does not match local development hosts across different ports', () => {
    expect(domainMatchesHost('127.0.0.1:3000', 'localhost:3001')).toBe(false);
  });
});
