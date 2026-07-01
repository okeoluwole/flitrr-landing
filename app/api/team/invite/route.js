import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';

/**
 * Invite a member by email. Admin only.
 *
 * Order matters. The pending_invitations row is written first (by the
 * create_pending_invitation function, which also checks the caller is an admin,
 * the one-organisation rule, that a seat is free, and that the email is not
 * already a live invite, all atomically), THEN the Supabase invite email is
 * sent. The sign-up trigger reads that pending row when the invited auth user is
 * created, so the row has to exist before the invite call.
 *
 * pending_invitations has no client write policy, so the post-invite write of
 * invited_user_id and any rollback go through the service-role admin client.
 * The admin client is also what sends the invite, so it is checked up front:
 * if it is not configured we stop before writing anything.
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
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json({ error: 'Enter an email address.' }, { status: 400 });
  }

  // The Auth admin API (and the invite row writes) need the service role. Check
  // it before writing anything, so we never strand a pending row we cannot
  // clean up.
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        error:
          'Invites are not configured on the server. Set SUPABASE_SECRET_KEY and try again.',
      },
      { status: 500 }
    );
  }

  // Atomic admin check, one-organisation check, seat check and pending-row
  // write. The function raises clean, user-readable messages.
  const { data: invite, error: createErr } = await supabase.rpc(
    'create_pending_invitation',
    { invite_email: email }
  );
  if (createErr) {
    const status = createErr.code === '42501' ? 403 : 400;
    return NextResponse.json({ error: createErr.message }, { status });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
    '/reset-password?welcome=1'
  )}`;

  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(invite.email, { redirectTo });

  if (inviteErr) {
    // Could not send the invite. Roll the pending row back (via the service
    // role, since there is no client write policy) so the email can be invited
    // again later and the seat is freed.
    await admin.from('pending_invitations').delete().eq('id', invite.id);
    const already = /already|registered|exist/i.test(inviteErr.message || '');
    const error = already
      ? 'That email already belongs to an account and cannot be invited. A person can belong to only one organisation.'
      : 'Could not send the invite. Please try again.';
    return NextResponse.json({ error }, { status: 400 });
  }

  // Record the invited auth user so a later cancel can revoke the invite.
  if (invited?.user?.id) {
    await admin
      .from('pending_invitations')
      .update({ invited_user_id: invited.user.id })
      .eq('id', invite.id);
  }

  return NextResponse.json({ ok: true, email: invite.email });
}
