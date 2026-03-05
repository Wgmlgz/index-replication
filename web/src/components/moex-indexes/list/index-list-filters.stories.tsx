import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { MoexIndexListProvider } from './moex-indexes-list-context';
import { IndexListFilters } from './index-list-filters';
import { createStorybookMoexListState } from './storybook-state';

const meta = {
  title: 'MOEX/IndexListFilters',
  component: IndexListFilters,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story, context) => {
      const variant = context.parameters.variant as string | undefined;
      const baseState = createStorybookMoexListState({
        filterOptions: {
          collections: [
            { value: 'blue', label: 'Blue chips', count: 12 },
            { value: 'banks', label: 'Banks', count: 5 },
          ],
          currency: [{ value: 'RUB', label: 'RUB', count: 20 }],
          board: [{ value: 'TQBR', label: 'TQBR', count: 20 }],
          calcMode: [{ value: 'Price', label: 'Price', count: 20 }],
        },
      });

      const value =
        variant === 'active'
          ? createStorybookMoexListState({
              ...baseState,
              hasActiveFilters: true,
              filters: {
                ...baseState.filters,
                collections: ['blue'],
              },
            })
          : variant === 'loading'
            ? createStorybookMoexListState({
                ...baseState,
                collectionsLoading: true,
              })
            : baseState;

      return (
        <MoexIndexListProvider value={value}>
          <Story />
        </MoexIndexListProvider>
      );
    },
  ],
} satisfies Meta<typeof IndexListFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ActiveFilters: Story = {
  parameters: {
    variant: 'active',
  },
};

export const LoadingCollections: Story = {
  parameters: {
    variant: 'loading',
  },
};
