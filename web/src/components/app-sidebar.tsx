'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LogIn, LogOut, Package, PanelLeftIcon, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/components/user-context';
import { ModeToggle } from '@/components/ui/mode-toggle';
import {
  DashboardCards,
  PortfolioSidebarSubItems,
  type SidebarSubItem,
} from '@/lib/menu';
import {
  buildPortfolioHref,
  parsePortfolioID,
  PORTFOLIO_ID_QUERY_KEY,
  PORTFOLIO_V2_ROUTES,
} from '@/lib/portfolio';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user, hasPermission, logoutUser } = useUser();
  const { state, toggleSidebar } = useSidebar();
  const selectedPortfolioID = parsePortfolioID(searchParams.get(PORTFOLIO_ID_QUERY_KEY));
  const isPortfolioSectionActive = pathname.startsWith('/portfolio');

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      router.push('/login');
    }
  };

  const isPortfolioSubItemActive = (item: SidebarSubItem): boolean => {
    const itemPathname = item.activePathname ?? item.href.split('?')[0];
    if (pathname === itemPathname) {
      return true;
    }

    if (
      itemPathname === PORTFOLIO_V2_ROUTES.replication
      && pathname.startsWith(`${PORTFOLIO_V2_ROUTES.replication}/`)
    ) {
      return true;
    }

    return false;
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
                const isPortfolioCard = item.titleKey === 'navigation.cards.portfolio.title';
                if (isPortfolioCard) return null;

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

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isPortfolioSectionActive}
                  tooltip={t('navigation.cards.portfolio.title')}
                >
                  <Link href={buildPortfolioHref(PORTFOLIO_V2_ROUTES.profiles, selectedPortfolioID)}>
                    <Wallet className='size-4' />
                    <span>{t('navigation.cards.portfolio.title')}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {PortfolioSidebarSubItems.map(item => {
                    if (item.kind === 'label') {
                      return (
                        <SidebarMenuSubItem key={item.titleKey}>
                          <div className='px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                            {t(item.titleKey)}
                          </div>
                        </SidebarMenuSubItem>
                      );
                    }

                    const isVisible = !item.permission || hasPermission(item.permission);
                    if (!isVisible) return null;

                    return (
                      <SidebarMenuSubItem key={item.href}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isPortfolioSubItemActive(item)}
                        >
                          <Link href={buildPortfolioHref(item.href, selectedPortfolioID)}>
                            <span>{t(item.titleKey)}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </SidebarMenuItem>
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
