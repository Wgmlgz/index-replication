"use client"

import { useState } from "react"
import { DataTable } from "../ui/data-table/data-table"
import { columns } from "../audit-logs-table/columns"
import { type AuditLog } from "../audit-logs-table/columns"
import { PaginationState, SortingState } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User } from "lucide-react"
import { DetailsPopup } from "../audit-logs-table/details-popup"
import { auditLogsApi as api } from "@/lib/api";

const fetchUserHistory = async (
  userId: number,
  pagination: PaginationState, 
  sorting: SortingState, 
  search: string
) => {
  const params = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy: sorting[0]?.id || "timestamp",
    sortDir: (sorting[0]?.desc ?? true) ? "desc" : "asc",
    userId,
    search,
    entityType: "user",
  };
  const response = await api.auditLogsGet(params.page, params.pageSize, params.search, undefined, params.entityType, String(params.userId));
  if (response.status === 200 && response.data) {
    const data = response.data;
    return { data: data.logs ?? [], total: data.total ?? 0 };
  }
  return { data: [], total: 0 };
}

export type UserHistoryProps = {
  userId: number
  userName?: string
}

export function UserHistory({ userId, userName }: UserHistoryProps) {
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const fetchUserHistoryWithId = async (
    pagination: PaginationState, 
    sorting: SortingState, 
    search: string
  ) => {
    const result = await fetchUserHistory(userId, pagination, sorting, search)
    return {
      ...result,
      data: result.data.map((auditLog: AuditLog) => ({
        ...auditLog,
        onViewDetails: (log: AuditLog) => {
          setSelectedAuditLog(log)
          setDetailsOpen(true)
        },
      })),
    }
  }

  return (
    <div className="container mx-auto space-y-4">
      {/* Details Popup */}
      <DetailsPopup
        auditLog={selectedAuditLog}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            История пользователя
            {userName && (
              <span className="text-lg font-normal text-gray-600">
                - {userName}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            filterPlaceholder="Поиск в истории пользователя..."
            columns={columns}
            fetchData={fetchUserHistoryWithId}
            extraTableOptions={{
              initialState: {
                sorting: [{ id: "timestamp", desc: true }],
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
} 