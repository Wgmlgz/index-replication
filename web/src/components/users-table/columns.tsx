"use client"

import { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "../ui/data-table/data-table-column-header"
import { Button } from "@/components/ui/button"
import { Pencil, History } from "lucide-react"
import { roleOptions } from "./user-form"
import { Badge } from "../ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { Time } from "../ui/time"
import { Checkbox } from "../ui/checkbox"
import { UseUserRet } from "../user-context"
import { UserResponse } from "@/api-client"

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type User = UserResponse & {
  organization_id?: number | null
  organization_name?: string | null
  last_active: string | null
  blocked_at: string | null
  onEdit?: (user: User) => void
  onViewHistory?: (user: User) => void
}


export const columns = (_ctx: UseUserRet): ColumnDef<User>[] => {
  void _ctx;
  return [
    // {
    //   header: ({ column }) => (
    //     <DataTableColumnHeader column={column} title="ID" />
    //   ),
    //   accessorKey: "id",
    // },
    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Логин" />
      ),
      accessorKey: "username",
    },

    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ФИО" />
      ),
      accessorKey: "full_name",
    },
    {

      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Роль" />
      ),
      accessorKey: "role_id",
      cell: ({ row }) => {
        const [variant, className] = (
          ({
            1: ["secondary", 'bg-blue-500 text-white dark:bg-blue-600'],
            2: ["destructive", ''],
            3: ["default", ''],
            4: ["secondary", ''],
            5: ["outline", ''],
          } satisfies
            Record<number, [Parameters<(typeof Badge)>[0]['variant'], string]>)
          [row.original.role_id]) ?? ["default", '']

        const role = roleOptions.find(o => o.value === row.original.role_id);
        return <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={variant} className={className}>
              {role?.label || "-"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-[250px] text-center">
            <p>{role?.description}</p>
          </TooltipContent>
        </Tooltip>
      },
    },
    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      accessorKey: "email",
    },
     {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Дата блокировки" />
      ),
      cell: ({ row }) => <Time time={row.original.blocked_at} />,
      accessorKey: "blocked_at",
    },
    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Последняя активность" />
      ),
      cell: ({ row }) => <Time time={row.original.last_active} />,
      accessorKey: "last_active",
    },
    {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Создан" />
      ),
      cell: ({ row }) => <Time time={row.original.created_at} />,
      accessorKey: "created_at",
    },

  ]
}


export const selectCol: ColumnDef<User>[] = [{
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={
        table.getIsAllPageRowsSelected() ||
        (table.getIsSomePageRowsSelected() && "indeterminate")
      }
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="Select row"
    />
  ),
  enableSorting: false,
  enableHiding: false,
}]

export const activeActionsCol = ({ hasPermission, user }: UseUserRet): ColumnDef<User>[] => {

  return [{
    id: "actions",
    header: () => <span></span>,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        {user?.id !== row.original.id &&
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => row.original.onEdit?.(row.original)}>
                <Pencil className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Редактировать</p>
            </TooltipContent>
          </Tooltip>}

        {hasPermission('audit_logs:view') &&
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => row.original.onViewHistory?.(row.original)}>
                <History className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>История изменений</p>
            </TooltipContent>
          </Tooltip>
        }

        {/* <Button size="icon" variant="ghost" onClick={() => row.original.onEdit?.(row.original)}>
          <Pencil className="w-4 h-4" />
          <span className="sr-only">Редактировать</span>
        </Button>
        <Button size="icon" variant="ghost" onClick={() => row.original.onViewHistory?.(row.original)}>
          <History className="w-4 h-4" />
          <span className="sr-only">История</span>
        </Button> */}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  ]
}
