import { createAdminClient } from '../../../lib/supabase/admin';
import { verifyUnsubscribeToken } from '../../../lib/digest/unsubscribeToken';

/**
 * GET /api/unsubscribe?token= - honour an unsubscribe click (M7.3).
 *
 * Validates the HMAC-signed token from the digest email, flips the user's
 * digest_enabled to false, and shows a one-line confirmation page. No login
 * required: the signature is the proof, and a tampered or malformed token
 * gets a calm refusal, never a crash. The admin client does the one write
 * because there is no session here.
 */

export const dynamic = 'force-dynamic';

// Brand values from globals.css, inlined: this tiny page renders outside
// the app shell and loads no stylesheet.
function page(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>PULSE digest</title>
</head>
<body style="margin: 0; min-height: 100vh; display: grid; place-items: center; background-color: #F2F0F4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <main style="max-width: 460px; margin: 16px; background: #ffffff; border-radius: 12px; padding: 32px;">
    <p style="margin: 0; font-size: 14px; font-weight: 800; letter-spacing: 0.12em; color: #376183;">PULSE</p>
    <div style="width: 40px; height: 3px; background-color: #F4C031; margin-top: 4px;"></div>
    <p style="margin: 20px 0 0; font-size: 15px; line-height: 1.55; color: #376183;">${message}</p>
  </main>
</body>
</html>`;
}

function htmlResponse(message, status) {
  return new Response(page(message), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  const admin = createAdminClient();
  if (!secret || !admin) {
    return htmlResponse(
      'This link cannot be processed right now. Please try again later.',
      503
    );
  }

  const token = new URL(request.url).searchParams.get('token');
  const userId = verifyUnsubscribeToken(token, secret);
  if (!userId) {
    return htmlResponse('This unsubscribe link is not valid.', 400);
  }

  const { error } = await admin
    .from('profiles')
    .update({ digest_enabled: false })
    .eq('id', userId);
  if (error) {
    return htmlResponse(
      'We could not update your preference. Please try again later.',
      500
    );
  }

  return htmlResponse(
    'You are unsubscribed. The weekly digest will not email you again.',
    200
  );
}
