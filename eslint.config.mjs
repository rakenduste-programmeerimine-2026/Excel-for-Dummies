import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  // App Router only: there is no pages/ directory.
  { rules: { '@next/next/no-html-link-for-pages': 'off' } },
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', 'lib/types.db.ts'] },
];

export default config;
