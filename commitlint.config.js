import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { packages } = JSON.parse(
  readFileSync(join(__dirname, 'release-please-config.json'), 'utf-8'),
);

const sections = packages['.']['changelog-sections'];
const types = sections.map(({ type }) => type);
const czTypes = sections.map(({ type, section, hidden }) => ({
  value: type,
  name: `${type.padEnd(9)}: ${section}${hidden ? '  [hidden]' : ''}`,
}));

/** @type {import('cz-git').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', types],
  },
  prompt: {
    types: czTypes,
    skipQuestions: ['scope', 'footerPrefix', 'footer'],
  },
};
