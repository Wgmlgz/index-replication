'use client';

import React, { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi as api, authApi } from '@/lib/api';
import { ModelsPermission } from '@/api-client';
import axios from 'axios';
import { useRouter, usePathname } from 'next/navigation';

type RoleKey =
  | string
  | 'root'
  | 'administrator'
  | 'manager'
  | 'operator'
  | 'observer';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role_id: number;
  role_key: RoleKey | string;
  organization_id?: number;
  organization_name?: string;
  phone?: string;
  email?: string;
  last_active?: string;
  is_blocked: boolean;
  created_at: string;
}

interface UserContextValue {
  user: User | null;
  permissions: ModelsPermission[];
  setUser: (user: User | null) => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logoutUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

const USER_QUERY_KEY = ['auth', 'me'];

type MeData = {
  user: User | null;
  permissions: ModelsPermission[];
};

const emptyMeData: MeData = {
  user: null,
  permissions: [],
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<MeData>({
    queryKey: USER_QUERY_KEY,
    queryFn: async () => {
      const resp = await api.meGet();
      return {
        user: resp.data.user ?? null,
        permissions: resp.data.permissions ?? [],
      };
    },
    retry: false,
    initialData: () => queryClient.getQueryData<MeData>(USER_QUERY_KEY),
    onError: error => {
      queryClient.setQueryData(USER_QUERY_KEY, emptyMeData);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (
          status === axios.HttpStatusCode.Unauthorized &&
          !pathname.startsWith('/login')
        ) {
          router.push('/login', {});
        }
      }
    },
  });

  const refreshUser = async () => {
    await refetch();
  };

  const logoutUser = async () => {
    try {
      await authApi.logoutPost();
    } catch (e) {
      console.warn('logout error', e);
    } finally {
      queryClient.setQueryData(USER_QUERY_KEY, emptyMeData);
      queryClient.removeQueries({ queryKey: USER_QUERY_KEY });
    }
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
        loading: isLoading,
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
    // console.log(obj, act, ctx.permissions, res)
    return res;
  };

  return { ...ctx, hasPermission };
}
