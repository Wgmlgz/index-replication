import { PermissionStr } from "@/components/user-context";
import { History, Users, LineChart, Wallet } from "lucide-react";

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
    title: 'Индексы MOEX',
    icon: LineChart,
    buttonText: 'Открыть индексы',
    href: '/moex-indexes',
    permission: null,
  },
  {
    title: 'Журнал событий',
    icon: History,
    buttonText: 'Просмотреть журнал',
    href: '/audit-logs',
    permission: 'audit_logs:view',
  },
  {
    title: 'Пользователи',
    icon: Users,
    buttonText: 'Управлять пользователями',
    href: '/users',
    permission: 'users:view',
  },
  {
    title: 'Настройки',
    icon: History,
    buttonText: 'Перейти к настройкам',
    href: '/settings',
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
];
