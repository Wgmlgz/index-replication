'use client';

import { useState } from 'react';
import {
  type Column,
  type ColumnDef,
  type RowData,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function renderSortIcon(sorted: false | 'asc' | 'desc') {
  if (sorted === 'asc') {
    return <ArrowUp className='size-4' />;
  }
  if (sorted === 'desc') {
    return <ArrowDown className='size-4' />;
  }
  return <ArrowUpDown className='size-4' />;
}

export function SortHeader<TData extends RowData>({
  column,
  label,
  alignRight,
}: {
  column: Column<TData, unknown>;
  label: string;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? 'text-right' : undefined}>
      <Button
        variant='ghost'
        size='sm'
        className='-ml-3 h-8'
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        {label}
        {renderSortIcon(column.getIsSorted())}
      </Button>
    </div>
  );
}

type SortableDataTableProps<TData extends RowData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  emptyLabel: string;
  getRowKey?: (row: TData, index: number) => string;
  className?: string;
};

export function SortableDataTable<TData extends RowData>({
  data,
  columns,
  emptyLabel,
  getRowKey,
  className,
}: SortableDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // TanStack Table is intentionally used for client-side sorting in this local table component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    getRowId: getRowKey
      ? (row, index) => getRowKey(row, index)
      : (_, index) => String(index),
  });

  return (
    <div
      className={
        className ?? 'w-full max-w-full min-w-0 overflow-auto rounded-md border'
      }
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={table.getAllColumns().length || 1}
                className='text-muted-foreground'
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
