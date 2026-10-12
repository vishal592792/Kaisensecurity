import { describe, it, expect } from 'vitest';
import { evaluateAppIntegrity, isVersionAtLeast } from '../src/lib/client-auth/integrity';

describe('App Integrity & Anti-Tampering Engine', () => {
  it('correctly compares semantic versioning strings', () => {
    expect(isVersionAtLeast('1.2.0', '1.0.0')).toBe(true);
    expect(isVersionAtLeast('1.0.0', '1.0.0')).toBe(true);
    expect(isVersionAtLeast('0.9.9', '1.0.0')).toBe(false);
    expect(isVersionAtLeast('2.0.0', '1.9.9')).toBe(true);
    expect(isVersionAtLeast('1.0.10', '1.0.9')).toBe(true);
  });

  it('rejects outdated app versions under STRICT policy', async () => {
    const result = await evaluateAppIntegrity({
      appVersion: '0.8.0',
      minSupportedVersion: '1.0.0',
      integrityPolicy: 'STRICT',
      integrityToken: 'dummy'
    });

    expect(result.passed).toBe(false);
    expect(result.verdict).toBe('NO_INTEGRITY');
    expect(result.details.appVersionOk).toBe(false);
  });

  it('requires integrity token under STRICT policy', async () => {
    const result = await evaluateAppIntegrity({
      appVersion: '1.2.0',
      minSupportedVersion: '1.0.0',
      integrityPolicy: 'STRICT',
      integrityToken: undefined
    });

    expect(result.passed).toBe(false);
    expect(result.details.reason).toContain('STRICT policy');
  });

  it('passes under PERMISSIVE policy when token is omitted', async () => {
    const result = await evaluateAppIntegrity({
      appVersion: '1.2.0',
      minSupportedVersion: '1.0.0',
      integrityPolicy: 'PERMISSIVE',
      integrityToken: undefined
    });

    expect(result.passed).toBe(true);
    expect(result.verdict).toBe('MEETS_BASIC_INTEGRITY');
  });

  it('logs but permits in MONITOR_ONLY mode even with older app version', async () => {
    const result = await evaluateAppIntegrity({
      appVersion: '0.9.0',
      minSupportedVersion: '1.0.0',
      integrityPolicy: 'MONITOR_ONLY'
    });

    expect(result.passed).toBe(true);
    expect(result.details.policyMode).toBe('MONITOR_ONLY');
  });
});
