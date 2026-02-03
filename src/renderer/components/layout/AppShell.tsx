import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SearchOverlay } from '../search/SearchOverlay';
import { ContactOverlay } from '../support/ContactOverlay';
import * as ipc from '../../utils/ipc';

export type AppView = 'home' | 'folder' | 'transcript';

interface AppShellProps {
  view: AppView;
  selectedFolder: string | null;
  onNavigate: (view: AppView, payload?: { folder?: string; jobId?: string }) => void;
  onSettingsOpen: () => void;
  children: React.ReactNode;
}

export function AppShell({ view, selectedFolder, onNavigate, onSettingsOpen, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isContactOpen, setIsContactOpen] = React.useState(false);
  const titleBarHeight = 36;

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <div
        className="app-titlebar flex items-center justify-between px-3"
        style={{ height: titleBarHeight }}
      >
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          LocalScribe
        </div>
        <div className="flex items-center gap-1">
          <button
            className="window-control"
            onClick={() => ipc.windowMinimize()}
            type="button"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            className="window-control"
            onClick={() => ipc.windowToggleMaximize()}
            type="button"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
          <button
            className="window-control window-control-close"
            onClick={() => ipc.windowClose()}
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-1">
        <div
          className="fixed left-0 transition-all duration-300 ease-in-out"
          style={{
            top: titleBarHeight,
            height: `calc(100vh - ${titleBarHeight}px)`,
            width: isSidebarOpen ? '232px' : '56px',
          }}
        >
          <Sidebar
            view={view}
            selectedFolder={selectedFolder}
            onNavigate={onNavigate}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen((prev) => !prev)}
            onSearchOpen={() => setIsSearchOpen(true)}
            onSettingsOpen={onSettingsOpen}
          onContactOpen={() => setIsContactOpen(true)}
          />
        </div>
        <div
          className="flex flex-1 flex-col overflow-y-auto transition-all duration-300 ease-in-out"
          style={{ marginLeft: isSidebarOpen ? '232px' : '56px' }}
        >
          <main className="flex-1 px-12 py-8">
            {children}
          </main>
          <footer className="px-12 pb-6 text-[13px] text-muted-foreground">
            © 2026 Larry Van Wallendael. All rights reserved
          </footer>
        </div>
      </div>
      {isSearchOpen && (
        <SearchOverlay
          onClose={() => setIsSearchOpen(false)}
          onOpenTranscript={(jobId) => {
            onNavigate('transcript', { jobId });
            setIsSearchOpen(false);
          }}
        />
      )}
      {isContactOpen && (
        <ContactOverlay onClose={() => setIsContactOpen(false)} />
      )}
    </div>
  );
}
