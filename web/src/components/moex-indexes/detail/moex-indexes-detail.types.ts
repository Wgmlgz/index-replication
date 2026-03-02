import type { MoexIndex as MoexIndex } from '@/api-client';

export type MoexIndexDetailState = {
  selectedIndex: MoexIndex | null;
  selectedIndexCollections: string[];
  error: string | null;
};
