'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Grid, 
  ListFilter, 
  Search, 
  ArrowUpDown, 
  Settings, 
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
import { useSearchParams } from 'next/navigation';
import { useRole } from '@/context/RoleContext';
import { useToast } from '@/components/ui/Toast';
import { submitMeasurementOverrideAction } from '@/server/actions/inventory';
import { Term } from '@/components/ui/Tooltip';
import type { InventoryRow } from '@/server/queries/inventory';

type InventoryItemProps = InventoryRow;

const RESTRICTED = (
  <span className="text-[#b8b6b9] text-[10px] bg-[#333234] px-1.5 py-0.5 rounded uppercase tracking-wider">Restricted</span>
);

const fmtDate = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const money = (n: number | null | undefined) =>
  n == null ? null : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DEFAULT_COLUMNS = {
  slabId: true,
  product: true,
  dimensions: true,
  sfCost: false,
  landedCost: true,
  location: true,
  container: false,
  dateReceived: false
};

const DEFAULT_COLUMN_ORDER = [
  'slabId', 'product', 'dimensions', 'location', 'container', 'dateReceived', 'status', 'sfCost', 'landedCost'
];

export function InventoryTableClient({
  initialData,
  availableLocations,
}: {
  initialData: InventoryItemProps[];
  availableLocations: string[];
}) {
  const { role, settings } = useRole();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'none' | 'slabId' | 'product' | 'totalSf' | 'landedCost' | 'createdAt' | 'status'>('none');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [isClient, setIsClient] = useState(false);
  
  // Array filters
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Filter Sidebar states
  const [showFilters, setShowFilters] = useState(true);
  const [isStatusExpanded, setIsStatusExpanded] = useState(true);
  const [isLocationExpanded, setIsLocationExpanded] = useState(true);

  // Columns & Order
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);

  // Drag and Drop State for Columns
  const [draggedCol, setDraggedCol] = useState<string | null>(null);

  // Load saved preferences on mount
  useEffect(() => {
    setIsClient(true);
    const savedCols = localStorage.getItem('blueplanet_inventory_columns');
    const savedOrder = localStorage.getItem('blueplanet_inventory_column_order');
    if (savedCols) {
      try { setVisibleColumns(JSON.parse(savedCols)); } catch (e) {}
    }
    if (savedOrder) {
      try { setColumnOrder(JSON.parse(savedOrder)); } catch (e) {}
    }
  }, []);

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
    if (!wanted) return;
    const match = initialData.find((i) => i.uniqueSlabId === wanted || i.id === wanted);
    if (match) setSelectedPassportSlab(match);
  }, [searchParams, initialData]);

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
      let newWidth = startWidth.current + delta;
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

  const handleDragOver = (e: React.DragEvent, colId: string) => {
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
      const searchableString = `
        ${item.uniqueSlabId}
        ${item.barcode}
        ${item.product.name}
        ${item.product.materialType}
        ${item.location.name}
        ${item.status}
        ${item.lotNumber || ''}
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

      const matchSearch = searchableString.includes(searchTerm.toLowerCase());
      const matchLoc = selectedLocations.length === 0 || selectedLocations.includes(item.location.name);
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(item.status);
      
      return matchSearch && matchLoc && matchStatus;
    });
  }, [initialData, searchTerm, selectedLocations, selectedStatuses, role, settings]);

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

  useEffect(() => { setPage(1); }, [searchTerm, selectedLocations, selectedStatuses, sortKey, sortDir]);

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
        className={`px-4 py-3 font-medium border-b border-[#454446] ${align} cursor-grab active:cursor-grabbing hover:bg-[#333234] transition-colors`} 
        title={title}
      >
        <div className={`flex items-center gap-1.5 ${align === 'text-right' ? 'justify-end' : ''}`}>
          <GripHorizontal size={12} className="text-[#454446] hover:text-[#92b0ce] shrink-0" />
          <span className="underline decoration-dotted decoration-[#454446] underline-offset-4">{label}</span>
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
        <td key={colKey} className="px-4 py-3 border-b border-[#454446] text-white">
          <span 
            onClick={() => setSelectedPassportSlab(item)}
            className="hover:underline cursor-pointer hover:text-[#e3c16c] transition-colors"
          >
            {item.uniqueSlabId}
          </span>
        </td>
      );
      case 'product': return <td key={colKey} className="px-4 py-3 border-b border-[#454446]">{item.product.name}</td>;
      case 'dimensions': return (
        <td key={colKey} className="px-4 py-3 border-b border-[#454446]">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={editForm.lengthInches}
                onChange={(e) => setEditForm({...editForm, lengthInches: Number(e.target.value)})}
                className="w-16 bg-[#1c1c1c] border border-[#e3c16c] rounded px-2 py-1 text-white text-[12px] outline-none"
              />
              <span>" ×</span>
              <input 
                type="number" 
                value={editForm.widthInches}
                onChange={(e) => setEditForm({...editForm, widthInches: Number(e.target.value)})}
                className="w-16 bg-[#1c1c1c] border border-[#e3c16c] rounded px-2 py-1 text-white text-[12px] outline-none"
              />
              <span>"</span>
            </div>
          ) : (
            <>{item.lengthInches}" × {item.widthInches}" <span className="text-[#b8b6b9] ml-1">({item.totalSf} SF)</span></>
          )}
        </td>
      );
      case 'location': return (
        <td key={colKey} className="px-4 py-3 border-b border-[#454446] text-[#b8b6b9]">
          <span className="flex items-center gap-2">
            <Building2 size={12} className="text-[#b8b6b9]" />
            {item.location.name}
          </span>
        </td>
      );
      case 'container': return <td key={colKey} className="px-4 py-3 border-b border-[#454446]">{item.lotNumber || 'N/A'}</td>;
      case 'dateReceived': return <td key={colKey} className="px-4 py-3 border-b border-[#454446]">{new Date(item.createdAt).toLocaleDateString()}</td>;
      case 'status': return <td key={colKey} className="px-4 py-3 border-b border-[#454446]">{item.status}</td>;
      case 'sfCost': return (
        <td key={colKey} className="px-4 py-3 border-b border-[#454446] text-right">
          {canViewCost ? `$${sfCost}` : <span className="text-[#b8b6b9] text-[10px] bg-[#333234] px-1.5 py-0.5 rounded uppercase tracking-wider">Restricted</span>}
        </td>
      );
      case 'landedCost': return (
        <td key={colKey} className="px-4 py-3 border-b border-[#454446] text-right font-medium">
          {canViewCost 
            ? `$${item.costLanded?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
            : <span className="text-[#b8b6b9] text-[10px] bg-[#333234] px-1.5 py-0.5 rounded uppercase tracking-wider">Restricted</span>}
        </td>
      );
      default: return null;
    }
  };

  if (!isClient) return null; // Prevent hydration mismatch

  return (
    <div className="flex flex-col h-full bg-[#2b2a2c] text-[#d9d8d9] relative">
      
      {/* 1. Sub Header Area */}
      <div className="pt-6 pb-2 px-6">
        <h1 className="text-[20px] font-medium text-white mb-4">Inventory Search</h1>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[13px]">
            {/* View Customization Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowViewMenu(!showViewMenu)}
                className="flex items-center gap-2 hover:bg-[#333234] px-2 py-1 rounded transition-colors"
              >
                <Grid size={14} className="text-[#b8b6b9]" /> Default view <ChevronDown size={12} />
              </button>
              
              {showViewMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowViewMenu(false)}></div>
                  <div className="absolute left-0 top-8 mt-1 w-48 bg-[#1c1c1c] border border-[#454446] rounded-md shadow-xl z-50 p-1 flex flex-col">
                    <button onClick={saveAsDefaultView} className="text-left px-3 py-2 text-[13px] text-white hover:bg-[#333234] rounded flex items-center gap-2">
                      <Save size={12} className="text-[#e3c16c]" /> Save as Default
                    </button>
                    <button onClick={resetToSystemDefault} className="text-left px-3 py-2 text-[13px] text-[#b8b6b9] hover:bg-[#333234] hover:text-white rounded">
                      Reset to System Default
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-4 bg-[#454446]"></div>
            
            {/* Toggle Filters Button */}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${showFilters ? 'bg-[#333234] text-white' : 'hover:bg-[#333234] text-[#b8b6b9]'}`}
            >
              <ListFilter size={14} /> {showFilters ? 'Hide Filters' : 'Show Filters'} 
              {(selectedLocations.length > 0 || selectedStatuses.length > 0) && (
                <span className="bg-[#e3c16c] text-black text-[10px] px-1 rounded-sm ml-1 font-medium">
                  {selectedLocations.length + selectedStatuses.length}
                </span>
              )}
            </button>

            <div className="ml-4 flex items-center bg-[#1c1c1c] border border-[#454446] rounded-md px-3 py-1.5 focus-within:border-[#92b0ce] transition-colors w-64">
              <Search size={14} className="text-[#b8b6b9] mr-2 shrink-0" />
              <input 
                type="text" 
                placeholder="Search any column..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[#b8b6b9]"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-[13px] relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="px-3 py-1.5 hover:bg-[#333234] rounded-md transition-colors flex items-center gap-1.5"
            >
              <ArrowUpDown size={14} /> {sortKey === 'none' ? 'Sort' : `Sort: ${SORT_OPTIONS.find((o) => o.key === sortKey)?.label}`}
              {sortKey !== 'none' && <span className="text-[11px] text-[#92b0ce]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-9 w-48 bg-[#1c1c1c] border border-[#454446] rounded-md shadow-xl z-50 p-1">
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      onClick={() => { setSortKey(o.key); setShowSortMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] rounded hover:bg-[#333234] ${sortKey === o.key ? 'text-[#e3c16c]' : 'text-white'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                  <div className="h-px bg-[#454446] my-1" />
                  <button
                    onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                    className="w-full text-left px-3 py-1.5 text-[13px] rounded hover:bg-[#333234] text-[#b8b6b9]"
                  >
                    Direction: {sortDir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Workspace */}
      <div className="flex flex-1 overflow-hidden border-t border-[#454446] mt-2">
        
        {/* Left Filter Sidebar - Resizable and Toggleable */}
        {showFilters && (
          <div 
            className="relative border-r border-[#454446] bg-[#2b2a2c] flex flex-col shrink-0 transition-all"
            style={{ width: sidebarWidth }}
          >
            {/* Custom Draggable Handle (Using Mousedown + Mousemove) */}
            <div 
              className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-col-resize hover:bg-[#e3c16c] transition-colors z-20 group"
              onMouseDown={startResizing}
              title="Drag to resize filter panel"
            >
              <div className="w-full h-full opacity-0 group-hover:opacity-100 bg-[#e3c16c]/20 transition-opacity" />
            </div>

            <div className="flex border-b border-[#454446] text-[13px] shrink-0">
              <div className="flex-1 py-2 px-3 text-center border-b-2 border-[#92b0ce] text-white font-medium cursor-pointer">
                Total <br/><span className="text-[#b8b6b9] font-normal">{initialData.length} Slabs</span>
              </div>
              <div className="flex-1 py-2 px-3 text-center text-[#b8b6b9] cursor-pointer hover:bg-[#333234]">
                Net New <br/>{filteredData.length}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 select-none">
              
              {/* Filter Group: Status - Collapsible */}
              <div className="border border-[#454446] rounded-md overflow-hidden shrink-0">
                <div 
                  onClick={() => setIsStatusExpanded(!isStatusExpanded)}
                  className="bg-[#333234] px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#454446] transition-colors"
                >
                  <span className="text-[13px] font-medium text-white">Slab Status</span>
                  {isStatusExpanded ? <ChevronUp size={14} className="text-[#b8b6b9]"/> : <ChevronDown size={14} className="text-[#b8b6b9]"/>}
                </div>
                {isStatusExpanded && (
                  <div className="p-2 space-y-1 bg-[#2b2a2c]">
                    {['AVAILABLE', 'SOLD', 'ON_HOLD'].map(status => (
                      <label key={status} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[#333234] rounded cursor-pointer group/label">
                        <input 
                          type="checkbox" 
                          checked={selectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                          className="w-4 h-4 rounded-sm bg-[#1c1c1c] border-[#454446] text-[#e3c16c] focus:ring-[#e3c16c] focus:ring-offset-[#2b2a2c]"
                        />
                        <span className="text-[13px] text-[#d9d8d9] group-hover/label:text-white capitalize truncate">{status.toLowerCase()}</span>
                        <span className="ml-auto text-[11px] text-[#b8b6b9]">
                          ({initialData.filter(i => i.status === status).length})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter Group: Location - Collapsible */}
              <div className="border border-[#454446] rounded-md overflow-hidden shrink-0">
                <div 
                  onClick={() => setIsLocationExpanded(!isLocationExpanded)}
                  className="bg-[#333234] px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#454446] transition-colors"
                >
                  <span className="text-[13px] font-medium text-white">Location</span>
                  {isLocationExpanded ? <ChevronUp size={14} className="text-[#b8b6b9]"/> : <ChevronDown size={14} className="text-[#b8b6b9]"/>}
                </div>
                {isLocationExpanded && (
                  <div className="p-2 space-y-1 bg-[#2b2a2c]">
                    {availableLocations.map(loc => (
                      <label key={loc} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[#333234] rounded cursor-pointer group/label">
                        <input 
                          type="checkbox" 
                          checked={selectedLocations.includes(loc)}
                          onChange={() => toggleLocation(loc)}
                          className="w-4 h-4 rounded-sm bg-[#1c1c1c] border-[#454446] text-[#e3c16c] focus:ring-[#e3c16c] focus:ring-offset-[#2b2a2c]"
                        />
                        <span className="text-[13px] text-[#d9d8d9] group-hover/label:text-white truncate">{loc}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <div className="p-3 border-t border-[#454446] flex justify-between items-center text-[13px] shrink-0">
              <button 
                onClick={() => { setSelectedLocations([]); setSelectedStatuses([]); setSearchTerm(''); }}
                className="text-[#b8b6b9] hover:text-white"
              >
                Clear all {selectedLocations.length + selectedStatuses.length > 0 && <span className="bg-[#454446] text-white px-1.5 rounded ml-1">{selectedLocations.length + selectedStatuses.length}</span>}
              </button>
            </div>
          </div>
        )}

        {/* Right Pane (Table Area) */}
        <div className="flex-1 overflow-auto bg-[#2b2a2c] relative">
          <table className="w-full text-left text-[13px] text-[#d9d8d9] whitespace-nowrap border-collapse min-w-max">
            <thead className="sticky top-0 bg-[#2b2a2c] z-10 shadow-[0_1px_0_#454446]">
              <tr>
                <th className="px-4 py-3 w-10 border-b border-[#454446]">
                  <input type="checkbox" className="w-4 h-4 rounded-sm bg-[#1c1c1c] border-[#454446] text-[#e3c16c] focus:ring-[#e3c16c]" />
                </th>
                
                {/* Dynamically Rendered Draggable Columns */}
                {columnOrder.map(colKey => renderHeaderCell(colKey))}
                
                {/* Column Toggle Dropdown Container */}
                <th className="px-4 py-3 font-medium border-b border-[#454446] text-right align-middle">
                  <div className="relative inline-block text-left">
                    <button 
                      onClick={() => setShowColumnMenu(!showColumnMenu)}
                      className="text-[#92b0ce] hover:text-white flex items-center gap-1.5 bg-[#1c1c1c] border border-[#454446] px-3 py-1.5 rounded-lg transition-all shadow-sm hover:shadow"
                    >
                      <Plus size={14} /> Add column
                    </button>

                    {showColumnMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowColumnMenu(false)}></div>
                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#1c1c1c] border border-[#454446] rounded-xl shadow-[0_12px_36px_rgb(0,0,0,0.6)] z-50 p-2.5 text-left">
                          <div className="text-[11px] text-[#b8b6b9] font-medium uppercase tracking-wider px-2 pb-1 mb-1 border-b border-[#454446]">Toggle Columns</div>
                          {DEFAULT_COLUMN_ORDER.map((colKey) => (
                            <label key={colKey} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[#333234] rounded cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                checked={visibleColumns[colKey as keyof typeof visibleColumns]}
                                onChange={() => toggleColumn(colKey as keyof typeof visibleColumns)}
                                className="w-4 h-4 rounded-sm bg-[#2b2a2c] border-[#454446] text-[#e3c16c] focus:ring-[#e3c16c] accent-[#e3c16c]"
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
            
            <tbody className="divide-y divide-[#454446]">
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-[#b8b6b9]">No slabs found matching your criteria.</td>
                </tr>
              ) : (
                pagedData.map((item) => {
                  const isEditing = editingSlabId === item.uniqueSlabId;
                  const isPendingApproval = pendingApprovals.includes(item.uniqueSlabId);
                  
                  return (
                    <tr key={item.id} className={`hover:bg-[#333234] transition-colors group ${isEditing ? 'bg-[#333234]' : ''}`}>
                      <td className="px-4 py-3 border-b border-[#454446]">
                        <input type="checkbox" className="w-4 h-4 rounded-sm bg-[#1c1c1c] border-[#454446] text-[#e3c16c] focus:ring-[#e3c16c] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                      
                      {/* Render Table Data according to columnOrder */}
                      {columnOrder.map(colKey => renderDataCell(colKey, item, isEditing))}

                      <td className="px-4 py-3 border-b border-[#454446] text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={handleCancelEdit}
                              className="flex items-center justify-center text-white border border-[#454446] w-7 h-7 rounded hover:bg-[#454446] transition-colors"
                              title="Cancel edits"
                            >
                              <X size={14} />
                            </button>
                            <button 
                              onClick={handleSubmitMeasures}
                              className="flex items-center gap-1 text-black bg-[#e3c16c] hover:bg-[#d2ac55] px-2 py-1 h-7 rounded font-medium transition-colors"
                              title="Submit to Admin for Approval"
                            >
                              <Send size={12} /> Submit
                            </button>
                          </div>
                        ) : isPendingApproval ? (
                          <button 
                            onClick={() => handleStartEdit(item)}
                            className="flex items-center gap-1 ml-auto text-[#10b981] border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-1 rounded-md transition-all group-hover:bg-[#10b981]/20"
                            title="Submitted for approval. Click to edit again."
                          >
                            <span className="flex items-center gap-1 group-hover:hidden">
                              <Check size={12} /> Submitted
                            </span>
                            <span className="items-center gap-1 hidden group-hover:flex text-white">
                              <Pencil size={12} className="text-[#92b0ce]" /> Edit again
                            </span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleStartEdit(item)}
                            className="flex items-center gap-1 ml-auto text-white border border-[#454446] px-2 py-1 rounded-md hover:bg-[#454446] transition-colors group-hover:bg-[#454446]"
                          >
                            <Pencil size={12} className="text-[#92b0ce]" />
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
          
          <div className="sticky bottom-0 bg-[#2b2a2c] p-3 border-t border-[#454446] flex items-center justify-between text-[13px] shadow-[0_-1px_0_#454446]">
            <div className="flex items-center gap-2 text-[#b8b6b9]">
              <span>Page {currentPage} of {totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="px-2 py-1 hover:bg-[#333234] rounded text-[#b8b6b9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &lt;
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                className="px-2 py-1 hover:bg-[#333234] rounded text-[#b8b6b9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                &gt;
              </button>
              <span className="ml-2 text-[#b8b6b9]">
                {sortedData.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedData.length)} of {sortedData.length} Slabs
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Floating Approval Toast Notification */}
      {showApprovalModal && (
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-[#1c1c1c] border border-[#e3c16c] px-4 py-3 rounded-md shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <CheckCircle size={18} className="text-[#e3c16c]" />
          <div>
            <p className="text-[13px] font-medium text-white">Event Queued: Measurement Override</p>
            <p className="text-[11px] text-[#b8b6b9]">Admin approval required for {showApprovalModal}. Navigating to Outbox...</p>
          </div>
        </div>
      )}

      {/* Material Passport (Lifecycle Tracking) Drawer */}
      {selectedPassportSlab && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 z-50 transition-opacity" 
            onClick={() => setSelectedPassportSlab(null)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-[700px] bg-[#2b2a2c] border-l border-[#454446] shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#454446] bg-[#1c1c1c]">
              <div>
                <h2 className="text-[18px] font-medium text-white flex items-center gap-2">
                  Material Passport
                  <span className="bg-[#e3c16c]/20 text-[#e3c16c] border border-[#e3c16c]/30 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider">
                    DIGITAL TWIN
                  </span>
                </h2>
                <p className="text-[13px] text-[#b8b6b9] mt-1">{selectedPassportSlab.uniqueSlabId}</p>
              </div>
              <button 
                onClick={() => setSelectedPassportSlab(null)}
                className="text-[#b8b6b9] hover:text-white hover:bg-[#333234] p-1.5 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Search / Switcher — jump to any slab by its lineage */}
            <div className="px-6 py-4 border-b border-[#454446] bg-[#2b2a2c] relative">
              <div className="flex items-center bg-[#1c1c1c] border border-[#454446] rounded-md px-3 py-2 focus-within:border-[#92b0ce] transition-colors">
                <Search size={14} className="text-[#b8b6b9] mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Find a slab by ID, supplier, lot/container, customer, PO, or date…"
                  value={passportSearch}
                  onChange={(e) => setPassportSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-[13px] text-white w-full placeholder-[#b8b6b9]"
                />
                {passportSearch && (
                  <button onClick={() => setPassportSearch('')} aria-label="Clear search" className="text-[#b8b6b9] hover:text-white ml-2"><X size={14} /></button>
                )}
              </div>
              {passportResults.length > 0 && (
                <div className="absolute left-6 right-6 top-full mt-1 bg-[#1c1c1c] border border-[#454446] rounded-md shadow-2xl z-20 max-h-72 overflow-y-auto">
                  {passportResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedPassportSlab(r); setPassportSearch(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-[#333234] border-b border-[#333234] last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-white font-mono">{r.uniqueSlabId}</span>
                        <span className="text-[10px] text-[#b8b6b9] uppercase tracking-wider">{r.status}</span>
                      </div>
                      <div className="text-[11px] text-[#b8b6b9] truncate">
                        {r.product.name} · {r.trace.supplierName ?? 'Opening stock'} · Lot {r.lotNumber ?? '—'}
                        {r.trace.customerName ? ` · → ${r.trace.customerName}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {passportSearch.trim().length >= 2 && passportResults.length === 0 && (
                <div className="absolute left-6 right-6 top-full mt-1 bg-[#1c1c1c] border border-[#454446] rounded-md shadow-2xl z-20 px-3 py-3 text-[12px] text-[#b8b6b9]">
                  No slab matches &ldquo;{passportSearch}&rdquo;.
                </div>
              )}
            </div>

            {/* Drawer Content (Timeline) — real lineage from the database */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const t = selectedPassportSlab.trace;
                const hasPO = !!t.poNumber;
                const renderDocs = (refs: string[], accent = false) => (
                  <div className={`w-[210px] shrink-0 bg-[#1c1c1c] border ${accent ? 'border-[#e3c16c]/30' : 'border-[#454446]'} rounded-md p-3`}>
                    <span className={`text-[10px] ${accent ? 'text-[#e3c16c]' : 'text-[#b8b6b9]'} font-medium uppercase tracking-wider mb-2 block`}>Linked Documents</span>
                    {refs.length === 0 ? (
                      <p className="text-[11px] text-[#b8b6b9] italic">None on file</p>
                    ) : refs.map((d, i) => (
                      <button key={i} onClick={() => toast('Documents are filed offline — the passport links the reference only.', 'info')} className="flex items-center gap-2 text-[12px] text-[#92b0ce] hover:text-[#e3c16c] hover:underline w-full text-left mb-1.5 last:mb-0 transition-colors break-all">
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
                return (
                  <>
                    {/* Top Meta Info */}
                    <div className="grid grid-cols-4 gap-4 mb-8 text-[13px]">
                      <div className="bg-[#333234] border border-[#454446] p-3 rounded-md">
                        <p className="text-[#b8b6b9] mb-1">Product</p>
                        <p className="text-white font-medium truncate" title={selectedPassportSlab.product.name}>{selectedPassportSlab.product.name}</p>
                      </div>
                      <div className="bg-[#333234] border border-[#454446] p-3 rounded-md">
                        <p className="text-[#b8b6b9] mb-1"><Term k="lot">Lot / Container</Term></p>
                        <p className="text-white font-medium truncate" title={selectedPassportSlab.lotNumber ?? ''}>{selectedPassportSlab.lotNumber ?? '—'}</p>
                      </div>
                      <div className="bg-[#333234] border border-[#454446] p-3 rounded-md">
                        <p className="text-[#b8b6b9] mb-1"><Term k="landedCost">Landed Cost</Term></p>
                        <p className="text-[#e3c16c] font-medium">{money(selectedPassportSlab.costLanded) ?? RESTRICTED}</p>
                      </div>
                      <div className="bg-[#333234] border border-[#454446] p-3 rounded-md">
                        <p className="text-[#b8b6b9] mb-1">Current Status</p>
                        <p className="text-[#10b981] font-medium flex items-center gap-1 truncate"><Check size={14} /> {selectedPassportSlab.status}</p>
                      </div>
                    </div>

                    <h3 className="text-[14px] font-medium text-white mb-6 tracking-wide uppercase">Lifecycle Pipeline &amp; Documentation</h3>

                    <div className="space-y-0">

                      {/* Node 1: Origin / Supplier */}
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className="w-8 h-8 rounded-full bg-[#333234] border-2 border-[#454446] flex items-center justify-center z-10 relative">
                            <Factory size={14} className="text-[#b8b6b9]" />
                          </div>
                          <div className="w-0.5 bg-[#454446] flex-1 -mt-2"></div>
                        </div>
                        <div className="flex-1 pb-8 flex gap-4">
                          <div className="flex-1">
                            <h4 className="text-[14px] text-white font-medium mb-2">1. Supplier Origin</h4>
                            {hasPO ? (
                              <div className="text-[13px] text-[#b8b6b9] space-y-1">
                                <p><User size={11} className="inline mr-1 -mt-0.5" />Supplier: <span className="text-white">{t.supplierName}</span>{t.supplierOrigin ? <span className="text-[#b8b6b9]"> · {t.supplierOrigin}</span> : null}</p>
                                <p><Hash size={11} className="inline mr-1 -mt-0.5" />Purchase Order: <span className="text-white font-mono">{t.poNumber}</span></p>
                                <p><Term k="fob">FOB</Term> Unit Cost: <span className="text-white">{t.unitCost != null ? `$${t.unitCost.toFixed(2)} / sf` : RESTRICTED}</span></p>
                                <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Date Issued: <span className="text-white">{fmtDate(t.poIssuedAt)}</span></p>
                              </div>
                            ) : (
                              <div className="text-[13px] text-[#b8b6b9] space-y-1">
                                <p>Origin: <span className="text-white">{t.supplierOrigin ?? 'Unknown'}</span></p>
                                <p className="italic text-[12px]">Opening stock — no inbound purchase order is linked to this slab.</p>
                              </div>
                            )}
                          </div>
                          {renderDocs(supplierDocs)}
                        </div>
                      </div>

                      {/* Node 2: Transit & Apportionment */}
                      <div className={`flex gap-4 ${hasPO ? '' : 'opacity-50'}`}>
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className="w-8 h-8 rounded-full bg-[#333234] border-2 border-[#454446] flex items-center justify-center z-10 relative">
                            <Ship size={14} className="text-[#b8b6b9]" />
                          </div>
                          <div className="w-0.5 bg-[#454446] flex-1 -mt-2"></div>
                        </div>
                        <div className="flex-1 pb-8 flex gap-4">
                          <div className="flex-1">
                            <h4 className="text-[14px] text-white font-medium mb-2">2. Transit &amp; <Term k="apportioned">Apportionment</Term></h4>
                            {hasPO ? (
                              <div className="text-[13px] text-[#b8b6b9] space-y-1">
                                <p><Ship size={11} className="inline mr-1 -mt-0.5" />Ocean Freight: <span className="text-white">{t.oceanVendorName ?? '—'}</span></p>
                                <p><Package size={11} className="inline mr-1 -mt-0.5" /><Term k="customs">Customs Broker</Term>: <span className="text-white">{t.customsVendorName ?? '—'}</span></p>
                                <p><Truck size={11} className="inline mr-1 -mt-0.5" />Inland Carrier: <span className="text-white">{t.inlandVendorName ?? '—'}</span></p>
                                <p>Apportioned Freight: <span className="text-[#e3c16c]">{selectedPassportSlab.costApportioned != null ? `+${money(selectedPassportSlab.costApportioned)} applied` : RESTRICTED}</span></p>
                                <p><Term k="eta">Est. Delivery</Term>: <span className="text-white">{fmtDate(t.poEstimatedDelivery)}</span></p>
                              </div>
                            ) : (
                              <p className="text-[13px] text-[#b8b6b9] italic">No inbound logistics recorded for opening stock.</p>
                            )}
                          </div>
                          {renderDocs(transitDocs)}
                        </div>
                      </div>

                      {/* Node 3: Receiving / Current Inventory */}
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className="w-8 h-8 rounded-full bg-[#e3c16c]/20 border-2 border-[#e3c16c] shadow-[0_0_10px_rgba(227,193,108,0.2)] flex items-center justify-center z-10 relative">
                            <Warehouse size={14} className="text-[#e3c16c]" />
                          </div>
                          <div className="w-0.5 bg-[#454446] flex-1 -mt-2"></div>
                        </div>
                        <div className="flex-1 pb-8 flex gap-4">
                          <div className="flex-1">
                            <h4 className="text-[14px] text-[#e3c16c] font-medium mb-2">3. Current Inventory</h4>
                            <div className="text-[13px] text-[#b8b6b9] space-y-1">
                              <p><MapPin size={11} className="inline mr-1 -mt-0.5" />Location: <span className="text-white">{selectedPassportSlab.location.name}</span></p>
                              <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Date Received: <span className="text-white">{fmtDate(selectedPassportSlab.createdAt)}</span></p>
                              <p>Dimensions: <span className="text-white">{selectedPassportSlab.lengthInches}&quot; × {selectedPassportSlab.widthInches}&quot; ({selectedPassportSlab.totalSf} SF)</span></p>
                              {t.receiptNumber && <p><Receipt size={11} className="inline mr-1 -mt-0.5" /><Term k="receipt">Receipt No.</Term>: <span className="text-white font-mono">{t.receiptNumber}</span></p>}
                            </div>
                          </div>
                          {renderDocs(receivingDocs, true)}
                        </div>
                      </div>

                      {/* Node 4: Sales & Customer */}
                      <div className={`flex gap-4 ${t.sold ? '' : 'opacity-50'}`}>
                        <div className="flex flex-col items-center w-8 shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 relative ${t.sold ? 'bg-[#10b981]/20 border-2 border-[#10b981]' : 'bg-[#1c1c1c] border-2 border-[#454446] border-dashed'}`}>
                            <ShoppingCart size={14} className={t.sold ? 'text-[#10b981]' : 'text-[#b8b6b9]'} />
                          </div>
                        </div>
                        <div className="flex-1 flex gap-4">
                          <div className="flex-1">
                            <h4 className="text-[14px] text-white font-medium mb-2">4. Sales &amp; Customer</h4>
                            {t.sold ? (
                              <div className="text-[13px] text-[#b8b6b9] space-y-1">
                                <p><User size={11} className="inline mr-1 -mt-0.5" />Customer: <span className="text-white">{t.customerName}</span></p>
                                <p>Sales Rep: <span className="text-white">{t.salesRepName ?? '—'}</span></p>
                                <p><Hash size={11} className="inline mr-1 -mt-0.5" />Sales Order: <span className="text-white font-mono">{t.soNumber}</span></p>
                                <p><Calendar size={11} className="inline mr-1 -mt-0.5" />Sold: <span className="text-white">{fmtDate(t.soldAt)}</span></p>
                                <p>Sold Price: <span className="text-white">{t.soldPricePerSf != null ? `$${t.soldPricePerSf.toFixed(2)} / sf` : RESTRICTED}</span></p>
                              </div>
                            ) : (
                              <p className="text-[13px] text-[#b8b6b9] italic">Not yet sold — awaiting opportunity conversion.</p>
                            )}
                          </div>
                          {renderDocs(t.sold && t.soNumber ? [t.soNumber] : [])}
                        </div>
                      </div>

                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
