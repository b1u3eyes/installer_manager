import { useEffect, useState, useCallback } from 'react';
import { api, SystemCommand, CommandHistoryEntry } from './api';

type ViewMode = 'grid' | 'list';
type CommandFilter = 'all' | 'favorite' | 'admin';
type SortKey = 'alpha' | 'last_run' | 'category' | 'favorite_first';

const DANGER_COLORS: Record<string, string> = {
  SAFE: '#39ff14',
  ADMIN: '#facc15',
  DANGEROUS: '#f87171',
};

const DANGER_BG: Record<string, string> = {
  SAFE: 'rgba(57, 255, 20, 0.12)',
  ADMIN: 'rgba(250, 204, 21, 0.12)',
  DANGEROUS: 'rgba(248, 113, 113, 0.12)',
};

interface SystemToolsProps {
  selectedCommand: SystemCommand | null;
  onSelectCommand: (cmd: SystemCommand | null) => void;
  onExecuteResult: (entry: CommandHistoryEntry) => void;
  onHistoryChanged: (history: CommandHistoryEntry[]) => void;
  onShowOutput: () => void;
}

export default function SystemTools({ selectedCommand, onSelectCommand, onExecuteResult, onHistoryChanged, onShowOutput }: SystemToolsProps) {
  const [commands, setCommands] = useState<SystemCommand[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<CommandFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('favorite_first');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<SystemCommand | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SystemCommand | null>(null);
  const [executeConfirm, setExecuteConfirm] = useState<SystemCommand | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Form state for add/edit modal
  const emptyForm = { name: '', description: '', command: '', category: '', tags: '', requires_admin: false, danger_level: 'SAFE' };
  const [form, setForm] = useState(emptyForm);

  const loadCommands = useCallback(async () => {
    try {
      const cmds = await api.getSystemCommands();
      setCommands(cmds);
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const hist = await api.getCommandExecutionHistory();
      onHistoryChanged(hist);
    } catch {}
  }, [onHistoryChanged]);

  useEffect(() => {
    loadCommands();
    loadHistory();
  }, [loadCommands, loadHistory]);

  const filteredCommands = commands
    .filter(c => {
      if (filter === 'favorite' && !c.favorite) return false;
      if (filter === 'admin' && !c.requires_admin) return false;
      const q = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortKey === 'favorite_first') {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      if (sortKey === 'alpha') return a.name.localeCompare(b.name);
      if (sortKey === 'last_run') {
        if (!a.last_run && !b.last_run) return 0;
        if (!a.last_run) return 1;
        if (!b.last_run) return -1;
        return b.last_run.localeCompare(a.last_run);
      }
      if (sortKey === 'category') return a.category.localeCompare(b.category);
      return 0;
    });

  async function handleToggleFavorite(id: string) {
    try {
      const fav = await api.toggleCommandFavorite(id);
      setCommands(prev => prev.map(c => c.id === id ? { ...c, favorite: fav } : c));
    } catch {}
  }

  function openAddModal() {
    setForm(emptyForm);
    setAddModal(true);
  }

  function openEditModal(cmd: SystemCommand) {
    setForm({
      name: cmd.name,
      description: cmd.description,
      command: cmd.command,
      category: cmd.category,
      tags: cmd.tags.join(', '),
      requires_admin: cmd.requires_admin,
      danger_level: cmd.danger_level,
    });
    setEditModal(cmd);
  }

  async function handleSave(cmd?: SystemCommand) {
    if (!form.name.trim() || !form.command.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      if (cmd) {
        await api.updateSystemCommand(cmd.id, form.name.trim(), form.description.trim(), form.command.trim(), form.category.trim(), tags, form.requires_admin, form.danger_level);
      } else {
        await api.createSystemCommand(form.name.trim(), form.description.trim(), form.command.trim(), form.category.trim(), tags, form.requires_admin, form.danger_level);
      }
      setAddModal(false);
      setEditModal(null);
      await loadCommands();
    } catch {}
  }

  async function handleDelete(cmd: SystemCommand) {
    try {
      await api.deleteSystemCommand(cmd.id);
      if (selectedCommand?.id === cmd.id) onSelectCommand(null);
      setDeleteConfirm(null);
      await loadCommands();
    } catch {}
  }

  async function handleExecute(cmd: SystemCommand) {
    setIsExecuting(true);
    setExecuteConfirm(null);
    try {
      const entry = await api.executeSystemCommand(cmd.id);
      onExecuteResult(entry);
      onShowOutput();
      await loadCommands();
      await loadHistory();
    } catch {}
    setIsExecuting(false);
  }

  function getDangerLabel(level: string): string {
    if (level === 'SAFE') return 'SAFE';
    if (level === 'ADMIN') return 'ADMIN';
    return 'DANGEROUS';
  }

  const buttonBase = 'px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none';

  return (
    <>
      {/* Filter/Search bar */}
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Caută comandă..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all border"
            style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }}
            onFocus={e => e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(51, 65, 85, 0.5)'}
          />
        </div>
        {(['all', 'favorite', 'admin'] as CommandFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={buttonBase}
            style={{
              background: filter === f ? 'rgba(59, 130, 246, 0.25)' : 'rgba(107, 114, 128, 0.15)',
              color: filter === f ? '#93c5fd' : 'rgba(156, 163, 175, 0.7)',
              border: filter === f ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent'
            }}
          >{f === 'all' ? 'Toate' : f === 'favorite' ? '⭐ Favorite' : '⚙ Necesită Admin'}</button>
        ))}
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border-none outline-none"
          style={{ background: 'rgba(107, 114, 128, 0.15)', color: 'rgba(156, 163, 175, 0.8)' }}
        >
          <option value="favorite_first" style={{ background: '#1e293b', color: '#e2e8f0' }}>Favorite First</option>
          <option value="alpha" style={{ background: '#1e293b', color: '#e2e8f0' }}>Alfabetic</option>
          <option value="last_run" style={{ background: '#1e293b', color: '#e2e8f0' }}>Ultima rulare</option>
          <option value="category" style={{ background: '#1e293b', color: '#e2e8f0' }}>Categorie</option>
        </select>
        <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          className="px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none"
          style={{ background: 'rgba(107, 114, 128, 0.15)', color: 'rgba(156, 163, 175, 0.8)' }}
        >{viewMode === 'grid' ? '⊞ Grid' : '☰ Listă'}</button>
        <button onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 border-none"
          style={{ background: 'rgba(37, 99, 235, 0.2)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
        >+ Adaugă comandă</button>
      </div>

      {filteredCommands.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 opacity-50">
          <span className="text-5xl mb-4">⚡</span>
          <p className="text-lg">Nicio comandă găsită</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(156, 163, 175, 0.6)' }}>Adaugă o comandă Windows din butonul de mai sus</p>
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {filteredCommands.map(cmd => (
            <div key={cmd.id} onClick={() => onSelectCommand(cmd)}
              className="p-4 rounded-2xl cursor-pointer transition-all duration-200 border backdrop-blur-sm hover:-translate-y-0.5"
              style={{
                background: selectedCommand?.id === cmd.id ? 'rgba(30, 41, 59, 0.9)' : 'rgba(17, 24, 39, 0.7)',
                border: selectedCommand?.id === cmd.id ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(51, 65, 85, 0.4)',
                boxShadow: selectedCommand?.id === cmd.id ? '0 0 20px rgba(59, 130, 246, 0.1)' : '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              <div className="flex gap-3.5 items-center mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: 'rgba(31, 41, 55, 0.8)' }}
                >⚡</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-[15px] font-bold truncate">{cmd.name}</div>
                    <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(cmd.id); }}
                      className="text-sm cursor-pointer bg-transparent border-none p-0 leading-none transition-transform duration-200 hover:scale-110"
                      style={{ color: cmd.favorite ? '#eab308' : 'rgba(156, 163, 175, 0.7)' }}
                    >{cmd.favorite ? '★' : '☆'}</button>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>{cmd.category}</div>
                </div>
              </div>
              <p className="text-sm leading-5 min-h-[40px]" style={{ color: 'rgba(209, 213, 219, 0.8)' }}>{cmd.description}</p>
              <div className="mt-3 rounded-lg px-3 py-2 text-xs font-mono truncate" style={{ background: 'rgba(2, 6, 23, 0.6)', color: 'rgba(156, 163, 175, 0.6)' }}>
                {cmd.command}
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: DANGER_BG[cmd.danger_level], color: DANGER_COLORS[cmd.danger_level] }}>
                  {getDangerLabel(cmd.danger_level)}
                </span>
                {cmd.requires_admin && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(248, 113, 113, 0.12)', color: '#f87171' }}>
                    ADMIN
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={(e) => { e.stopPropagation(); setExecuteConfirm(cmd); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 border-none"
                  style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
                >Execută</button>
                <button onClick={(e) => { e.stopPropagation(); openEditModal(cmd); }}
                  className={buttonBase}
                  style={{ background: 'rgba(107, 114, 128, 0.2)', color: 'rgba(156, 163, 175, 0.8)' }}
                >Editare</button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cmd); }}
                  className={buttonBase}
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                >🗑 Șterge</button>
                <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(cmd.id); }}
                  className="px-3 py-2 rounded-xl text-xs cursor-pointer transition-all duration-200 border-none"
                  style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}
                >{cmd.favorite ? '★' : '☆'}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredCommands.map(cmd => (
            <div key={cmd.id} onClick={() => onSelectCommand(cmd)}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border backdrop-blur-sm"
              style={{
                background: selectedCommand?.id === cmd.id ? 'rgba(30, 41, 59, 0.9)' : 'rgba(17, 24, 39, 0.7)',
                border: selectedCommand?.id === cmd.id ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(51, 65, 85, 0.4)'
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: 'rgba(31, 41, 55, 0.8)' }}>⚡</div>
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <div className="font-semibold text-sm truncate min-w-[120px]">{cmd.name}</div>
                <div className="text-xs shrink-0" style={{ color: 'rgba(156, 163, 175, 0.6)' }}>{cmd.category}</div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setExecuteConfirm(cmd); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border-none"
                  style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd' }}
                >Execută</button>
                <button onClick={(e) => { e.stopPropagation(); openEditModal(cmd); }}
                  className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none"
                  style={{ background: 'rgba(107, 114, 128, 0.2)', color: 'rgba(156, 163, 175, 0.8)' }}
                >✎</button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cmd); }}
                  className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none"
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
                >🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD MODAL */}
      {addModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-lg mx-4 border backdrop-blur-xl" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: '#93c5fd' }}>➕ Adaugă Comandă</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Nume comandă</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Flush DNS"
                  className="w-full p-2.5 rounded-xl text-sm outline-none border"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Descriere</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  placeholder="Curăță cache-ul DNS Windows."
                  className="w-full p-2.5 rounded-xl text-sm outline-none border resize-none"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Comandă Windows</label>
                <input value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })}
                  placeholder="ipconfig /flushdns"
                  className="w-full p-2.5 rounded-xl text-sm font-mono outline-none border"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Categorie</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Network"
                    className="w-full p-2.5 rounded-xl text-sm outline-none border"
                    style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Tags (virgulă)</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="dns, network, internet"
                    className="w-full p-2.5 rounded-xl text-sm outline-none border"
                    style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.requires_admin} onChange={(e) => setForm({ ...form, requires_admin: e.target.checked })}
                    className="w-4 h-4 rounded accent-blue-500 cursor-pointer" />
                  <span className="text-xs" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Necesită Admin</span>
                </label>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>
                  Danger Level:
                  <select value={form.danger_level} onChange={(e) => setForm({ ...form, danger_level: e.target.value })}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none border-none cursor-pointer"
                    style={{ background: 'rgba(30, 41, 59, 0.6)', color: 'white' }}
                  >
                    <option value="SAFE" style={{ background: '#1e293b' }}>SAFE</option>
                    <option value="ADMIN" style={{ background: '#1e293b' }}>ADMIN</option>
                    <option value="DANGEROUS" style={{ background: '#1e293b' }}>DANGEROUS</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setAddModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}
              >Anulează</button>
              <button onClick={() => handleSave()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
              >Salvează</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-lg mx-4 border backdrop-blur-xl" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: '#93c5fd' }}>✎ Editare Comandă</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Nume comandă</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl text-sm outline-none border"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Descriere</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full p-2.5 rounded-xl text-sm outline-none border resize-none"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Comandă Windows</label>
                <input value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })}
                  className="w-full p-2.5 rounded-xl text-sm font-mono outline-none border"
                  style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Categorie</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl text-sm outline-none border"
                    style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
                </div>
                <div className="flex-1">
                  <label className="text-xs block mb-1" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Tags (virgulă)</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="w-full p-2.5 rounded-xl text-sm outline-none border"
                    style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(51, 65, 85, 0.5)', color: 'white' }} />
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.requires_admin} onChange={(e) => setForm({ ...form, requires_admin: e.target.checked })}
                    className="w-4 h-4 rounded accent-blue-500 cursor-pointer" />
                  <span className="text-xs" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>Necesită Admin</span>
                </label>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'rgba(156, 163, 175, 0.7)' }}>
                  Danger Level:
                  <select value={form.danger_level} onChange={(e) => setForm({ ...form, danger_level: e.target.value })}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none border-none cursor-pointer"
                    style={{ background: 'rgba(30, 41, 59, 0.6)', color: 'white' }}
                  >
                    <option value="SAFE" style={{ background: '#1e293b' }}>SAFE</option>
                    <option value="ADMIN" style={{ background: '#1e293b' }}>ADMIN</option>
                    <option value="DANGEROUS" style={{ background: '#1e293b' }}>DANGEROUS</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}
              >Anulează</button>
              <button onClick={() => handleSave(editModal)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
              >Salvează</button>
            </div>
          </div>
        </div>
      )}

      {/* EXECUTE CONFIRM MODAL */}
      {executeConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-sm mx-4 border backdrop-blur-xl" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#facc15' }}>⚡ Confirmare execuție</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>
              Ești sigur că dorești să rulezi <strong className="text-white">{executeConfirm.name}</strong>?
            </p>
            <div className="rounded-xl p-3 font-mono text-xs mb-4" style={{ background: 'rgba(2, 6, 23, 0.8)', color: 'rgba(156, 163, 175, 0.6)' }}>
              {executeConfirm.command}
            </div>
            {executeConfirm.requires_admin && (
              <div className="text-xs mb-4" style={{ color: '#f87171' }}>⚠ Această comandă necesită privilegii administrative.</div>
            )}
            {executeConfirm.danger_level === 'DANGEROUS' && (
              <div className="text-xs mb-4" style={{ color: '#f87171' }}>⚠ Atenție! Această comandă poate cauza pierderi de date.</div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setExecuteConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-medium cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}
              >Anulează</button>
              <button onClick={() => handleExecute(executeConfirm)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(37, 99, 235, 0.25)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)' }}
              >✅ Rulează</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-6 rounded-2xl w-full max-w-sm mx-4 border backdrop-blur-xl" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
            <h3 className="text-xl font-bold mb-2" style={{ color: '#fca5a5' }}>🗑 Șterge comanda</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>
              Ești sigur că vrei să ștergi <strong className="text-white">{deleteConfirm.name}</strong>?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-medium cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}
              >Anulează</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer border-none transition-colors"
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}
              >Șterge</button>
            </div>
          </div>
        </div>
      )}

      {/* Executing overlay */}
      {isExecuting && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm" style={{ color: 'rgba(156, 163, 175, 0.8)' }}>Se execută comanda...</span>
          </div>
        </div>
      )}
    </>
  );
}
