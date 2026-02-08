'use client';

import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type MoexSourceButtonProps = {
  href?: string;
  label: string;
  tooltip?: string;
  disabledTooltip?: string;
  className?: string;
};

function MoexMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm bg-[#e30613] px-1 text-[9px] font-semibold uppercase leading-[1.1] text-white py-1',
        className
      )}
      aria-hidden='true'
    >
      MOEX
    </span>
  );
}

export function MoexSourceButton({
  href,
  label,
  tooltip,
  disabledTooltip,
  className,
}: MoexSourceButtonProps) {
  const tooltipContent = tooltip ?? label;

  const buttonContent = (
    <span className='flex items-center gap-1'>
      <MoexMark />
      <Info className='h-3.5 w-3.5' aria-hidden='true' />
      <span className='sr-only'>{label}</span>
    </span>
  );

  if (href) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant='ghost'
            size='sm'
            className={cn('h-7 px-2', className)}
          >
            <a href={href} target='_blank' rel='noreferrer noopener'>
              {buttonContent}
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='inline-flex'>
          <Button
            variant='ghost'
            size='sm'
            className={cn('h-7 px-2', className)}
            disabled
          >
            {buttonContent}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{disabledTooltip ?? tooltipContent}</TooltipContent>
    </Tooltip>
  );
}
