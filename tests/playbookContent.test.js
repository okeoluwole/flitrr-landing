import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePlaybookContent,
  parsePlaybookDocuments,
} from '../lib/playbook/playbookContent.js';

/**
 * Part C (M7.4) parser: a valid fixture parses; malformed fixtures fail
 * loudly with the right error naming the slug and field; the real agreed
 * content files parse with the expected per-stage counts.
 */

const VALID_BLOCK = `
Some prose around the block is ignored.

\`\`\`
play: pi-insurance-check
type: action
stage: 2
jurisdiction: general
title: Confirm professional indemnity insurance for every consultant
why: If a consultant's design fails years later, PI insurance pays for the fix.
objective: quality
always_critical: yes
\`\`\`
`;

// A block builder for malformed fixtures: start from valid fields, then
// override or drop.
function block(overrides = {}, drop = []) {
  const fields = {
    play: 'sample-play',
    type: 'action',
    stage: '2',
    jurisdiction: 'general',
    title: 'A sample title',
    why: 'A sample why line.',
    objective: 'cost',
    always_critical: 'no',
    ...overrides,
  };
  for (const field of drop) delete fields[field];
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return ['```', ...lines, '```'].join('\n');
}

describe('the playbook parser', () => {
  it('parses a valid block with typed fields', () => {
    const plays = parsePlaybookContent(VALID_BLOCK, 'fixture');
    expect(plays).toHaveLength(1);
    expect(plays[0]).toEqual({
      slug: 'pi-insurance-check',
      type: 'action',
      stage: 2,
      jurisdiction: 'general',
      title: 'Confirm professional indemnity insurance for every consultant',
      why: "If a consultant's design fails years later, PI insurance pays for the fix.",
      objective: 'quality',
      always_critical: true,
    });
  });

  it('maps always_critical no to false', () => {
    const [play] = parsePlaybookContent(block(), 'fixture');
    expect(play.always_critical).toBe(false);
  });

  it('fails loudly on a missing field, naming the slug and field', () => {
    expect(() =>
      parsePlaybookContent(block({}, ['why']), 'fixture')
    ).toThrow('play "sample-play": field "why" is missing');
  });

  it('fails loudly on a bad type enum', () => {
    expect(() =>
      parsePlaybookContent(block({ type: 'reminder' }), 'fixture')
    ).toThrow('field "type" has invalid value "reminder"');
  });

  it('fails loudly on a bad objective enum', () => {
    expect(() =>
      parsePlaybookContent(block({ objective: 'budget' }), 'fixture')
    ).toThrow('field "objective" has invalid value "budget"');
  });

  it('fails loudly on a bad always_critical value', () => {
    expect(() =>
      parsePlaybookContent(block({ always_critical: 'maybe' }), 'fixture')
    ).toThrow('field "always_critical" has invalid value "maybe"');
  });

  it('fails loudly on a stage outside the framework', () => {
    expect(() =>
      parsePlaybookContent(block({ stage: '9' }), 'fixture')
    ).toThrow('field "stage" has invalid value "9"');
    expect(() =>
      parsePlaybookContent(block({ stage: 'two' }), 'fixture')
    ).toThrow('field "stage" has invalid value "two"');
  });

  it('fails loudly on an unknown field (a typo never seeds silently)', () => {
    const withTypo = block().replace('objective:', 'objectve:');
    expect(() => parsePlaybookContent(withTypo, 'fixture')).toThrow(
      'field "objectve" is not a recognised field'
    );
  });

  it('fails loudly on a duplicate slug within one document', () => {
    const doubled = `${block()}\n\n${block({ title: 'Another title' })}`;
    expect(() =>
      parsePlaybookDocuments([{ source: 'fixture', content: doubled }])
    ).toThrow('play "sample-play": field "play" duplicates a slug');
  });

  it('fails loudly on a duplicate slug across documents', () => {
    expect(() =>
      parsePlaybookDocuments([
        { source: 'one.md', content: block() },
        { source: 'two.md', content: block() },
      ])
    ).toThrow('two.md: play "sample-play": field "play" duplicates a slug already defined in one.md');
  });

  it('fails on an unclosed fence rather than guessing', () => {
    const unclosed = '```\nplay: sample-play\ntype: action';
    expect(() => parsePlaybookContent(unclosed, 'fixture')).toThrow(
      'unclosed fenced block'
    );
  });
});

describe('the agreed content files', () => {
  const dir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'content',
    'playbooks'
  );

  const read = (name) => ({
    source: name,
    content: fs.readFileSync(path.join(dir, name), 'utf8'),
  });

  it('parse cleanly with the expected per-stage counts', () => {
    const plays = parsePlaybookDocuments([
      read('pulse_playbook_stage_2.md'),
      read('pulse_playbook_stage_3.md'),
    ]);

    const count = (stage, type) =>
      plays.filter((p) => p.stage === stage && p.type === type).length;

    // The agreed content: Stage 2 ten action and four risk plays, Stage 3
    // nine action and four risk plays.
    expect(count(2, 'action')).toBe(10);
    expect(count(2, 'risk')).toBe(4);
    expect(count(3, 'action')).toBe(9);
    expect(count(3, 'risk')).toBe(4);
    expect(plays).toHaveLength(27);
  });

  it('carry the two agreed always-critical plays, both at Stage 2', () => {
    const plays = parsePlaybookDocuments([
      read('pulse_playbook_stage_2.md'),
      read('pulse_playbook_stage_3.md'),
    ]);
    const alwaysCritical = plays
      .filter((p) => p.always_critical)
      .map((p) => p.slug)
      .sort();
    expect(alwaysCritical).toEqual([
      'pi-insurance-check',
      'statutory-duty-holders',
    ]);
  });
});
