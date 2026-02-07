'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMoexIndexesContext } from './moex-indexes-context';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export function IndexListPagination() {
  const {
    showPagination,
    pageIndex,
    pageCount,
    pageSize,
    setPageIndex,
    setPageSize,
  } = useMoexIndexesContext();

  if (!showPagination) return null;

  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  return (
    <div className='flex flex-wrap items-center gap-3 pt-3 text-xs text-muted-foreground'>
      <div className='flex items-center gap-2'>
        <span>Строк на странице</span>
        <Select
          value={`${pageSize}`}
          onValueChange={(value) => setPageSize(Number(value))}
        >
          <SelectTrigger size='sm'>
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side='top'>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={`${option}`}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className='text-xs font-medium text-foreground'>
        {pageIndex + 1} из {pageCount}
      </div>
      <div className='ml-auto flex items-center gap-2'>
        <Button
          variant='outline'
          size='icon'
          className='size-8'
          onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
          disabled={!canPreviousPage}
        >
          <span className='sr-only'>Предыдущая страница</span>
          <ChevronLeft />
        </Button>
        <Button
          variant='outline'
          size='icon'
          className='size-8'
          onClick={() => setPageIndex(Math.min(pageCount - 1, pageIndex + 1))}
          disabled={!canNextPage}
        >
          <span className='sr-only'>Следующая страница</span>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
