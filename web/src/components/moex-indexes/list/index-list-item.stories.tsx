import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import type { MoexIndex } from '@/api-client';
import { MoexIndexListProvider } from './moex-indexes-list-context';
import { createStorybookMoexListState } from './storybook-state';
import { IndexListItem } from './index-list-item';

const sampleIndex: MoexIndex = {
  secid: 'IMOEX',
  shortName: 'MOEX Russia Index',
  name: 'Moscow Exchange Russia Index',
  currency: 'RUB',
  boardId: 'SNDX',
  calcMode: 'Price',
  lastActiveDate: '2025-11-01',
};

const meta = {
  title: 'MOEX/IndexListItem',
  component: IndexListItem,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story, context) => {
      const selectedSecid = context.args.index?.secid === 'IMOEX' ? 'IMOEX' : null;
      const favorites = context.args.index?.secid === 'IMOEX' ? new Set(['IMOEX']) : new Set<string>();

      return (
        <MoexIndexListProvider
          value={createStorybookMoexListState({
            selectedSecid,
            favoritesSet: favorites,
            indexCollectionsMap: {
              IMOEX: ['Blue chips', 'Core allocation', 'Benchmark'],
            },
          })}
        >
          <Story />
        </MoexIndexListProvider>
      );
    },
  ],
  args: {
    index: sampleIndex,
    showCollections: true,
  },
} satisfies Meta<typeof IndexListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutCollections: Story = {
  args: {
    showCollections: false,
  },
};

export const InactiveFavorite: Story = {
  args: {
    index: {
      ...sampleIndex,
      secid: 'IMOEX2',
      shortName: 'Legacy Index',
      lastActiveDate: '2025-01-10',
    },
  },
};
