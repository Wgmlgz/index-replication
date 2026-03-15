'use client';

import React, { createContext, useContext } from 'react';
import { useIsRestoring, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi as api } from '@/lib/api';
import { Permission } from '@/api-client';
import axios from 'axios';
import { clearKeycloakTokens } from '@/lib/keycloak-auth';

type RoleKey = string;

export interface User {
  id: number;
  username: string;
  full_name: string;
  role_id: number;
  role_key: RoleKey;
  organization_id?: number;
  organization_name?: string;
  phone?: string;
  email?: string;
  last_active?: string;
  is_blocked: boolean;
  created_at: string;
}

export type AuthState = 'restoring' | 'authenticated' | 'unauthenticated';

interface UserContextValue {
  user: User | null;
  permissions: Permission[];
  setUser: (user: User | null) => void;
  loading: boolean;
  authState: AuthState;
  refreshUser: () => Promise<void>;
  logoutUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

const USER_QUERY_KEY = ['auth', 'me'];

type MeData = {
  user: User | null;
  permissions: Permission[];
};

const emptyMeData: MeData = {
  user: null,
  permissions: [],
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();

  const { data, isPending, refetch } = useQuery<MeData>({
    queryKey: USER_QUERY_KEY,
    queryFn: async () => {
      try {
        const resp = await api.meGet();
        return {
          user: resp.data.user ?? null,
          permissions: resp.data.permissions ?? [],
        };
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === axios.HttpStatusCode.Unauthorized
        ) {
          clearKeycloakTokens();
          return emptyMeData;
        }

        throw error;
      }
    },
    retry: false,
    initialData: () => queryClient.getQueryData<MeData>(USER_QUERY_KEY),
    refetchOnMount: 'always',
  });

  const loading = isRestoring || (isPending && !data);
  const authState: AuthState = loading
    ? 'restoring'
    : data?.user
      ? 'authenticated'
      : 'unauthenticated';

  const refreshUser = async () => {
    await refetch();
  };

  const logoutUser = (): Promise<void> => {
    clearKeycloakTokens();
    queryClient.setQueryData(USER_QUERY_KEY, emptyMeData);
    return Promise.resolve();
  };

  const setUser = (nextUser: User | null) => {
    queryClient.setQueryData<MeData>(USER_QUERY_KEY, prev => {
      const current = prev ?? emptyMeData;
      return {
        user: nextUser,
        permissions: nextUser ? current.permissions : [],
      };
    });
  };

  return (
    <UserContext.Provider
      value={{
        user: data?.user ?? null,
        permissions: data?.permissions ?? [],
        setUser,
        loading,
        authState,
        refreshUser,
        logoutUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export type PermissionStr =
  | 'users:view'
  | 'users:create'
  | 'users:delete'
  | 'users:create_role_root'
  | 'users:create_role_administrator'
  | 'users:create_role_manager'
  | 'users:create_role_operator'
  | 'users:create_role_observer'
  | 'users:delete_role_root'
  | 'users:delete_role_administrator'
  | 'users:delete_role_manager'
  | 'users:delete_role_operator'
  | 'users:delete_role_observer'
  | 'users:edit'
  | 'users:block'
  | 'audit_logs:view'
  | 'settings:view'
  | 'system_metadata:view'
  | 'self:view'
  | 'self:reset_password';

export type PermissionChecker = (permissionStr: PermissionStr) => boolean;
export type UseUserRet = UserContextValue & {
  hasPermission: PermissionChecker;
};
export function useUser(): UseUserRet {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');

  const hasPermission: PermissionChecker = permissionStr => {
    if (!ctx.user) return false;
    if (ctx.user.role_key === 'root') return true;
    const [obj, act] = permissionStr.split(':');
    const res = ctx.permissions.some(p => p.obj === obj && p.act === act);
    return res;
  };

  return { ...ctx, hasPermission };
}
