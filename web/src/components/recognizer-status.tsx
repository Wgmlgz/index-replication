import { PermissionStr, useUser } from './user-context';
import { ModeToggle } from '@/components/ui/mode-toggle';
import Link from 'next/link';
import { useEffect, useState } from 'react'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { LogOut, Satellite, Circle } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { recognitionApi } from '@/lib/api'
import type { ModelsRecognitionStatus } from '@/api-client'
import { Calendar, Home, Inbox, Search, Settings } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { DashboardCards } from '@/lib/menu';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export default function RecognizerStatus({ }) {

  const [recStatus, setRecStatus] = useState<ModelsRecognitionStatus | null>(null)

  const fetchStatus = async () => {
    try {
      const { data } = await recognitionApi.recognitionStatusGet()
      setRecStatus(data)
    } catch (_) {
      // ignore
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])
  return <Popover>
    <PopoverTrigger asChild>
      <Button
        type='button'
        variant={'ghost'}
        aria-label='Recognizer status'
        onMouseEnter={fetchStatus}
      >
        <Circle className={`h-3 w-3 ${recStatus?.connected ? 'text-green-500' : 'text-red-500'}`} fill='currentColor' />
        <span className='text-xs'>Recognizer</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent className='max-w-sm' sideOffset={8}>
      <div className='space-y-1'>
        <div className='font-medium'>Recognizer status</div>
        <div className='text-xs'>
          <div><span className='opacity-80'>Connected:</span> {recStatus?.connected ? 'Yes' : 'No'}</div>
          {recStatus?.remote_addr && (
            <div><span className='opacity-80'>Remote:</span> {recStatus.remote_addr}</div>
          )}
          {recStatus?.connected_at && (
            <div><span className='opacity-80'>Connected at:</span> {new Date(recStatus.connected_at).toLocaleString()}</div>
          )}
          {recStatus?.last_message_at && (
            <div><span className='opacity-80'>Last message:</span> {new Date(recStatus.last_message_at).toLocaleString()}</div>
          )}
          <div><span className='opacity-80'>Pending requests:</span> {recStatus?.pending_requests ?? 0}</div>
        </div>
      </div>
    </PopoverContent>
  </Popover>

}