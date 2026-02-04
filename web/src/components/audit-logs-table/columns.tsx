"use client"

import { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "../ui/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { Time } from "../ui/time"
import { actionColors, actionLabels, entityTypeLabels, extractRectsFromLog } from "@/lib/logs"
import { ModelsAuditLogResponse } from "@/api-client"
import { ImagePopup } from "./image-popup"

// This type is used to define the shape of our data.
export type AuditLog = {
  id: number
  action: string
  entity_type: string
  entity_id: number | undefined
  details: string
  timestamp: string
  performed_by?: {
    id: number
    username: string
    full_name: string
  }
  onViewDetails?: (auditLog: AuditLog) => void
} & ModelsAuditLogResponse


export const columns: ColumnDef<AuditLog>[] = [
  // {
  //   header: ({ column }) => (
  //     <DataTableColumnHeader column={column} title="ID" />
  //   ),
  //   accessorKey: "id",
  // },
  {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Действие" />
    ),
    accessorKey: "action",
    cell: ({ row }) => {
      const action = row.original.action
      const label = actionLabels[action] || action
      const color = actionColors[action] || "bg-gray-100 text-gray-800"

      return (
        <Badge className={color}>
          {label}
        </Badge>
      )
    },
  },
  {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Тип,ID сущности" />
    ),
    accessorKey: "entity_type",
    cell: ({ row }) => {
      const entityType = row.original.entity_type
      let label = (entityTypeLabels[entityType] || entityType)
      if (row.original.entity_id) {
        label += ', ' + row.original.entity_id
      }
      return (
        <Badge variant="outline">
          {label}
        </Badge>
      )
    },
  },
  {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Выполнил" />
    ),
    accessorKey: "performed_by",
    cell: ({ row }) => {
      const performedBy = row.original.performed_by
      if (!performedBy) return "-"

      return (
        <div className="flex flex-col">
          <span className="font-medium">{performedBy.full_name}</span>
          <span className="text-sm text-gray-500">@{performedBy.username}</span>
        </div>
      )
    },
  },
  {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Время" />
    ),
    accessorKey: "timestamp",
    cell: ({ row }) => <Time time={row.original.timestamp} />,
  },
  {
    id: "actions",
    header: () => <span></span>,
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => row.original.onViewDetails?.(row.original)}
          className="h-8 w-8"
        >
          <Eye className="h-4 w-4" />
          <span className="sr-only">Просмотр деталей</span>
        </Button>
        {row.original.log_image && (
          <ImagePopup url={row.original.log_image} results={extractRectsFromLog(row.original)}></ImagePopup>
        )}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
] 
