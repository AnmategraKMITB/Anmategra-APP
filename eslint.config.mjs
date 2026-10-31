import nextVitals from 'eslint-config-next/core-web-vitals';
import drizzle from 'eslint-plugin-drizzle';
import tseslint from 'typescript-eslint';

const drizzleObjectName = ['db', 'ctx.db'];

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'src/components/ui/**',
      'docs/**',
      'drizzle/**',
      'public/**',
    ],
  },
  ...nextVitals,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { drizzle },
    rules: {
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'drizzle/enforce-delete-with-where': ['error', { drizzleObjectName }],
      'drizzle/enforce-update-with-where': ['error', { drizzleObjectName }],
    },
  },
);
