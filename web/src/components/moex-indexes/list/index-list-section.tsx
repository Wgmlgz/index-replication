'use client';

import type { MoexIndex as MoexIndex } from '@/api-client';
import { IndexListItem } from './index-list-item';

type IndexListSectionProps = {
  title: string;
  indexes: MoexIndex[];
  showCollections?: boolean;
};

export function IndexListSection({
  title,
  indexes,
  showCollections = false,
}: IndexListSectionProps) {
  if (indexes.length === 0) return null;

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground'>
        <span>{title}</span>
        <span>{indexes.length}</span>
      </div>
      <div className='space-y-2'>
        {indexes.map((index) => (
          <IndexListItem
            key={index.secid}
            index={index}
            showCollections={showCollections}
          />
        ))}
      </div>
    </div>
  );
}
