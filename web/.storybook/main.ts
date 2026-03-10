import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/nextjs-vite',
  staticDirs: ['../public'],
  docs: {
    autodocs: 'tag',
  },
  viteFinal: async viteConfig => {
    const proxyTarget = process.env.STORYBOOK_API_PROXY_TARGET || 'http://localhost:18080';
    viteConfig.server = viteConfig.server ?? {};
    viteConfig.server.proxy = {
      ...(viteConfig.server.proxy ?? {}),
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    };

    return viteConfig;
  },
};

export default config;
