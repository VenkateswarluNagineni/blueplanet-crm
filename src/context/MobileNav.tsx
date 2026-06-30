'use client';

import { createContext, useContext, useState } from 'react';

type MobileNav = { open: boolean; setOpen: (v: boolean) => void };
const Ctx = createContext<MobileNav | null>(null);

/** Shares the mobile-sidebar open state between the Header (hamburger) and the Sidebar (overlay). */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function useMobileNav(): MobileNav {
  const c = useContext(Ctx);
  if (!c) throw new Error('useMobileNav must be used within MobileNavProvider');
  return c;
}
