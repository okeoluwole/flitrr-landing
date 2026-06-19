/**
 * The weekly digest email (M7.3). Pure builders for the subject, the HTML
 * body, and the plain-text alternative, so the email is fully testable
 * without a network call.
 *
 * Register: minimal and on-brand. Brand colours inlined (email clients
 * ignore stylesheets), a system font stack (no webfonts in email), grouped
 * by project, each action with its description and objective. A short calm
 * opening line, no urgency theatre, and the required unsubscribe link.
 * Punctuation discipline: no em dashes or en dashes anywhere.
 */

// Brand values from globals.css, inlined for email clients.
const CREAM = '#F2F0F4';
const DEEP_BLUE = '#376183';
const GREY_BLUE = '#7793A8';
const AMBER = '#F4C031';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const DIGEST_SUBJECT = 'PULSE: your critical actions this week';

const OPENING_LINE =
  'The must-hold actions open across your projects, with the gate each is working toward.';

// Escape user content (project names, action descriptions) for HTML.
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// The proportional gate framing for a project (A6): its stage and what stands
// before the gate it is working toward. App-generated, no user content.
export function gateSentence(project) {
  const n = project.gate.open;
  if (n === 0) {
    return `Stage ${project.stage}, ${project.stageName}.`;
  }
  const verb = n === 1 ? 'action bears' : 'actions bear';
  const critical =
    project.gate.critical > 0 ? `, ${project.gate.critical} critical` : '';
  return `Stage ${project.stage}, ${project.stageName}. ${n} open ${verb} on ${project.gateLabel}${critical}.`;
}

/**
 * The HTML body. digest is buildUserDigest's output ({ projects,
 * totalCount }); unsubscribeUrl and appUrl are absolute.
 */
export function buildDigestHtml(digest, unsubscribeUrl, appUrl) {
  const projectBlocks = digest.projects
    .map((project) => {
      const items = project.actions
        .map((action) => {
          const objective = action.objectiveName
            ? `<span style="color: ${GREY_BLUE};"> for ${escapeHtml(action.objectiveName)}</span>`
            : '';
          return `<tr><td style="padding: 6px 0; font-size: 15px; line-height: 1.5; color: ${DEEP_BLUE};">${escapeHtml(action.description)}${objective}</td></tr>`;
        })
        .join('');

      return `
        <tr><td style="padding: 18px 0 2px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${GREY_BLUE};">${escapeHtml(project.name)}</td></tr>
        <tr><td style="padding: 0 0 4px; font-size: 13px; line-height: 1.5; color: ${GREY_BLUE};">${escapeHtml(gateSentence(project))}</td></tr>
        ${items}`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin: 0; padding: 0; background-color: ${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${CREAM}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; padding: 32px; font-family: ${FONT_STACK};">
          <tr><td style="font-size: 14px; font-weight: 800; letter-spacing: 0.12em; color: ${DEEP_BLUE};">PULSE</td></tr>
          <tr><td style="padding-top: 4px;"><div style="width: 40px; height: 3px; background-color: ${AMBER};"></div></td></tr>
          <tr><td style="padding: 20px 0 4px; font-size: 15px; line-height: 1.5; color: ${DEEP_BLUE};">${OPENING_LINE}</td></tr>
          ${projectBlocks}
          <tr><td style="padding-top: 28px; font-size: 13px; line-height: 1.5; color: ${GREY_BLUE}; border-top: 1px solid ${CREAM};">
            <a href="${appUrl}" style="color: ${DEEP_BLUE};">Open PULSE</a> to review or update them.
          </td></tr>
          <tr><td style="padding-top: 16px; font-size: 12px; line-height: 1.5; color: ${GREY_BLUE};">
            You receive this weekly digest because it is on for your account.
            <a href="${unsubscribeUrl}" style="color: ${GREY_BLUE};">Unsubscribe</a>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** The plain-text alternative, same content, same calm register. */
export function buildDigestText(digest, unsubscribeUrl, appUrl) {
  const lines = [OPENING_LINE, ''];
  for (const project of digest.projects) {
    lines.push(project.name.toUpperCase());
    lines.push(gateSentence(project));
    for (const action of project.actions) {
      lines.push(
        action.objectiveName
          ? `- ${action.description} (for ${action.objectiveName})`
          : `- ${action.description}`
      );
    }
    lines.push('');
  }
  lines.push(`Open PULSE to review or update them: ${appUrl}`);
  lines.push('');
  lines.push(
    'You receive this weekly digest because it is on for your account.'
  );
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);
  return lines.join('\n');
}
