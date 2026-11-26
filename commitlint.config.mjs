// Angular commit convention, as defined in CLAUDE.md (Git workflow).
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'test', 'refactor', 'docs', 'chore', 'ci', 'perf', 'style', 'build']],
    'scope-enum': [2, 'always', ['db', 'calc', 'excel', 'api', 'ui', 'auth', 'e2e', 'ci']],
    // subject-case: the conventional default (no Sentence/Start/Pascal/UPPER case), so code names like calcRows are fine.
    'header-max-length': [2, 'always', 72],
    // Bodies may quote file names, Estonian text and long URLs.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};

export default config;
