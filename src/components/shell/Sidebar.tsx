'use client';

import React, { useState, createContext, useContext, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, Menu, Command } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useMobileNav } from '@/context/MobileNav';
import { BrandMark } from '@/components/brand/Wordmark';
import {
  type AppRole,
  type NavItemDef,
  visibleNavItems,
  labelFor,
  isNavActive,
  GROUP_ORDER,
} from '@/lib/domain/nav';

export type NavBadges = Partial<Record<string, number>>;

interface SidebarContextType {
  isCollapsed: boolean;
  pathname: string;
  onItemClick: () => void;
  badges: NavBadges;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  pathname: '',
  onItemClick: () => {},
  badges: {},
});

const ROLE_CHIP: Record<AppRole, { label: string; className: string }> = {
  ADMIN: {
    label: 'Admin',
    className: 'bg-[rgba(227,193,108,0.15)] text-[var(--color-vein)] border-[rgba(227,193,108,0.3)]',
  },
  SALES: {
    label: 'Sales',
    className: 'bg-[rgba(16,185,129,0.15)] text-[var(--color-emerald)] border-[rgba(16,185,129,0.3)]',
  },
  VENDOR: {
    label: 'Vendor',
    className: 'bg-[rgba(146,176,206,0.15)] text-[var(--color-sodalite)] border-[rgba(146,176,206,0.3)]',
  },
};

const NavItem = ({ item, role }: { item: NavItemDef; role: AppRole }) => {
  const { isCollapsed, pathname, onItemClick, badges } = useContext(SidebarContext);
  const label = labelFor(item, role);
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;
  const badge =
    item.badgeKey && badges[item.badgeKey] != null && badges[item.badgeKey]! > 0
      ? badges[item.badgeKey]!
      : null;

  return (
    <Link href={item.href} className="block" onClick={onItemClick} title={item.hint}>
      <div
        className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-[var(--radius-md)] cursor-pointer transition-all mb-0.5 text-[13px] ${
          active
            ? 'bg-[var(--color-basalt-700)] text-white font-medium shadow-[var(--shadow-lift-1)] border-l-2 border-[var(--color-vein)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-basalt-700)]/70 hover:text-white border-l-2 border-transparent'
        }`}
      >
        <span className="relative shrink-0">
          <Icon size={16} className={active ? 'opacity-100 text-[var(--color-vein)]' : 'opacity-80'} />
          {isCollapsed && badge != null && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--color-vein)] text-[var(--color-primary-text)] text-[9px] font-bold flex items-center justify-center leading-none">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        {!isCollapsed && (
          <>
            <span className="whitespace-nowrap truncate flex-1">{label}</span>
            {badge != null && (
              <span className="ml-1 shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[rgba(227,193,108,0.15)] text-[var(--color-vein)] border border-[rgba(227,193,108,0.3)] text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </>
        )}
      </div>
    </Link>
  );
};

const NavGroup = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { isCollapsed } = useContext(SidebarContext);
  if (!children) return null;
  return (
    <div className="mb-5">
      {!isCollapsed && (
        <div className="px-3 py-1 mb-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fog-500)] whitespace-nowrap overflow-hidden text-ellipsis">
            {title}
          </h3>
        </div>
      )}
      {isCollapsed && <div className="mx-auto w-6 border-t border-[var(--color-basalt-700)] mb-2" aria-hidden />}
      <div className={isCollapsed ? 'flex flex-col items-center gap-0.5' : 'space-y-0.5'}>
        {children}
      </div>
    </div>
  );
};

export function Sidebar({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { role, settings, userEmail } = useRole();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNav();
  const appRole = role as AppRole;
  const chip = ROLE_CHIP[appRole];

  const items = useMemo(() => visibleNavItems(appRole, settings), [appRole, settings]);

  const topLevel = items.filter((i) => !i.group[appRole]);
  const groups = useMemo(() => {
    const map = new Map<string, NavItemDef[]>();
    for (const item of items) {
      const g = item.group[appRole];
      if (!g) continue;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    const preferred = GROUP_ORDER[appRole] ?? [];
    const ordered: { title: string; items: NavItemDef[] }[] = [];
    for (const title of preferred) {
      const list = map.get(title);
      if (list?.length) ordered.push({ title, items: list });
      map.delete(title);
    }
    for (const [title, list] of map) {
      if (list.length) ordered.push({ title, items: list });
    }
    return ordered;
  }, [items, appRole]);

  const ctxValue = {
    isCollapsed,
    pathname,
    onItemClick: () => setMobileOpen(false),
    badges,
  };

  return (
    <SidebarContext.Provider value={ctxValue}>
      <>
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside
          className={`bg-[var(--color-basalt-900)] border-r border-[var(--color-border)] flex flex-col shrink-0 h-screen z-50 fixed md:sticky top-0 left-0 transition-transform md:transition-all duration-300 ease-in-out w-[240px] ${
            isCollapsed ? 'md:w-[64px]' : 'md:w-[240px]'
          } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        >
          {/* Scrollable nav body */}
          <div className="flex-1 p-3 overflow-y-auto overflow-x-hidden relative min-h-0">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`absolute top-3 ${isCollapsed ? 'right-0 left-0 mx-auto w-6' : 'right-2 w-6'} h-6 rounded-[var(--radius-sm)] bg-[var(--color-basalt-700)] hover:bg-[var(--color-basalt-500)] border border-[var(--color-basalt-500)] hidden md:flex items-center justify-center text-[var(--color-text-secondary)] hover:text-white transition-colors z-10 cursor-pointer`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <Menu size={12} /> : <ChevronsLeft size={12} />}
            </button>

            <Link
              href={appRole === 'VENDOR' ? '/vendor' : '/'}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 px-2'} mb-7 cursor-pointer mt-8 group`}
              onClick={() => setMobileOpen(false)}
              aria-label="BluePlanet home"
            >
              <BrandMark size={28} />
              {!isCollapsed && (
                <div className="min-w-0">
                  <span
                    className="block text-[16px] font-semibold tracking-tight text-white whitespace-nowrap leading-none group-hover:text-[var(--color-vein)] transition-colors"
                    style={{ fontFamily: 'var(--font-fraunces), serif' }}
                  >
                    BluePlanet
                  </span>
                  <span className="block text-[9px] uppercase tracking-[0.14em] text-[var(--color-fog-500)] mt-1 font-medium">
                    Stone OS
                  </span>
                </div>
              )}
            </Link>

            {topLevel.length > 0 && (
              <div className="mb-4">
                {topLevel.map((item) => (
                  <NavItem key={item.id} item={item} role={appRole} />
                ))}
              </div>
            )}

            <div>
              {groups.map((g) => (
                <NavGroup key={g.title} title={g.title}>
                  {g.items.map((item) => (
                    <NavItem key={item.id} item={item} role={appRole} />
                  ))}
                </NavGroup>
              ))}
            </div>
          </div>

          {/* Footer: role + keyboard hint */}
          <div
            className={`shrink-0 border-t border-[var(--color-basalt-500)] p-3 ${isCollapsed ? 'flex flex-col items-center gap-2' : 'space-y-2'}`}
          >
            {!isCollapsed ? (
              <>
                <div className="flex items-center justify-between gap-2 px-1">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                  <span className="text-[10px] text-[var(--color-fog-500)] truncate" title={userEmail}>
                    {userEmail.split('@')[0]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fog-500)] px-1">
                  <Command size={11} className="shrink-0" />
                  <span>
                    Search with{' '}
                    <kbd className="font-mono text-[10px] bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] rounded px-1 py-0.5 text-[var(--color-text-secondary)]">
                      Ctrl
                    </kbd>{' '}
                    <kbd className="font-mono text-[10px] bg-[var(--color-basalt-700)] border border-[var(--color-basalt-500)] rounded px-1 py-0.5 text-[var(--color-text-secondary)]">
                      K
                    </kbd>
                  </span>
                </div>
              </>
            ) : (
              <>
                <span
                  className={`w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold border ${chip.className}`}
                  title={`${chip.label} · ${userEmail}`}
                >
                  {chip.label.slice(0, 1)}
                </span>
                <span
                  className="text-[9px] text-[var(--color-fog-500)] font-mono"
                  title="Command palette: Ctrl+K"
                >
                  ⌘K
                </span>
              </>
            )}
          </div>
        </aside>
      </>
    </SidebarContext.Provider>
  );
}
