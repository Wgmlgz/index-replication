'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usersApi as api, authApi } from '@/lib/api';
import { ModelsPermission } from '@/api-client';
import axios from 'axios';
import { useRouter } from 'next/navigation';

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

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<ModelsPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    setLoading(true);
    try {
      const resp = await api.meGet();
      console.log('user', user)
      setUser(resp.data.user);
      setPermissions(resp.data.permissions);
    } catch (e) {
      console.log(e)
      setUser(null);
      setPermissions([]);
      if (axios.isAxiosError(e)) {
        if (e.status === axios.HttpStatusCode.Unauthorized) {
          router.push('/login');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    try {
      await authApi.logoutPost();
      setUser(null);
      setPermissions([]);
    } catch (e) {
      console.warn('logout error', e)
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider
      value={{ user, setUser, loading, refreshUser, logoutUser, permissions }}
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
  | 'self:reset_password'
  ;

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
