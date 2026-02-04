'use client';

import { useUser } from './user-context';
import { ModeToggle } from '@/components/ui/mode-toggle';
import Link from 'next/link';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { LogOut, Package } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { DashboardCards } from '@/lib/menu';
import RecognizerStatus from './recognizer-status';

// const menuItems: { icon: any, href: string, label: string, permission: null | PermissionStr }[] = [
//   { icon: Home, href: '/dashboard', label: 'Главная', permission: null }, // always visible
//   { icon: Home, href: '/users', label: 'Пользователи', permission: 'users:view' },
//   { icon: Home, href: '/organizations', label: 'Организации', permission: 'organizations:view' },
//   { icon: Home, href: '/audit-logs', label: 'История', permission: 'audit_logs:view' },
//   { icon: Home, href: '/settings', label: 'Настройки', permission: 'self:view' },
// ];
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logoutUser, hasPermission } = useUser();

  return (
    <Sidebar collapsible="offcanvas" {...props}>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className='mt-[60px]'>Retail</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DashboardCards.map((item) => {
                const isVisible = !item.permission || hasPermission(item.permission);
                if (!isVisible) return null;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <a href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <RecognizerStatus />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<'li'> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <div className='text-sm leading-none font-medium'>{title}</div>
          <p className='text-muted-foreground line-clamp-2 text-sm leading-snug'>
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  return (
    <Button asChild variant={pathname === href ? 'outline' : 'ghost'}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export default function UserStuff({ }) {
  const { user, logoutUser, hasPermission } = useUser();
  const router = useRouter();

  const isMobile = useIsMobile()
  console.log('ismob', isMobile)


  const handleLogout = async () => {
    try {
      await logoutUser();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <header className=' shadow-sm border-b'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center h-16 space-x-4 w-full'>
          {isMobile &&
            <SidebarTrigger />
          }
          <a
            href='/dashboard'
            className='text-xl font-semibold flex items-center gap-2 text-nowrap'
          >
            {!isMobile && <Package />}
            Retail
          </a>
          {!isMobile &&
            <RecognizerStatus />
          }

          {!isMobile &&
            <NavigationMenu viewport={false} className=''>
              <NavigationMenuList>
                {user == null ? (
                  <NavigationMenuItem>
                    <NavLink href='/login'>Вход</NavLink>
                  </NavigationMenuItem>
                ) : (
                  <>
                    {DashboardCards.map((item) => {
                      const isVisible = !item.permission || hasPermission(item.permission);
                      if (!isVisible) return null;

                      return (
                        <NavigationMenuItem key={item.href}>
                          <NavLink href={item.href}>{item.title}</NavLink>
                        </NavigationMenuItem>
                      );
                    })}
                  </>
                )}
              </NavigationMenuList>
            </NavigationMenu>
          }


          <div className='grow max-w-none' />

          {user && (
            <div className='text-sm text-muted-foreground mr-4'>
              <span className='font-semibold'>{user.username}</span> (
              <span>{user.role_key}</span>)
            </div>
          )}
          <NavigationMenu viewport={false} className=''>
            <NavigationMenuList>
              {user != null && (
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <button
                      onClick={handleLogout}
                      className='flex flex-nowrap flex-row! items-center gap-2 px-3 py-2 rounded hover:bg-muted transition-colors'
                      type='button'
                    >
                      <LogOut className='h-4 w-4' />
                      <span>Выход</span>
                    </button>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )}
              <NavigationMenuItem>
                <ModeToggle />
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </div>
    </header>
  );
}
