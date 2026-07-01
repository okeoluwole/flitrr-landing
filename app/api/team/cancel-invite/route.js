import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';

/**
 * Cancel a pending invite. Admin only.
 *
 * Two parts. First, the cancel_invitation function marks the pending row
 * cancelled (admin-scoped, and only while it is still pending, so a cancel that
 * races an acceptance is a clean no-op) and returns the row. Second, best
 * effort, revoke the unaccepted auth invite by deleting the invited,
 * still-unconfirmed auth user, so the email is fully free to invite again.
 */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const invitationId =
    typeof body.invitationId === 'string' ? body.invitationId : '';
  if (!invitationId) {
    return NextResponse.json({ error: 'Missing invite.' }, { status: 400 });
  }

  const { data: cancelled, error: cancelErr } = await supabase.rpc(
    'cancel_invitation',
    { invitation_id: invitationId }
  );
  if (cancelErr) {
    const status = cancelErr.code === '42501' ? 403 : 409;
    return NextResponse.json({ error: cancelErr.message }, { status });
  }

  // Revoke the unaccepted auth invite. Best effort: the cancel above already
  // succeeded, so a failure here does not fail the request.
  const admin = createAdminClient();
  if (admin) {
    let targetId = cancelled?.invited_user_id || null;
    if (!targetId && cancelled?.email) {
      const { data: list } = await admin.auth.admin.listUsers();
      const match = list?.users?.find(
        (u) => (u.email || '').toLowerCase() === cancelled.email.toLowerCase()
      );
      targetId = match?.id || null;
    }
    if (targetId) {
      // Only delete a genuinely unaccepted (unconfirmed) auth user, so we never
      // remove someone who has just accepted.
      const { data: got } = await admin.auth.admin.getUserById(targetId);
      if (got?.user && !got.user.email_confirmed_at) {
        await admin.auth.admin.deleteUser(targetId);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
