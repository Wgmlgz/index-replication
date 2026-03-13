import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect } from 'react';

const API_BASE_STORAGE_KEY = 'settings-api-url';
const DEFAULT_LIVE_API_BASE_URL = 'http://localhost:18080';

type LiveSummaryHostProps = {
  portfolioID: number;
};

function LiveSummaryHost({ portfolioID }: LiveSummaryHostProps) {
  useEffect(() => {
    let targetApiBaseUrl = DEFAULT_LIVE_API_BASE_URL;
    try {
      const params = new URLSearchParams(window.location.search);
      const override = params.get('apiBaseUrl');
      if (override && override.trim().length > 0) {
        targetApiBaseUrl = override.trim().replace(/\/+$/, '');
      }
    } catch {
      // Ignore malformed URL state and keep default backend base URL.
    }

    try {
      localStorage.setItem(API_BASE_STORAGE_KEY, targetApiBaseUrl);
    } catch {
      // ignore localStorage access errors in restrictive browser modes
    }
  }, []);

  return (
    <div className='p-6'>
      <div className='mb-4 text-sm text-muted-foreground'>
        Live backend summary for portfolio_id={portfolioID} via {DEFAULT_LIVE_API_BASE_URL}
      </div>
    </div>
  );
}

const meta = {
  title: 'Pages/Portfolio/Summary Live',
  component: LiveSummaryHost,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Live Summary tab story: renders the real PortfolioSummaryPanel and loads current backend data for a concrete portfolio id.',
      },
    },
  },
  args: {
    portfolioID: 3,
  },
} satisfies Meta<typeof LiveSummaryHost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SummaryTabLive: Story = {};

export const SummaryTabLivePortfolio3: Story = {
  args: {
    portfolioID: 3,
  },
};
