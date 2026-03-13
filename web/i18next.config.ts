import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    output: 'src/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'common',
    keySeparator: '.',
    sort: false,
    extractFromComments: false,
    removeUnusedKeys: true,
    preservePatterns: [
      'landing.features.*.title',
      'landing.features.*.description',
      'navigation.cards.*',
      'navigation.portfolio.*',
      'tbankTest.menu.*',
      'settings.telegram.errors.*',
      'moex.groups.uncategorized',
      'moex.filters.*',
      'moex.sort.*',
      'moex.chart.*',
      'moex.composition.*',
      'portfolio.chart.*',
      'portfolio.composition.*',
      'portfolio.replication.modeOptions.*',
      'portfolio.composition.compare.status.*',
    ],
  },
});
