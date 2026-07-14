'use client';

import React, { useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  Package,
  Box,
  Users,
  FileText,
  Briefcase,
  Truck,
  CheckCircle,
  ChevronsLeft,
  Menu,
  BarChart3,
  Warehouse,
  History,
  LayoutDashboard,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { useMobileNav } from '@/context/MobileNav';
import { BrandMark } from '@/components/brand/Wordmark';

interface SidebarContextType {
  isCollapsed: boolean;
  pathname: string;
  onItemClick: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  pathname: '',
  onItemClick: () => {},
});

const NavItem = ({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) => {
  const { isCollapsed, pathname, onItemClick } = useContext(SidebarContext);
  const active = pathname === href;
  return (
    <Link href={href} className="block" onClick={onItemClick}>
      <div 
        className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-lg cursor-pointer transition-all mb-1 text-[13px] ${active ? 'bg-[#333234] text-white font-medium shadow-sm border-l-2 border-[#e3c16c]' : 'text-[#b8b6b9] hover:bg-[#333234]/70 hover:text-white'}`}
        title={isCollapsed ? label : `Navigate to the ${label} module.`}
      >
        <Icon size={16} className={`shrink-0 ${active ? 'opacity-100 text-[#e3c16c]' : 'opacity-80'}`} />
        {!isCollapsed && <span className="whitespace-nowrap truncate">{label}</span>}
      </div>
    </Link>
  );
};

const NavGroup = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { isCollapsed } = useContext(SidebarContext);
  if (!children) return null;
  return (
    <div className="mb-6">
      {!isCollapsed && (
        <div className="flex items-center justify-between px-3 py-1 mb-1 cursor-pointer hover:bg-[#333234] rounded-md text-[#b8b6b9] transition-colors">
          <h3 className="text-[13px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{title}</h3>
          <span className="text-[10px]">▼</span>
        </div>
      )}
      <div className={isCollapsed ? 'flex flex-col items-center gap-1' : 'ml-2 pl-2 border-l border-[#454446]'}>
        {children}
      </div>
    </div>
  );
};

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { role, settings } = useRole();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNav();

  const ctxValue = {
    isCollapsed,
    pathname,
    onItemClick: () => setMobileOpen(false),
  };

  return (
    <SidebarContext.Provider value={ctxValue}>
    <>
    {/* Mobile backdrop */}
    {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileOpen(false)} />}
    <aside
      className={`bg-[#1c1c1c] border-r border-[#454446] flex flex-col justify-between shrink-0 h-screen z-50 fixed md:sticky top-0 left-0 transition-transform md:transition-all duration-300 ease-in-out w-[240px] ${isCollapsed ? 'md:w-[64px]' : 'md:w-[240px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
    >
      <div className="p-4 overflow-y-auto overflow-x-hidden relative">
        
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute top-4 ${isCollapsed ? 'right-0 left-0 mx-auto w-6' : 'right-2 w-6'} h-6 rounded bg-[#333234] hover:bg-[#454446] border border-[#454446] hidden md:flex items-center justify-center text-[#b8b6b9] hover:text-white transition-colors z-10 cursor-pointer`}
          title={isCollapsed ? "Expand sidebar" : "Close sidebar"}
        >
          {isCollapsed ? <Menu size={12} /> : <ChevronsLeft size={12} />}
        </button>

        {/* Logo Header */}
        <Link href="/" className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2 px-2'} mb-8 cursor-pointer mt-8`}>
          <BrandMark size={26} />
          {!isCollapsed && (
            <span
              className="text-[16px] font-semibold tracking-tight text-white whitespace-nowrap"
              style={{ fontFamily: 'var(--font-fraunces), serif' }}
            >
              BluePlanet
            </span>
          )}
        </Link>
        
        {/* Top Level Links - Everyone sees Home */}
        <div className="mb-4">
          <NavItem icon={Home} label="Home Dashboard" href="/" />
        </div>
        
        {/* ADMIN Navigation */}
        {role === 'ADMIN' && (
          <div className="space-y-2">
            <NavGroup title="Inventory Pipeline">
              <NavItem icon={LayoutDashboard} label="Inventory Overview" href="/inventory/overview" />
              <NavItem icon={Search} label="Inventory Search" href="/inventory" />
              <NavItem icon={Package} label="Purchasing & POs" href="/purchases" />
              <NavItem icon={Box} label="Product Catalog" href="/catalog" />
            </NavGroup>
            
            <NavGroup title="Sales & CRM">
              <NavItem icon={Users} label="People & Companies" href="/crm" />
              <NavItem icon={FileText} label="Sales Orders" href="/orders" />
              <NavItem icon={Briefcase} label="Deals & Pipeline" href="/pipeline" />
            </NavGroup>

            <NavGroup title="Operations">
              <NavItem icon={Warehouse} label="Locations" href="/admin/locations" />
              <NavItem icon={History} label="Stock Movements" href="/admin/movements" />
              <NavItem icon={BarChart3} label="Profitability Analytics" href="/analytics" />
              <NavItem icon={Truck} label="Logistics Tracker" href="/logistics" />
              <NavItem icon={CheckCircle} label="Pending Approvals" href="/admin/approvals" />
            </NavGroup>
          </div>
        )}

        {/* SALES Navigation */}
        {role === 'SALES' && (
          <div className="space-y-2">
            <NavGroup title="Sales Performance">
              <NavItem icon={Briefcase} label="My Pipeline & Quotas" href="/pipeline" />
              <NavItem icon={FileText} label="My Orders" href="/orders" />
              <NavItem icon={Users} label="My Customers" href="/crm" />
            </NavGroup>

            <NavGroup title="Catalog & Stock">
              <NavItem icon={LayoutDashboard} label="Inventory Overview" href="/inventory/overview" />
              <NavItem icon={Search} label="Local Inventory Search" href="/inventory" />
              <NavItem icon={Box} label="Product Catalog (Pricing)" href="/catalog" />
            </NavGroup>
          </div>
        )}

        {/* VENDOR Navigation */}
        {role === 'VENDOR' && (
          <div className="space-y-2">
            <NavGroup title="Vendor Portal">
              <NavItem icon={Truck} label="My Orders & Invoices" href="/vendor" />
            </NavGroup>

            {settings.vendorCanViewFullInventory && (
              <NavGroup title="Directory">
                <NavItem icon={Search} label="Full Inventory Access" href="/inventory" />
              </NavGroup>
            )}
          </div>
        )}

      </div>
    </aside>
    </>
    </SidebarContext.Provider>
  );
}
