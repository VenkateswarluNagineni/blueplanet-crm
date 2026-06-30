'use client';

import { Search, Settings, ShieldAlert, X, LogOut, Menu } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useMobileNav } from '@/context/MobileNav';
import { useState, useEffect } from 'react';
import { logoutAction } from '@/server/session-actions';
import { CommandPalette } from '@/components/CommandPalette';

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

  return (
    <>
      <header className="h-[52px] border-b border-[#454446] bg-[#2b2a2c] flex items-center justify-between px-4 z-10 shrink-0 relative">
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          className="md:hidden mr-2 shrink-0 text-[#b8b6b9] hover:text-white p-1.5 rounded hover:bg-[#333234] transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="flex-1 flex items-center max-w-2xl min-w-0">
          <button
            onClick={() => setCmdOpen(true)}
            aria-label="Open command menu"
            className="flex items-center w-full bg-[#1c1c1c] border border-[#454446] rounded-lg px-3.5 py-2 hover:border-[#92b0ce] transition-all text-left shadow-sm"
          >
            <Search size={14} className="text-[#b8b6b9] mr-2.5 shrink-0" />
            <span className="text-[13px] text-[#b8b6b9] w-full truncate whitespace-nowrap text-left">Search or jump to…</span>
            <span className="text-[10px] text-[#b8b6b9] border border-[#454446] px-1.5 py-0.5 rounded ml-2 whitespace-nowrap shrink-0 hidden sm:flex items-center gap-1 font-mono"><span className="bg-[#333234] px-1 rounded">Ctrl</span><span className="bg-[#333234] px-1 rounded">K</span></span>
          </button>
        </div>
        
        {/* Right Side: Environment & User Profile */}
        <div className="flex items-center gap-3 sm:gap-6 ml-3 sm:ml-4 shrink-0">

          {/* Admin-only impersonation switcher (server-enforced via cookie) */}
          {canImpersonate && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[11px] text-[#b8b6b9] uppercase tracking-wider">View as:</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'ADMIN' | 'SALES' | 'VENDOR')}
                className="bg-[#1c1c1c] border border-[#454446] rounded text-[12px] text-white px-2 py-1 outline-none focus:border-[#92b0ce] transition-colors"
                title="Preview the app as another role"
              >
                <option value="ADMIN">Admin</option>
                <option value="SALES">Sales Rep</option>
                <option value="VENDOR">Vendor</option>
              </select>
            </div>
          )}

          {/* User Profile */}
          <div
            onClick={() => {
              if (role === 'ADMIN') setIsSettingsOpen(true);
            }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${role === 'ADMIN' ? 'hover:bg-[#333234] cursor-pointer' : 'opacity-70 cursor-default'}`}
            title={role === 'ADMIN' ? "Manage Admin Settings" : "Settings only available to Admin"}
          >
            <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] text-white font-medium ${role === 'ADMIN' ? 'bg-[#e3c16c] text-black' : role === 'SALES' ? 'bg-[#10b981]' : 'bg-[#92b0ce]'}`}>
              {role === 'ADMIN' ? 'AD' : role === 'SALES' ? 'SR' : 'VD'}
            </div>
            <div className="flex-1 overflow-hidden hidden sm:block">
              <p className="text-[13px] font-medium text-white truncate">{userEmail}</p>
              <p className="text-[10px] text-[#b8b6b9] truncate capitalize">{role.toLowerCase()}</p>
            </div>
            {role === 'ADMIN' && <Settings size={14} className="text-[#b8b6b9]" />}
          </div>

          {/* Logout */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-[12px] text-[#b8b6b9] hover:text-white hover:bg-[#333234] px-2 py-1.5 rounded-md transition-colors"
              title="Sign out"
            >
              <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} role={role} />

      {/* Admin Settings Drawer */}
      {isSettingsOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40 transition-opacity" 
            onClick={() => setIsSettingsOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-[450px] bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#454446] bg-[#1c1c1c]">
              <div>
                <h2 className="text-[18px] font-medium text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-[#e3c16c]" /> Global Security Settings
                </h2>
                <p className="text-[13px] text-[#b8b6b9] mt-1">Control what Sales and Vendors can access.</p>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-[#b8b6b9] hover:text-white hover:bg-[#333234] p-1.5 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Toggles */}
            <div className="p-6 space-y-8 flex-1 overflow-y-auto">
              
              {/* Sales Permissions */}
              <div className="space-y-4">
                <h3 className="text-[12px] uppercase tracking-wider text-[#b8b6b9] font-medium border-b border-[#454446] pb-2">Sales Rep Permissions</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] text-white font-medium mb-1">View Landed Costs</p>
                    <p className="text-[11px] text-[#b8b6b9]">Allow sales reps to see the sensitive landed cost calculations.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={settings.salesCanViewLandedCost}
                      onChange={(e) => updateSetting('salesCanViewLandedCost', e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-[#454446] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] text-white font-medium mb-1">Global Pipeline Visibility</p>
                    <p className="text-[11px] text-[#b8b6b9]">Allow sales to view the active pipeline of ALL other associates.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={settings.salesCanViewAllPipeline}
                      onChange={(e) => updateSetting('salesCanViewAllPipeline', e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-[#454446] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981]"></div>
                  </label>
                </div>
              </div>

              {/* Vendor Permissions */}
              <div className="space-y-4 pt-4">
                <h3 className="text-[12px] uppercase tracking-wider text-[#b8b6b9] font-medium border-b border-[#454446] pb-2">Vendor / Supplier Permissions</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] text-white font-medium mb-1">Full Inventory Directory</p>
                    <p className="text-[11px] text-[#b8b6b9]">Vendors can search all inventory, not just their shipped goods.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={settings.vendorCanViewFullInventory}
                      onChange={(e) => updateSetting('vendorCanViewFullInventory', e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-[#454446] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#92b0ce]"></div>
                  </label>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
}
