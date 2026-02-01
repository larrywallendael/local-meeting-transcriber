import React from 'react';
import { Sidebar } from './Sidebar';
import { SearchOverlay } from '../search/SearchOverlay';
import { ContactOverlay } from '../support/ContactOverlay';

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
    <div className="h-screen bg-background text-foreground">
      <div className="flex h-full">
        <div
          className="fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out"
          style={{ width: isSidebarOpen ? '232px' : '56px' }}
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
          className="flex h-full flex-1 flex-col overflow-y-auto transition-all duration-300 ease-in-out"
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
