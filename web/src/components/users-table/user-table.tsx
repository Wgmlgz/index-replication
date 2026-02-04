"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DataTablePagination } from "../ui/data-table/data-table-pagination"
import { DataTable } from "../ui/data-table/data-table"
import { activeActionsCol, columns, selectCol } from "./columns"
import { type User } from "./columns"
import { PaginationState, SortingState } from "@tanstack/react-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserForm } from "./user-form"
import { useRouter } from "next/navigation"
import { usersApi as api } from "@/lib/api";
import { useUser } from "../user-context"
// const roleNames: Record<number, string> = {
//   1: "Root",
//   2: "Administrator", 
//   3: "Manager",
//   4: "Operator",
//   5: "Observer"
// }

export type UserTableProps = {
  mode?: "normal" | "select"
  onSelectionChange?: (user: User | null) => void
  initialSelectedId?: number,
  organization_id?: number
}
interface UsersResponse {
  total: number
  page: number
  page_size: number
  users: User[]
}

const fetchUsers = async (pagination: PaginationState, sorting: SortingState, search: string, organization_id?: number) => {
  const params = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search,
  };
  const response = await api.usersGet(params.page, params.pageSize, params.search, sorting[0]?.id, sorting[0]?.desc ? "desc" : "asc", organization_id);
  if (response.status === 200 && response.data) {
    const data = response.data;
    return { data: data.users ?? [], total: data.total ?? 0 };
  }
  return { data: [], total: 0 };
}
export function UserTable({ mode = "normal", onSelectionChange, initialSelectedId, organization_id }: UserTableProps) {
  const useUserRet = useUser()
  const [open, setOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [rowSelection, setRowSelection] = useState<{ [key: string]: boolean }>({})
  const [visibleUsers, setVisibleUsers] = useState<User[]>([])
  const router = useRouter()

  // Wrap fetchUsers to inject onEdit and onViewHistory callbacks
  const fetchUsersWithCallbacks = async (pagination: PaginationState, sorting: SortingState, search: string) => {
    const result = await fetchUsers(pagination, sorting, search, organization_id)
    setVisibleUsers(result.data)
    return {
      ...result,
      data: result.data.map((user: User) => ({
        ...user,
        onEdit: (u: User) => {
          setEditUser(u)
          setOpen(true)
        },
        onViewHistory: (u: User) => {
          router.push(`/users?history=${u.id}`)
        },
      })),
    }
  }

  const handleAddUser = () => {
    setEditUser(null)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setEditUser(null)
  }

  const handleSuccess = () => {
    setOpen(false)
    setEditUser(null)
    setRefreshKey(k => k + 1)
  }

  // Selection logic for picker mode
  const handleRowSelection = (rowSelection: { [key: string]: boolean }) => {
    setRowSelection(rowSelection)
    if (mode === "select" && onSelectionChange) {
      const selectedIdx = Object.keys(rowSelection)[0]
      let selectedUser: User | null = null
      if (selectedIdx) {
        selectedUser = visibleUsers[parseInt(selectedIdx)] || null
      }
      onSelectionChange(selectedUser)
    }
  }

  // Set initial selection if provided
  useState(() => {
    if (mode === "select" && initialSelectedId && visibleUsers.length > 0) {
      const idx = visibleUsers.findIndex(u => u.id === initialSelectedId)
      if (idx >= 0) setRowSelection({ [String(idx)]: true })
    }
  })

  return (
    <div className="container mx-auto">
      <Dialog open={open} onOpenChange={open => { setOpen(open); if (!open) setEditUser(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editUser ? "Редактировать пользователя" : "Добавить пользователя"}</DialogTitle>
          </DialogHeader>
          <UserForm mode={editUser ? "edit" : "create"} user={editUser} onSuccess={handleSuccess} />
        </DialogContent>
      </Dialog>
      <DataTable
        filterPlaceholder="Поиск пользователей..."
        columns={
          (mode === 'select') ? ([...selectCol, ...columns(useUserRet)]) : [...columns(useUserRet), ...activeActionsCol(useUserRet)]
        }
        fetchData={fetchUsersWithCallbacks}
        key={refreshKey}
        extraHeader={
          mode !== "select" && useUserRet.hasPermission('users:create') && <Button onClick={handleAddUser}>Добавить пользователя</Button>
        }
        extraTableOptions={mode === "select" ? {
          enableRowSelection: true,
          enableMultiRowSelection: false,
        } : {}}
        onRowSelectionChange={handleRowSelection}
      />
    </div>
  )
} 