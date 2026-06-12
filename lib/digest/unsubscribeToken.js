import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Unsubscribe tokens (M7.3). An HMAC-signed token that lets one click in an
 * email flip digest_enabled off with no login, while making it impossible to
 * unsubscribe anyone else: the signature binds the user id to the server's
 * UNSUBSCRIBE_SECRET, so a tampered id fails verification.
 *
 * Token shape: base64url(userId) + '.' + hex(HMAC-SHA256(purpose:userId)).
 * The purpose prefix scopes the signature to this one use, so the same
 * secret could sign other token kinds later without cross-validity.
 *
 * Deterministic on purpose: no expiry and no nonce, so the link in an old
 * digest keeps working (an unsubscribe link that has stopped working is a
 * spam complaint). Verification is constant-time.
 */

const PURPOSE = 'digest-unsubscribe';

function sign(userId, secret) {
  return createHmac('sha256', secret)
    .update(`${PURPOSE}:${userId}`)
    .digest('hex');
}

/** The token for a user id. Throws if the secret is missing (callers check
 *  configuration before building emails). */
export function createUnsubscribeToken(userId, secret) {
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not configured.');
  const payload = Buffer.from(String(userId), 'utf8').toString('base64url');
  return `${payload}.${sign(userId, secret)}`;
}

/**
 * Verify a token. Returns the user id when the signature is valid, null for
 * anything else: missing, malformed, or tampered. Never throws on bad
 * input; a garbage token is a quiet null.
 */
export function verifyUnsubscribeToken(token, secret) {
  if (!secret || typeof token !== 'string') return null;

  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;

  let userId;
  try {
    userId = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!userId) return null;

  const given = Buffer.from(token.slice(dot + 1), 'utf8');
  const expected = Buffer.from(sign(userId, secret), 'utf8');
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  return userId;
}
