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
  Warehouse,
  Package,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useRole } from '@/context/RoleContext';
import { useToast } from '@/components/ui/Toast';
import {
  submitMeasurementOverrideAction,
  transferSlabsAction, holdSlabsAction, releaseSlabsAction, writeOffSlabsAction,
} from '@/server/inventory/actions';
import type { InventoryRow, InventoryLocation } from '@/server/inventory/queries';
import { ArrowLeftRight, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { FacetCard, FacetRow } from '@/components/ui/FacetCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { ListToolbar } from '@/components/ui/ListToolbar';
import { StatusPill } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { swatchBaseForMaterial } from '@/lib/domain/material-swatch';
import { getBlockMates } from '@/lib/domain/block-mates';
import { PassportDrawer } from '@/components/inventory/PassportDrawer';
import { BulkOpModal } from '@/components/inventory/BulkOpModal';

type InventoryItemProps = InventoryRow;
export type BulkOp = 'TRANSFER' | 'HOLD' | 'RELEASE' | 'WRITE_OFF';

const fmtDate = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

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
                          <Button type="button" onClick={clearAllFilters} variant="ghost">
                            Clear filters
                          </Button>
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
                            <Button
                              type="button"
                              onClick={handleSubmitMeasures}
                              className="!min-h-7 !px-2 text-[11px] gap-1"
                              title="Submit to Admin for Approval"
                            >
                              <Send size={12} /> Submit
                            </Button>
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
            <button type="button" onClick={() => openBulk('WRITE_OFF')} className="flex items-center gap-1.5 text-[13px] text-white hover:bg-[var(--color-basalt-700)] px-2.5 py-1.5 rounded-md transition-colors"><Trash2 size={14} className="text-[var(--color-ruby)]" /> Write-off</button>
          )}
          <div className="w-px h-5 bg-[var(--color-basalt-500)] mx-1" />
          <button type="button" onClick={clearSelection} aria-label="Clear selection" className="text-[var(--color-text-secondary)] hover:text-white p-1 rounded hover:bg-[var(--color-basalt-700)]"><X size={16} /></button>
        </div>
      )}

      {/* Bulk operation — shared Modal */}
      <BulkOpModal
        bulkOp={bulkOp}
        onClose={() => setBulkOp(null)}
        selectedCount={selectedIds.size}
        bulkDestId={bulkDestId}
        setBulkDestId={setBulkDestId}
        bulkReason={bulkReason}
        setBulkReason={setBulkReason}
        locations={locations}
        isPending={isPending}
        onConfirm={runBulk}
      />

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
      <PassportDrawer
        selectedPassportSlab={selectedPassportSlab}
        onClose={closePassport}
        passportSearch={passportSearch}
        setPassportSearch={setPassportSearch}
        passportResults={passportResults}
        onSelectSlab={openPassport}
        passportMates={passportMates}
      />

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
