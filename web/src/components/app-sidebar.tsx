'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogIn, LogOut, Package, PanelLeftIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/components/user-context';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { DashboardCards } from '@/lib/menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, hasPermission, logoutUser } = useUser();
  const { state, toggleSidebar } = useSidebar();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      router.push('/login');
    }
  };

  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('navigation.brand')}>
              <Link href={'/dashboard'}>
                <Package className='size-4' />
                <span>{t('navigation.brand')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar}>
              <PanelLeftIcon />
              <span>
                {state === 'expanded'
                  ? t('navigation.collapseSidebar')
                  : t('navigation.expandSidebar')}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('navigation.section')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DashboardCards.map(item => {
                const isVisible =
                  !item.permission || hasPermission(item.permission);
                if (!isVisible) return null;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.titleKey ? t(item.titleKey) : item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>
                          {item.titleKey ? t(item.titleKey) : item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className='mb-16'>
        {/* {user && (
          <div className='px-2 py-1 text-xs text-muted-foreground'>
            <span className='font-semibold'>{user.username}</span>
            <br/>
            (<span>{user.role_key}</span>)
          </div>
        )} */}
        <SidebarMenu>
          <SidebarMenuItem>
            <ModeToggle />
          </SidebarMenuItem>
          {user ? (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => void handleLogout()}>
                <LogOut />
                <span>{t('navigation.signOut')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/login'}>
                <Link href='/login'>
                  <LogIn />
                  <span>{t('navigation.signIn')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
