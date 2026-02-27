"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTable } from "../ui/data-table/data-table"
import { columns } from "./columns"
import { type AuditLog } from "./columns"
import { PaginationState, SortingState } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Filter, X } from "lucide-react"
import { DetailsPopup } from "./details-popup"
import { auditLogsApi as api } from '@/lib/api'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UserTable } from "@/components/users-table/user-table"
import { type User } from "@/components/users-table/columns"
import { Badge } from "../ui/badge"
import { actionColors, actionLabels, entityTypeLabels } from "@/lib/logs"
import { downloadTextFile } from "@/lib/utils"
import { AuditLogResponse } from "@/api-client"

const fetchAuditLogs = async (
  pagination: PaginationState,
  sorting: SortingState,
  search: string,
  filters: {
    action?: string
    entityType?: string
    entityId?: string
    performedBy?: number
    startDate?: string
    endDate?: string
  }
) => {
  const params = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search,
    action: filters.action,
    entityType: filters.entityType,
    entityId: filters.entityId,
    performedBy: filters.performedBy,
    startDate: filters.startDate,
    endDate: filters.endDate,
  }
  const response = await api.auditLogsGet(params.page, params.pageSize, params.search, params.action, params.entityType, params.entityId, params.performedBy, params.startDate, params.endDate)
  if (response.status === 200 && response.data) {
    const data = response.data
    return { data: data.logs ?? [], total: data.total ?? 0 }
  }
  return { data: [], total: 0 }
}

// User picker for filters
function BaseUserInput({ value, onChange }: { value?: string, onChange: (user: User | null) => void }) {
  // const [open, setOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  return (
    <div className="flex w-full items-center gap-2">
      <Input readOnly placeholder="Пользователь не выбран"
        value={selectedUser ? `${selectedUser.full_name} (${selectedUser.username})` : ""}
      />
      <Dialog >
        <DialogTrigger asChild>
          <Button type="button" variant="outline">Выбор пользователя</Button>
        </DialogTrigger>
        <DialogContent className="max-w-[1200px]!">
          <DialogHeader>
            <DialogTitle>Выберите пользователя</DialogTitle>
            <DialogDescription>
              {selectedUser ? `Выбран: ${selectedUser.full_name} (${selectedUser.username})` : "Пожалуйста, выберите пользователя из списка."}
            </DialogDescription>
          </DialogHeader>
          <UserTable mode="select" onSelectionChange={(user) => {
            setSelectedUser(user)
            if (user) onChange(user)
            // setOpen(false)
          }} initialSelectedId={value ? Number(value) : undefined} />
        </DialogContent>
      </Dialog>
      {value && (
        <button type="button" className="text-red-500 ml-2" onClick={() => { setSelectedUser(null); onChange(null) }}>x</button>
      )}
    </div>
  )
}

export function AuditLogsTable() {
  const [filters, setFilters] = useState({
    action: "__all__",
    entityType: "__all__",
    entityId: "",
    performedBy: "",
    startDate: "",
    endDate: "",
  })
  const [filterKey, setFilterKey] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null)
  const [displayLogs, setDisplayLogs] = useState<AuditLogResponse[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const fetchAuditLogsWithFilters = async (
    pagination: PaginationState,
    sorting: SortingState,
    search: string
  ) => {
    const result = await fetchAuditLogs(pagination, sorting, search, {
      action: filters.action === "__all__" ? "" : filters.action,
      entityType: filters.entityType === "__all__" ? "" : filters.entityType,
      entityId: filters.entityId,
      performedBy: filters.performedBy ? Number(filters.performedBy) : undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
    })
    setDisplayLogs(result.data)
    const mappedLogs: AuditLog[] = result.data.map((auditLog) => ({
      ...auditLog,
      onViewDetails: (log: AuditLog) => {
        setSelectedAuditLog(log)
        setDetailsOpen(true)
      },
    }));

    return {
      ...result,
      data: mappedLogs,
    }
  }

  const clearFilters = () => {
    setFilters({
      action: "__all__",
      entityType: "__all__",
      entityId: "",
      performedBy: "",
      startDate: "",
      endDate: "",
    })
  }

  const hasActiveFilters = filters.action !== "__all__" || filters.entityType !== "__all__" || filters.entityId || filters.performedBy || filters.startDate || filters.endDate

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFilterKey(k => k + 1)
  }

  const downloadLogs = () => {
    downloadTextFile('logs.json', JSON.stringify(displayLogs, null, 2))
  }

  return (
    <div className="container mx-auto space-y-4">
      {/* Details Popup */}
      <DetailsPopup
        auditLog={selectedAuditLog}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Фильтры
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? "Скрыть" : "Показать"} фильтры
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Очистить
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="action-filter">Действие</Label>
                <Select
                  value={filters.action}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Все действия" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Все действия</SelectItem>
                    {Object.keys(actionLabels).map((action) => (
                      <SelectItem key={action} value={action}>
                        <Badge className={actionColors[action]}>{actionLabels[action]}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-type-filter">Тип сущности</Label>
                <Select
                  value={filters.entityType}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Все типы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Все типы</SelectItem>
                    {Object.keys(entityTypeLabels).map((type) => (
                      <SelectItem key={type} value={type}>
                        {entityTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-id">ID сущности</Label>
                <Input
                  id="entity-id"
                  name="entityId"
                  type="text"
                  value={filters.entityId}
                  onChange={handleFilterChange}
                  placeholder="ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="performed-by">Пользователь</Label>
                <BaseUserInput
                  value={filters.performedBy}
                  onChange={user => setFilters(prev => ({ ...prev, performedBy: user ? String(user.id) : "" }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">Начальная дата</Label>
                <Input
                  id="start-date"
                  name="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">Конечная дата</Label>
                <Input
                  id="end-date"
                  name="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="col-span-full flex justify-end mt-2">
                <Button type="submit" variant="default">Применить</Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Audit Logs Table */}
      <DataTable
        filterPlaceholder="Поиск по журналу аудита..."
        columns={columns}
        fetchData={fetchAuditLogsWithFilters}
        refetchKey={filterKey}
        extraTableOptions={{
          initialState: {
            sorting: [{ id: "timestamp", desc: true }],
          },
        }}
        extraHeader={
          (
            <div>
              <Button onClick={downloadLogs}>
                <Download>
                </Download>
                Скачать логи
              </Button>
            </div>
          )
        }
      />
    </div>
  )
} 
