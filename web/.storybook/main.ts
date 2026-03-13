import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/nextjs-vite',
  staticDirs: ['../public'],
  docs: {
    autodocs: 'tag',
  },
  env: env => {
    const nextApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:18080';
    return {
      ...env,
      NEXT_PUBLIC_API_BASE_URL: nextApiBaseUrl,
    };
  },
};

export default config;
