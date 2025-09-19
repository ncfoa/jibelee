module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: [
    'airbnb-base'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'consistent-return': 'off',
    'no-param-reassign': ['error', { props: false }],
    'max-len': ['error', { code: 120 }],
    'comma-dangle': ['error', 'never'],
    'object-curly-newline': 'off',
    'no-underscore-dangle': 'off',
    'class-methods-use-this': 'off',
    'import/no-dynamic-require': 'off',
    'global-require': 'off'
  },
  overrides: [
    {
      files: ['src/tests/**/*.js', '**/*.test.js'],
      rules: {
        'no-unused-expressions': 'off'
      }
    }
  ]
};