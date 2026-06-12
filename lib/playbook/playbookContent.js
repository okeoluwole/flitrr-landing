/**
 * Playbook content parser (M7.4). Pure, strict parsing and validation of
 * the agreed playbook content files (content/playbooks/*.md), shared by the
 * seed generator (scripts/seed-playbooks.js) and the test suite. No
 * filesystem access here: callers pass content in.
 *
 * The format, per the M7.4 spec: each play is a fenced code block of
 * labelled single-line fields:
 *
 *   ```
 *   play: pi-insurance-check
 *   type: action
 *   stage: 2
 *   jurisdiction: general
 *   title: ...
 *   why: ...
 *   objective: quality
 *   always_critical: yes
 *   ```
 *
 * Validation is strict and loud: every field present exactly once, no
 * unknown fields, enums valid, stage a framework stage (0 to 7),
 * always_critical exactly yes or no, slugs unique across everything parsed
 * together. Any failure throws naming the slug (or block position) and the
 * field. Never skip silently, never guess: curated content is governance
 * content, and a play that seeds wrongly classifies wrongly on every
 * project.
 */

export const PLAY_FIELDS = [
  'play',
  'type',
  'stage',
  'jurisdiction',
  'title',
  'why',
  'objective',
  'always_critical',
];

const PLAY_TYPES = new Set(['action', 'risk']);
const OBJECTIVES = new Set(['scope', 'cost', 'time', 'quality', 'funding']);
const ALWAYS_CRITICAL = { yes: true, no: false };

// Slugs are kebab-case identifiers; anything else is a typo worth failing.
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

class PlaybookContentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlaybookContentError';
  }
}

function fail(source, label, field, problem) {
  throw new PlaybookContentError(
    `${source}: play ${label}: field "${field}" ${problem}`
  );
}

// Pull the fenced blocks out of a markdown document. An unclosed fence is
// a malformed file, not a skippable one.
function extractBlocks(content, source) {
  const lines = String(content ?? '').split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (current === null) {
        current = [];
      } else {
        blocks.push(current);
        current = null;
      }
      continue;
    }
    if (current !== null) current.push(line);
  }

  if (current !== null) {
    throw new PlaybookContentError(
      `${source}: unclosed fenced block at end of file.`
    );
  }
  return blocks;
}

// Parse one fenced block into a validated play object.
function parseBlock(blockLines, blockIndex, source) {
  const fields = {};
  // Until the slug is known, name the block by its position.
  let label = `block ${blockIndex + 1}`;

  for (const rawLine of blockLines) {
    const line = rawLine.trim();
    if (line === '') continue;

    const colon = line.indexOf(':');
    if (colon <= 0) {
      throw new PlaybookContentError(
        `${source}: play ${label}: malformed line "${line}" (expected "field: value").`
      );
    }

    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();

    if (!PLAY_FIELDS.includes(key)) {
      fail(source, label, key, 'is not a recognised field');
    }
    if (key in fields) {
      fail(source, label, key, 'appears more than once');
    }
    if (value === '') {
      fail(source, label, key, 'is empty');
    }

    fields[key] = value;
    if (key === 'play') label = `"${value}"`;
  }

  for (const field of PLAY_FIELDS) {
    if (!(field in fields)) {
      fail(source, label, field, 'is missing');
    }
  }

  if (!SLUG_RE.test(fields.play)) {
    fail(source, label, 'play', `has an invalid slug "${fields.play}" (kebab-case required)`);
  }
  if (!PLAY_TYPES.has(fields.type)) {
    fail(source, label, 'type', `has invalid value "${fields.type}" (expected action or risk)`);
  }
  if (!/^\d+$/.test(fields.stage) || Number(fields.stage) > 7) {
    fail(source, label, 'stage', `has invalid value "${fields.stage}" (expected a stage 0 to 7)`);
  }
  if (!OBJECTIVES.has(fields.objective)) {
    fail(
      source,
      label,
      'objective',
      `has invalid value "${fields.objective}" (expected scope, cost, time, quality, or funding)`
    );
  }
  if (!(fields.always_critical in ALWAYS_CRITICAL)) {
    fail(
      source,
      label,
      'always_critical',
      `has invalid value "${fields.always_critical}" (expected yes or no)`
    );
  }

  return {
    slug: fields.play,
    type: fields.type,
    stage: Number(fields.stage),
    jurisdiction: fields.jurisdiction,
    title: fields.title,
    why: fields.why,
    objective: fields.objective,
    always_critical: ALWAYS_CRITICAL[fields.always_critical],
  };
}

/**
 * Parse one content document. Returns the plays in file order. Throws a
 * PlaybookContentError naming the slug and field on any failure.
 */
export function parsePlaybookContent(content, source = 'playbook content') {
  const blocks = extractBlocks(content, source);
  return blocks.map((block, i) => parseBlock(block, i, source));
}

/**
 * Parse a set of documents together and enforce slug uniqueness across all
 * of them. documents: [{ source, content }]. Returns all plays in document
 * then file order.
 */
export function parsePlaybookDocuments(documents) {
  const plays = [];
  const seen = new Map();

  for (const doc of documents ?? []) {
    for (const play of parsePlaybookContent(doc.content, doc.source)) {
      if (seen.has(play.slug)) {
        throw new PlaybookContentError(
          `${doc.source}: play "${play.slug}": field "play" duplicates a slug already defined in ${seen.get(play.slug)}.`
        );
      }
      seen.set(play.slug, doc.source);
      plays.push(play);
    }
  }
  return plays;
}
