import React from 'react';
import { FileText, Folder, MoreHorizontal, ChevronDown, Search, Plus, Check, X } from 'lucide-react';
import { Job, JobStatus } from '../../shared/types';
import { useJobs } from '../contexts/JobContext';

interface TranscriptsListProps {
  jobs: Job[];
  onOpenTranscript: (jobId: string) => void;
  emptyLabel?: string;
}

function formatDateGroup(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Unknown date';
  }
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) {
    return 'Today';
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || seconds < 0) {
    return '';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDisplayTimestamp(job: Job): number {
  const timestamp = job.completedAt ?? job.createdAt;
  return Number.isFinite(timestamp) ? (timestamp as number) : 0;
}

function groupHistoryByDate(history: Job[]): Array<{ label: string; items: Job[]; sortKey: number }> {
  const groups = new Map<string, { items: Job[]; sortKey: number }>();
  history.forEach((job) => {
    const timestamp = getDisplayTimestamp(job);
    const label = formatDateGroup(timestamp);
    if (!groups.has(label)) {
      groups.set(label, { items: [], sortKey: timestamp });
    }
    const entry = groups.get(label)!;
    entry.items.push(job);
    if (timestamp > entry.sortKey) {
      entry.sortKey = timestamp;
    }
  });

  return Array.from(groups.entries()).map(([label, entry]) => ({
    label,
    items: entry.items.sort((a, b) => getDisplayTimestamp(b) - getDisplayTimestamp(a)),
    sortKey: entry.sortKey,
  }));
}

export function TranscriptsList({ jobs, onOpenTranscript, emptyLabel }: TranscriptsListProps) {
  const { folders, jobFolders, trashedJobs, setJobFolder, removeJobFolder, addFolder, moveToTrash } = useJobs();
  const [openMenuFor, setOpenMenuFor] = React.useState<string | null>(null);
  const [openFolderPickerFor, setOpenFolderPickerFor] = React.useState<string | null>(null);
  const [folderSearch, setFolderSearch] = React.useState('');
  const [newFolderName, setNewFolderName] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = React.useState<string | null>(null);
  const [folderPickerAnchor, setFolderPickerAnchor] = React.useState<DOMRect | null>(null);
  const [menuAnchor, setMenuAnchor] = React.useState<DOMRect | null>(null);
  const [bulkAnchor, setBulkAnchor] = React.useState<DOMRect | null>(null);

  const completed = jobs.filter((job) => job.status === JobStatus.DONE && !trashedJobs[job.id]);
  if (completed.length === 0) {
    return <p className="text-[14px] text-muted-foreground">{emptyLabel || 'No transcripts yet'}</p>;
  }

  const groups = groupHistoryByDate(completed).sort((a, b) => b.sortKey - a.sortKey);
  const orderedIds = groups.flatMap((group) => group.items.map((item) => item.id));
  const filteredFolders = folders.filter((folder) =>
    folder.toLowerCase().includes(folderSearch.trim().toLowerCase())
  );
  const selectedCount = selectedIds.size;

  React.useEffect(() => {
    setOpenMenuFor(null);
    setOpenFolderPickerFor(null);
    setFolderSearch('');
    setNewFolderName('');
  }, [jobs]);

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      completed.forEach((job) => {
        if (prev.has(job.id)) {
          next.add(job.id);
        }
      });
      return next;
    });
  }, [completed]);

  const toggleSelection = (jobId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
    setLastSelectedId(jobId);
  };

  const selectRange = (targetId: string) => {
    if (!lastSelectedId) {
      toggleSelection(targetId);
      return;
    }
    const startIndex = orderedIds.indexOf(lastSelectedId);
    const endIndex = orderedIds.indexOf(targetId);
    if (startIndex === -1 || endIndex === -1) {
      toggleSelection(targetId);
      return;
    }
    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      orderedIds.slice(from, to + 1).forEach((id) => next.add(id));
      return next;
    });
    setLastSelectedId(targetId);
  };

  const handleBulkAssign = (folder: string) => {
    selectedIds.forEach((jobId) => setJobFolder(jobId, folder));
    setOpenFolderPickerFor(null);
    setSelectedIds(new Set());
  };

  const handleBulkNewFolder = (folder: string) => {
    addFolder(folder);
    selectedIds.forEach((jobId) => setJobFolder(jobId, folder));
    setOpenFolderPickerFor(null);
    setSelectedIds(new Set());
  };

  const handleBulkTrash = () => {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => moveToTrash(id));
    setSelectedIds(new Set());
  };

  const getPopoverStyle = (anchor: DOMRect | null, width: number, maxHeight: number) => {
    if (!anchor) {
      return { top: 0, left: 0 };
    }
    const padding = 8;
    const top = Math.min(anchor.bottom + padding, window.innerHeight - maxHeight - padding);
    const left = Math.min(anchor.left, window.innerWidth - width - padding);
    return {
      top: Math.max(padding, top),
      left: Math.max(padding, left),
      width,
      maxHeight,
    };
  };

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-[13px] uppercase tracking-wide text-muted-foreground">{group.label}</p>
          <div className="space-y-2">
            {group.items.map((job) => {
              const fileName = job.originalAudioPath
                ? job.originalAudioPath.split(/[/\\]/).pop() || 'Unknown file'
                : 'Unknown file';
              const durationText = formatDuration(job.audioDurationSeconds);
              const assignedFolder = jobFolders[job.id];
              const isMenuOpen = openMenuFor === job.id;
              const isFolderOpen = openFolderPickerFor === job.id;
              const isSelected = selectedIds.has(job.id);
              const showHoverActions = isSelected || isMenuOpen || isFolderOpen;

              return (
                <div
                  key={job.id}
                  className="group relative"
                  onClick={(event) => {
                    if (event.shiftKey) {
                      selectRange(job.id);
                      return;
                    }
                    if (selectedCount === 0) {
                      onOpenTranscript(job.id);
                    } else {
                      toggleSelection(job.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex w-full items-center justify-between rounded-md bg-muted/40 px-4 py-3 text-left text-sm transition-shadow hover:bg-muted/60 group-hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        className={`flex h-5 w-5 items-center justify-center rounded border transition-opacity ${
                          isSelected ? 'border-[#9DBAE6] bg-[#9DBAE6]' : 'border-border/70'
                        } ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (event.shiftKey) {
                            selectRange(job.id);
                          } else {
                            toggleSelection(job.id);
                          }
                        }}
                        type="button"
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                      </button>
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[16px] text-foreground">{fileName}</p>
                        {durationText && (
                          <p className="text-[13px] text-muted-foreground">{durationText}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`${showHoverActions ? 'hidden' : 'flex'} items-center gap-3 group-hover:hidden`}>
                        {assignedFolder && (
                          <Folder className="h-4 w-4 text-muted-foreground" />
                        )}
                        {job.completedAt && (
                          <span className="text-[13px] text-muted-foreground">
                            {formatTime(job.completedAt)}
                          </span>
                        )}
                      </div>

                      <div className={`${showHoverActions ? 'flex' : 'hidden'} items-center gap-2 group-hover:flex`}>
                        <div className="relative">
                          <button
                            className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-2.5 py-1 text-[14px] text-muted-foreground hover:bg-muted"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFolderPickerAnchor(event.currentTarget.getBoundingClientRect());
                              setOpenFolderPickerFor(isFolderOpen ? null : job.id);
                              setFolderSearch('');
                              setNewFolderName('');
                            }}
                            type="button"
                          >
                            <Folder className="h-4 w-4" />
                            <span>{assignedFolder || 'Add to folder'}</span>
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          {isFolderOpen && (
                            <div
                              className="fixed z-50 rounded-md border border-border/70 bg-card p-2 text-[14px] shadow-md overflow-y-auto"
                              style={getPopoverStyle(folderPickerAnchor, 224, 240)}
                              onClick={(event) => event.stopPropagation()}
                              onMouseLeave={() => setOpenFolderPickerFor(null)}
                            >
                              <div className="mb-2 flex items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1 text-muted-foreground">
                                <Search className="h-3.5 w-3.5" />
                                <input
                                  className="w-full bg-transparent text-[14px] text-muted-foreground outline-none placeholder:text-muted-foreground"
                                  placeholder="Search folders"
                                  value={folderSearch}
                                  onChange={(event) => setFolderSearch(event.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                {filteredFolders.map((folder) => (
                                  <button
                                    key={folder}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setJobFolder(job.id, folder);
                                      setOpenFolderPickerFor(null);
                                    }}
                                    type="button"
                                  >
                                    <Folder className="h-4 w-4 text-muted-foreground" />
                                    <span>{folder}</span>
                                  </button>
                                ))}
                                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground">
                                  <Plus className="h-4 w-4" />
                                  <input
                                    className="w-full bg-transparent text-[14px] text-muted-foreground outline-none placeholder:text-muted-foreground"
                                    placeholder="New folder"
                                    value={newFolderName}
                                    onChange={(event) => setNewFolderName(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        addFolder(newFolderName);
                                        setJobFolder(job.id, newFolderName);
                                        setNewFolderName('');
                                        setOpenFolderPickerFor(null);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          className="rounded-md border border-border/70 bg-card px-2 py-1 text-muted-foreground hover:bg-muted"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuAnchor(event.currentTarget.getBoundingClientRect());
                            setOpenMenuFor(isMenuOpen ? null : job.id);
                          }}
                          type="button"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {isMenuOpen && (
                          <div
                            className="fixed z-50 rounded-md border border-border/70 bg-card py-1 text-[14px] text-foreground shadow-md"
                            style={getPopoverStyle(menuAnchor, 160, 180)}
                            onClick={(event) => event.stopPropagation()}
                            onMouseLeave={() => setOpenMenuFor(null)}
                          >
                            {assignedFolder && (
                              <button
                                className="w-full px-3 py-2 text-left hover:bg-muted"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeJobFolder(job.id);
                                  setOpenMenuFor(null);
                                }}
                                type="button"
                              >
                                Remove from folder
                              </button>
                            )}
                            <button
                              className="w-full px-3 py-2 text-left text-red-600 hover:bg-muted"
                              onClick={(event) => {
                                event.stopPropagation();
                                moveToTrash(job.id);
                                setOpenMenuFor(null);
                              }}
                              type="button"
                            >
                              Move to trash
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-[232px] right-0 z-40 flex justify-center">
          <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card px-4 py-2 text-[14px] shadow-md">
            <span>{selectedCount} selected</span>
            <button
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setSelectedIds(new Set())}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[14px] text-muted-foreground hover:bg-muted"
                onClick={(event) => {
                  setBulkAnchor(event.currentTarget.getBoundingClientRect());
                  setOpenFolderPickerFor(openFolderPickerFor === 'bulk' ? null : 'bulk');
                }}
                type="button"
              >
                <Folder className="h-4 w-4" />
                <span>Add to folder</span>
                <ChevronDown className="h-3 w-3 rotate-180" />
              </button>
              {openFolderPickerFor === 'bulk' && (
                <div
                  className="fixed z-50 rounded-md border border-border/70 bg-card p-2 text-[14px] shadow-md overflow-y-auto"
                  style={getPopoverStyle(bulkAnchor, 224, 240)}
                  onMouseLeave={() => setOpenFolderPickerFor(null)}
                >
                  <div className="mb-2 flex items-center gap-2 rounded-md border border-border/70 bg-background px-2 py-1 text-muted-foreground">
                    <Search className="h-3.5 w-3.5" />
                    <input
                      className="w-full bg-transparent text-[14px] text-muted-foreground outline-none placeholder:text-muted-foreground"
                      placeholder="Search folders"
                      value={folderSearch}
                      onChange={(event) => setFolderSearch(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    {filteredFolders.map((folder) => (
                      <button
                        key={folder}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => handleBulkAssign(folder)}
                        type="button"
                      >
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span>{folder}</span>
                      </button>
                    ))}
                    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground">
                      <Plus className="h-4 w-4" />
                      <input
                        className="w-full bg-transparent text-[14px] text-muted-foreground outline-none placeholder:text-muted-foreground"
                        placeholder="New folder"
                        value={newFolderName}
                        onChange={(event) => setNewFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleBulkNewFolder(newFolderName);
                            setNewFolderName('');
                          }
                        }}
                      />
                    </div>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-red-600 hover:bg-muted"
                      onClick={handleBulkTrash}
                      type="button"
                    >
                      Move to trash
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
