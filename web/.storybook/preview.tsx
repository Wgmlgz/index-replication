import type { Preview } from '@storybook/nextjs-vite';
import React from 'react';
import { initialize, mswLoader } from 'msw-storybook-addon';

import '../src/app/globals.css';
import { storybookDefaultHandlers } from '../src/mocks/storybook/handlers';
import { StorybookAppProviders } from '../src/storybook/storybook-app-providers';

initialize({
  onUnhandledRequest: ({ method, url }) => {
    if (url.pathname.startsWith('/_next/')) {
      return;
    }

    // Keep signal without breaking rendering when a story forgets a handler.
    // eslint-disable-next-line no-console
    console.warn(`[MSW] Unhandled ${method} ${url.href}`);
  },
});

const preview: Preview = {
  loaders: [mswLoader],
  decorators: [
    Story => (
      <StorybookAppProviders>
        <Story />
      </StorybookAppProviders>
    ),
  ],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    msw: {
      handlers: storybookDefaultHandlers,
    },
  },
};

export default preview;
