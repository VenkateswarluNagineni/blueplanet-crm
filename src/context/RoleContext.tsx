'use client';

import React, { createContext, useContext, useState, useTransition, ReactNode } from 'react';
import { impersonateAction, updateSettingAction } from '@/server/session-actions';

type Role = 'ADMIN' | 'SALES' | 'VENDOR';

interface VisibilitySettings {
  salesCanViewLandedCost: boolean;
  salesCanViewAllPipeline: boolean;
  vendorCanViewFullInventory: boolean;
}

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  settings: VisibilitySettings;
  updateSetting: (key: keyof VisibilitySettings, value: boolean) => void;
  /** True only for real ADMINs — gates the impersonation switcher. */
  canImpersonate: boolean;
  userEmail: string;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function SessionProvider({
  children,
  initialRole,
  initialSettings,
  canImpersonate,
  userEmail,
}: {
  children: ReactNode;
  initialRole: Role;
  initialSettings: VisibilitySettings;
  canImpersonate: boolean;
  userEmail: string;
}) {
  const [role, setRoleState] = useState<Role>(initialRole);
  const [settings, setSettings] = useState<VisibilitySettings>(initialSettings);
  const [, startTransition] = useTransition();

  // ADMIN-only impersonation. Optimistic UI; the server cookie is the source of
  // truth for actual authorization, so this is not a client-only bypass.
  const setRole = (newRole: Role) => {
    if (!canImpersonate) return;
    setRoleState(newRole);
    startTransition(() => {
      impersonateAction(newRole);
    });
  };

  const updateSetting = (key: keyof VisibilitySettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    startTransition(() => {
      updateSettingAction(key, value);
    });
  };

  return (
    <RoleContext.Provider value={{ role, setRole, settings, updateSetting, canImpersonate, userEmail }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a SessionProvider');
  }
  return context;
}
