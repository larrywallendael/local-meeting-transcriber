import React from 'react';
import { ChevronDown, ChevronRight, Folder, Search, Settings, Home, Send, Trash2, RotateCcw, FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useJobs } from '../../contexts/JobContext';
import { createPortal } from 'react-dom';
import { AppView } from './AppShell';

interface SidebarProps {
  view: AppView;
  selectedFolder: string | null;
  onNavigate: (view: AppView, payload?: { folder?: string; jobId?: string }) => void;
  isOpen: boolean;
  onToggle: () => void;
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
  onContactOpen: () => void;
}

const FOLDERS = ['ADP', 'ETL'];

export function Sidebar({ view, selectedFolder, onNavigate, isOpen, onToggle, onSearchOpen, onSettingsOpen, onContactOpen }: SidebarProps) {
  const [foldersOpen, setFoldersOpen] = React.useState(true);
  const [isTrashOpen, setIsTrashOpen] = React.useState(false);
  const [trashPosition, setTrashPosition] = React.useState<{ bottom: number; left: number } | null>(null);
  const trashButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const trashPanelRef = React.useRef<HTMLDivElement | null>(null);
  const { history, trashedJobs, restoreFromTrash, deletePermanently } = useJobs();

  const trashedItems = history
    .filter((job) => trashedJobs[job.id])
    .sort((a, b) => (trashedJobs[b.id]?.trashedAt ?? 0) - (trashedJobs[a.id]?.trashedAt ?? 0));

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null || seconds < 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateTrashPosition = React.useCallback(() => {
    if (!trashButtonRef.current) {
      return;
    }
    const rect = trashButtonRef.current.getBoundingClientRect();
    const screenQuarter = Math.round(window.innerHeight * 0.3);
    const bottomOffset = window.innerHeight - rect.top;
    setTrashPosition({
      bottom: Math.max(12, bottomOffset),
      left: rect.right + 16,
    });
  }, []);

  React.useEffect(() => {
    if (!isTrashOpen) {
      return;
    }
    updateTrashPosition();
    window.addEventListener('resize', updateTrashPosition);
    return () => window.removeEventListener('resize', updateTrashPosition);
  }, [isTrashOpen, updateTrashPosition]);

  return (
    <aside className="flex h-full flex-col border-r border-border/70 px-3 py-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          className="tooltip flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          data-tooltip={isOpen ? 'Close sidebar  Ctrl+S' : 'Open sidebar  Ctrl+S'}
          onClick={onToggle}
          type="button"
        >
          {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      {isOpen && (
        <button
          className="mb-5 flex w-full items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-muted"
          onClick={onSearchOpen}
          type="button"
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
          <span className="ml-auto text-[12px]">Ctrl+K</span>
        </button>
      )}

      <nav className="flex-1 space-y-6">
        <button
          className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-[15px] ${
            view === 'home' ? 'bg-muted text-foreground' : 'text-muted-foreground'
          }`}
          onClick={() => onNavigate('home')}
          type="button"
        >
          <Home className="h-4 w-4" />
          {isOpen && <span>My transcripts</span>}
        </button>

        {isOpen && (
          <div>
          <button
            className="flex w-full items-center gap-2 px-2 py-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
            onClick={() => setFoldersOpen((prev) => !prev)}
            type="button"
          >
            {foldersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span>Folders</span>
          </button>
          {foldersOpen && (
            <div className="mt-2 space-y-1">
              {FOLDERS.map((folder) => {
                const isActive = view === 'folder' && selectedFolder === folder;
                return (
                  <button
                    key={folder}
                    className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-[15px] ${
                      isActive ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    }`}
                    onClick={() => onNavigate('folder', { folder })}
                    type="button"
                  >
                    <Folder className="h-4 w-4" />
                    <span>{folder}</span>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        )}
      </nav>

      <div className="mt-6 space-y-4 text-muted-foreground">
        <div className="relative">
          <button
            className="tooltip flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            onClick={() => setIsTrashOpen((prev) => !prev)}
            type="button"
            data-tooltip="Trash"
            ref={trashButtonRef}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {isTrashOpen && trashPosition && createPortal(
            <>
              <div
                className="fixed inset-0 z-[2147483646]"
                onClick={() => setIsTrashOpen(false)}
              />
              <div
                ref={trashPanelRef}
                className="fixed w-[360px] rounded-lg border border-border/70 bg-card p-4 text-foreground shadow-lg z-[2147483647]"
                style={{ bottom: trashPosition.bottom, left: trashPosition.left }}
              >
              <div className="flex items-center justify-between pb-3 text-[16px] font-medium">
                <span>Trash</span>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setIsTrashOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden space-y-2 pr-1">
                {trashedItems.length === 0 && (
                  <p className="text-[13px] text-muted-foreground">No items in trash.</p>
                )}
                {trashedItems.map((job) => {
                  const fileName = job.originalAudioPath.split(/[/\\]/).pop() || 'Unknown file';
                  const duration = formatDuration(job.audioDurationSeconds);
                  return (
                    <button
                      key={job.id}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-3 py-2 text-left hover:bg-muted"
                      onClick={(event) => {
                        event.stopPropagation();
                        onNavigate('transcript', { jobId: job.id });
                        setIsTrashOpen(false);
                      }}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-[14px] text-foreground">{fileName}</p>
                          {duration && <p className="text-[13px] text-muted-foreground">{duration}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <button
                          className="tooltip hover:text-foreground"
                          onClick={() => restoreFromTrash(job.id)}
                          type="button"
                          data-tooltip="Restore"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          className="tooltip hover:text-foreground"
                          onClick={() => deletePermanently(job.id)}
                          type="button"
                          data-tooltip="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-border/60 pt-3 text-[13px] text-muted-foreground">
                Notes in Trash for over 30 days will be automatically deleted.
              </div>
              </div>
            </>,
            document.body
          )}
        </div>
        {isOpen && (
          <div className="text-[13px] text-muted-foreground">
            <p className="leading-4">Have ideas to improve the product?</p>
            <button
              className="mt-2 flex items-center gap-2 text-[15px] text-foreground hover:text-foreground/80"
              onClick={onContactOpen}
              type="button"
            >
              <span>Contact us!</span>
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
        {isOpen && (
          <div className="border-t border-border/50 pt-2">
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[15px] text-muted-foreground hover:bg-muted"
              onClick={onSettingsOpen}
              type="button"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
