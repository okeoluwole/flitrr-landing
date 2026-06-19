import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabase/admin';
import { OBJECTIVE_META } from '../../pulse/app/components/objectiveMeta';
import {
  digestRunKey,
  filterRecipients,
  buildUserDigest,
} from '../../../lib/digest/digestModel';
import {
  DIGEST_SUBJECT,
  buildDigestHtml,
  buildDigestText,
} from '../../../lib/digest/digestEmail';
import { createUnsubscribeToken } from '../../../lib/digest/unsubscribeToken';

/**
 * GET /api/digest - the weekly digest job (M7.3).
 *
 * Triggered by Vercel cron (vercel.json, Monday 06:00 UTC) with the
 * CRON_SECRET bearer header, or manually with ?secret= for testing. For
 * each user with the digest on, it gathers the open tracked actions across
 * their projects, selects the live must-hold ones (A6), frames each project by
 * the gate it is working toward, and sends one email via Resend. A user with
 * nothing to say gets nothing. Each send is recorded in digest_sends keyed by
 * the week's run key, so one scheduled run can never email a user twice.
 *
 * Degrades gracefully: missing configuration is a clear 503, never a crash.
 * Everything selected, ordered, and written is deterministic (the pure
 * model in lib/digest); this route is only data in, emails out.
 */

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://flitrr.com';
const APP_URL = `${SITE_URL}/pulse/app`;
const FROM = 'PULSE <pulse@flitrr.com>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

// The cron header, or the query parameter for manual testing.
function isAuthorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get('secret') === secret;
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 });
  }

  // Configuration check, all at once, so one clear message names
  // everything still to set. Nothing crashes on a missing key.
  const missing = [];
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!process.env.UNSUBSCRIBE_SECRET) missing.push('UNSUBSCRIBE_SECRET');
  const admin = createAdminClient();
  if (!admin) missing.push('SUPABASE_SECRET_KEY');
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `The digest is not configured. Set ${missing.join(', ')} and try again.`,
      },
      { status: 503 }
    );
  }

  const runKey = digestRunKey(Date.now());

  // Opted-in users, and who this run has already emailed.
  const { data: profiles, error: profilesErr } = await admin
    .from('profiles')
    .select('id, email, digest_enabled')
    .eq('digest_enabled', true);
  if (profilesErr) {
    return NextResponse.json(
      { error: 'Could not read profiles.' },
      { status: 500 }
    );
  }

  const { data: prior, error: priorErr } = await admin
    .from('digest_sends')
    .select('user_id')
    .eq('run_key', runKey);
  if (priorErr) {
    return NextResponse.json(
      { error: 'Could not read digest_sends.' },
      { status: 500 }
    );
  }

  const alreadySentIds = new Set((prior ?? []).map((r) => r.user_id));
  const recipients = filterRecipients(profiles, alreadySentIds);

  const counts = {
    run_key: runKey,
    sent: 0,
    skipped_quiet: 0,
    skipped_already_sent: alreadySentIds.size,
    failed: 0,
  };

  if (recipients.length === 0) {
    return NextResponse.json(counts);
  }

  // The recipients' projects (with stage, for the gate framing), and the
  // digest candidates across them: all open tracked actions, from which the
  // pure model selects the live must-hold ones (A6) and reads the gate.
  const userIds = recipients.map((u) => u.id);
  const { data: projects, error: projectsErr } = await admin
    .from('projects')
    .select('id, name, user_id, current_stage')
    .in('user_id', userIds);
  if (projectsErr) {
    return NextResponse.json(
      { error: 'Could not read projects.' },
      { status: 500 }
    );
  }

  const projectIds = (projects ?? []).map((p) => p.id);
  let actions = [];
  let objectives = [];
  if (projectIds.length > 0) {
    const [actionsRes, objectivesRes] = await Promise.all([
      admin
        .from('project_actions')
        .select(
          'id, project_id, description, linked_objective_id, criticality_override, status, created_at, stage'
        )
        .in('project_id', projectIds)
        .neq('status', 'done'),
      admin
        .from('project_objectives')
        .select('id, objective_type, classification')
        .in('project_id', projectIds),
    ]);
    if (actionsRes.error || objectivesRes.error) {
      return NextResponse.json(
        { error: 'Could not read project actions.' },
        { status: 500 }
      );
    }
    actions = actionsRes.data ?? [];
    objectives = objectivesRes.data ?? [];
  }

  const objectivesById = Object.fromEntries(
    objectives.map((o) => [
      o.id,
      {
        classification: o.classification,
        name: NAME_BY_TYPE[o.objective_type] ?? null,
      },
    ])
  );

  for (const user of recipients) {
    const ownProjects = (projects ?? []).filter(
      (p) => p.user_id === user.id
    );
    const digest = buildUserDigest(ownProjects, actions, objectivesById);

    // The digest only speaks when there is something to say.
    if (digest.totalCount === 0) {
      counts.skipped_quiet += 1;
      continue;
    }

    const token = createUnsubscribeToken(
      user.id,
      process.env.UNSUBSCRIBE_SECRET
    );
    const unsubscribeUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;

    const sendRes = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [user.email],
        subject: DIGEST_SUBJECT,
        html: buildDigestHtml(digest, unsubscribeUrl, APP_URL),
        text: buildDigestText(digest, unsubscribeUrl, APP_URL),
      }),
    });

    if (!sendRes.ok) {
      // Not recorded, so the next trigger of this run retries this user.
      counts.failed += 1;
      continue;
    }

    // Record the send. A unique violation here means a concurrent trigger
    // recorded it first; either way the row exists, which is the guard.
    await admin.from('digest_sends').insert({
      user_id: user.id,
      run_key: runKey,
      summary: {
        projects: digest.projects.map((p) => ({
          name: p.name,
          actions: p.actions.length,
        })),
        total: digest.totalCount,
      },
    });
    counts.sent += 1;
  }

  return NextResponse.json(counts);
}
