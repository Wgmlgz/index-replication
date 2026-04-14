'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LogIn, LogOut, Package, PanelLeftIcon, Settings, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { PortfolioProfile } from '@/api-client';
import {
  buildPortfolioActionTabs,
  resolvePortfolioActionTabValue,
} from '@/app/portfolio/components/actions-tabs';
import { useUser } from '@/components/user-context';
import { ModeToggle } from '@/components/ui/mode-toggle';
import {
  DashboardCards,
  PortfolioSidebarSubItems,
  type SidebarSubItem,
} from '@/lib/menu';
import { portfolioApi } from '@/lib/api';
import {
  LAST_SELECTED_PORTFOLIO_EVENT,
  LAST_SELECTED_PORTFOLIO_STORAGE_KEY,
  type LastSelectedPortfolio,
  buildPortfolioHref,
  parsePortfolioID,
  PORTFOLIO_ID_QUERY_KEY,
  PORTFOLIO_V2_PROFILES_QUERY_KEY,
  PORTFOLIO_V2_ROUTES,
  readLastSelectedPortfolio,
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
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user, hasPermission, logoutUser } = useUser();
  const { state, toggleSidebar } = useSidebar();
  const selectedPortfolioID = parsePortfolioID(searchParams.get(PORTFOLIO_ID_QUERY_KEY));
  const [lastSelectedPortfolio, setLastSelectedPortfolio] = useState<LastSelectedPortfolio | null>(null);
  const resolvedPortfolioID = selectedPortfolioID ?? lastSelectedPortfolio?.id ?? null;
  const actionTabParam = searchParams.get('action_tab')?.trim() ?? '';
  const isPortfolioSectionActive = pathname.startsWith('/portfolio');
  const detailsLabelText = useMemo(() => {
    const detailsLabel = t('navigation.portfolio.details');
    const portfolioName = lastSelectedPortfolio?.name.trim();
    return portfolioName ? `${detailsLabel}: ${portfolioName}` : detailsLabel;
  }, [lastSelectedPortfolio?.name, t]);
  const profilesQuery = useQuery<PortfolioProfile[]>({
    queryKey: PORTFOLIO_V2_PROFILES_QUERY_KEY,
    queryFn: async () => (await portfolioApi.mePortfoliosGet()).data ?? [],
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const actionSidebarItems = useMemo(() => {
    if (!resolvedPortfolioID) {
      return [];
    }

    const selectedProfile = (profilesQuery.data ?? []).find(profile => profile.id === resolvedPortfolioID);
    return buildPortfolioActionTabs(
      selectedProfile?.capabilities?.actions ?? [],
      t('portfolio.card.runAction'),
    );
  }, [profilesQuery.data, resolvedPortfolioID, t]);
  const resolvedActionTab = useMemo(
    () => resolvePortfolioActionTabValue(actionSidebarItems, actionTabParam),
    [actionSidebarItems, actionTabParam],
  );

  const handleLogout = async () => {
    await logoutUser();
  };

  useEffect(() => {
    const syncLastSelectedPortfolio = () => {
      setLastSelectedPortfolio(readLastSelectedPortfolio());
    };

    syncLastSelectedPortfolio();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === LAST_SELECTED_PORTFOLIO_STORAGE_KEY) {
        syncLastSelectedPortfolio();
      }
    };
    const onLastSelectedPortfolioUpdated = () => {
      syncLastSelectedPortfolio();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(LAST_SELECTED_PORTFOLIO_EVENT, onLastSelectedPortfolioUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LAST_SELECTED_PORTFOLIO_EVENT, onLastSelectedPortfolioUpdated);
    };
  }, []);

  const isPortfolioSubItemActive = (item: SidebarSubItem): boolean => {
    const itemPathname = item.activePathname ?? item.href.split('?')[0];
    if (pathname === itemPathname) {
      return true;
    }

    if (item.matchSubpaths && pathname.startsWith(`${itemPathname}/`)) {
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
                const isSettingsCard = item.titleKey === 'navigation.cards.settings.title';
                if (isPortfolioCard || isSettingsCard) return null;

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
                  <Link href={buildPortfolioHref(PORTFOLIO_V2_ROUTES.profiles, resolvedPortfolioID)}>
                    <Wallet className='size-4' />
                    <span>{t('navigation.cards.portfolio.title')}</span>
                  </Link>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {PortfolioSidebarSubItems.map(item => {
                    if (item.kind === 'label') {
                      const isDetailsLabel = item.titleKey === 'navigation.portfolio.details';
                      const isActionsLabel = item.titleKey === 'navigation.portfolio.actions';
                      if (isActionsLabel) {
                        return (
                          <Fragment key={item.titleKey}>
                            <SidebarMenuSubItem>
                              <div className='px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                                {t(item.titleKey)}
                              </div>
                            </SidebarMenuSubItem>
                            {actionSidebarItems.map(actionItem => (
                              <SidebarMenuSubItem key={`${item.titleKey}:${actionItem.value}`}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={
                                    pathname === PORTFOLIO_V2_ROUTES.actions
                                    && resolvedActionTab === actionItem.value
                                  }
                                >
                                  <Link
                                    href={buildPortfolioHref(
                                      `${PORTFOLIO_V2_ROUTES.actions}?action_tab=${encodeURIComponent(actionItem.value)}`,
                                      resolvedPortfolioID,
                                    )}
                                  >
                                    <span>{actionItem.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </Fragment>
                        );
                      }

                      return (
                        <SidebarMenuSubItem key={item.titleKey}>
                          <div className={isDetailsLabel
                            ? 'px-2 pt-2 text-[11px] font-medium text-muted-foreground'
                            : 'px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'}
                          >
                            {isDetailsLabel ? detailsLabelText : t(item.titleKey)}
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
                          <Link href={buildPortfolioHref(item.href, resolvedPortfolioID)}>
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
        <SidebarMenu className='flex-row items-center gap-1 group-data-[collapsible=icon]:flex-col'>
          <SidebarMenuItem className='flex-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-none'>
            <ModeToggle className='justify-center' labelClassName='sr-only' />
          </SidebarMenuItem>
          <SidebarMenuItem className='flex-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-none'>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/settings'}
              tooltip={t('navigation.cards.settings.title')}
              className='justify-center'
            >
              <Link href='/settings' aria-label={t('navigation.cards.settings.title')}>
                <Settings className='size-4' />
                <span className='sr-only'>{t('navigation.cards.settings.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user ? (
            <SidebarMenuItem className='flex-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-none'>
              <SidebarMenuButton
                onClick={() => void handleLogout()}
                tooltip={t('navigation.signOut')}
                className='justify-center'
                aria-label={t('navigation.signOut')}
              >
                <LogOut />
                <span className='sr-only'>{t('navigation.signOut')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem className='flex-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-none'>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/login'}
                tooltip={t('navigation.signIn')}
                className='justify-center'
              >
                <Link href='/login' aria-label={t('navigation.signIn')}>
                  <LogIn />
                  <span className='sr-only'>{t('navigation.signIn')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
