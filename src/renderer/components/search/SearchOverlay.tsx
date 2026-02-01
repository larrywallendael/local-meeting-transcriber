import React from 'react';
import { X, Search, SlidersHorizontal, Folder, FileText } from 'lucide-react';
import { useJobs } from '../../contexts/JobContext';
import { JobStatus } from '../../../shared/types';

interface SearchOverlayProps {
  onClose: () => void;
  onOpenTranscript: (jobId: string) => void;
}

export function SearchOverlay({ onClose, onOpenTranscript }: SearchOverlayProps) {
  const { history, folders, jobFolders, trashedJobs } = useJobs();
  const [query, setQuery] = React.useState('');
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [folderFilter, setFolderFilter] = React.useState('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const filteredJobs = history.filter((job) => {
    if (job.status !== JobStatus.DONE) return false;
    if (trashedJobs[job.id]) return false;
    const title = job.originalAudioPath.split(/[/\\]/).pop() || '';
    if (query && !title.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    const assignedFolder = jobFolders[job.id];
    if (folderFilter !== 'all' && assignedFolder !== folderFilter) {
      return false;
    }
    if (dateFrom) {
      const fromDate = new Date(dateFrom).getTime();
      const jobDate = job.completedAt ?? job.createdAt;
      if (jobDate && jobDate < fromDate) return false;
    }
    if (dateTo) {
      const toDate = new Date(dateTo).getTime();
      const jobDate = job.completedAt ?? job.createdAt;
      if (jobDate && jobDate > toDate + 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  const groupedByFolder = filteredJobs.reduce<Record<string, typeof filteredJobs>>((acc, job) => {
    const folderName = jobFolders[job.id] || 'Unassigned';
    if (!acc[folderName]) acc[folderName] = [];
    acc[folderName].push(job);
    return acc;
  }, {});

  const filtersActive = folderFilter !== 'all' || !!dateFrom || !!dateTo;
  const clearFilters = () => {
    setFolderFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-start justify-center bg-black/30 px-6 py-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border/70 bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[16px] text-foreground outline-none"
            placeholder="Search people, folders, companies, or meetings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="relative">
            <button
              className="tooltip rounded-md border border-border/60 bg-background px-2 py-1 text-muted-foreground hover:bg-muted"
              data-tooltip="Filters"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              type="button"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            {filtersActive && (
              <div className="absolute right-full top-1/2 mr-2 flex -translate-y-1/2 items-center gap-1 text-[13px] text-[#9DBAE6]">
                <span>Filters active</span>
                <button
                  className="rounded-full px-1 text-[#9DBAE6] hover:bg-[#9DBAE6]/20"
                  onClick={clearFilters}
                  type="button"
                >
                  ×
                </button>
              </div>
            )}
            {isFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsFilterOpen(false)}
                />
                <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border border-border/70 bg-card p-3 shadow-md">
                <div className="grid gap-3">
                  <div>
                    <p className="text-[13px] text-muted-foreground mb-1">Folder</p>
                    <select
                      className="w-full rounded-md border border-border/70 bg-card px-2 py-1 text-[14px]"
                      value={folderFilter}
                      onChange={(event) => setFolderFilter(event.target.value)}
                    >
                      <option value="all">All folders</option>
                      {folders.map((folder) => (
                        <option key={folder} value={folder}>{folder}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[13px] text-muted-foreground mb-1">Date range</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="w-full rounded-md border border-border/70 bg-card px-2 py-1 text-[14px]"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                      />
                      <input
                        type="date"
                        className="w-full rounded-md border border-border/70 bg-card px-2 py-1 text-[14px]"
                        value={dateTo}
                        onChange={(event) => setDateTo(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              </>
            )}
          </div>
          <button
            className="tooltip rounded-md border border-border/60 bg-background px-2 py-1 text-muted-foreground hover:bg-muted"
            data-tooltip="Close"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-[13px] uppercase tracking-wide text-muted-foreground mb-2">Transcripts</p>
            <div className="space-y-3">
              {Object.entries(groupedByFolder).map(([folderName, items]) => (
                <div key={folderName}>
                  <p className="text-[13px] text-muted-foreground mb-2">{folderName}</p>
                  <div className="space-y-2">
                    {items.map((job) => {
                      const title = job.originalAudioPath.split(/[/\\]/).pop() || 'Transcript';
                      return (
                        <button
                          key={job.id}
                          className="flex w-full items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2 text-left text-[14px] hover:bg-muted"
                          onClick={() => onOpenTranscript(job.id)}
                          type="button"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredJobs.length === 0 && (
                <p className="text-[14px] text-muted-foreground">No matching transcripts.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
