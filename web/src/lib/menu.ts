import { PermissionStr } from "@/components/user-context";
import { History, Users, LineChart, Wallet, Plug } from "lucide-react";
import { PORTFOLIO_V2_ROUTES } from "@/lib/portfolio";

export type DashboardCard = {
  title: string;
  titleKey?: string;
  icon: React.ComponentType<{ className?: string }>;
  buttonText: string;
  buttonTextKey?: string;
  href: string;
  permission: PermissionStr | null;
}

export type SidebarSubItem = {
  kind: "item";
  titleKey: string;
  href: string;
  activePathname?: string;
  matchSubpaths?: boolean;
  permission: PermissionStr | null;
}

export type SidebarSubLabel = {
  kind: "label";
  titleKey: string;
};

export type SidebarSubEntry = SidebarSubItem | SidebarSubLabel;


export const DashboardCards: DashboardCard[] = [
  {
    title: 'MOEX indexes',
    titleKey: 'navigation.cards.moex.title',
    icon: LineChart,
    buttonText: 'Open indexes',
    buttonTextKey: 'navigation.cards.moex.button',
    href: '/moex-indexes',
    permission: null,
  },
  {
    title: 'Audit logs',
    titleKey: 'navigation.cards.auditLogs.title',
    icon: History,
    buttonText: 'View logs',
    buttonTextKey: 'navigation.cards.auditLogs.button',
    href: '/audit-logs',
    permission: 'audit_logs:view',
  },
  {
    title: 'Users',
    titleKey: 'navigation.cards.users.title',
    icon: Users,
    buttonText: 'Manage users',
    buttonTextKey: 'navigation.cards.users.button',
    href: '/users',
    permission: 'users:view',
  },
  {
    title: 'Settings',
    titleKey: 'navigation.cards.settings.title',
    icon: History,
    buttonText: 'Open settings',
    buttonTextKey: 'navigation.cards.settings.button',
    href: '/settings',
    permission: null,
  },
  {
    title: 'Integrations',
    titleKey: 'navigation.cards.integrations.title',
    icon: Plug,
    buttonText: 'Open integrations',
    buttonTextKey: 'navigation.cards.integrations.button',
    href: '/integrations',
    permission: null,
  },
  {
    title: 'Portfolio',
    titleKey: 'navigation.cards.portfolio.title',
    icon: Wallet,
    buttonText: 'Open portfolio',
    buttonTextKey: 'navigation.cards.portfolio.button',
    href: PORTFOLIO_V2_ROUTES.profiles,
    permission: null,
  },
];

export const PortfolioSidebarSubItems: SidebarSubEntry[] = [
  {
    kind: "item",
    titleKey: 'navigation.portfolio.profiles',
    href: PORTFOLIO_V2_ROUTES.profiles,
    activePathname: PORTFOLIO_V2_ROUTES.profiles,
    permission: null,
  },
  {
    kind: "label",
    titleKey: "navigation.portfolio.details",
  },
  {
    kind: "label",
    titleKey: "navigation.portfolio.overview",
  },
  {
    kind: "item",
    titleKey: "portfolio.overview.tabs.summary",
    href: PORTFOLIO_V2_ROUTES.overview,
    activePathname: PORTFOLIO_V2_ROUTES.overview,
    permission: null,
  },
  {
    kind: "item",
    titleKey: "portfolio.overview.tabs.operations",
    href: PORTFOLIO_V2_ROUTES.overviewOperations,
    activePathname: PORTFOLIO_V2_ROUTES.overviewOperations,
    permission: null,
  },
  {
    kind: "item",
    titleKey: "portfolio.overview.tabs.compare",
    href: PORTFOLIO_V2_ROUTES.overviewCompare,
    activePathname: PORTFOLIO_V2_ROUTES.overviewCompare,
    permission: null,
  },
  {
    kind: "item",
    titleKey: "portfolio.overview.tabs.analytics",
    href: PORTFOLIO_V2_ROUTES.overviewAnalytics,
    activePathname: PORTFOLIO_V2_ROUTES.overviewAnalytics,
    permission: null,
  },
  {
    kind: "label",
    titleKey: 'navigation.portfolio.actions',
  },
  {
    kind: "label",
    titleKey: "navigation.portfolio.replication",
  },
  {
    kind: "item",
    titleKey: "portfolio.replication.tabs.drafts",
    href: PORTFOLIO_V2_ROUTES.replicationDrafts,
    activePathname: PORTFOLIO_V2_ROUTES.replicationDrafts,
    permission: null,
  },
  {
    kind: "item",
    titleKey: "portfolio.replication.tabs.settings",
    href: PORTFOLIO_V2_ROUTES.replication,
    activePathname: PORTFOLIO_V2_ROUTES.replication,
    permission: null,
  },
];
