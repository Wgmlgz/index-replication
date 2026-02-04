'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  RowSelectionState,
  SortingState,
  TableOptions,
  useReactTable,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from './data-table-pagination';
import { Key, useEffect, useState } from 'react';
import { SearchInput } from '../search-input';
import { Button } from '../button';
import { Switch } from '../switch';
import { Label } from '../label';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  extraTableOptions?: Partial<TableOptions<TData>>;
  extraHeader?: React.ReactNode;
  altSearch?: React.ReactNode;
  filterPlaceholder?: string;
  refetchKey?: Key;
  enableHideBlocked?: boolean;
  className?: string;
  tableBodyClassName?: string;
  tableCellClassName?: string;
  externalRowSelection?: RowSelectionState;
  onRowSelectionChange?: (rowSelection: RowSelectionState) => void;
  fetchData: (
    pagination: PaginationState,
    sorting: SortingState,
    filter: string,
    hideBlocked?: boolean
  ) => Promise<{
    data: TData[];
    total: number;
    selectIdx?: number;
  }>;
}

export function DataTable<TData, TValue>({
  columns,
  extraTableOptions,
  extraHeader,
  altSearch,
  filterPlaceholder,
  refetchKey,
  className,
  tableBodyClassName,
  tableCellClassName,
  externalRowSelection,
  onRowSelectionChange,
  fetchData,
  enableHideBlocked,
}: DataTableProps<TData, TValue>) {
  const [data, setData] = useState<TData[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState<string>('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [hideBlocked, setHideBlocked] = useState<boolean>(false);

  const doFetch = () => {
    fetchData(pagination, sorting, search, hideBlocked).then(
      ({ data, total, selectIdx }) => {
        setData(data);
        setTotal(total);
        if (selectIdx !== undefined) {
          setRowSelection({ [String(selectIdx)]: true });
        }
      }
    );
  };

  useEffect(() => {
    if (externalRowSelection) {
      setRowSelection(externalRowSelection);
    }
  }, [externalRowSelection]);

  useEffect(() => {
    doFetch();
  }, [pagination, sorting, refetchKey]);

  useEffect(() => {
    if (onRowSelectionChange) onRowSelectionChange(rowSelection);
  }, [onRowSelectionChange, rowSelection]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    rowCount: total,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,

    state: {
      pagination,
      sorting,
      rowSelection,
    },
    ...extraTableOptions,
  });

  return (
    <div className={className}>
      <div className='flex items-end py-4 gap-4 flex-wrap'>
        {altSearch ? (
          altSearch
        ) : (
          <SearchInput
            placeholder={filterPlaceholder}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        )}
        {enableHideBlocked && (
          <div className='h-[36px] grid justify-items-center items-center'>
            <div className='flex gap-2'>
              <Switch
                checked={!!hideBlocked}
                onCheckedChange={setHideBlocked}
              />
              <Label className=''>Скрыть заблокированные</Label>
            </div>
          </div>
        )}
        <Button variant='outline' onClick={doFetch}>
          Поиск
        </Button>
        {/* <Input
          placeholder={filterPlaceholder}
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          className="max-w-sm"
        /> */}
        {extraHeader && <div className='ml-auto'>{extraHeader}</div>}
      </div>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={tableBodyClassName ?? ""}>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}
                      className={tableCellClassName}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  Нет результатов.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
