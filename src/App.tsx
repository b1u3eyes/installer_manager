import { useEffect, useState, useCallback } from 'react';
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, SoftwareItem, Category, HistoryEntry, SystemCommand, CommandHistoryEntry } from './api';
import SystemTools from './SystemTools';

const EMOJIS = ["🌐", "🛠", "🎬", "🎮", "📦", "💬", "📄", "🎵", "📷", "🔧", "⚙", "🎨", "🖥", "📡", "🔒", "☁"];
const COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#84cc16", "#14b8a6", "#e11d48"];
type StatusFilter = 'all' | 'installed' | 'not_installed';
type ViewMode = 'grid' | 'list';
type SortKey = 'name_asc' | 'name_desc' | 'size_asc' | 'size_desc' | 'installed' | 'favorite';

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatTime(unix: string): string {
  const d = new Date(Number(unix) * 1000);
  return d.toLocaleString('ro-RO');
}

function getEmojiForProgram(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('browser') || n.includes('chrome') || n.includes('firefox') || n.includes('opera') || n.includes('edge')) return "🌐";
  if (n.includes('vlc') || n.includes('media') || n.includes('player') || n.includes('music') || n.includes('video')) return "🎬";
  if (n.includes('discord') || n.includes('chat') || n.includes('slack') || n.includes('teams')) return "💬";
  if (n.includes('game') || n.includes('joc')) return "🎮";
  if (n.includes('tool') || n.includes('util') || n.includes('7-zip') || n.includes('winrar')) return "🛠";
  if (n.includes('pdf') || n.includes('office') || n.includes('word') || n.includes('excel')) return "📄";
  return "📦";
}

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }
interface DeleteConfirm { path: string; name: string; }
interface LaunchConfirm { path: string; name: string; }

let toastId = 0;

export default function App() {
  const [software, setSoftware] = useState<SoftwareItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'details' | 'history' | 'stats' | 'output'>('details');
  const [shownUncategorized, setShownUncategorized] = useState<Set<string>>(new Set());
  const [installingPaths, setInstallingPaths] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [softwarePath, setSoftwarePath] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [launchConfirm, setLaunchConfirm] = useState<LaunchConfirm | null>(null);
  const [categoryAssignmentModal, setCategoryAssignmentModal] = useState<{item: SoftwareItem, open: boolean}>({
    item: { path: '', name: '', description: '', file_name: '', file_size: 0, category_id: null, is_installed: false, version: '', publisher: '', icon_base64: '', is_favorite: false },
    open: false
  });
  const [categoryPicker, setCategoryPicker] = useState<{mode: 'create' | 'edit', id?: string, name: string, icon: string, color: string} | null>(null);
  const [hiddenSoftware, setHiddenSoftware] = useState<string[]>([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showSystemTools, setShowSystemTools] = useState(false);
  const [selectedSystemCommand, setSelectedSystemCommand] = useState<SystemCommand | null>(null);
  const [systemCommandHistory, setSystemCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [lastCommandOutput, setLastCommandOutput] = useState<CommandHistoryEntry | null>(null);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    refreshData();
    refreshHistory();
    api.getSoftwarePath().then(setSoftwarePath).catch(() => {});
    api.getHiddenSoftware().then(setHiddenSoftware).catch(() => {});

    const unlistenStatus = listen("install-status", (event: any) => {
      const payload: string = event.payload;
      const sep = payload.indexOf("|");
      if (sep === -1) return;
      const status = payload.substring(0, sep);
      const path = payload.substring(sep + 1);
      if (status === "started") {
        setInstallingPaths(prev => new Set(prev).add(path));
        addToast(`Instalare pornită: ${path.split('\\').pop()}`, 'info');
      } else if (status === "finished") {
        setInstallingPaths(prev => { const next = new Set(prev); next.delete(path); return next; });
        addToast(`Instalare finalizată: ${path.split('\\').pop()}`, 'success');
        refreshData();
        refreshHistory();
      }
    });
    const unlistenChange = listen("software-changed", () => {
      refreshData();
      addToast("Folder Software actualizat", 'info');
    });

    const unlistenDrag = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const exeCount = event.payload.paths.filter((p: string) => p.endsWith('.exe')).length;
        const txtCount = event.payload.paths.filter((p: string) => p.endsWith('.txt')).length;
        if (exeCount > 0 || txtCount > 0) {
          refreshData();
          addToast(`Adăugate: ${exeCount} .exe, ${txtCount} .txt — plasați în folderul Software`, 'success');
        }
      }
    });

    return () => {
      unlistenStatus.then(fn => fn());
      unlistenChange.then(fn => fn());
      unlistenDrag.then(fn => fn());
    };
  }, []);

  async function refreshData(resetShown?: boolean) {
    const [sw, cat] = await Promise.all([api.getSoftware(), api.getCategories()]);
    setSoftware(sw);
    setCategories(cat);
    const shown = resetShown ? new Set<string>() : shownUncategorized;
    if (resetShown) setShownUncategorized(shown);
    const uncategorized = sw.filter(s => !s.category_id && !shown.has(s.path));
    if (uncategorized.length > 0 && activeCategory === null && !categoryAssignmentModal.open) {
      setSelectedSoftware(uncategorized[0]);
      setCategoryAssignmentModal({ item: uncategorized[0], open: true });
    }
  }

  async function refreshHidden() {
    try { setHiddenSoftware(await api.getHiddenSoftware()); } catch {}
  }

  async function refreshHistory() {
    try { setHistory(await api.getHistory()); } catch {}
  }

  async function handleAssign(path: string, categoryId: string) {
    await api.assignCategory(path, categoryId);
    setShownUncategorized(prev => new Set(prev).add(path));
    setCategoryAssignmentModal({ item: { path: '', name: '', description: '', file_name: '', file_size: 0, category_id: null, is_installed: false, version: '', publisher: '', icon_base64: '', is_favorite: false }, open: false });
    await refreshData();
    addToast("Categorie atribuită", 'success');
  }

  async function handleToggleFavorite(path: string) {
    await api.toggleFavorite(path);
    await refreshData();
    const item = software.find(s => s.path === path);
    addToast(item ? (item.is_favorite ? "Eliminat din favorite" : "Adăugat la favorite") : "", 'info');
  }

  async function handleCategorySave(name: string, icon: string, color: string) {
    if (categoryPicker?.mode === 'create') {
      await api.createCategory(name, icon, color);
      addToast("Categorie creată", 'success');
    } else if (categoryPicker?.mode === 'edit' && categoryPicker.id) {
      await api.updateCategory(categoryPicker.id, name, icon, color);
      addToast("Categorie actualizată", 'success');
    }
    await refreshData();
    setCategoryPicker(null);
  }

  async function handleDelete(keepFile: boolean) {
    if (!deleteConfirm) return;
    try {
      await api.deleteSoftware(deleteConfirm.path, keepFile);
      addToast(keepFile ? `Ascuns: ${deleteConfirm.name}` : `Șters: ${deleteConfirm.name}`, 'success');
      await refreshData();
      await refreshHidden();
      setSelectedSoftware(null);
    } catch (e) {
      addToast("Eroare: " + e, 'error');
    }
    setDeleteConfirm(null);
  }

  async function handleUnhide(path: string) {
    try {
      await api.unhideSoftware(path);
      addToast("Program restaurat în listă", 'success');
      await refreshData();
      await refreshHidden();
    } catch (e) {
      addToast("Eroare: " + e, 'error');
    }
  }

  async function handleLaunch(path: string) {
    setLaunchConfirm(null);
    api.launchExe(path);
  }

  async function handleSaveDetails() {
    if (!selectedSoftware) return;
    try {
      await api.updateSoftwareMetadata(selectedSoftware.path, editName, editDescription);
      addToast("Detalii salvate", 'success');
      await refreshData();
      setEditingDetails(false);
    } catch (e) {
      addToast("Eroare: " + e, 'error');
    }
  }

  function startEditing(item: SoftwareItem) {
    setEditName(item.name);
    setEditDescription(item.description);
    setEditingDetails(true);
  }

  const filteredSoftware = software
    .filter(s => {
      if (statusFilter === 'installed' && !s.is_installed) return false;
      if (statusFilter === 'not_installed' && s.is_installed) return false;
      if (activeCategory && s.category_id !== activeCategory) return false;
      if (showFavorites && !s.is_favorite) return false;
      return s.name.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      switch (sortKey) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'size_asc': return a.file_size - b.file_size;
        case 'size_desc': return b.file_size - a.file_size;
        case 'installed': return a.is_installed === b.is_installed ? a.name.localeCompare(b.name) : a.is_installed ? -1 : 1;
        case 'favorite': return a.is_favorite === b.is_favorite ? a.name.localeCompare(b.name) : a.is_favorite ? -1 : 1;
        default: return 0;
      }
    });

  const SORT_LABELS: Record<SortKey, string> = {
    name_asc: 'Nume ▲', name_desc: 'Nume ▼',
    size_asc: 'Mărime ▲', size_desc: 'Mărime ▼',
    installed: 'Instalate prima', favorite: 'Favorite prima'
  };

  return (
    <div className="w-full h-full flex overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #0a0f1c 0%, #0f172a 50%, #0a0f1c 100%)', fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      {/* TOASTS */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="px-4 py-3 rounded-xl text-sm font-medium shadow-2xl animate-slide-in backdrop-blur-lg border"
            style={{
              background: t.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : t.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(96, 165, 250, 0.15)',
              borderColor: t.type === 'success' ? 'rgba(34, 197, 94, 0.4)' : t.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(96, 165, 250, 0.4)',
              color: t.type === 'success' ? '#86efac' : t.type === 'error' ? '#fca5a5' : '#93c5fd'
            }}
          >{t.message}</div>
        ))}
      </div>

      {/* SIDEBAR */}
      <aside className="w-[260px] shrink-0 flex flex-col p-5 backdrop-blur-xl"
        style={{ background: 'rgba(15, 23, 42, 0.85)', borderRight: '1px solid rgba(51, 65, 85, 0.5)' }}>
        <div className="text-[24px] font-extrabold mb-5 tracking-tight" style={{ color: '#39ff14', textShadow: '0 0 20px rgba(57, 255, 20, 0.4)' }}>
          Software Center
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
          <div onClick={() => { setShowSystemTools(false); setActiveCategory(null); setShowFavorites(false); setSelectedSystemCommand(null); }}
            className="px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3 text-sm font-medium backdrop-blur-sm"
            style={{
              background: !activeCategory && !showFavorites && !showSystemTools ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 41, 59, 0.6)',
              border: !activeCategory && !showFavorites && !showSystemTools ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
              boxShadow: !activeCategory && !showFavorites && !showSystemTools ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none'
            }}
          ><span className="text-lg">📋</span> Toate</div>
          <div onClick={() => { setShowSystemTools(false); setShowFavorites(true); setActiveCategory(null); setSelectedSystemCommand(null); }}
            className="px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3 text-sm font-medium backdrop-blur-sm"
            style={{
              background: showFavorites ? 'rgba(234, 179, 8, 0.15)' : 'rgba(30, 41, 59, 0.6)',
              border: showFavorites ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid transparent',
            }}
          >⭐ Favorite</div>
          {categories.map(cat => (
            <div key={cat.id} onClick={() => { setShowSystemTools(false); setActiveCategory(cat.id); setShowFavorites(false); setSelectedSystemCommand(null); }}
              className="px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3 text-sm font-medium backdrop-blur-sm"
              style={{
                background: activeCategory === cat.id && !showFavorites ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                border: activeCategory === cat.id && !showFavorites ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                boxShadow: activeCategory === cat.id && !showFavorites ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none'
              }}
            ><span className="text-lg">{cat.icon}</span> {cat.name}</div>
          ))}
          <div className="border-t my-2" style={{ borderColor: 'rgba(51, 65, 85, 0.4)' }} />
          <div onClick={() => { setShowSystemTools(true); setActiveCategory(null); setShowFavorites(false); setSelectedSoftware(null); setRightPanelTab('details'); }}
            className="px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3 text-sm font-medium backdrop-blur-sm"
            style={{
              background: showSystemTools ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 41, 59, 0.6)',
              border: showSystemTools ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
              boxShadow: showSystemTools ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none'
            }}
          ><span className="text-lg">🖥</span> System Tools</div>
        </div>
        <button onClick={() => setCategoryPicker({ mode: 'create', name: '', icon: '📁', color: '#3b82f6' })}
          className="w-full mt-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all duration-200 text-sm border-none"
          style={{ background: 'rgba(37, 99, 235, 0.2)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
        >+ Adaugă categorie</button>
        <div className="mt-auto pt-5 text-[11px] leading-relaxed" style={{ color: 'rgba(107, 114, 128, 0.8)' }}>
          <div className="flex items-center gap-2 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50"></span> Monitorizare activă</div>
          <div>Folder: Software</div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex flex-col flex-1 min-w-0">
        {/* TITLEBAR */}
        <div className="h-11 flex items-center px-4 text-sm shrink-0 backdrop-blur-sm"
          style={{ background: 'rgba(17, 24, 39, 0.8)', borderBottom: '1px solid rgba(30, 41, 59, 0.5)' }}>
          <span style={{ color: 'rgba(156, 163, 175, 0.8)' }}>Software Installer Suite</span>
          <span className="mx-2 opacity-30">—</span>
          <span className="text-xs" style={{ color: 'rgba(156, 163, 175, 0.5)' }}>Tauri Desktop</span>
        </div>

        {/* TOPBAR */}
        <div className="px-5 py-3 flex gap-3 shrink-0 backdrop-blur-sm items-center flex-wrap"
          style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(30, 41, 59, 0.5)' }}>
          <div className="flex-1 relative min-w-[200px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Caută program..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all border"
              style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }}
              onFocus={e => e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(51, 65, 85, 0.5)'}
            />
          </div>
          {/* Status filter */}
          {(['all', 'installed', 'not_installed'] as StatusFilter[]).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className="px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none whitespace-nowrap"
              style={{
                background: statusFilter === f ? 'rgba(59, 130, 246, 0.25)' : 'rgba(107, 114, 128, 0.15)',
                color: statusFilter === f ? '#93c5fd' : 'rgba(156, 163, 175, 0.7)',
                border: statusFilter === f ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
              }}
            >{f === 'all' ? 'Toate' : f === 'installed' ? '● Instalate' : '○ Neinstalate'}</button>
          ))}
          {/* Sort */}
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border-none outline-none"
            style={{ background: 'rgba(107, 114, 128, 0.15)', color: 'rgba(156, 163, 175, 0.8)' }}
          >{Object.entries(SORT_LABELS).map(([k, l]) => (
            <option key={k} value={k} style={{ background: '#1e293b', color: '#e2e8f0' }}>{l}</option>
          ))}</select>
          {/* Grid/List toggle */}
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none"
            style={{ background: 'rgba(107, 114, 128, 0.15)', color: 'rgba(156, 163, 175, 0.8)' }}
          >{viewMode === 'grid' ? '⊞ Grid' : '☰ Listă'}</button>
          <button onClick={() => setIsSettingsOpen(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 border-none"
            style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.3)' }}
          >⚙️ Setări</button>
          <button onClick={() => refreshData(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 border-none"
            style={{ background: 'rgba(37, 99, 235, 0.2)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
          >🔄 Scanează</button>
        </div>

        {/* WORKSPACE */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* CONTENT */}
          {showSystemTools ? (
            <section className="flex-1 p-5 overflow-y-auto">
              <SystemTools
                selectedCommand={selectedSystemCommand}
                onSelectCommand={setSelectedSystemCommand}
                onExecuteResult={(entry) => setLastCommandOutput(entry)}
                onHistoryChanged={setSystemCommandHistory}
                onShowOutput={() => setRightPanelTab('output')}
              />
            </section>
          ) : (
            <section className="flex-1 p-5 overflow-y-auto">
              {filteredSoftware.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 opacity-50">
                  <span className="text-5xl mb-4">📂</span>
                  <p className="text-lg">Niciun program găsit</p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(156, 163, 175, 0.6)' }}>Adaugă fișiere .exe în folderul Software</p>
                </div>
              )}
              {viewMode === 'grid' ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                  {filteredSoftware.map(item => (
                    <div key={item.path} onClick={() => { setSelectedSoftware(item); setEditingDetails(false); }}
                      className="p-4 rounded-2xl cursor-pointer transition-all duration-200 border backdrop-blur-sm hover:-translate-y-0.5"
                      style={{
                        background: selectedSoftware?.path === item.path ? 'rgba(30, 41, 59, 0.9)' : 'rgba(17, 24, 39, 0.7)',
                        border: selectedSoftware?.path === item.path ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(51, 65, 85, 0.4)',
                        boxShadow: selectedSoftware?.path === item.path ? '0 0 20px rgba(59, 130, 246, 0.1)' : '0 4px 12px rgba(0,0,0,0.2)'
                      }}
                    >
                      <div className="flex gap-3.5 items-center">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 overflow-hidden relative"
                          style={{ background: 'rgba(31, 41, 55, 0.8)' }}>
                          {item.icon_base64 && item.icon_base64.startsWith('data:') ? (
                            <img src={item.icon_base64} alt="" className="w-full h-full object-contain" />
                          ) : <span>{getEmojiForProgram(item.name)}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-[15px] font-bold truncate">{item.name}</div>
                            <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.path); }}
                              className="text-sm cursor-pointer bg-transparent border-none p-0 leading-none transition-transform duration-200 hover:scale-110"
                              style={{ color: item.is_favorite ? '#eab308' : 'rgba(156, 163, 175, 0.7)' }}
                              title={item.is_favorite ? "Elimină din favorite" : "Adaugă la favorite"}
                            >{item.is_favorite ? '★' : '☆'}</button>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>{item.file_name} · {formatSize(item.file_size)}</div>
                          {installingPaths.has(item.path) ? (
                            <span className="text-[10px] font-bold text-blue-400 animate-pulse tracking-wider uppercase mt-1.5 inline-block">⟳ Instalare...</span>
                          ) : item.is_installed ? (
                            <span className="text-[10px] font-bold tracking-wider uppercase mt-1.5 inline-block" style={{ color: '#39ff14', textShadow: '0 0 10px rgba(57, 255, 20, 0.5)' }}>● INSTALAT</span>
                          ) : (
                            <span className="text-[10px] font-bold tracking-wider uppercase mt-1.5 inline-block" style={{ color: '#facc15' }}>○ NEINSTALAT</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 flex-wrap">
                        <button onClick={(e) => { e.stopPropagation(); setLaunchConfirm({ path: item.path, name: item.name }); }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none"
                          style={{
                            background: item.is_installed ? 'rgba(71, 85, 105, 0.5)' : 'rgba(37, 99, 235, 0.25)',
                            color: item.is_installed ? '#9ca3af' : '#93c5fd',
                            border: item.is_installed ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(37, 99, 235, 0.3)'
                          }}
                        >{item.is_installed ? '▶ Deschide' : '⬇ Instalează'}</button>
                        <button onClick={(e) => { e.stopPropagation(); api.openTxt(item.path.replace('.exe', '.txt')); }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none"
                          style={{ background: 'rgba(71, 85, 105, 0.3)', color: 'rgba(156, 163, 175, 0.8)', border: '1px solid rgba(71, 85, 105, 0.2)' }}
                        >📄 Readme</button>
                        <button onClick={(e) => { e.stopPropagation(); api.openFolder(item.path); }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none"
                          style={{ background: 'rgba(71, 85, 105, 0.3)', color: 'rgba(156, 163, 175, 0.8)', border: '1px solid rgba(71, 85, 105, 0.2)' }}
                        >📁 Folder</button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ path: item.path, name: item.name }); }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none"
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                        >🗑 Șterge</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredSoftware.map(item => (
                    <div key={item.path} onClick={() => { setSelectedSoftware(item); setEditingDetails(false); }}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border backdrop-blur-sm"
                      style={{
                        background: selectedSoftware?.path === item.path ? 'rgba(30, 41, 59, 0.9)' : 'rgba(17, 24, 39, 0.7)',
                        border: selectedSoftware?.path === item.path ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(51, 65, 85, 0.4)'
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: 'rgba(31, 41, 55, 0.8)' }}>
                        {item.icon_base64 && item.icon_base64.startsWith('data:') ? (
                          <img src={item.icon_base64} alt="" className="w-full h-full object-contain" />
                        ) : <span>{getEmojiForProgram(item.name)}</span>}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="font-semibold text-sm truncate min-w-[120px]">{item.name}</div>
                        <div className="text-xs shrink-0" style={{ color: 'rgba(156, 163, 175, 0.6)' }}>{item.file_name} · {formatSize(item.file_size)}</div>
                        {installingPaths.has(item.path) ? (
                          <span className="text-[10px] font-bold text-blue-400 animate-pulse tracking-wider uppercase">⟳ Instalare...</span>
                        ) : item.is_installed ? (
                          <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: '#39ff14' }}>● INSTALAT</span>
                        ) : (
                          <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: '#facc15' }}>○ NEINSTALAT</span>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setLaunchConfirm({ path: item.path, name: item.name }); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none"
                          style={{
                            background: item.is_installed ? 'rgba(71, 85, 105, 0.4)' : 'rgba(37, 99, 235, 0.25)',
                            color: item.is_installed ? '#9ca3af' : '#93c5fd'
                          }}
                        >{item.is_installed ? '▶' : '⬇'}</button>
                        <button onClick={(e) => { e.stopPropagation(); api.openFolder(item.path); }}
                          className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none"
                          style={{ background: 'rgba(71, 85, 105, 0.3)', color: 'rgba(156, 163, 175, 0.8)' }}
                        >📁</button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ path: item.path, name: item.name }); }}
                          className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none"
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
                        >🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* RIGHT PANEL (Details / History / Stats/Output) */}
          <aside className="w-[380px] shrink-0 flex flex-col backdrop-blur-xl overflow-y-auto"
            style={{ background: 'rgba(15, 23, 42, 0.85)', borderLeft: '1px solid rgba(51, 65, 85, 0.4)' }}>
            {/* Tab bar */}
            <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
              {(showSystemTools ? (['details', 'history', 'output'] as const) : (['details', 'history', 'stats'] as const)).map(tab => (
                <button key={tab} onClick={() => { setRightPanelTab(tab); if (tab === 'history') { if (showSystemTools) { api.getCommandExecutionHistory().then(setSystemCommandHistory).catch(() => {}); } else { refreshHistory(); } } }}
                  className="flex-1 py-2.5 text-xs font-semibold cursor-pointer border-none transition-all duration-200"
                  style={{
                    background: rightPanelTab === tab ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: rightPanelTab === tab ? '#93c5fd' : 'rgba(156, 163, 175, 0.6)',
                    borderBottom: rightPanelTab === tab ? '2px solid #3b82f6' : '2px solid transparent'
                  }}
                >{tab === 'details' ? '📋 Detalii' : tab === 'history' ? '📋 Istoric' : showSystemTools ? '📟 Output' : '📊 Stats'}</button>
              ))}
            </div>

            {showSystemTools && rightPanelTab === 'output' ? (
              <div className="p-5 flex-1 overflow-y-auto">
                {lastCommandOutput ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-bold" style={{ color: '#39ff14' }}>📟 Output Comandă</h3>
                      <span className={`text-xs font-bold px-3 py-1 rounded-lg ${lastCommandOutput.success ? 'text-green-400' : 'text-red-400'}`}
                        style={{ background: lastCommandOutput.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)' }}
                      >{lastCommandOutput.success ? 'SUCCES' : 'EROARE'}</span>
                    </div>
                    <div className="font-mono text-xs leading-6 overflow-y-auto rounded-xl p-4" style={{ background: 'rgba(2, 6, 23, 0.9)', minHeight: '200px', maxHeight: '400px', color: 'rgba(134, 239, 172, 0.9)' }}>
                      {lastCommandOutput.output.split('\n').map((line, i) => (
                        <div key={i} style={{
                          color: line.toLowerCase().includes('error') || line.toLowerCase().includes('fail') ? '#f87171'
                            : line.toLowerCase().includes('warn') ? '#facc15'
                            : line.toLowerCase().includes('ok') || line.toLowerCase().includes('success') ? '#39ff14'
                            : 'rgba(156, 163, 175, 0.8)'
                        }}>{line}</div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs" style={{ color: 'rgba(156, 163, 175, 0.5)' }}>
                      {formatTime(lastCommandOutput.timestamp)}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-10 text-center" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>
                    <div><span className="text-4xl block mb-3">⚡</span><span className="text-sm">Rulează o comandă pentru a vedea output-ul</span></div>
                  </div>
                )}
              </div>
            ) : showSystemTools && rightPanelTab === 'history' ? (
              <div className="p-5 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold" style={{ color: '#39ff14' }}>📋 Istoric Comenzi</h3>
                  <button onClick={async () => { try { await api.clearCommandExecutionHistory(); setSystemCommandHistory([]); } catch {} }}
                    className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none transition-colors"
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  >Șterge tot</button>
                </div>
                {systemCommandHistory.length === 0 ? (
                  <div className="text-center py-10 opacity-40"><span className="text-3xl block mb-2">📭</span><span className="text-sm">Nicio execuție</span></div>
                ) : (
                  <div className="space-y-2">
                    {[...systemCommandHistory].reverse().map((h, i) => (
                      <div key={i} className="p-3 rounded-xl text-xs"
                        style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm" style={{ color: 'rgba(209, 213, 219, 0.9)' }}>{h.command_name}</span>
                          <span className={`text-[10px] font-bold ${h.success ? 'text-green-400' : 'text-red-400'}`}>{h.success ? '✓' : '✗'}</span>
                        </div>
                        <div style={{ color: 'rgba(156, 163, 175, 0.6)' }}>{formatTime(h.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : showSystemTools && rightPanelTab === 'details' ? (
              selectedSystemCommand ? (
                <div className="p-5 flex-1 overflow-y-auto">
                  <div className="p-[18px] rounded-2xl backdrop-blur-sm border" style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-base" style={{ color: '#39ff14' }}>Detalii Comandă</h3>
                    </div>
                    <div className="text-sm leading-8" style={{ color: 'rgba(209, 213, 219, 0.9)' }}>
                      <div><strong className="text-white font-semibold">Nume:</strong> {selectedSystemCommand.name}</div>
                      <div><strong className="text-white font-semibold">Categorie:</strong> {selectedSystemCommand.category}</div>
                      <div><strong className="text-white font-semibold">Descriere:</strong> <span style={{ color: 'rgba(156, 163, 175, 0.8)', fontSize: '12px' }}>{selectedSystemCommand.description}</span></div>
                      <div>
                        <strong className="text-white font-semibold">Comandă:</strong>
                        <div className="mt-1.5 p-2.5 rounded-xl font-mono text-xs overflow-x-auto" style={{ background: 'rgba(2, 6, 23, 0.8)', color: 'rgba(156, 163, 175, 0.6)' }}>
                          {selectedSystemCommand.command}
                        </div>
                      </div>
                      <div><strong className="text-white font-semibold">Requires Admin:</strong> {selectedSystemCommand.requires_admin ? '✅ Da' : '❌ Nu'}</div>
                      <div><strong className="text-white font-semibold">Danger Level:</strong> <span className="font-bold" style={{ color: selectedSystemCommand.danger_level === 'SAFE' ? '#39ff14' : selectedSystemCommand.danger_level === 'ADMIN' ? '#facc15' : '#f87171' }}>{selectedSystemCommand.danger_level}</span></div>
                      <div><strong className="text-white font-semibold">Favorite:</strong> {selectedSystemCommand.favorite ? '⭐ Da' : '☆ Nu'}</div>
                      {selectedSystemCommand.tags.length > 0 && (
                        <div><strong className="text-white font-semibold">Tags:</strong> <span style={{ color: 'rgba(156, 163, 175, 0.8)', fontSize: '12px' }}>{selectedSystemCommand.tags.join(', ')}</span></div>
                      )}
                      {selectedSystemCommand.last_run && (
                        <div><strong className="text-white font-semibold">Ultima rulare:</strong> {formatTime(selectedSystemCommand.last_run)}</div>
                      )}
                      {selectedSystemCommand.last_status && (
                        <div><strong className="text-white font-semibold">Ultim status:</strong> <span className={selectedSystemCommand.last_status === 'success' ? 'text-green-400' : 'text-red-400'}>{selectedSystemCommand.last_status === 'success' ? 'Succes' : 'Eroare'}</span></div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-10 text-center" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>
                  <div><span className="text-4xl block mb-3">👈</span><span className="text-sm">Selectează o comandă</span></div>
                </div>
              )
            ) : !showSystemTools && rightPanelTab === 'stats' ? (
              <div className="p-5 flex-1 overflow-y-auto">
                {(() => {
                  const total = software.length;
                  const installed = software.filter(s => s.is_installed).length;
                  const notInstalled = total - installed;
                  const instPct = total ? Math.round((installed / total) * 100) : 0;
                  const catStats = categories.map(cat => {
                    const items = software.filter(s => s.category_id === cat.id);
                    const inst = items.filter(s => s.is_installed).length;
                    return { ...cat, total: items.length, installed: inst };
                  });
                  const uncatItems = software.filter(s => !s.category_id);
                  const uncatInst = uncatItems.filter(s => s.is_installed).length;
                  const Bar = ({ pct, color }: { pct: number; color: string }) => (
                    <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(51, 65, 85, 0.4)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  );
                  return (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl" style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold text-white">Total programe</span>
                          <span className="text-2xl font-bold" style={{ color: '#39ff14' }}>{total}</span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <div className="flex justify-between mb-1"><span style={{ color: 'rgba(156, 163, 175, 0.8)' }}>● Instalate</span><span style={{ color: '#39ff14' }}>{installed} ({instPct}%)</span></div>
                            <Bar pct={instPct} color="#39ff14" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-1"><span style={{ color: 'rgba(156, 163, 175, 0.8)' }}>○ Neinstalate</span><span style={{ color: '#facc15' }}>{notInstalled} ({100 - instPct}%)</span></div>
                            <Bar pct={100 - instPct} color="#facc15" />
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl" style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                        <h4 className="text-sm font-semibold text-white mb-3">📁 Pe categorii</h4>
                        <div className="space-y-3">
                          {catStats.map(cs => cs.total > 0 && (
                            <div key={cs.id}>
                              <div className="flex justify-between text-xs mb-1">
                                <span style={{ color: 'rgba(209, 213, 219, 0.9)' }}>{cs.icon} {cs.name}</span>
                                <span style={{ color: 'rgba(156, 163, 175, 0.7)' }}>{cs.installed}/{cs.total}</span>
                              </div>
                              <Bar pct={cs.total ? Math.round((cs.installed / cs.total) * 100) : 0} color={cs.color} />
                            </div>
                          ))}
                          {uncatItems.length > 0 && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span style={{ color: 'rgba(209, 213, 219, 0.9)' }}>📦 Fără categorie</span>
                                <span style={{ color: 'rgba(156, 163, 175, 0.7)' }}>{uncatInst}/{uncatItems.length}</span>
                              </div>
                              <Bar pct={uncatItems.length ? Math.round((uncatInst / uncatItems.length) * 100) : 0} color="#8b5cf6" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : !showSystemTools && rightPanelTab === 'history' ? (
              <div className="p-5 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold" style={{ color: '#39ff14' }}>📋 Istoric Instalări</h3>
                  <button onClick={async () => { await api.clearHistory(); refreshHistory(); addToast("Istoric șters", 'info'); }}
                    className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none transition-colors"
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  >Șterge tot</button>
                </div>
                {history.length === 0 ? (
                  <div className="text-center py-10 opacity-40"><span className="text-3xl block mb-2">📭</span><span className="text-sm">Nicio înregistrare</span></div>
                ) : (
                  <div className="space-y-2">
                    {[...history].reverse().map((h, i) => (
                      <div key={i} className="p-3 rounded-xl text-xs"
                        style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                        <div className="font-medium text-sm mb-0.5">{h.program_name}</div>
                        <div style={{ color: 'rgba(156, 163, 175, 0.6)' }}>
                          {formatTime(h.timestamp)} — {h.action === 'launched' ? 'Lansat' : h.action}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : selectedSoftware ? (
              <div className="p-5 flex-1 overflow-y-auto">
                <div className="p-[18px] rounded-2xl backdrop-blur-sm border" style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base" style={{ color: '#39ff14' }}>Detalii Program</h3>
                    {!editingDetails ? (
                      <button onClick={() => startEditing(selectedSoftware)}
                        className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none transition-colors"
                        style={{ background: 'rgba(107, 114, 128, 0.2)', color: 'rgba(156, 163, 175, 0.7)' }}
                      >✎ Editează</button>
                    ) : null}
                  </div>
                  {editingDetails ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Nume</label>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="w-full p-2 rounded-xl text-sm outline-none border"
                          style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Descriere</label>
                        <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4}
                          className="w-full p-2 rounded-xl text-sm outline-none border resize-none"
                          style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingDetails(false)}
                          className="flex-1 py-2 rounded-xl text-sm cursor-pointer border-none transition-colors"
                          style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}
                        >Anulează</button>
                        <button onClick={handleSaveDetails}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                          style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
                        >Salvează</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm leading-8" style={{ color: 'rgba(209, 213, 219, 0.9)' }}>
                      <div><strong className="text-white font-semibold">Nume:</strong> {selectedSoftware.name}</div>
                      <div><strong className="text-white font-semibold">Versiune:</strong> {selectedSoftware.version}</div>
                      <div><strong className="text-white font-semibold">Publisher:</strong> {selectedSoftware.publisher}</div>
                      <div><strong className="text-white font-semibold">Categorie:</strong> {categories.find(c => c.id === selectedSoftware.category_id)?.name || "Nespecificat"}</div>
                      <div><strong className="text-white font-semibold">Status:</strong> {selectedSoftware.is_installed ? "Detectat în sistem" : "Nu este instalat"}</div>
                      <div className="break-all"><strong className="text-white font-semibold">Locație:</strong> <span style={{ color: 'rgba(156, 163, 175, 0.6)', fontSize: '12px' }}>{selectedSoftware.path}</span></div>
                      <div><strong className="text-white font-semibold">Descriere:</strong> <span style={{ color: 'rgba(156, 163, 175, 0.8)', fontSize: '12px' }}>{selectedSoftware.description}</span></div>
                      <div><strong className="text-white font-semibold">Favorite:</strong> {selectedSoftware.is_favorite ? '⭐ Da' : '☆ Nu'}</div>
                    </div>
                  )}
                </div>
                <div className="mt-4 p-3 rounded-xl font-mono text-xs leading-6 overflow-y-auto border" style={{ background: 'rgba(2, 6, 23, 0.8)', border: '1px solid rgba(51, 65, 85, 0.3)', color: 'rgba(134, 239, 172, 0.9)', minHeight: '120px' }}>
                  <div className="mb-1.5 opacity-50 uppercase text-[10px] font-bold tracking-wider">Consolă Evenimente</div>
                  <div>[SCAN] {selectedSoftware.file_name} detectat</div>
                  <div>[INFO] Icon extras automat</div>
                  <div>[CHECK] Instalare: {selectedSoftware.is_installed ? 'CONFIRMATĂ ✓' : 'ABSENTĂ ✗'}</div>
                  <div>[READY] Disponibil pentru lansare</div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-10 text-center" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>
                <div><span className="text-4xl block mb-3">👈</span><span className="text-sm">Selectează un program</span></div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* LAUNCH CONFIRM MODAL */}
      {launchConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-sm mx-4 border backdrop-blur-xl" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#93c5fd' }}>🚀 Lansare program</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>
              Ești sigur că vrei să lansezi <strong className="text-white">{launchConfirm.name}</strong>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setLaunchConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-medium cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}
              >Anulează</button>
              <button onClick={() => handleLaunch(launchConfirm.path)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
              >✅ Lansează</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-sm mx-4 border backdrop-blur-xl" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#fca5a5' }}>🗑 Șterge program</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>
              <strong className="text-white">{deleteConfirm.name}</strong>
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleDelete(true)}
                className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#d1d5db', border: '1px solid rgba(107, 114, 128, 0.3)' }}
              >Doar din listă (fișierele rămân)</button>
              <button onClick={() => handleDelete(false)}
                className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}
              >Șterge complet (.exe + .txt)</button>
              <button onClick={() => setDeleteConfirm(null)}
                className="w-full py-2 text-sm font-medium cursor-pointer transition-colors bg-transparent border-none mt-1"
                style={{ color: 'rgba(107, 114, 128, 0.6)' }}
              >Anulează</button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNMENT MODAL */}
      {categoryAssignmentModal.open && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-md mx-4 border backdrop-blur-xl" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#39ff14' }}>Atribuire Categorie</h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>
              Programul <strong className="text-white">{categoryAssignmentModal.item.name}</strong> nu are o categorie. Selectați una:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => handleAssign(categoryAssignmentModal.item.path, cat.id)}
                  className="p-3 rounded-xl text-left transition-all duration-200 cursor-pointer border-l-4 border-none text-sm"
                  style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    borderLeftColor: cat.color,
                    color: 'rgba(209, 213, 219, 0.9)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(51, 65, 85, 0.8)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.7)'}
                >{cat.icon} {cat.name}</button>
              ))}
            </div>
            <button onClick={() => setCategoryAssignmentModal({ ...categoryAssignmentModal, open: false })}
              className="w-full mt-5 py-2 text-sm font-medium cursor-pointer transition-colors bg-transparent border-none"
              style={{ color: 'rgba(107, 114, 128, 0.6)' }}
            >Anulează</button>
          </div>
        </div>
      )}

      {/* CATEGORY PICKER MODAL */}
      {categoryPicker && (
        <div className="fixed inset-0 flex items-center justify-center z-[101] backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-md mx-4 border backdrop-blur-xl" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: categoryPicker.color }}>{categoryPicker.mode === 'create' ? '➕ Categorie Nouă' : '✎ Editare Categorie'}</h3>
            <input value={categoryPicker.name} onChange={(e) => setCategoryPicker({ ...categoryPicker, name: e.target.value })}
              placeholder="Nume categorie..."
              className="w-full p-2.5 rounded-xl text-sm outline-none border mb-4"
              style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }}
            />
            <label className="text-xs block mb-2" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Alege iconiță:</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => setCategoryPicker({ ...categoryPicker, icon: emoji })}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg cursor-pointer transition-all duration-200 border"
                  style={{
                    background: categoryPicker.icon === emoji ? 'rgba(59, 130, 246, 0.3)' : 'rgba(30, 41, 59, 0.6)',
                    border: categoryPicker.icon === emoji ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(51, 65, 85, 0.3)'
                  }}
                >{emoji}</button>
              ))}
            </div>
            <label className="text-xs block mb-2" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Alege culoare:</label>
            <div className="flex flex-wrap gap-2 mb-5">
              {COLORS.map(c => (
                <button key={c} onClick={() => setCategoryPicker({ ...categoryPicker, color: c })}
                  className="w-8 h-8 rounded-full cursor-pointer transition-all duration-200 border"
                  style={{
                    background: c,
                    border: categoryPicker.color === c ? '3px solid white' : '2px solid transparent',
                    transform: categoryPicker.color === c ? 'scale(1.2)' : 'scale(1)'
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCategoryPicker(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}
              >Anulează</button>
              <button onClick={() => categoryPicker.name.trim() && handleCategorySave(categoryPicker.name.trim(), categoryPicker.icon, categoryPicker.color)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
              >{categoryPicker.mode === 'create' ? 'Creează' : 'Salvează'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-md mx-4 border backdrop-blur-xl max-h-[80vh] overflow-y-auto" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold" style={{ color: '#39ff14' }}>⚙️ Setări</h3>
              <button onClick={() => setIsSettingsOpen(false)}
                className="text-lg cursor-pointer bg-transparent border-none transition-colors"
                style={{ color: 'rgba(107, 114, 128, 0.6)' }}>✕</button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Calea folderului Software</label>
                <div className="flex gap-2">
                  <input className="flex-1 p-2.5 rounded-xl text-sm outline-none border transition-all"
                    style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }}
                    value={softwarePath} onChange={(e) => setSoftwarePath(e.target.value)} />
                  <button onClick={async () => { await api.updateSoftwarePath(softwarePath); refreshData(); addToast("Cale salvată", 'success'); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-colors"
                    style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
                  >Salvează</button>
                </div>
              </div>
              <div className="pt-4 border-t" style={{ borderColor: 'rgba(31, 41, 55, 0.8)' }}>
                <h4 className="text-sm mb-3" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>Categorii</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: 'rgba(30, 41, 59, 0.5)' }}>
                      <span className="text-sm">{cat.icon} {cat.name}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => setCategoryPicker({ mode: 'edit', id: cat.id, name: cat.name, icon: cat.icon, color: cat.color })}
                          className="p-1.5 rounded-lg text-xs cursor-pointer bg-transparent border-none transition-colors"
                          style={{ color: 'rgba(156, 163, 175, 0.6)' }}>✎</button>
                        <button onClick={async () => { await api.deleteCategory(cat.id); refreshData(); addToast("Categorie ștearsă", 'info'); }}
                          className="p-1.5 rounded-lg text-xs cursor-pointer bg-transparent border-none transition-colors"
                          style={{ color: 'rgba(156, 163, 175, 0.6)' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t" style={{ borderColor: 'rgba(31, 41, 55, 0.8)' }}>
                <h4 className="text-sm mb-3" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>Programe ascunse</h4>
                {hiddenSoftware.length === 0 ? (
                  <p className="text-xs" style={{ color: 'rgba(107, 114, 128, 0.6)' }}>Niciun program ascuns</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {hiddenSoftware.map(path => {
                      const name = path.split('\\').pop() || path;
                      return (
                        <div key={path} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: 'rgba(30, 41, 59, 0.5)' }}>
                          <span className="text-xs truncate flex-1" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>{name}</span>
                          <button onClick={() => handleUnhide(path)}
                            className="ml-2 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border-none transition-colors shrink-0"
                            style={{ background: 'rgba(37, 99, 235, 0.2)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
                          >Restabilește</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="pt-4 border-t" style={{ borderColor: 'rgba(31, 41, 55, 0.8)' }}>
                <h4 className="text-sm mb-3" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>Export & Backup</h4>
                <div className="flex flex-col gap-2">
                  <button onClick={async () => {
                      const path = prompt("Cale salvare CSV (ex: C:\\software.csv):");
                      if (path) { try { await api.exportCsv(path); addToast("CSV exportat", 'success'); } catch (e) { addToast("Eroare: " + e, 'error'); } }
                    }}
                    className="w-full py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-colors"
                    style={{ background: 'rgba(107, 114, 128, 0.15)', color: 'rgba(156, 163, 175, 0.8)' }}
                  >📥 Export CSV</button>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                        const path = prompt("Cale salvare backup (ex: C:\\backup.json):");
                        if (path) { try { await api.exportConfig(path); addToast("Backup creat", 'success'); } catch (e) { addToast("Eroare: " + e, 'error'); } }
                      }}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-colors"
                      style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.25)' }}
                    >📤 Export Config</button>
                    <button onClick={async () => {
                        const path = prompt("Cale fișier backup (ex: C:\\backup.json):");
                        if (path) { try { await api.importConfig(path); refreshData(); addToast("Configurare restaurată", 'success'); } catch (e) { addToast("Eroare: " + e, 'error'); } }
                      }}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer border-none transition-colors"
                      style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.25)' }}
                    >📥 Import Config</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.5); border-radius: 10px; }
        * { scrollbar-width: thin; scrollbar-color: rgba(51, 65, 85, 0.5) transparent; }
      `}</style>
    </div>
  );
}
