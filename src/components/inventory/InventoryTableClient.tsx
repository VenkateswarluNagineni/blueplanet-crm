'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Grid, 
  ListFilter, 
  Search, 
  ArrowUpDown, 
  Plus, 
  Pencil, 
  CheckCircle,
  Building2,
  X,
  Send,
  Check,
  ChevronUp,
  ChevronDown,
  Save,
  GripHorizontal,
  Factory,
  Ship,
  Warehouse,
  ShoppingCart,
  Truck,
  FileText,
  Calendar,
  User,
  Hash,
  MapPin,
  Receipt,
  Package,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useRole } from '@/context/RoleContext';
import { useToast } from '@/components/ui/Toast';
import {
  submitMeasurementOverrideAction,
  transferSlabsAction, holdSlabsAction, releaseSlabsAction, writeOffSlabsAction,
} from '@/server/actions/inventory';
import { Term } from '@/components/ui/Tooltip';
import type { InventoryRow, InventoryLocation } from '@/server/queries/inventory';
import { ArrowLeftRight, PauseCircle, PlayCircle, Trash2, History, ArrowLeft } from 'lucide-react';
import { FacetCard, FacetRow } from '@/components/ui/FacetCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { ListToolbar } from '@/components/ui/ListToolbar';
import { StatusPill } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Drawer } from '@/components/ui/Drawer';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { swatchBaseForMaterial } from '@/lib/material-swatch';
import { getBlockMates } from '@/lib/block-mates';
import { PassportMatesStrip } from '@/components/inventory/PassportMatesStrip';

type InventoryItemProps = InventoryRow;
type BulkOp = 'TRANSFER' | 'HOLD' | 'RELEASE' | 'WRITE_OFF';

const RESTRICTED = (
  <span className="text-[var(--color-text-secondary)] text-[10px] bg-[var(--color-basalt-700)] px-1.5 py-0.5 rounded uppercase tracking-wider">Restricted</span>
);

const fmtDate = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const money = (n: number | null | undefined) =>
  n == null ? null : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DEFAULT_COLUMNS = {
  slabId: true,
  product: true,
  category: true,
  baseColor: false,
  bin: false,
  dimensions: true,
  sfCost: false,
  landedCost: true,
  location: true,
  container: false,
  dateReceived: false
};

const DEFAULT_COLUMN_ORDER = [
  'slabId', 'product', 'category', 'baseColor', 'dimensions', 'location', 'bin', 'container', 'dateReceived', 'status', 'sfCost', 'landedCost'
];

export function InventoryTableClient({
  initialData,
  availableLocations,
  locations,
}: {
  initialData: InventoryItemProps[];
  availableLocations: string[];
  locations: InventoryLocation[];
}) {
  const { role, settings } = useRole();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Warehouse ops (transfer / write-off): ADMIN only.
  // Reservation ceremony (hold / release): ADMIN + SALES.
  const canWarehouseOps = role === 'ADMIN';
  const canReserve = role === 'ADMIN' || role === 'SALES';
  const canSelect = canWarehouseOps || canReserve;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = useState<BulkOp | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkDestId, setBulkDestId] = useState('');
  const toggleRow = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSelection = () => setSelectedIds(new Set());
  const openBulk = (op: BulkOp) => { setBulkOp(op); setBulkReason(''); setBulkDestId(locations[0]?.id ?? ''); };
  const runBulk = () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || !bulkOp) return;
    const reasonSnapshot = bulkReason.trim();
    startTransition(async () => {
      let res: { ok: true; affected: number; skipped: number } | { ok: false; error: string };
      if (bulkOp === 'TRANSFER') res = await transferSlabsAction(ids, bulkDestId, bulkReason || undefined);
      else if (bulkOp === 'HOLD') res = await holdSlabsAction(ids, bulkReason);
      else if (bulkOp === 'RELEASE') res = await releaseSlabsAction(ids);
      else res = await writeOffSlabsAction(ids, bulkReason);
      if (!res.ok) { toast(res.error, 'error'); return; }
      const n = res.affected;
      const skipped = res.skipped > 0 ? ` (${res.skipped} not eligible)` : '';
      if (bulkOp === 'HOLD') {
        toast(
          n === 0
            ? `No available slabs to hold${skipped}.`
            : `Held ${n} slab${n === 1 ? '' : 's'} for “${reasonSnapshot}”${skipped}.`,
          n === 0 ? 'info' : 'reserve',
        );
      } else if (bulkOp === 'RELEASE') {
        toast(
          n === 0
            ? `No held slabs to release${skipped}.`
            : `Released ${n} slab${n === 1 ? '' : 's'} — available again${skipped}.`,
          n === 0 ? 'info' : 'success',
        );
      } else if (bulkOp === 'TRANSFER') {
        toast(
          n === 0
            ? `No slabs moved${skipped}.`
            : `Transferred ${n} slab${n === 1 ? '' : 's'}${skipped}.`,
          n === 0 ? 'info' : 'success',
        );
      } else {
        toast(
          n === 0
            ? `No slabs written off${skipped}.`
            : `Wrote off ${n} slab${n === 1 ? '' : 's'}${skipped}.`,
          n === 0 ? 'info' : 'success',
        );
      }
      setBulkOp(null); clearSelection(); router.refresh();
    });
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'none' | 'slabId' | 'product' | 'totalSf' | 'landedCost' | 'createdAt' | 'status'>('none');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);

  // Array filters
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  // Text + dimension refinements (reference: Lot / Bundle / Bin / Barcode / Length>: / Width>:)
  const [refLot, setRefLot] = useState('');
  const [refBundle, setRefBundle] = useState('');
  const [refBin, setRefBin] = useState('');
  const [refBarcode, setRefBarcode] = useState('');
  const [minLength, setMinLength] = useState('');
  const [minWidth, setMinWidth] = useState('');

  // Filter Sidebar states
  const [showFilters, setShowFilters] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [isStatusExpanded, setIsStatusExpanded] = useState(true);
  const [isLocationExpanded, setIsLocationExpanded] = useState(true);
  const [isMaterialExpanded, setIsMaterialExpanded] = useState(false);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [isColorExpanded, setIsColorExpanded] = useState(false);
  const [isOriginExpanded, setIsOriginExpanded] = useState(false);
  const [isRefineExpanded, setIsRefineExpanded] = useState(false);
  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  // Columns & Order
  const [visibleColumns, setVisibleColumns] = useState<typeof DEFAULT_COLUMNS>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCols = localStorage.getItem('blueplanet_inventory_columns');
        if (savedCols) return JSON.parse(savedCols) as typeof DEFAULT_COLUMNS;
      } catch { /* ignore */ }
    }
    return DEFAULT_COLUMNS;
  });
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedOrder = localStorage.getItem('blueplanet_inventory_column_order');
        if (savedOrder) return JSON.parse(savedOrder) as string[];
      } catch { /* ignore */ }
    }
    return DEFAULT_COLUMN_ORDER;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Drag and Drop State for Columns
  const [draggedCol, setDraggedCol] = useState<string | null>(null);

  const saveAsDefaultView = () => {
    localStorage.setItem('blueplanet_inventory_columns', JSON.stringify(visibleColumns));
    localStorage.setItem('blueplanet_inventory_column_order', JSON.stringify(columnOrder));
    setShowViewMenu(false);
    toast('Column layout saved as your default view.');
  };

  const resetToSystemDefault = () => {
    setVisibleColumns(DEFAULT_COLUMNS);
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    localStorage.removeItem('blueplanet_inventory_columns');
    localStorage.removeItem('blueplanet_inventory_column_order');
    setShowViewMenu(false);
  };

  // Approval Modal
  const [showApprovalModal, setShowApprovalModal] = useState<string | null>(null);

  // Inline Edit State
  const [editingSlabId, setEditingSlabId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ lengthInches: 0, widthInches: 0 });
  const [pendingApprovals, setPendingApprovals] = useState<string[]>([]);

  // Material Passport State
  const [selectedPassportSlab, setSelectedPassportSlab] = useState<InventoryItemProps | null>(null);
  const [passportSearch, setPassportSearch] = useState('');

  // Deep-link: open the Material Passport directly when arriving with ?slab=<uniqueSlabId>
  // (e.g. from an order or PO), so inventory is the one place to trace any slab end-to-end.
  const searchParams = useSearchParams();
  useEffect(() => {
    const wanted = searchParams.get('slab');
    if (!wanted) {
      return;
    }
    const match = initialData.find((i) => i.uniqueSlabId === wanted || i.id === wanted);
    if (match) {
      setSelectedPassportSlab(match);
    }
  }, [searchParams, initialData]);

  const closePassport = () => {
    setSelectedPassportSlab(null);
    setPassportSearch('');
    const params = new URLSearchParams(searchParams.toString());
    if (params.has('slab')) {
      params.delete('slab');
      const q = params.toString();
      router.replace(q ? `/inventory?${q}` : '/inventory', { scroll: false });
    }
  };

  const openPassport = (slab: InventoryItemProps) => {
    setSelectedPassportSlab(slab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('slab', slab.uniqueSlabId);
    router.replace(`/inventory?${params.toString()}`, { scroll: false });
  };

  const passportMates = useMemo(() => {
    if (!selectedPassportSlab) return [];
    return getBlockMates(selectedPassportSlab, initialData);
  }, [selectedPassportSlab, initialData]);

  // Deep-link filters: arriving with ?location=<name> / ?status=<STATUS> (e.g. from the
  // Inventory Overview by-location rows) pre-seeds the matching sidebar filter once on mount.
  useEffect(() => {
    const t = setTimeout(() => {
      const loc = searchParams.get('location');
      if (loc && initialData.some((i) => i.location.name === loc)) setSelectedLocations([loc]);
      const status = searchParams.get('status');
      if (status && initialData.some((i) => i.status === status)) setSelectedStatuses([status]);
    }, 0);
    return () => clearTimeout(t);
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resizable Sidebar State (Fixed jumping logic)
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(280);

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection
  }, [sidebarWidth]);

  const stopResizing = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing.current) {
      const delta = mouseMoveEvent.clientX - startX.current;
      const newWidth = startWidth.current + delta;
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Drag & Drop Column Logic
  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedCol(colId);
    e.dataTransfer.effectAllowed = "move";
    // Optional: set a drag ghost image here
  };

  const handleDragOver = (e: React.DragEvent, _colId: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetColId) return;

    const newOrder = [...columnOrder];
    const draggedIdx = newOrder.indexOf(draggedCol);
    const targetIdx = newOrder.indexOf(targetColId);

    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedCol);

    setColumnOrder(newOrder);
    setDraggedCol(null);
  };

  // Filter Logic
  const filteredData = useMemo(() => {
    return initialData.filter(item => {
      const canViewCost = role === 'ADMIN' || (role === 'SALES' && settings.salesCanViewLandedCost);
      const sfCost = (item.costLanded && canViewCost) ? (item.costLanded / item.totalSf).toFixed(2) : 'N/A';
      const landedCostValue = canViewCost ? item.costLanded : 'HIDDEN';
      const dateRec = new Date(item.createdAt).toLocaleDateString();
      
      const t = item.trace;
      const p = item.product;
      const searchableString = `
        ${item.uniqueSlabId}
        ${item.barcode}
        ${p.name}
        ${p.materialType}
        ${p.category || ''}
        ${p.baseColor}
        ${p.finish}
        ${item.location.name}
        ${item.status}
        ${item.lotNumber || ''}
        ${item.bundleId || ''}
        ${item.bin || ''}
        ${item.lengthInches}x${item.widthInches}
        ${item.totalSf}
        ${landedCostValue}
        ${sfCost}
        ${dateRec}
        ${t.supplierName || ''} ${t.supplierOrigin || ''}
        ${t.poNumber || ''} ${t.containerId || ''} ${t.receiptNumber || ''}
        ${t.oceanVendorName || ''} ${t.customsVendorName || ''} ${t.inlandVendorName || ''}
        ${t.customerName || ''} ${t.salesRepName || ''} ${t.soNumber || ''}
        ${t.documentRefs.join(' ')}
        ${fmtDate(t.poIssuedAt)} ${fmtDate(t.poEstimatedDelivery)} ${fmtDate(t.soldAt)}
      `.toLowerCase();

      const contains = (field: string | null | undefined, q: string) =>
        !q.trim() || (field ?? '').toLowerCase().includes(q.trim().toLowerCase());

      const matchSearch = searchableString.includes(searchTerm.toLowerCase());
      const matchLoc = selectedLocations.length === 0 || selectedLocations.includes(item.location.name);
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(item.status);
      const matchMaterial = selectedMaterials.length === 0 || selectedMaterials.includes(p.materialType);
      const matchCategory = selectedCategories.length === 0 || selectedCategories.includes(p.category ?? '—');
      const matchColor = selectedColors.length === 0 || selectedColors.includes(p.baseColor);
      const matchOrigin = selectedOrigins.length === 0 || selectedOrigins.includes(p.originCountry ?? '—');
      const matchRefine =
        contains(item.lotNumber, refLot) && contains(item.bundleId, refBundle) &&
        contains(item.bin, refBin) && contains(item.barcode, refBarcode);
      const matchDims =
        (!minLength || item.lengthInches >= Number(minLength)) &&
        (!minWidth || item.widthInches >= Number(minWidth));

      return matchSearch && matchLoc && matchStatus && matchMaterial && matchCategory &&
        matchColor && matchOrigin && matchRefine && matchDims;
    });
  }, [initialData, searchTerm, selectedLocations, selectedStatuses, selectedMaterials, selectedCategories,
      selectedColors, selectedOrigins, refLot, refBundle, refBin, refBarcode, minLength, minWidth, role, settings]);

  const PAGE_SIZE = 20;
  const SORT_OPTIONS: { key: typeof sortKey; label: string }[] = [
    { key: 'none', label: 'Default order' },
    { key: 'slabId', label: 'Slab ID' },
    { key: 'product', label: 'Product' },
    { key: 'totalSf', label: 'Total SF' },
    { key: 'landedCost', label: 'Landed Cost' },
    { key: 'createdAt', label: 'Date Received' },
    { key: 'status', label: 'Status' },
  ];

  const sortedData = useMemo(() => {
    if (sortKey === 'none') return filteredData;
    const arr = [...filteredData];
    arr.sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case 'slabId': av = a.uniqueSlabId; bv = b.uniqueSlabId; break;
        case 'product': av = a.product.name; bv = b.product.name; break;
        case 'totalSf': av = a.totalSf; bv = b.totalSf; break;
        case 'landedCost': av = a.costLanded ?? 0; bv = b.costLanded ?? 0; break;
        case 'createdAt': av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); break;
        case 'status': av = a.status; bv = b.status; break;
        default: return 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredData, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedData = sortedData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0);
    return () => clearTimeout(t);
  }, [searchTerm, selectedLocations, selectedStatuses, selectedMaterials,
    selectedCategories, selectedColors, selectedOrigins, refLot, refBundle, refBin, refBarcode, minLength, minWidth, sortKey, sortDir]);

  // Facet options + counts derived from the full dataset (stable overview).
  const countBy = useCallback((fn: (i: InventoryItemProps) => string) => {
    const m = new Map<string, number>();
    for (const i of initialData) { const k = fn(i); m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [initialData]);
  const materialCounts = useMemo(() => countBy((i) => i.product.materialType), [countBy]);
  const categoryCounts = useMemo(() => countBy((i) => i.product.category ?? '—'), [countBy]);
  const colorCounts = useMemo(() => countBy((i) => i.product.baseColor), [countBy]);
  const originCounts = useMemo(() => countBy((i) => i.product.originCountry ?? '—'), [countBy]);
  const statusCounts = useMemo(() => countBy((i) => i.status), [countBy]);
  const locationCounts = useMemo(() => countBy((i) => i.location.name), [countBy]);
  const refineCount =
    selectedMaterials.length + selectedCategories.length + selectedColors.length + selectedOrigins.length +
    (refLot ? 1 : 0) + (refBundle ? 1 : 0) + (refBin ? 1 : 0) + (refBarcode ? 1 : 0) + (minLength ? 1 : 0) + (minWidth ? 1 : 0);
  const activeFilterCount =
    refineCount + selectedStatuses.length + selectedLocations.length + (searchTerm.trim() ? 1 : 0);
  const clearAllFilters = () => {
    setSelectedLocations([]); setSelectedStatuses([]); setSelectedMaterials([]); setSelectedCategories([]);
    setSelectedColors([]); setSelectedOrigins([]); setRefLot(''); setRefBundle(''); setRefBin(''); setRefBarcode('');
    setMinLength(''); setMinWidth(''); setSearchTerm('');
  };

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleLocation = (loc: string) => {
    setSelectedLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  const handleStartEdit = (item: InventoryItemProps) => {
    setEditingSlabId(item.uniqueSlabId);
    setEditForm({ lengthInches: item.lengthInches, widthInches: item.widthInches });
  };

  const handleCancelEdit = () => {
    setEditingSlabId(null);
  };

  const handleSubmitMeasures = async () => {
    if (!editingSlabId) return;
    const slabId = editingSlabId;
    const { lengthInches, widthInches } = editForm;
    // Optimistic UI; the override is queued to the approval outbox server-side.
    setPendingApprovals(prev => [...prev, slabId]);
    setShowApprovalModal(slabId);
    setEditingSlabId(null);
    setTimeout(() => setShowApprovalModal(null), 4000);
    await submitMeasurementOverrideAction(slabId, lengthInches, widthInches);
  };

  // Passport switcher: find slabs by ID, supplier, lot/container, customer, PO, or date.
  const passportResults = (() => {
    const q = passportSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return initialData
      .filter((it) => {
        const t = it.trace;
        return [
          it.uniqueSlabId, it.lotNumber, it.product.name, t.supplierName, t.supplierOrigin,
          t.poNumber, t.containerId, t.receiptNumber, t.customerName, t.salesRepName, t.soNumber,
          fmtDate(it.createdAt), fmtDate(t.poIssuedAt), fmtDate(t.soldAt),
        ].filter(Boolean).join(' ').toLowerCase().includes(q);
      })
      .slice(0, 8);
  })();

  // Helper renderer for dynamic columns
  const renderHeaderCell = (colKey: string) => {
    if (!visibleColumns[colKey as keyof typeof visibleColumns]) return null;
    
    let title = "";
    let label = colKey;
    let align = "text-left";
    
    switch (colKey) {
      case 'slabId': title = "Unique Slab Identifier. Format: BP-[Location]-[Year]-[Material]-[Sequence]"; label = "Slab ID"; break;
      case 'product': title = "The master catalog material name"; label = "Product"; break;
      case 'category': title = "Catalog category"; label = "Category"; break;
      case 'baseColor': title = "Base color"; label = "Color"; break;
      case 'bin': title = "Warehouse bin / rack location"; label = "Bin"; break;
      case 'dimensions': title = "Physical length and width in inches"; label = "Dimensions"; break;
      case 'location': title = "Warehouse location"; label = "Location"; break;
      case 'container': title = "Ocean container tracking number"; label = "Container"; break;
      case 'dateReceived': title = "Date received in warehouse"; label = "Date Received"; break;
      case 'status': title = "Current stock status"; label = "Status"; break;
      case 'sfCost': title = "Calculated actively: Total Landed Cost / Total Square Feet."; label = "Cost / SF"; align = "text-right"; break;
      case 'landedCost': title = "Fully loaded cost including Material FOB + Ocean Freight + Customs"; label = "Landed Cost"; align = "text-right"; break;
    }

    return (
      <th 
        key={colKey}
        draggable
        onDragStart={(e) => handleDragStart(e, colKey)}
        onDragOver={(e) => handleDragOver(e, colKey)}
        onDrop={(e) => handleDrop(e, colKey)}
        className={`${align} cursor-grab active:cursor-grabbing hover:bg-[var(--color-basalt-600)] transition-colors`}
        title={title}
      >
        <div className={`flex items-center gap-1.5 ${align === 'text-right' ? 'justify-end' : ''}`}>
          <GripHorizontal size={12} className="text-[var(--color-basalt-500)] hover:text-[var(--color-sodalite)] shrink-0" />
          <span className="underline decoration-dotted decoration-[var(--color-basalt-500)] underline-offset-4">{label}</span>
        </div>
      </th>
    );
  };

  const renderDataCell = (colKey: string, item: InventoryItemProps, isEditing: boolean) => {
    if (!visibleColumns[colKey as keyof typeof visibleColumns]) return null;
    
    const canViewCost = role === 'ADMIN' || (role === 'SALES' && settings.salesCanViewLandedCost);
    const sfCost = (item.costLanded && canViewCost) ? (item.costLanded / item.totalSf).toFixed(2) : 'N/A';
    
    switch (colKey) {
      case 'slabId': return (
        <td key={colKey} className="bp-id">
          <button
            type="button"
            onClick={() => openPassport(item)}
            className="text-left hover:underline cursor-pointer text-inherit hover:text-[var(--color-vein)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-vein)] focus-visible:outline-offset-2 rounded-sm"
            data-testid="slab-id-link"
            title="Open material passport"
          >
            {item.uniqueSlabId}
          </button>
        </td>
      );
      case 'product': return <td key={colKey}>{item.product.name}</td>;
      case 'category': return <td key={colKey} className="text-[var(--color-text-secondary)]">{item.product.category ?? '—'}</td>;
      case 'baseColor': return <td key={colKey} className="text-[var(--color-text-secondary)]">{item.product.baseColor || '—'}</td>;
      case 'bin': return <td key={colKey} className="text-[var(--color-text-secondary)] bp-mono text-[12px]">{item.bin || '—'}</td>;
      case 'dimensions': return (
        <td key={colKey}>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={editForm.lengthInches}
                onChange={(e) => setEditForm({...editForm, lengthInches: Number(e.target.value)})}
                className="w-16 bg-[var(--color-basalt-900)] border border-[var(--color-vein)] rounded px-2 py-1 text-white text-[12px] outline-none"
              />
              <span>&quot; ×</span>
              <input 
                type="number" 
                value={editForm.widthInches}
                onChange={(e) => setEditForm({...editForm, widthInches: Number(e.target.value)})}
                className="w-16 bg-[var(--color-basalt-900)] border border-[var(--color-vein)] rounded px-2 py-1 text-white text-[12px] outline-none"
              />
              <span>&quot;</span>
            </div>
          ) : (
            <>{item.lengthInches}&quot; × {item.widthInches}&quot; <span className="text-[var(--color-text-secondary)] ml-1">({item.totalSf} SF)</span></>
          )}
        </td>
      );
      case 'location': return (
        <td key={colKey} className="text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-2">
            <Building2 size={12} className="text-[var(--color-fog-500)]" />
            {item.location.name}
          </span>
        </td>
      );
      case 'container': return <td key={colKey} className="bp-mono text-[12px]">{item.lotNumber || 'N/A'}</td>;
      case 'dateReceived': return <td key={colKey} className="text-[var(--color-text-secondary)]">{new Date(item.createdAt).toLocaleDateString()}</td>;
      case 'status': return (
        <td key={colKey}>
          <StatusPill
            status={item.status}
            title={
              item.status === 'ON_HOLD' && item.holdReason
                ? `Held: ${item.holdReason}`
                : undefined
            }
          />
        </td>
      );
      case 'sfCost': return (
        <td key={colKey} className="text-right tabular-nums">
          {canViewCost ? `$${sfCost}` : <span className="text-[var(--color-text-secondary)] text-[10px] bg-[var(--color-basalt-700)] px-1.5 py-0.5 rounded uppercase tracking-wider">Restricted</span>}
        </td>
      );
      case 'landedCost': return (
        <td key={colKey} className="text-right font-medium tabular-nums text-[var(--color-vein)]">
          {canViewCost 
            ? `$${item.costLanded?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
            : <span className="text-[var(--color-text-secondary)] text-[10px] bg-[var(--color-basalt-700)] px-1.5 py-0.5 rounded uppercase tracking-wider">Restricted</span>}
        </td>
      );
      default: return null;
    }
  };

  // Hydration gate for table chrome only — passport deep-link still mounts below.
  const availableCount = initialData.filter((i) => i.status === 'AVAILABLE').length;
  const activeFilterBits = [
    ...selectedStatuses.map((s) => s.replace(/_/g, ' ')),
    ...selectedLocations,
  ];
  if (searchParams.get('status') && selectedStatuses.length === 0) {
    const s = searchParams.get('status')!;
    if (!activeFilterBits.includes(s.replace(/_/g, ' '))) activeFilterBits.push(s.replace(/_/g, ' '));
  }
  if (searchParams.get('location') && selectedLocations.length === 0) {
    const loc = searchParams.get('location')!;
    if (!activeFilterBits.includes(loc)) activeFilterBits.push(loc);
  }

  return (
    <PageShell
      flush
      className="relative"
      header={
        <PageHeader
          breadcrumbs={[
            { label: 'Inventory', href: '/inventory/overview' },
            { label: 'Slabs' },
          ]}
          title="Slabs"
          subtitle="Yard stock — open a passport from any slab ID."
          meta={[
            { label: `${availableCount.toLocaleString()} available`, tone: 'green' },
            ...(activeFilterBits.length > 0
              ? [{ label: `${activeFilterBits.length} filter${activeFilterBits.length === 1 ? '' : 's'}`, tone: 'gold' as const }]
              : []),
          ]}
        >
          <ListToolbar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search slab ID, product, lot, barcode…"
            resultCount={sortedData.length}
            totalCount={initialData.length}
            filters={
              <div className="flex items-center gap-2 flex-wrap text-[13px]">
                <div className="relative">
                  <button
                    onClick={() => setShowViewMenu(!showViewMenu)}
                    className="flex items-center gap-2 hover:bg-[var(--color-basalt-700)] px-2 py-1 rounded transition-colors text-[var(--color-text-secondary)] hover:text-white"
                  >
                    <Grid size={14} /> View <ChevronDown size={12} />
                  </button>
                  {showViewMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowViewMenu(false)} />
                      <div className="absolute left-0 top-8 mt-1 w-48 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-xl z-50 p-1 flex flex-col">
                        <button onClick={saveAsDefaultView} className="text-left px-3 py-2 text-[13px] text-white hover:bg-[var(--color-basalt-700)] rounded flex items-center gap-2">
                          <Save size={12} className="text-[var(--color-vein)]" /> Save as Default
                        </button>
                        <button onClick={resetToSystemDefault} className="text-left px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-basalt-700)] hover:text-white rounded">
                          Reset to System Default
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${showFilters ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}
                >
                  <ListFilter size={14} /> {showFilters ? 'Hide filters' : 'Filters'}
                  {(selectedStatuses.length + selectedLocations.length + refineCount) > 0 && (
                    <span className="bg-[rgba(227,193,108,0.14)] text-[var(--color-vein)] border border-[rgba(227,193,108,0.3)] text-[10px] px-1.5 rounded-sm font-semibold tabular-nums">
                      {selectedStatuses.length + selectedLocations.length + refineCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowOverview(!showOverview)}
                  className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${showOverview ? 'bg-[var(--color-basalt-700)] text-white' : 'hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]'}`}
                >
                  <Grid size={14} /> Facets
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="px-2 py-1 hover:bg-[var(--color-basalt-700)] rounded-md transition-colors flex items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-white"
                  >
                    <ArrowUpDown size={14} /> {sortKey === 'none' ? 'Sort' : `Sort: ${SORT_OPTIONS.find((o) => o.key === sortKey)?.label}`}
                    {sortKey !== 'none' && <span className="text-[11px] text-[var(--color-sodalite)]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                  {showSortMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                      <div className="absolute left-0 top-8 w-48 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-xl z-50 p-1">
                        {SORT_OPTIONS.map((o) => (
                          <button
                            key={o.key}
                            onClick={() => { setSortKey(o.key); setShowSortMenu(false); }}
                            className={`w-full text-left px-3 py-1.5 text-[13px] rounded hover:bg-[var(--color-basalt-700)] ${sortKey === o.key ? 'text-[var(--color-vein)]' : 'text-white'}`}
                          >
                            {o.label}
                          </button>
                        ))}
                        <div className="h-px bg-[var(--color-basalt-500)] my-1" />
                        <button
                          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                          className="w-full text-left px-3 py-1.5 text-[13px] rounded hover:bg-[var(--color-basalt-700)] text-[var(--color-text-secondary)]"
                        >
                          Direction: {sortDir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            }
          />
        </PageHeader>
      }
    >
    <div className="flex flex-col h-full min-h-0 bg-[var(--color-basalt-800)] text-[var(--color-text-muted)] relative">

      {/* 2. Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Filter Sidebar - Resizable and Toggleable */}
        {showFilters && (
          <div 
            className="relative border-r border-[var(--color-basalt-500)] bg-[var(--color-basalt-800)] flex flex-col shrink-0 transition-all"
            style={{ width: sidebarWidth }}
          >
            {/* Custom Draggable Handle (Using Mousedown + Mousemove) */}
            <div 
              className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-col-resize hover:bg-[var(--color-vein)] transition-colors z-20 group"
              onMouseDown={startResizing}
              title="Drag to resize filter panel"
            >
              <div className="w-full h-full opacity-0 group-hover:opacity-100 bg-[var(--color-vein)]/20 transition-opacity" />
            </div>

            <div className="flex border-b border-[var(--color-basalt-500)] text-[13px] shrink-0">
              <div className="flex-1 py-2 px-3 text-center border-b-2 border-[#92b0ce] text-white font-medium cursor-pointer">
                Total <br/><span className="text-[var(--color-text-secondary)] font-normal">{initialData.length} Slabs</span>
              </div>
              <div className="flex-1 py-2 px-3 text-center text-[var(--color-text-secondary)] cursor-pointer hover:bg-[var(--color-basalt-700)]">
                Net New <br/>{filteredData.length}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 select-none">
              
              {/* Filter Group: Status - Collapsible */}
              <div className="border border-[var(--color-basalt-500)] rounded-md overflow-hidden shrink-0">
                <div 
                  onClick={() => setIsStatusExpanded(!isStatusExpanded)}
                  className="bg-[var(--color-basalt-700)] px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[var(--color-basalt-500)] transition-colors"
                >
                  <span className="text-[13px] font-medium text-white">Slab Status</span>
                  {isStatusExpanded ? <ChevronUp size={14} className="text-[var(--color-text-secondary)]"/> : <ChevronDown size={14} className="text-[var(--color-text-secondary)]"/>}
                </div>
                {isStatusExpanded && (
                  <div className="p-2 space-y-1 bg-[var(--color-basalt-800)]">
                    {['AVAILABLE', 'SOLD', 'ON_HOLD'].map(status => (
                      <label key={status} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[var(--color-basalt-700)] rounded cursor-pointer group/label">
                        <input 
                          type="checkbox" 
                          checked={selectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                          className="w-4 h-4 rounded-sm bg-[var(--color-basalt-900)] border-[var(--color-basalt-500)] text-[var(--color-vein)] focus:ring-[var(--color-vein)] focus:ring-offset-[#2b2a2c]"
                        />
                        <span className="text-[13px] text-[var(--color-text-muted)] group-hover/label:text-white capitalize truncate">{status.toLowerCase()}</span>
                        <span className="ml-auto text-[11px] text-[var(--color-text-secondary)]">
                          ({initialData.filter(i => i.status === status).length})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter Group: Location - Collapsible */}
              <div className="border border-[var(--color-basalt-500)] rounded-md overflow-hidden shrink-0">
                <div 
                  onClick={() => setIsLocationExpanded(!isLocationExpanded)}
                  className="bg-[var(--color-basalt-700)] px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[var(--color-basalt-500)] transition-colors"
                >
                  <span className="text-[13px] font-medium text-white">Location</span>
                  {isLocationExpanded ? <ChevronUp size={14} className="text-[var(--color-text-secondary)]"/> : <ChevronDown size={14} className="text-[var(--color-text-secondary)]"/>}
                </div>
                {isLocationExpanded && (
                  <div className="p-2 space-y-1 bg-[var(--color-basalt-800)]">
                    {availableLocations.map(loc => (
                      <label key={loc} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[var(--color-basalt-700)] rounded cursor-pointer group/label">
                        <input
                          type="checkbox"
                          checked={selectedLocations.includes(loc)}
                          onChange={() => toggleLocation(loc)}
                          className="w-4 h-4 rounded-sm bg-[var(--color-basalt-900)] border-[var(--color-basalt-500)] text-[var(--color-vein)] focus:ring-[var(--color-vein)] focus:ring-offset-[#2b2a2c]"
                        />
                        <span className="text-[13px] text-[var(--color-text-muted)] group-hover/label:text-white truncate">{loc}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <SidebarFacet title="Material Type" expanded={isMaterialExpanded} onToggle={() => setIsMaterialExpanded(!isMaterialExpanded)} options={materialCounts} selected={selectedMaterials} onSelect={(v) => toggleIn(setSelectedMaterials, v)} />
              <SidebarFacet title="Category" expanded={isCategoryExpanded} onToggle={() => setIsCategoryExpanded(!isCategoryExpanded)} options={categoryCounts} selected={selectedCategories} onSelect={(v) => toggleIn(setSelectedCategories, v)} />
              <SidebarFacet title="Base Color" expanded={isColorExpanded} onToggle={() => setIsColorExpanded(!isColorExpanded)} options={colorCounts} selected={selectedColors} onSelect={(v) => toggleIn(setSelectedColors, v)} />
              <SidebarFacet title="Origin" expanded={isOriginExpanded} onToggle={() => setIsOriginExpanded(!isOriginExpanded)} options={originCounts} selected={selectedOrigins} onSelect={(v) => toggleIn(setSelectedOrigins, v)} />

              {/* Refine: free-text identifiers + dimension thresholds */}
              <div className="border border-[var(--color-basalt-500)] rounded-md overflow-hidden shrink-0">
                <div onClick={() => setIsRefineExpanded(!isRefineExpanded)} className="bg-[var(--color-basalt-700)] px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[var(--color-basalt-500)] transition-colors">
                  <span className="text-[13px] font-medium text-white">Refine</span>
                  {isRefineExpanded ? <ChevronUp size={14} className="text-[var(--color-text-secondary)]" /> : <ChevronDown size={14} className="text-[var(--color-text-secondary)]" />}
                </div>
                {isRefineExpanded && (
                  <div className="p-2.5 space-y-2 bg-[var(--color-basalt-800)]">
                    {([['Lot', refLot, setRefLot], ['Bundle', refBundle, setRefBundle], ['Bin', refBin, setRefBin], ['Barcode', refBarcode, setRefBarcode]] as const).map(([label, val, set]) => (
                      <div key={label}>
                        <label className="text-[11px] text-[var(--color-text-secondary)] block mb-0.5">{label}</label>
                        <input value={val} onChange={(e) => set(e.target.value)} placeholder={`Filter by ${label.toLowerCase()}…`} className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-2 py-1.5 text-[12px] text-white outline-none focus:border-[var(--color-sodalite)]" />
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-[var(--color-text-secondary)] block mb-0.5">Length &gt;=</label>
                        <input type="number" min="0" value={minLength} onChange={(e) => setMinLength(e.target.value)} placeholder="in" className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-2 py-1.5 text-[12px] text-white outline-none focus:border-[var(--color-sodalite)]" />
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--color-text-secondary)] block mb-0.5">Width &gt;=</label>
                        <input type="number" min="0" value={minWidth} onChange={(e) => setMinWidth(e.target.value)} placeholder="in" className="w-full bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded px-2 py-1.5 text-[12px] text-white outline-none focus:border-[var(--color-sodalite)]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            <div className="p-3 border-t border-[var(--color-basalt-500)] flex justify-between items-center text-[13px] shrink-0">
              <button
                onClick={clearAllFilters}
                className="text-[var(--color-text-secondary)] hover:text-white"
              >
                Clear all {(selectedLocations.length + selectedStatuses.length + refineCount) > 0 && <span className="bg-[var(--color-basalt-500)] text-white px-1.5 rounded ml-1">{selectedLocations.length + selectedStatuses.length + refineCount}</span>}
              </button>
            </div>
          </div>
        )}

        {/* Right Pane (Table Area) */}
        <div className="flex-1 overflow-auto bg-[var(--color-basalt-800)] relative">
          {showOverview && (
            <div className="p-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-900)]">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                <FacetCard title="Status">
                  {statusCounts.map(([v, n]) => <FacetRow key={v} label={v} count={n} active={selectedStatuses.includes(v)} onClick={() => toggleIn(setSelectedStatuses, v)} />)}
                </FacetCard>
                <FacetCard title="Material Type">
                  {materialCounts.map(([v, n]) => <FacetRow key={v} label={v} count={n} active={selectedMaterials.includes(v)} onClick={() => toggleIn(setSelectedMaterials, v)} />)}
                </FacetCard>
                <FacetCard title="Category">
                  {categoryCounts.map(([v, n]) => <FacetRow key={v} label={v} count={n} active={selectedCategories.includes(v)} onClick={() => toggleIn(setSelectedCategories, v)} />)}
                </FacetCard>
                <FacetCard title="Origin">
                  {originCounts.map(([v, n]) => <FacetRow key={v} label={v} count={n} active={selectedOrigins.includes(v)} onClick={() => toggleIn(setSelectedOrigins, v)} />)}
                </FacetCard>
                <FacetCard title="Location">
                  {locationCounts.map(([v, n]) => <FacetRow key={v} label={v} count={n} active={selectedLocations.includes(v)} onClick={() => toggleIn(setSelectedLocations, v)} />)}
                </FacetCard>
                <FacetCard title="Base Color">
                  {colorCounts.map(([v, n]) => <FacetRow key={v} label={v} count={n} active={selectedColors.includes(v)} onClick={() => toggleIn(setSelectedColors, v)} />)}
                </FacetCard>
              </div>
            </div>
          )}
          <div className="bp-table-shell mx-0 overflow-x-auto">
          <table className="bp-table min-w-max whitespace-nowrap">
            <thead>
              <tr>
                <th className="w-10 !px-4">
                  {canSelect ? (
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      className="w-4 h-4 rounded-sm bg-[var(--color-basalt-900)] border-[var(--color-basalt-500)] accent-[var(--color-vein)]"
                      checked={pagedData.length > 0 && pagedData.every((i) => selectedIds.has(i.id))}
                      onChange={(e) => setSelectedIds((prev) => {
                        const n = new Set(prev);
                        if (e.target.checked) pagedData.forEach((i) => n.add(i.id));
                        else pagedData.forEach((i) => n.delete(i.id));
                        return n;
                      })}
                    />
                  ) : null}
                </th>
                
                {/* Dynamically Rendered Draggable Columns */}
                {columnOrder.map(colKey => renderHeaderCell(colKey))}
                
                {/* Column Toggle Dropdown Container */}
                <th className="text-right align-middle">
                  <div className="relative inline-block text-left">
                    <button 
                      onClick={() => setShowColumnMenu(!showColumnMenu)}
                      className="text-[var(--color-sodalite)] hover:text-white flex items-center gap-1.5 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] px-3 py-1.5 rounded-lg transition-all shadow-sm hover:shadow"
                    >
                      <Plus size={14} /> Add column
                    </button>

                    {showColumnMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowColumnMenu(false)}></div>
                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-xl shadow-[0_12px_36px_rgb(0,0,0,0.6)] z-50 p-2.5 text-left">
                          <div className="text-[11px] text-[var(--color-text-secondary)] font-medium uppercase tracking-wider px-2 pb-1 mb-1 border-b border-[var(--color-basalt-500)]">Toggle Columns</div>
                          {DEFAULT_COLUMN_ORDER.map((colKey) => (
                            <label key={colKey} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[var(--color-basalt-700)] rounded cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                checked={visibleColumns[colKey as keyof typeof visibleColumns]}
                                onChange={() => toggleColumn(colKey as keyof typeof visibleColumns)}
                                className="w-4 h-4 rounded-sm bg-[var(--color-basalt-800)] border-[var(--color-basalt-500)] text-[var(--color-vein)] focus:ring-[var(--color-vein)] accent-[var(--color-vein)]"
                              />
                              <span className="text-[13px] text-white capitalize">{colKey.replace(/([A-Z])/g, ' $1').trim()}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            
            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="!p-4">
                    <EmptyState
                      icon={Package}
                      title="No slabs match"
                      hint="Try clearing filters or search to see yard stock."
                      action={
                        activeFilterCount > 0 ? (
                          <button type="button" onClick={clearAllFilters} className="btn-ghost text-[13px]">
                            Clear filters
                          </button>
                        ) : undefined
                      }
                      className="py-10"
                    />
                  </td>
                </tr>
              ) : (
                pagedData.map((item) => {
                  const isEditing = editingSlabId === item.uniqueSlabId;
                  const isPendingApproval = pendingApprovals.includes(item.uniqueSlabId);
                  
                  const isHeld = item.status === 'ON_HOLD';
                  return (
                    <tr
                      key={item.id}
                      className={`group ${
                        isEditing || selectedIds.has(item.id)
                          ? 'bg-[var(--color-basalt-700)]/50'
                          : ''
                      } ${isHeld ? 'bp-row-held' : ''}`}
                    >
                      <td>
                        {canSelect ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.uniqueSlabId}`}
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleRow(item.id)}
                            className={`w-4 h-4 rounded-sm bg-[var(--color-basalt-900)] border-[var(--color-basalt-500)] accent-[var(--color-vein)] transition-opacity ${selectedIds.has(item.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          />
                        ) : null}
                      </td>
                      
                      {/* Render Table Data according to columnOrder */}
                      {columnOrder.map(colKey => renderDataCell(colKey, item, isEditing))}

                      <td className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={handleCancelEdit}
                              className="flex items-center justify-center text-white border border-[var(--color-basalt-500)] w-7 h-7 rounded hover:bg-[var(--color-basalt-500)] transition-colors"
                              title="Cancel edits"
                            >
                              <X size={14} />
                            </button>
                            <button 
                              type="button"
                              onClick={handleSubmitMeasures}
                              className="btn-primary !min-h-7 !px-2 text-[11px] gap-1"
                              title="Submit to Admin for Approval"
                            >
                              <Send size={12} /> Submit
                            </button>
                          </div>
                        ) : isPendingApproval ? (
                          <button 
                            onClick={() => handleStartEdit(item)}
                            className="flex items-center gap-1 ml-auto text-[var(--color-emerald)] border border-[rgba(16,185,129,0.30)] bg-[var(--color-emerald)]/10 px-2 py-1 rounded-md transition-all group-hover:bg-[var(--color-emerald)]/20"
                            title="Submitted for approval. Click to edit again."
                          >
                            <span className="flex items-center gap-1 group-hover:hidden">
                              <Check size={12} /> Submitted
                            </span>
                            <span className="items-center gap-1 hidden group-hover:flex text-white">
                              <Pencil size={12} className="text-[var(--color-sodalite)]" /> Edit again
                            </span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleStartEdit(item)}
                            className="flex items-center gap-1 ml-auto text-white border border-[var(--color-basalt-500)] px-2 py-1 rounded-md hover:bg-[var(--color-basalt-500)] transition-colors group-hover:bg-[var(--color-basalt-500)]"
                          >
                            <Pencil size={12} className="text-[var(--color-sodalite)]" />
                            Edit Measures
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          <div className="sticky bottom-0 bg-[var(--color-basalt-900)] p-3 border-t border-[var(--color-basalt-500)] flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <span>Page {currentPage} of {totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="px-2 py-1 hover:bg-[var(--color-basalt-700)] rounded text-[var(--color-text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &lt;
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                className="px-2 py-1 hover:bg-[var(--color-basalt-700)] rounded text-[var(--color-text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &gt;
              </button>
              <span className="ml-2 text-[var(--color-text-secondary)]">
                {sortedData.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedData.length)} of {sortedData.length} Slabs
              </span>
            </div>
          </div>
          </div>{/* end bp-table-shell */}
        </div>

      </div>

      {/* Floating bulk bar — reserve for Sales; full ops for Admin */}
      {canSelect && selectedIds.size > 0 && !bulkOp && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-xl shadow-2xl px-3 py-2">
          <span className="text-[13px] text-white px-2 font-medium">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-[var(--color-basalt-500)] mx-1" />
          {canWarehouseOps && (
            <button type="button" onClick={() => openBulk('TRANSFER')} className="flex items-center gap-1.5 text-[13px] text-white hover:bg-[var(--color-basalt-700)] px-2.5 py-1.5 rounded-md transition-colors"><ArrowLeftRight size={14} className="text-[var(--color-sodalite)]" /> Transfer</button>
          )}
          {canReserve && (
            <>
              <button type="button" onClick={() => openBulk('HOLD')} className="flex items-center gap-1.5 text-[13px] text-white hover:bg-[var(--color-basalt-700)] px-2.5 py-1.5 rounded-md transition-colors" title="Reserve for a customer or quote"><PauseCircle size={14} className="text-[var(--color-vein)]" /> Hold</button>
              <button type="button" onClick={() => openBulk('RELEASE')} className="flex items-center gap-1.5 text-[13px] text-white hover:bg-[var(--color-basalt-700)] px-2.5 py-1.5 rounded-md transition-colors"><PlayCircle size={14} className="text-[var(--color-emerald)]" /> Release</button>
            </>
          )}
          {canWarehouseOps && (
            <button type="button" onClick={() => openBulk('WRITE_OFF')} className="flex items-center gap-1.5 text-[13px] text-white hover:bg-[var(--color-basalt-700)] px-2.5 py-1.5 rounded-md transition-colors"><Trash2 size={14} className="text-red-400" /> Write-off</button>
          )}
          <div className="w-px h-5 bg-[var(--color-basalt-500)] mx-1" />
          <button type="button" onClick={clearSelection} aria-label="Clear selection" className="text-[var(--color-text-secondary)] hover:text-white p-1 rounded hover:bg-[var(--color-basalt-700)]"><X size={16} /></button>
        </div>
      )}

      {/* Bulk operation — shared Modal */}
      {(() => {
        const count = selectedIds.size;
        const TITLES: Record<BulkOp, string> = {
          TRANSFER: 'Transfer slabs',
          HOLD: 'Hold slabs',
          RELEASE: 'Release hold',
          WRITE_OFF: 'Write off slabs',
        };
        const SUBTITLES: Record<BulkOp, string> = {
          TRANSFER: `${count} selected. Only non-sold slabs move.`,
          HOLD: `${count} selected. Only AVAILABLE slabs are held — quiet reservation, not a sale.`,
          RELEASE: `${count} selected. Only slabs currently on hold return to AVAILABLE.`,
          WRITE_OFF: `${count} selected. Permanent removal from sellable stock.`,
        };
        const needsReason = bulkOp === 'HOLD' || bulkOp === 'WRITE_OFF';
        const disabled =
          isPending ||
          (bulkOp === 'TRANSFER' && !bulkDestId) ||
          (needsReason && !bulkReason.trim());
        const confirmLabel =
          bulkOp === 'HOLD'
            ? isPending
              ? 'Holding…'
              : 'Confirm hold'
            : bulkOp === 'RELEASE'
              ? isPending
                ? 'Releasing…'
                : 'Release to available'
              : isPending
                ? 'Working…'
                : 'Confirm';
        return (
          <Modal
            open={!!bulkOp}
            onClose={() => setBulkOp(null)}
            title={bulkOp ? TITLES[bulkOp] : ''}
            subtitle={bulkOp ? SUBTITLES[bulkOp] : undefined}
            width={440}
            zIndex={60}
            footer={
              <>
                <Button variant="ghost" size="sm" onClick={() => setBulkOp(null)}>
                  Cancel
                </Button>
                <Button
                  variant={bulkOp === 'WRITE_OFF' ? 'danger' : 'primary'}
                  size="sm"
                  onClick={runBulk}
                  disabled={disabled}
                >
                  {confirmLabel}
                </Button>
              </>
            }
          >
            {bulkOp === 'TRANSFER' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5">
                    Destination warehouse
                  </label>
                  <select
                    value={bulkDestId}
                    onChange={(e) => setBulkDestId(e.target.value)}
                    className="bp-select w-full"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5">
                    Note (optional)
                  </label>
                  <input
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    placeholder="e.g. Rebalancing showroom stock"
                    className="bp-input"
                  />
                </div>
              </div>
            )}
            {bulkOp === 'HOLD' && (
              <div className="space-y-3">
                <div className="rounded-[var(--radius-md)] border border-[rgba(227,193,108,0.28)] bg-[rgba(227,193,108,0.06)] px-3 py-2.5">
                  <p className="text-[12px] text-[var(--color-vein)] font-medium mb-0.5">Reservation</p>
                  <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    Status becomes <strong className="text-white font-medium">On hold</strong> with a gold mark in the list.
                    Not a sale — release when the deal walks or convert from Pipeline.
                  </p>
                </div>
                <div>
                  <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5">
                    Held for <span className="text-[var(--color-ruby)]">*</span>
                  </label>
                  <input
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    placeholder="Customer, quote #, or project"
                    className="bp-input"
                    autoFocus
                    maxLength={200}
                    data-testid="hold-reason-input"
                  />
                </div>
              </div>
            )}
            {bulkOp === 'WRITE_OFF' && (
              <div>
                <label className="text-[12px] text-[var(--color-text-secondary)] block mb-1.5">
                  Reason <span className="text-[var(--color-ruby)]">*</span>
                </label>
                <input
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="e.g. Damaged in handling"
                  className="bp-input"
                />
                <p className="text-[11px] text-[var(--color-coral)] mt-2">
                  Write-off is permanent — slabs are removed from sellable inventory.
                </p>
              </div>
            )}
            {bulkOp === 'RELEASE' && (
              <div className="space-y-2">
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                  Return selected held slabs to <strong className="text-white font-medium">Available</strong>.
                  Hold reason is cleared; the release is audited.
                </p>
              </div>
            )}
          </Modal>
        );
      })()}

      {/* Quiet approval notice — no bounce */}
      {showApprovalModal && (
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-[var(--color-basalt-900)] border border-[rgba(227,193,108,0.4)] px-4 py-3 rounded-[var(--radius-md)] bp-lift-2 flex items-center gap-3 z-50 animate-toast-in">
          <CheckCircle size={18} className="text-[var(--color-vein)]" />
          <div>
            <p className="text-[13px] font-medium text-white">Event queued: measurement override</p>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Admin approval required for {showApprovalModal}. Navigating to Outbox...
            </p>
          </div>
        </div>
      )}

      {/* Material Passport — shared Drawer + museum-label hero (UI_CRAFT_PLAN Wave 3) */}
      <Drawer
        open={!!selectedPassportSlab}
        onClose={closePassport}
        width={700}
        testId="passport-root"
        zIndex={50}
        header={
          selectedPassportSlab ? (
            <div className="bp-passport-hero flex items-start justify-between gap-3 px-6 py-5 shrink-0">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={closePassport}
                  className="inline-flex items-center gap-1 text-[12px] text-[var(--color-sodalite)] hover:text-white mb-2.5 transition-colors"
                >
                  <ArrowLeft size={13} /> Back to results
                </button>
                <div className="flex items-start gap-3">
                  <div
                    className="bp-swatch shrink-0 mt-0.5 hidden sm:block"
                    style={{
                      ['--swatch-base' as string]: swatchBaseForMaterial(
                        selectedPassportSlab.product.materialType,
                        selectedPassportSlab.product.baseColor,
                      ),
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <h2
                      className="text-[18px] font-medium text-white flex items-center gap-2 flex-wrap tracking-tight"
                      style={{ fontFamily: 'var(--font-heading)' }}
                      data-testid="passport-title"
                    >
                      Material Passport
                      <span className="bg-[rgba(227,193,108,0.14)] text-[var(--color-vein)] border border-[rgba(227,193,108,0.3)] px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold tracking-[0.12em] uppercase">
                        Digital twin
                      </span>
                    </h2>
                    <p
                      className="text-[16px] text-white font-medium mt-1.5 truncate"
                      title={selectedPassportSlab.product.name}
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {selectedPassportSlab.product.name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      <span className="bp-mono text-[12px] text-[var(--color-text-secondary)]">
                        {selectedPassportSlab.uniqueSlabId}
                      </span>
                      <StatusPill status={selectedPassportSlab.status} />
                      <span className="text-[12px] text-[var(--color-fog-500)] flex items-center gap-1">
                        <MapPin size={12} /> {selectedPassportSlab.location.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closePassport}
                className="text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-basalt-700)] p-1.5 rounded-[var(--radius-md)] transition-colors shrink-0"
                aria-label="Close passport"
              >
                <X size={20} />
              </button>
            </div>
          ) : null
        }
      >
            {selectedPassportSlab && (
            <>
            {/* Drawer Search / Switcher — jump to any slab by its lineage */}
            <div className="px-6 py-4 border-b border-[var(--color-basalt-500)] bg-[var(--color-basalt-800)] relative">
              <div className="flex items-center bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md px-3 py-2 focus-within:border-[var(--color-sodalite)] transition-colors">
                <Search size={14} className="text-[var(--color-text-secondary)] mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Find a slab by ID, supplier, lot/container, customer, PO, or date…"
                  value={passportSearch}
                  onChange={(e) => setPassportSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[var(--color-fog-500)]"
                />
                {passportSearch && (
                  <button onClick={() => setPassportSearch('')} aria-label="Clear search" className="text-[var(--color-text-secondary)] hover:text-white ml-2"><X size={14} /></button>
                )}
              </div>
              {passportResults.length > 0 && (
                <div className="absolute left-6 right-6 top-full mt-1 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-2xl z-20 max-h-72 overflow-y-auto">
                  {passportResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { openPassport(r); setPassportSearch(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-[var(--color-basalt-700)] border-b border-[var(--color-basalt-700)] last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-white font-mono">{r.uniqueSlabId}</span>
                        <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">{r.status}</span>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
                        {r.product.name} · {r.trace.supplierName ?? 'Opening stock'} · Lot {r.lotNumber ?? '—'}
                        {r.trace.customerName ? ` · → ${r.trace.customerName}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {passportSearch.trim().length >= 2 && passportResults.length === 0 && (
                <div className="absolute left-6 right-6 top-full mt-1 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md shadow-2xl z-20 px-3 py-3 text-[12px] text-[var(--color-text-secondary)]">
                  No slab matches &ldquo;{passportSearch}&rdquo;.
                </div>
              )}
            </div>

            <PassportMatesStrip mates={passportMates} onSelect={openPassport} />

            {/* Drawer Content (Timeline) — real lineage from the database */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Operational movement history (transfers / holds / write-offs) */}
              {(selectedPassportSlab.holdReason || selectedPassportSlab.movements.length > 0) && (
                <div className="mb-8">
                  <h3 className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)] font-medium flex items-center gap-2 mb-3"><History size={13} /> Movement History</h3>
                  {selectedPassportSlab.status === 'ON_HOLD' && (
                    <div className="mb-3 rounded-[var(--radius-md)] border border-[rgba(227,193,108,0.35)] bg-[rgba(227,193,108,0.08)] px-3 py-2.5 flex items-start gap-2">
                      <PauseCircle size={15} className="text-[var(--color-vein)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-[var(--color-vein)]">Reserved · on hold</p>
                        <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 truncate" title={selectedPassportSlab.holdReason ?? undefined}>
                          {selectedPassportSlab.holdReason
                            ? `Held for ${selectedPassportSlab.holdReason}`
                            : 'No reason recorded'}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedPassportSlab.movements.length === 0 ? (
                    <EmptyState
                      icon={History}
                      title="No movements yet"
                      hint="Transfers, holds, and write-offs will appear here."
                      className="py-6"
                    />
                  ) : (
                    <div className="space-y-2">
                      {selectedPassportSlab.movements.map((m) => {
                        const tone = m.type === 'TRANSFER' ? 'text-[var(--color-sodalite)] border-[rgba(146,176,206,0.30)] bg-[rgba(146,176,206,0.10)]'
                          : m.type === 'HOLD' ? 'text-[var(--color-vein)] border-[rgba(227,193,108,0.30)] bg-[var(--color-vein)]/10'
                          : m.type === 'RELEASE' ? 'text-[var(--color-emerald)] border-[rgba(16,185,129,0.30)] bg-[var(--color-emerald)]/10'
                          : 'text-red-400 border-red-500/30 bg-red-500/10';
                        const desc = m.type === 'TRANSFER' ? `Moved ${m.fromLocation ?? '—'} → ${m.toLocation ?? '—'}`
                          : m.type === 'HOLD' ? 'Placed on hold'
                          : m.type === 'RELEASE' ? 'Released to available'
                          : 'Written off';
                        return (
                          <div key={m.id} className="flex items-start gap-3 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] rounded-md px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 ${tone}`}>{m.type.replace('_', '-')}</span>
                            <div className="flex-1 text-[12px] min-w-0">
                              <p className="text-white">{desc}</p>
                              {m.reason && <p className="text-[var(--color-text-secondary)] truncate" title={m.reason}>{m.reason}</p>}
                              {m.note && <p className="text-[var(--color-text-secondary)] truncate" title={m.note}>{m.note}</p>}
                              {m.byRole && <p className="text-[11px] text-[var(--color-fog-500)]">by {m.byRole}</p>}
                            </div>
                            <span className="text-[11px] text-[var(--color-text-secondary)] whitespace-nowrap">{fmtDate(m.createdAt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {(() => {
                const t = selectedPassportSlab.trace;
                const hasPO = !!t.poNumber;
                const sold = !!t.sold;
                // Timeline states: emerald done · gold active · basalt pending (DESIGN craft)
                type NodeState = 'done' | 'active' | 'pending';
                const n1: NodeState = 'done';
                const n2: NodeState = !hasPO ? 'pending' : sold ? 'done' : 'done';
                const n3: NodeState = sold ? 'done' : 'active';
                const n4: NodeState = sold ? 'done' : 'pending';
                const nodeClass = (s: NodeState) =>
                  `bp-timeline-node bp-timeline-node--${s}`;
                const titleClass = (s: NodeState) =>
                  s === 'active'
                    ? 'text-[14px] text-[var(--color-vein)] font-medium mb-2'
                    : 'text-[14px] text-white font-medium mb-2';
                const renderDocs = (refs: string[], accent = false) => (
                  <div className={`w-[210px] shrink-0 bg-[var(--color-basalt-900)] border ${accent ? 'border-[rgba(227,193,108,0.30)]' : 'border-[var(--color-basalt-500)]'} rounded-md p-3`}>
                    <span className={`text-[10px] ${accent ? 'text-[var(--color-vein)]' : 'text-[var(--color-text-secondary)]'} font-medium uppercase tracking-wider mb-2 block`}>Linked Documents</span>
                    {refs.length === 0 ? (
                      <p className="text-[11px] text-[var(--color-text-secondary)] italic">None on file</p>
                    ) : refs.map((d, i) => (
                      <button key={i} type="button" onClick={() => toast('Documents are filed offline — the passport links the reference only.', 'info')} className="flex items-center gap-2 text-[12px] text-[var(--color-sodalite)] hover:text-[var(--color-vein)] hover:underline w-full text-left mb-1.5 last:mb-0 transition-colors break-all">
                        <FileText size={12} className="shrink-0" /> {d}
                      </button>
                    ))}
                  </div>
                );
                // Split PO documents across the legs they belong to.
                const transitDocs = t.documentRefs.filter((d) => /BOL|CUSTOMS|ENTRY|LADING/i.test(d));
                const supplierDocs = t.documentRefs.filter((d) => !transitDocs.includes(d) && !/GRN|RCV|RECEIV/i.test(d));
                const receivingDocs = [
                  ...t.documentRefs.filter((d) => /GRN|RCV|RECEIV/i.test(d)),
                  ...(t.receiptNumber && !t.documentRefs.includes(t.receiptNumber) ? [t.receiptNumber] : []),
                ];
                const canViewLanded =
                  selectedPassportSlab.costLanded != null;
                return (
                  <>
                    {/* Top Meta Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 text-[13px]">
                      <div className="bp-card p-3">
                        <p className="bp-eyebrow mb-1.5">Product</p>
                        <p className="text-white font-medium truncate" title={selectedPassportSlab.product.name}>{selectedPassportSlab.product.name}</p>
                      </div>
                      <div className="bp-card p-3">
                        <p className="bp-eyebrow mb-1.5"><Term k="lot">Lot / Container</Term></p>
                        <p className="text-white font-medium truncate bp-mono text-[12px]" title={selectedPassportSlab.lotNumber ?? ''}>{selectedPassportSlab.lotNumber ?? '—'}</p>
                      </div>
                      <div className="bp-card p-3">
                        <p className="bp-eyebrow mb-1.5"><Term k="landedCost">Landed Cost</Term></p>
                        <p
                          className={`font-medium ${canViewLanded ? 'text-[var(--color-vein)]' : 'text-[var(--color-text-secondary)]'}`}
                          style={canViewLanded ? { fontFamily: 'var(--font-heading)' } : undefined}
                        >
                          {money(selectedPassportSlab.costLanded) ?? RESTRICTED}
                        </p>
                      </div>
                      <div className="bp-card p-3">
                        <p className="bp-eyebrow mb-1.5">Current Status</p>
                        <div className="mt-0.5"><StatusPill status={selectedPassportSlab.status} /></div>
                      </div>
                    </div>

                    <h3 className="bp-section-title mb-5">Lifecycle &amp; documentation</h3>

                    <div className="space-y-0">

                      {/* Node 1: Origin / Supplier */}
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className={nodeClass(n1)} aria-hidden>
                            <Factory size={14} />
                          </div>
                          <div className={`bp-timeline-rail ${n1 === 'done' ? 'bp-timeline-rail--done' : ''}`} />
                        </div>
                        <div className="flex-1 pb-8 flex gap-4">
                          <div className="flex-1">
                            <h4 className={titleClass(n1)}>1. Supplier Origin</h4>
                            {hasPO ? (
                              <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                                <p><User size={11} className="inline mr-1 -mt-0.5" />Supplier: <span className="text-white">{t.supplierName}</span>{t.supplierOrigin ? <span className="text-[var(--color-text-secondary)]"> · {t.supplierOrigin}</span> : null}</p>
                                <p><Hash size={11} className="inline mr-1 -mt-0.5" />Purchase Order: <span className="text-white font-mono">{t.poNumber}</span></p>
                                <p><Term k="fob">FOB</Term> Unit Cost: <span className="text-white">{t.unitCost != null ? `$${t.unitCost.toFixed(2)} / sf` : RESTRICTED}</span></p>
                                <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Date Issued: <span className="text-white">{fmtDate(t.poIssuedAt)}</span></p>
                              </div>
                            ) : (
                              <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                                <p>Origin: <span className="text-white">{t.supplierOrigin ?? 'Unknown'}</span></p>
                                <p className="italic text-[12px]">Opening stock — no inbound purchase order is linked to this slab.</p>
                              </div>
                            )}
                          </div>
                          {renderDocs(supplierDocs)}
                        </div>
                      </div>

                      {/* Node 2: Transit & Apportionment */}
                      <div className={`flex gap-4 ${hasPO ? '' : 'opacity-60'}`}>
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className={nodeClass(n2)} aria-hidden>
                            <Ship size={14} />
                          </div>
                          <div className={`bp-timeline-rail ${n2 === 'done' ? 'bp-timeline-rail--done' : ''}`} />
                        </div>
                        <div className="flex-1 pb-8 flex gap-4">
                          <div className="flex-1">
                            <h4 className={titleClass(n2)}>2. Transit &amp; <Term k="apportioned">Apportionment</Term></h4>
                            {hasPO ? (
                              <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                                <p><Ship size={11} className="inline mr-1 -mt-0.5" />Ocean Freight: <span className="text-white">{t.oceanVendorName ?? '—'}</span></p>
                                <p><Package size={11} className="inline mr-1 -mt-0.5" /><Term k="customs">Customs Broker</Term>: <span className="text-white">{t.customsVendorName ?? '—'}</span></p>
                                <p><Truck size={11} className="inline mr-1 -mt-0.5" />Inland Carrier: <span className="text-white">{t.inlandVendorName ?? '—'}</span></p>
                                <p>Apportioned Freight: <span className={selectedPassportSlab.costApportioned != null ? 'text-[var(--color-vein)]' : 'text-white'}>{selectedPassportSlab.costApportioned != null ? `+${money(selectedPassportSlab.costApportioned)} applied` : RESTRICTED}</span></p>
                                <p><Term k="eta">Est. Delivery</Term>: <span className="text-white">{fmtDate(t.poEstimatedDelivery)}</span></p>
                              </div>
                            ) : (
                              <p className="text-[13px] text-[var(--color-text-secondary)] italic">No inbound logistics recorded for opening stock.</p>
                            )}
                          </div>
                          {renderDocs(transitDocs)}
                        </div>
                      </div>

                      {/* Node 3: Receiving / Current Inventory */}
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className={nodeClass(n3)} aria-hidden>
                            <Warehouse size={14} />
                          </div>
                          <div className={`bp-timeline-rail ${n3 === 'done' ? 'bp-timeline-rail--done' : ''}`} />
                        </div>
                        <div className="flex-1 pb-8 flex gap-4">
                          <div className="flex-1">
                            <h4 className={titleClass(n3)}>3. Current Inventory</h4>
                            <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                              <p><MapPin size={11} className="inline mr-1 -mt-0.5" />Location: <span className="text-white">{selectedPassportSlab.location.name}</span></p>
                              <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Date Received: <span className="text-white">{fmtDate(selectedPassportSlab.createdAt)}</span></p>
                              <p>Dimensions: <span className="text-white">{selectedPassportSlab.lengthInches}&quot; × {selectedPassportSlab.widthInches}&quot; ({selectedPassportSlab.totalSf} SF)</span></p>
                              {t.receiptNumber && <p><Receipt size={11} className="inline mr-1 -mt-0.5" /><Term k="receipt">Receipt No.</Term>: <span className="text-white font-mono">{t.receiptNumber}</span></p>}
                            </div>
                          </div>
                          {renderDocs(receivingDocs, n3 === 'active')}
                        </div>
                      </div>

                      {/* Node 4: Sales & Customer */}
                      <div className={`flex gap-4 ${sold ? '' : 'opacity-70'}`}>
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className={nodeClass(n4)} aria-hidden>
                            <ShoppingCart size={14} />
                          </div>
                        </div>
                        <div className="flex-1 flex gap-4">
                          <div className="flex-1">
                            <h4 className={titleClass(n4)}>4. Sales &amp; Customer</h4>
                            {sold ? (
                              <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
                                <p><User size={11} className="inline mr-1 -mt-0.5" />Customer: <span className="text-white">{t.customerName}</span></p>
                                <p>Sales Rep: <span className="text-white">{t.salesRepName ?? '—'}</span></p>
                                <p><Hash size={11} className="inline mr-1 -mt-0.5" />Sales Order: <span className="text-white font-mono">{t.soNumber}</span></p>
                                <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Sold: <span className="text-white">{fmtDate(t.soldAt)}</span></p>
                                <p>Sold Price: <span className="text-white">{t.soldPricePerSf != null ? `$${t.soldPricePerSf.toFixed(2)} / sf` : RESTRICTED}</span></p>
                              </div>
                            ) : (
                              <p className="text-[13px] text-[var(--color-text-secondary)] italic">Not yet sold — awaiting opportunity conversion.</p>
                            )}
                          </div>
                          {renderDocs(sold && t.soNumber ? [t.soNumber] : [])}
                        </div>
                      </div>

                    </div>
                  </>
                );
              })()}
            </div>
            </>
            )}
      </Drawer>

    </div>
    </PageShell>
  );
}

/** A collapsible multi-select facet group for the inventory filter sidebar (with per-value counts). */
function SidebarFacet({ title, expanded, onToggle, options, selected, onSelect }: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  options: [string, number][];
  selected: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="border border-[var(--color-basalt-500)] rounded-md overflow-hidden shrink-0">
      <div onClick={onToggle} className="bg-[var(--color-basalt-700)] px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[var(--color-basalt-500)] transition-colors">
        <span className="text-[13px] font-medium text-white">{title}{selected.length > 0 && <span className="ml-2 text-[11px] text-[var(--color-vein)]">({selected.length})</span>}</span>
        {expanded ? <ChevronUp size={14} className="text-[var(--color-text-secondary)]" /> : <ChevronDown size={14} className="text-[var(--color-text-secondary)]" />}
      </div>
      {expanded && (
        <div className="p-2 space-y-1 bg-[var(--color-basalt-800)] max-h-52 overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-[11px] text-[var(--color-text-secondary)] italic px-2 py-1">No values</p>
          ) : options.map(([value, count]) => (
            <label key={value} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[var(--color-basalt-700)] rounded cursor-pointer group/label">
              <input type="checkbox" checked={selected.includes(value)} onChange={() => onSelect(value)} className="w-4 h-4 rounded-sm bg-[var(--color-basalt-900)] border-[var(--color-basalt-500)] accent-[var(--color-vein)]" />
              <span className="text-[13px] text-[var(--color-text-muted)] group-hover/label:text-white truncate">{value}</span>
              <span className="ml-auto text-[11px] text-[var(--color-text-secondary)]">({count})</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
