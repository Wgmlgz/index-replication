"use client"
import JsonView from '@uiw/react-json-view';
import React, { PureComponent } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import * as yaml from "@std/yaml";
import * as toml from "@std/toml";
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Eye, EyeIcon, Image, X } from "lucide-react"
import { Time } from "../ui/time";
import { AuditLog } from "./columns";
import { actionColors, actionLabels, extractRectsFromLog } from "@/lib/logs";
import { ModelsAuditLogResponse } from '@/api-client';

interface DetailsPopupProps {
  auditLog: ModelsAuditLogResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DetailsPopup({ auditLog, open, onOpenChange }: DetailsPopupProps) {
  const [parsedDetails, setParsedDetails] = useState<any>(null)
  const [diffFormat, setDiffFormat] = useState<'yaml' | 'toml'>("yaml")
  const [diffStrings, setDiffStrings] = useState<{ old: string, new: string } | null>(null)

  useEffect(() => {
    if (auditLog?.details) {
      try {
        const parsed = JSON.parse(auditLog.details)
        setParsedDetails(parsed)
        // If details has old/new, prepare diff strings
        if (parsed && typeof parsed === 'object' && 'old' in parsed && 'new' in parsed) {
          let oldStr = ""
          let newStr = ""
          if (diffFormat === "yaml") {
            oldStr = yaml.stringify(parsed.old)
            newStr = yaml.stringify(parsed.new)
          } else if (diffFormat === "toml") {
            oldStr = toml.stringify(parsed.old)
            newStr = toml.stringify(parsed.new)
          }
          else {
            oldStr = JSON.stringify(parsed.old, null, 2)
            newStr = JSON.stringify(parsed.new, null, 2)
          }
          setDiffStrings({ old: oldStr, new: newStr })
        } else {
          setDiffStrings(null)
        }
      } catch {
        setParsedDetails(null)
        setDiffStrings(null)
      }
    } else {
      setParsedDetails(null)
      setDiffStrings(null)
    }
  }, [auditLog?.details, diffFormat])

  if (!auditLog) return null

  const action = auditLog.action
  const label = actionLabels[action] || action
  const color = actionColors[action] || "bg-gray-100 text-gray-800"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px]! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Детали изменений
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-mediu">Действие</label>
                <div className="mt-1">
                  <Badge className={color}>{label}</Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Тип и ID сущности</label>
                <div className="mt-1 text-sm">
                  {auditLog.entity_type.charAt(0).toUpperCase() + auditLog.entity_type.slice(1)},
                  {auditLog.entity_id || "N/A"}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {auditLog.performed_by && (
                <div>
                  <label className="text-sm font-medium">Выполнено пользователем</label>
                  <div className="mt-1">
                    <div className="text-sm font-medium">
                      {auditLog.performed_by.full_name}
                    </div>
                    <div className="text-sm">
                      @{auditLog.performed_by.username} (ID: {auditLog.performed_by.id})
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium">
                  Время
                </label>
                <div>
                  <Time className="inline" time={auditLog.timestamp} />
                </div>
              </div>
            </div>
          </div>

          {/* Diff Viewer for old/new */}
          {diffStrings && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium">Изменения</label>
                <Button size="sm" variant={diffFormat === 'yaml' ? 'default' : 'outline'} onClick={() => setDiffFormat('yaml')}>
                  YAML
                </Button>
                <Button size="sm" variant={diffFormat === 'toml' ? 'default' : 'outline'} onClick={() => setDiffFormat('toml')}>
                  TOML
                </Button>
              </div>
              <ReactDiffViewer
                oldValue={diffStrings.old}
                newValue={diffStrings.new}
                splitView={true}
                leftTitle="Было"
                rightTitle="Стало"
                showDiffOnly={false}
                styles={{
                  variables: {
                    light: {
                      diffViewerBackground: '#f8fafc',
                      addedBackground: '#e6ffed',
                      removedBackground: '#ffeef0',
                      wordAddedBackground: '#acf2bd',
                      wordRemovedBackground: '#fdb8c0',
                    },
                  },
                }}
              />
            </div>
          )}

          {/* Details JSON (fallback) */}
          {!diffStrings && parsedDetails && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Изменения
              </label>
              <JsonView
                value={parsedDetails}
                title="Детали"
                className="w-full"
              />
            </div>
          )}

          {/* Raw Details (if JSON parsing failed) */}
          {!parsedDetails && auditLog.details && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Сырые данные
              </label>
              <div className="bg-gray-50 rounded-lg border p-3">
                <pre className="text-sm whitespace-pre-wrap break-all">
                  {auditLog.details}
                </pre>
              </div>
            </div>
          )}

          {/* No details */}
          {!auditLog.details && (
            <div className="text-center py-8">
              Дополнительных деталей для этого действия нет.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 