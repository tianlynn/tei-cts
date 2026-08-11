import { readFileSync } from 'node:fs';

/**
 * Test-only access to the committed excerpts in `fixtures/`.
 *
 * Not part of the published package: the fixtures are real Perseus text under
 * CC BY-SA 4.0 and are excluded from the npm tarball, which ships MIT-licensed
 * code only. See `fixtures/ATTRIBUTION.md`.
 */

const DIR = new URL('../fixtures/', import.meta.url);

export const readFixture = (name: string): string => readFileSync(new URL(name, DIR), 'utf8');
