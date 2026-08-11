module.exports = {
  extends: ['../../.eslintrc.cjs', 'next/core-web-vitals'],
  settings: {
    next: {
      rootDir: 'apps/admin/',
    },
  },
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
  },
};
