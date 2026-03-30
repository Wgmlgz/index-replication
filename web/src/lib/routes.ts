export const PUBLIC_ROUTES = ['/', '/login', '/auth/silent-callback'] as const;

export const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number]);
}

export function getSafeNextPath(nextPath: string | null | undefined): string | null {
  if (!nextPath) {
    return null;
  }

  if (!nextPath.startsWith('/')) {
    return null;
  }

  if (nextPath.startsWith('//')) {
    return null;
  }

  if (nextPath === '/login' || nextPath.startsWith('/login?')) {
    return null;
  }

  return nextPath;
}
