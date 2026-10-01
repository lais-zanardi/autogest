module.exports = {
  root: true,
  extends: [require.resolve('./packages/eslint-config/index.js')],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.gradle/',
    'android/',
    'ios/',
    'coverage/',
  ],
};
