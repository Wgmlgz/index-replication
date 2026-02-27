import { PermissionStr } from "@/components/user-context";
import { History, Users, LineChart, Wallet, Plug } from "lucide-react";

export type DashboardCard = {
  title: string;
  titleKey?: string;
  icon: React.ComponentType<{ className?: string }>;
  buttonText: string;
  buttonTextKey?: string;
  href: string;
  permission: PermissionStr | null;
}


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
    title: 'T-Bank test buy',
    titleKey: 'tbankTest.menu.title',
    icon: Wallet,
    buttonText: 'Open T-Bank tester',
    buttonTextKey: 'tbankTest.menu.button',
    href: '/tbank-test',
    permission: null,
  },
  {
    title: 'Portfolio',
    titleKey: 'navigation.cards.portfolio.title',
    icon: Wallet,
    buttonText: 'Open portfolio',
    buttonTextKey: 'navigation.cards.portfolio.button',
    href: '/portfolio',
    permission: null,
  },
];
