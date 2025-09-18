module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/scripts/**',
    '!src/app.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/src/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  testTimeout: 30000,
  verbose: true
};