'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type FullPageRedirectStatusProps = {
  title: string;
  description: string;
  children?: ReactNode;
  revealDelayMs?: number;
  fadeInMs?: number;
};

export function FullPageRedirectStatus({
  title,
  description,
  children,
  revealDelayMs = 0,
  fadeInMs = 200,
}: FullPageRedirectStatusProps) {
  const [isRendered, setIsRendered] = useState(revealDelayMs <= 0);
  const [isVisible, setIsVisible] = useState(revealDelayMs <= 0);

  useEffect(() => {
    if (isRendered) {
      return;
    }

    const timerID = window.setTimeout(() => {
      setIsRendered(true);
    }, Math.max(0, revealDelayMs));
    return () => window.clearTimeout(timerID);
  }, [isRendered, revealDelayMs]);

  useEffect(() => {
    if (!isRendered || isVisible) {
      return;
    }
    const rafID = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => window.cancelAnimationFrame(rafID);
  }, [isRendered, isVisible]);

  if (!isRendered) {
    return null;
  }

  return (
    <div
      className='flex min-h-svh items-center justify-center p-6 text-center'
      style={{
        opacity: isVisible ? 1 : 0,
        transition: `opacity ${Math.max(0, fadeInMs)}ms ease`,
      }}
    >
      <div className='space-y-2'>
        <h1 className='text-xl font-semibold'>{title}</h1>
        <p className='text-sm text-muted-foreground'>{description}</p>
        {children}
      </div>
    </div>
  );
}
