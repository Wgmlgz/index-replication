'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from './sidebar';

type ModeToggleProps = {
  className?: string;
  labelClassName?: string;
};

export function ModeToggle({ className, labelClassName }: ModeToggleProps) {
  const [mounted, setMounted] = React.useState(false);
  const { setTheme } = useTheme();
  const { t } = useTranslation();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          isActive={false}
          tooltip={{
            children: t('navigation.themeToggle'),
            hidden: false,
          }}
          className={className}
          aria-label={t('navigation.themeToggle')}
        >
          <Sun className='size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
          <Moon className='absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
          <span className={labelClassName}>{t('navigation.themeToggle')}</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={() => setTheme('light')}>{t('navigation.themeLight')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>{t('navigation.themeDark')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>{t('navigation.themeSystem')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
