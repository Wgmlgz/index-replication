"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import type { PortfolioSummaryResponse } from "@/api-client";
import { portfolioApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPercent } from "@/app/portfolio/components/portfolio-formatting";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PortfolioSummaryPanelProps = {
  portfolioID: number | null;
};

type MoneyBalance = NonNullable<PortfolioSummaryResponse["money"]>[number];
type PortfolioPosition = NonNullable<PortfolioSummaryResponse["positions"]>[number];

export function PortfolioSummaryPanel({ portfolioID }: PortfolioSummaryPanelProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PortfolioSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState("");
  const [moneySorting, setMoneySorting] = useState<SortingState>([]);
  const [positionsSorting, setPositionsSorting] = useState<SortingState>([]);

  const signedValueClassName = (value: number): string => {
    if (value > 0) return "text-emerald-600 dark:text-emerald-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-foreground";
  };

  const renderSortIcon = (sorted: false | "asc" | "desc") => {
    if (sorted === "asc") return <ArrowUp className="size-4" />;
    if (sorted === "desc") return <ArrowDown className="size-4" />;
    return <ArrowUpDown className="size-4" />;
  };

  const moneyColumns = useMemo<ColumnDef<MoneyBalance>[]>(
    () => [
      {
        accessorKey: "currency",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.moneyCurrency")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
      },
      {
        accessorKey: "available",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.moneyAvailable")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => formatNumber(row.original.available ?? 0),
      },
      {
        accessorKey: "blocked",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.moneyBlocked")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => formatNumber(row.original.blocked ?? 0),
      },
      {
        accessorKey: "withdraw_available",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.moneyWithdrawAvailable")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => formatNumber(row.original.withdraw_available ?? 0),
      },
      {
        accessorKey: "withdraw_blocked",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.moneyWithdrawBlocked")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => formatNumber(row.original.withdraw_blocked ?? 0),
      },
    ],
    [t],
  );

  const positionsColumns = useMemo<ColumnDef<PortfolioPosition>[]>(
    () => [
      {
        accessorKey: "ticker",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.positionTicker")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => row.original.ticker || "-",
      },
      {
        accessorKey: "instrument_id",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.positionInstrumentID")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => row.original.instrument_id || "-",
      },
      {
        accessorKey: "quantity",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.positionQuantity")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => formatNumber(row.original.quantity ?? 0),
      },
      {
        accessorKey: "current_price",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.positionCurrentPrice")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => (
          <>
            {formatNumber(row.original.current_price ?? 0)} {row.original.currency || ""}
          </>
        ),
      },
      {
        accessorKey: "current_value",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.positionCurrentValue")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => (
          <>
            {formatNumber(row.original.current_value ?? 0)} {row.original.currency || ""}
          </>
        ),
      },
      {
        accessorKey: "expected_yield",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("portfolio.card.positionExpectedYield")}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => (
          <span className={cn("font-medium", signedValueClassName(row.original.expected_yield ?? 0))}>
            {formatNumber(row.original.expected_yield ?? 0)}
          </span>
        ),
      },
    ],
    [t],
  );

  const moneyData = useMemo(
    () => summary?.money ?? [],
    [summary?.money],
  );
  const positionsData = useMemo(
    () => (summary?.positions ?? []).slice(0, 10),
    [summary?.positions],
  );

  const moneyTable = useReactTable({
    data: moneyData,
    columns: moneyColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setMoneySorting,
    state: { sorting: moneySorting },
    autoResetAll: false,
    getRowId: (row, index) => row.currency || `currency-${index}`,
  });

  const positionsTable = useReactTable({
    data: positionsData,
    columns: positionsColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setPositionsSorting,
    state: { sorting: positionsSorting },
    autoResetAll: false,
    getRowId: (row, index) =>
      `${row.instrument_id || "-"}:${row.ticker || "-"}:${index}`,
  });

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const loadSummary = useCallback(
    async (targetPortfolioID: number) => {
      setError("");
      setLoadingSummary(true);
      try {
        const nextSummary = (
          await portfolioApi.mePortfoliosIdSummaryGet(targetPortfolioID)
        ).data;
        setSummary(nextSummary);
      } catch (err) {
        setError(parseErrorMessage(err, t("portfolio.errors.summary")));
      } finally {
        setLoadingSummary(false);
      }
    },
    [parseErrorMessage, t],
  );

  useEffect(() => {
    if (!portfolioID) {
      setSummary(null);
      setError("");
      return;
    }

    void loadSummary(portfolioID);
  }, [loadSummary, portfolioID]);

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("portfolio.overview.summaryTitle")}</CardTitle>
          <CardDescription>
            {t("portfolio.overview.summaryDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("portfolio.card.selectPrompt")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{t("portfolio.overview.summaryTitle")}</CardTitle>
        <CardDescription>
          {t("portfolio.overview.summaryDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loadingSummary ? (
          <div className="text-muted-foreground">
            {t("portfolio.card.loading")}
          </div>
        ) : summary ? (
          <>
            <div className="space-y-2">
              <div className="font-medium">
                {t("portfolio.overview.balancesTitle")}
              </div>
              <div className="rounded-md border p-3">
                <div>
                  <span className="font-medium">
                    {t("portfolio.card.totalLabel")}{" "}
                  </span>
                  {formatNumber(summary.total_amount_portfolio ?? 0)}{" "}
                  {summary.total_amount_currency || ""}
                </div>
                <div>
                  <span className="font-medium">
                    {t("portfolio.card.dailyYieldLabel")}{" "}
                  </span>
                  {formatNumber(summary.daily_yield ?? 0)}
                </div>
                <div>
                  <span className="font-medium">
                    {t("portfolio.card.dailyYieldRelativeLabel")}{" "}
                  </span>
                  <span className={cn("font-medium", signedValueClassName(summary.daily_yield_relative ?? 0))}>
                    {formatPercent(summary.daily_yield_relative ?? 0)}
                  </span>
                </div>
              </div>

              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    {moneyTable.getHeaderGroups().map(headerGroup => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {moneyTable.getRowModel().rows.length === 0 ? (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={5}>
                          {t("portfolio.card.moneyEmpty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      moneyTable.getRowModel().rows.map(row => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map(cell => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">
                {t("portfolio.card.positionsTitle", {
                  count: Math.min((summary.positions ?? []).length, 10),
                })}
              </div>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    {positionsTable.getHeaderGroups().map(headerGroup => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {positionsTable.getRowModel().rows.length === 0 ? (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={6}>
                          {t("portfolio.card.positionsEmpty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      positionsTable.getRowModel().rows.map(row => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map(cell => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">
            {t("portfolio.card.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
