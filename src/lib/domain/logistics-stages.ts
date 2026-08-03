import type { ElementType } from 'react';
import { Ship, Package, Truck, Factory, Warehouse } from 'lucide-react';

/** Client-safe logistics stage union (kept in sync with purchasing queries). */
export type PoLogisticsStatus =
  | 'PRODUCTION'
  | 'ON_WATER'
  | 'CUSTOMS'
  | 'INLAND_TRANSIT'
  | 'RECEIVED';

/**
 * Canonical logistics stage labels shared by Purchasing and Logistics Tracker
 * so operators see the same language on both screens.
 */
export type LogisticsStep = {
  key: PoLogisticsStatus;
  /** Short label for tracker chips / compact UI */
  label: string;
  /** Longer label for PO pipeline strip */
  longLabel: string;
  icon: ElementType;
};

export const LOGISTICS_STEPS: LogisticsStep[] = [
  { key: 'PRODUCTION', label: 'Production', longLabel: 'Production', icon: Factory },
  { key: 'ON_WATER', label: 'Ocean', longLabel: 'Ocean Freight', icon: Ship },
  { key: 'CUSTOMS', label: 'Customs', longLabel: 'Customs', icon: Package },
  { key: 'INLAND_TRANSIT', label: 'Inland', longLabel: 'Inland Transit', icon: Truck },
  { key: 'RECEIVED', label: 'Received', longLabel: 'Received', icon: Warehouse },
];

export const LOGISTICS_STATUS_INDEX: Record<PoLogisticsStatus, number> = {
  PRODUCTION: 0,
  ON_WATER: 1,
  CUSTOMS: 2,
  INLAND_TRANSIT: 3,
  RECEIVED: 4,
};

export const LOGISTICS_STATUS_LABEL: Record<PoLogisticsStatus, string> = {
  PRODUCTION: 'In production',
  ON_WATER: 'On water',
  CUSTOMS: 'Customs',
  INLAND_TRANSIT: 'Inland transit',
  RECEIVED: 'Received',
};
