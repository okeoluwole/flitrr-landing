import { describe, it, expect } from 'vitest';
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../lib/digest/unsubscribeToken.js';

/**
 * Part B (M7.3) pure logic: the unsubscribe token. A valid token verifies
 * back to its user id (which is what lets the route flip digest_enabled);
 * anything tampered, malformed, or mis-keyed is a quiet null.
 */

const SECRET = 'test-secret-for-the-suite';
const USER_ID = '6f1d2c3b-4a59-4e8d-9c70-1234567890ab';

describe('the unsubscribe token', () => {
  it('verifies a valid token back to the user id', () => {
    const token = createUnsubscribeToken(USER_ID, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(USER_ID);
  });

  it('rejects a token whose payload was swapped for another user', () => {
    const token = createUnsubscribeToken(USER_ID, SECRET);
    const signature = token.split('.')[1];
    const otherUser = Buffer.from('someone-else', 'utf8').toString(
      'base64url'
    );
    expect(verifyUnsubscribeToken(`${otherUser}.${signature}`, SECRET)).toBe(
      null
    );
  });

  it('rejects a token with a tampered signature', () => {
    const token = createUnsubscribeToken(USER_ID, SECRET);
    const flipped = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    expect(verifyUnsubscribeToken(flipped, SECRET)).toBe(null);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createUnsubscribeToken(USER_ID, 'another-secret');
    expect(verifyUnsubscribeToken(token, SECRET)).toBe(null);
  });

  it('rejects garbage without throwing', () => {
    expect(verifyUnsubscribeToken('not-a-token', SECRET)).toBe(null);
    expect(verifyUnsubscribeToken('a.b.c', SECRET)).toBe(null);
    expect(verifyUnsubscribeToken('.signature-only', SECRET)).toBe(null);
    expect(verifyUnsubscribeToken('payload-only.', SECRET)).toBe(null);
    expect(verifyUnsubscribeToken('', SECRET)).toBe(null);
    expect(verifyUnsubscribeToken(null, SECRET)).toBe(null);
    expect(verifyUnsubscribeToken(undefined, SECRET)).toBe(null);
  });

  it('rejects any token when the secret is missing', () => {
    const token = createUnsubscribeToken(USER_ID, SECRET);
    expect(verifyUnsubscribeToken(token, undefined)).toBe(null);
  });

  it('refuses to create a token without a secret', () => {
    expect(() => createUnsubscribeToken(USER_ID, undefined)).toThrow(
      'UNSUBSCRIBE_SECRET'
    );
  });
});
