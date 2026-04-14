'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Fragment, useMemo, type ComponentType } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CircleHelp,
  ClipboardList,
  Clock3,
  FlaskConical,
  LineChart,
  LogIn,
  LogOut,
  Monitor,
  Package,
  PanelLeftIcon,
  PlayCircle,
  Settings,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
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
  buildPortfolioHref,
  parsePortfolioID,
  PORTFOLIO_ID_QUERY_KEY,
  PORTFOLIO_V2_PROFILES_QUERY_KEY,
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

const portfolioSubItemIcons: Record<string, ComponentType<{ className?: string }>> = {
  'navigation.portfolio.profiles': Wallet,
  'navigation.portfolio.overview': Wallet,
  'portfolio.overview.tabs.summary': Wallet,
  'portfolio.overview.tabs.operations': ClipboardList,
  'portfolio.overview.tabs.compare': BarChart3,
  'portfolio.overview.tabs.analytics': LineChart,
  'navigation.portfolio.actions': PlayCircle,
  'navigation.portfolio.replication': SlidersHorizontal,
  'portfolio.replication.tabs.drafts': Clock3,
  'portfolio.replication.tabs.settings': Settings,
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user, hasPermission, logoutUser } = useUser();
  const { state, toggleSidebar } = useSidebar();
  const selectedPortfolioID = parsePortfolioID(searchParams.get(PORTFOLIO_ID_QUERY_KEY));
  const resolvedPortfolioID = selectedPortfolioID;
  const actionTabParam = searchParams.get('action_tab')?.trim() ?? '';
  const isPortfolioSectionActive = pathname.startsWith('/portfolio');
  const shouldShowPortfolioSubItems = isPortfolioSectionActive;
  const shouldShowSelectedPortfolioSubItems = Boolean(resolvedPortfolioID);
  const profilesQuery = useQuery<PortfolioProfile[]>({
    queryKey: PORTFOLIO_V2_PROFILES_QUERY_KEY,
    queryFn: async () => (await portfolioApi.mePortfoliosGet()).data ?? [],
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const availableProfiles = useMemo(
    () =>
      (profilesQuery.data ?? []).flatMap(profile => {
        if (typeof profile.id !== 'number' || profile.id <= 0) {
          return [];
        }

        const name = typeof profile.name === 'string' && profile.name.trim()
          ? profile.name.trim()
          : `#${profile.id}`;
        const providerKey = typeof profile.provider === 'string'
          ? profile.provider.trim().toLowerCase()
          : '';

        return [{
          id: profile.id,
          name,
          providerKey,
        }];
      }),
    [profilesQuery.data],
  );
  const selectedProfile = useMemo(
    () => (profilesQuery.data ?? []).find(profile => profile.id === resolvedPortfolioID),
    [profilesQuery.data, resolvedPortfolioID],
  );
  const selectedPortfolioName = typeof selectedProfile?.name === 'string'
    ? selectedProfile.name.trim()
    : '';
  const selectedProviderKey = selectedProfile?.provider?.trim().toLowerCase() ?? '';
  const SelectedProviderIcon =
    selectedProviderKey === 'virtual'
      ? Monitor
      : selectedProviderKey === 'mock'
        ? FlaskConical
        : CircleHelp;
  const isTbankProvider = selectedProviderKey === 'tbank';
  const actionSidebarItems = useMemo(() => {
    if (!resolvedPortfolioID) {
      return [];
    }

    return buildPortfolioActionTabs(
      selectedProfile?.capabilities?.actions ?? [],
      t('portfolio.card.runAction'),
    );
  }, [resolvedPortfolioID, selectedProfile?.capabilities?.actions, t]);
  const resolvedActionTab = useMemo(
    () => resolvePortfolioActionTabValue(actionSidebarItems, actionTabParam),
    [actionSidebarItems, actionTabParam],
  );

  const handleLogout = async () => {
    await logoutUser();
  };

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
                  tooltip={t('navigation.portfolio.profiles')}
                >
                  <Link href={buildPortfolioHref(PORTFOLIO_V2_ROUTES.profiles, resolvedPortfolioID)}>
                    <Wallet className='size-4' />
                    <span>{t('navigation.portfolio.profiles')}</span>
                  </Link>
                </SidebarMenuButton>
                {shouldShowPortfolioSubItems ? (
                  <SidebarMenuSub>
                    {shouldShowSelectedPortfolioSubItems
                      ? PortfolioSidebarSubItems.map(item => {
                        if (item.kind === 'item' && item.titleKey === 'navigation.portfolio.profiles') {
                          return null;
                        }

                        const SubItemIcon = portfolioSubItemIcons[item.titleKey];
                        if (item.kind === 'label') {
                          const isDetailsLabel = item.titleKey === 'navigation.portfolio.details';
                          const isActionsLabel = item.titleKey === 'navigation.portfolio.actions';
                          if (isDetailsLabel) {
                            return (
                              <SidebarMenuSubItem key={item.titleKey}>
                                <div className='inline-flex items-center gap-1.5 px-2 pt-2 text-[11px] font-medium text-muted-foreground'>
                                  {isTbankProvider ? (
                                    <Image
                                      src='/tbank-logo-32x32.png'
                                      alt='T-Bank'
                                      width={14}
                                      height={14}
                                      unoptimized
                                      className='size-3.5 rounded-[3px]'
                                    />
                                  ) : (
                                    <SelectedProviderIcon className='size-3.5' />
                                  )}
                                  <span>{selectedPortfolioName || t('common.loading')}</span>
                                </div>
                              </SidebarMenuSubItem>
                            );
                          }

                          if (isActionsLabel) {
                            return (
                              <Fragment key={item.titleKey}>
                                <SidebarMenuSubItem>
                                  <div className='inline-flex items-center gap-1.5 px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                                    {SubItemIcon ? <SubItemIcon className='size-3.5' /> : null}
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
                              <div className='inline-flex items-center gap-1.5 px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'
                              >
                                {SubItemIcon ? <SubItemIcon className='size-3.5' /> : null}
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
                              <Link href={buildPortfolioHref(item.href, resolvedPortfolioID)}>
                                {SubItemIcon ? <SubItemIcon className='size-4' /> : null}
                                <span>{t(item.titleKey)}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })
                      : (
                        <>
                          <SidebarMenuSubItem>
                            <div className='inline-flex items-center gap-1.5 px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                              <Wallet className='size-3.5' />
                              {t('navigation.portfolio.profiles')}
                            </div>
                          </SidebarMenuSubItem>
                          {availableProfiles.length > 0 ? availableProfiles.map(profile => {
                            const ProfileProviderIcon =
                              profile.providerKey === 'virtual'
                                ? Monitor
                                : profile.providerKey === 'mock'
                                  ? FlaskConical
                                  : CircleHelp;
                            const isProfileTbank = profile.providerKey === 'tbank';
                            return (
                              <SidebarMenuSubItem key={`profile:${profile.id}`}>
                                <SidebarMenuSubButton asChild>
                                  <Link href={buildPortfolioHref(PORTFOLIO_V2_ROUTES.overview, profile.id)}>
                                    {isProfileTbank ? (
                                      <Image
                                        src='/tbank-logo-32x32.png'
                                        alt='T-Bank'
                                        width={16}
                                        height={16}
                                        unoptimized
                                        className='size-4 rounded-[3px]'
                                      />
                                    ) : (
                                      <ProfileProviderIcon className='size-4' />
                                    )}
                                    <span>{profile.name}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          }) : (
                            <SidebarMenuSubItem>
                              <div className='px-2 py-1 text-xs text-muted-foreground'>
                                {profilesQuery.isLoading ? t('common.loading') : t('portfolio.selector.noProfiles')}
                              </div>
                            </SidebarMenuSubItem>
                          )}
                        </>
                      )}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
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
              tooltip={{
                children: t('navigation.cards.settings.title'),
                hidden: false,
              }}
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
                tooltip={{
                  children: t('navigation.signOut'),
                  hidden: false,
                }}
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
                tooltip={{
                  children: t('navigation.signIn'),
                  hidden: false,
                }}
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
