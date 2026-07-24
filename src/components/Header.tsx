'use client';

import { Search, Settings, ShieldAlert, LogOut, Menu } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useMobileNav } from '@/context/MobileNav';
import { useState, useEffect } from 'react';
import { logoutAction } from '@/server/session-actions';
import { CommandPalette } from '@/components/CommandPalette';
import { Drawer } from '@/components/ui/Drawer';

export function Header() {
  const { role, setRole, settings, updateSetting, canImpersonate, userEmail } = useRole();
  const { setOpen: setMobileNavOpen } = useMobileNav();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const roleInitial = role === 'ADMIN' ? 'AD' : role === 'SALES' ? 'SR' : 'VD';
  const roleAvatarClass =
    role === 'ADMIN'
      ? 'bg-[var(--color-vein)] text-[var(--color-primary-text)]'
      : role === 'SALES'
        ? 'bg-[var(--color-emerald)] text-white'
        : 'bg-[var(--color-sodalite)] text-white';

  return (
    <>
      <header className="h-[54px] bp-glass-bar flex items-center justify-between px-4 z-10 shrink-0 relative">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          className="md:hidden mr-2 shrink-0 text-[var(--color-text-secondary)] hover:text-white p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--color-basalt-700)] transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="flex-1 flex items-center max-w-2xl min-w-0">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            aria-label="Open command menu"
            className="flex items-center w-full h-9 bg-[var(--color-basalt-950)] border border-[var(--color-basalt-500)] rounded-[var(--radius-md)] px-3.5 hover:border-[rgba(146,176,206,0.5)] transition-all text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-vein)] focus-visible:outline-offset-2"
          >
            <Search size={14} className="text-[var(--color-fog-500)] mr-2.5 shrink-0" />
            <span className="text-[13px] text-[var(--color-fog-500)] w-full truncate whitespace-nowrap text-left">
              Search slabs, orders, people… or jump
            </span>
            <span className="text-[10px] text-[var(--color-fog-500)] border border-[var(--color-basalt-500)] px-1.5 py-0.5 rounded ml-2 whitespace-nowrap shrink-0 hidden sm:flex items-center gap-1 font-mono">
              <span className="bg-[var(--color-basalt-700)] px-1 rounded text-[var(--color-text-secondary)]">
                Ctrl
              </span>
              <span className="bg-[var(--color-basalt-700)] px-1 rounded text-[var(--color-text-secondary)]">
                K
              </span>
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 ml-3 sm:ml-4 shrink-0">
          {canImpersonate && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'SALES' | 'VENDOR')}
              className="bp-select h-8 text-[12px] py-0 max-w-[7.5rem]"
              title="Preview the app as another role"
              aria-label="View as role"
            >
              <option value="ADMIN">Admin</option>
              <option value="SALES">Sales</option>
              <option value="VENDOR">Vendor</option>
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              if (role === 'ADMIN') setIsSettingsOpen(true);
            }}
            disabled={role !== 'ADMIN'}
            className={`flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-[var(--radius-md)] transition-colors text-left ${
              role === 'ADMIN'
                ? 'hover:bg-[var(--color-basalt-700)] cursor-pointer'
                : 'cursor-default'
            }`}
            title={role === 'ADMIN' ? 'Workspace settings' : userEmail ?? 'Signed in'}
            aria-label={role === 'ADMIN' ? 'Open settings' : 'Account'}
          >
            <div
              className={`w-7 h-7 rounded-[var(--radius-md)] flex items-center justify-center text-[10px] font-semibold shadow-sm ${roleAvatarClass}`}
            >
              {roleInitial}
            </div>
            <div className="overflow-hidden hidden md:block min-w-0 max-w-[11rem]">
              <p className="text-[12px] font-medium text-white truncate leading-tight">{userEmail}</p>
              <p className="text-[10px] text-[var(--color-fog-500)] truncate capitalize leading-tight">
                {role === 'ADMIN' ? 'Administrator' : role === 'SALES' ? 'Sales' : 'Vendor'}
              </p>
            </div>
            {role === 'ADMIN' && (
              <Settings size={14} className="text-[var(--color-fog-500)] shrink-0 hidden sm:block" />
            )}
          </button>

          <form action={logoutAction}>
            <button
              type="submit"
              className="btn-ghost !min-h-8 !px-2 text-[12px]"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={14} />
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} role={role} settings={settings} />

      <Drawer
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-[var(--color-vein)]" /> Global Security Settings
          </span>
        }
        subtitle="Control what Sales and Vendors can access."
        width={450}
      >
        <div className="p-6 space-y-8">
          <div className="space-y-4">
            <h3 className="bp-section-title border-b border-[var(--color-basalt-500)] pb-2">
              Sales rep permissions
            </h3>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] text-white font-medium mb-1">View landed costs</p>
                <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                  Allow sales reps to see landed cost calculations.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.salesCanViewLandedCost}
                  onChange={(e) => updateSetting('salesCanViewLandedCost', e.target.checked)}
                />
                <div className="w-9 h-5 bg-[var(--color-basalt-500)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-emerald)]" />
              </label>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] text-white font-medium mb-1">Global pipeline visibility</p>
                <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                  Allow sales to view the pipeline of all associates.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.salesCanViewAllPipeline}
                  onChange={(e) => updateSetting('salesCanViewAllPipeline', e.target.checked)}
                />
                <div className="w-9 h-5 bg-[var(--color-basalt-500)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-emerald)]" />
              </label>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="bp-section-title border-b border-[var(--color-basalt-500)] pb-2">
              Vendor permissions
            </h3>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[14px] text-white font-medium mb-1">Full inventory directory</p>
                <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                  Vendors can search all inventory, not only their shipped goods.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.vendorCanViewFullInventory}
                  onChange={(e) => updateSetting('vendorCanViewFullInventory', e.target.checked)}
                />
                <div className="w-9 h-5 bg-[var(--color-basalt-500)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-sodalite)]" />
              </label>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
