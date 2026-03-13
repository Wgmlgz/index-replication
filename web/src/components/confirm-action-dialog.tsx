'use client';

import type { ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type ConfirmActionDialogProps = {
  trigger: ReactNode;
  title: string;
  description: string;
  cancelLabel: string;
  actionLabel: string;
  disabled?: boolean;
  onAction: () => unknown;
};

export function ConfirmActionDialog({
  trigger,
  title,
  description,
  cancelLabel,
  actionLabel,
  disabled = false,
  onAction,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onAction()} disabled={disabled}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
