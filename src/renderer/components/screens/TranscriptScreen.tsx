import React from 'react';
import { Button } from '../ui/button';
import { Folder, Calendar, ChevronLeft } from 'lucide-react';
import { useJobs } from '../../contexts/JobContext';
import * as ipc from '../../utils/ipc';

interface TranscriptScreenProps {
  jobId: string | null;
  onBack: () => void;
  backLabel: string;
  backTooltip: string;
}

export function TranscriptScreen({ jobId, onBack, backLabel, backTooltip }: TranscriptScreenProps) {
  const { history, queue, openTranscript, openAudio, jobFolders } = useJobs();
  const [content, setContent] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = React.useState(false);
  const [fileActionToast, setFileActionToast] = React.useState<string | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  const job = React.useMemo(() => {
    if (!jobId) return undefined;
    return [...queue, ...history].find((item) => item.id === jobId);
  }, [jobId, queue, history]);

  React.useEffect(() => {
    const loadTranscript = async () => {
      if (!jobId) {
        setContent('');
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await ipc.readTranscript(jobId);
        if (!response.success || typeof response.data !== 'string') {
          throw new Error(response.error || 'Failed to load transcript');
        }
        setContent(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transcript');
      } finally {
        setIsLoading(false);
      }
    };

    loadTranscript();
  }, [jobId]);

  const fileName = job?.originalAudioPath
    ? job.originalAudioPath.split(/[/\\]/).pop() || 'Transcript'
    : 'Transcript';
  const durationText = (() => {
    if (job?.audioDurationSeconds === undefined || job.audioDurationSeconds === null || job.audioDurationSeconds < 0) {
      return '';
    }
    const mins = Math.floor(job.audioDurationSeconds / 60);
    const secs = Math.floor(job.audioDurationSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  })();
  const dateLabel = (() => {
    if (!job) return '';
    const timestamp = job.completedAt ?? job.createdAt;
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  })();
  const folderLabel = job ? jobFolders[job.id] : undefined;

  const clearToastTimer = () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setShowCopiedToast(true);
      clearToastTimer();
      toastTimerRef.current = window.setTimeout(() => setShowCopiedToast(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy transcript');
    }
  };

  const handleOpenFile = async (type: 'txt' | 'audio') => {
    if (!jobId) return;
    const label = type === 'txt' ? 'Opening .txt file…' : 'Opening audio file…';
    setFileActionToast(label);
    try {
      if (type === 'txt') {
        await openTranscript(jobId);
      } else {
        await openAudio(jobId);
      }
      clearToastTimer();
      setFileActionToast(type === 'txt' ? 'Opened .txt file.' : 'Opened audio file.');
      toastTimerRef.current = window.setTimeout(() => setFileActionToast(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file');
      setFileActionToast(null);
    }
  };

  if (!jobId) {
    return (
      <div className="text-sm text-muted-foreground">
        Select a transcription to view the transcript.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <button
        className="tooltip inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[13px] text-muted-foreground hover:bg-muted"
        data-tooltip={backTooltip}
        onClick={onBack}
        type="button"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        <span>Back to {backLabel}</span>
      </button>
      <div className="space-y-1">
        <h1 className="text-[24px] font-semibold">{fileName}</h1>
        {durationText && (
          <p className="text-[14px] text-muted-foreground">{durationText}</p>
        )}
        <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
          {dateLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-3 py-1">
              <Calendar className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
          )}
          {folderLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-3 py-1">
              <Folder className="h-3.5 w-3.5" />
              {folderLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={handleCopy} className="border-border/70 text-[14px]">
          Copy transcription
        </Button>
        <Button variant="outline" onClick={() => handleOpenFile('txt')} className="border-border/70 text-[14px]">
          Open .txt file
        </Button>
        <Button variant="outline" onClick={() => handleOpenFile('audio')} className="border-border/70 text-[14px]">
          Open audio file
        </Button>
      </div>

      <div className="rounded-md border border-border/70 bg-card px-6 py-5 shadow-sm">
        {isLoading && <p className="text-[14px] text-muted-foreground">Loading transcript...</p>}
        {error && <p className="text-[14px] text-destructive">{error}</p>}
        {!isLoading && !error && (
          <div className="max-h-[62vh] overflow-y-auto whitespace-pre-wrap text-[15px] leading-6 text-foreground">
            {content || 'Transcript is empty.'}
          </div>
        )}
      </div>
      {showCopiedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border/70 bg-card px-4 py-2 text-[14px] text-foreground shadow-md">
          Transcript copied.
        </div>
      )}
      {fileActionToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border/70 bg-card px-4 py-2 text-[14px] text-foreground shadow-md">
          {fileActionToast}
        </div>
      )}
    </div>
  );
}
