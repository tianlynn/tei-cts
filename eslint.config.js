import tseslint from 'typescript-eslint';

export default tseslint.config(
  // This file is JavaScript, so the type-aware rules have no project to read it
  // from; linting it would mean adding it to the TypeScript program for nothing.
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.js'] },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // The two house conventions that are otherwise only vibes: no default
      // exports anywhere, and `type` modifiers inline on imports.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'this package uses named exports only',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    // Config files are the one place a default export is the required shape.
    files: ['*.config.ts', 'eslint.config.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      // Tests deliberately feed malformed values to the parser.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
