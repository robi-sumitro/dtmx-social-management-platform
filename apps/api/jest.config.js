module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  moduleNameMapper: {
    '^@dtmx/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@dtmx/config$': '<rootDir>/../../packages/config/src/index.ts',
  },
};
