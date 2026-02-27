'use client';

import { useEffect, useRef } from 'react';
import { canonicalizeSearchParams } from './search-params';

type UseUrlStateSyncOptions<TParsed> = {
  pathname: string;
  urlKey: string;
  stateKey: string;
  parse: (params: URLSearchParams) => TParsed;
  applyParsedState: (parsed: TParsed) => void;
  buildSearchParams: () => URLSearchParams;
};

export function useUrlStateSync<TParsed>({
  pathname,
  urlKey,
  stateKey,
  parse,
  applyParsedState,
  buildSearchParams,
}: UseUrlStateSyncOptions<TParsed>) {
  const parseRef = useRef(parse);
  const applyParsedStateRef = useRef(applyParsedState);
  const buildSearchParamsRef = useRef(buildSearchParams);

  useEffect(() => {
    parseRef.current = parse;
    applyParsedStateRef.current = applyParsedState;
    buildSearchParamsRef.current = buildSearchParams;
  }, [applyParsedState, buildSearchParams, parse]);

  useEffect(() => {
    const parsed = parseRef.current(new URLSearchParams(urlKey));
    applyParsedStateRef.current(parsed);
  }, [urlKey]);

  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const next = buildSearchParamsRef.current();

    const currentCanonical = canonicalizeSearchParams(current);
    const nextCanonical = canonicalizeSearchParams(next);
    if (currentCanonical === nextCanonical) return;

    const hash = window.location.hash || '';
    const nextUrl = nextCanonical.length > 0
      ? `${pathname}?${nextCanonical}${hash}`
      : `${pathname}${hash}`;

    window.history.replaceState(window.history.state, '', nextUrl);
  }, [pathname, stateKey]);

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRef.current(new URLSearchParams(window.location.search));
      applyParsedStateRef.current(parsed);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
