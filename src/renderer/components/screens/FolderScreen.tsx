import React from 'react';
import { Folder } from 'lucide-react';
import { useJobs } from '../../contexts/JobContext';
import { JobStatus } from '../../../shared/types';
import { TranscriptsList } from '../TranscriptsList';

interface FolderScreenProps {
  folderName: string;
  onOpenTranscript: (jobId: string) => void;
}

export function FolderScreen({ folderName, onOpenTranscript }: FolderScreenProps) {
  const { history, jobFolders, trashedJobs, loading } = useJobs();
  const items = history.filter((job) =>
    job.status === JobStatus.DONE &&
    jobFolders[job.id] === folderName &&
    !trashedJobs[job.id]
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Folder className="h-4 w-4" />
          <span className="text-[14px]">Folder</span>
        </div>
        <h1 className="text-[28px] font-semibold">{folderName}</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-[17px] font-medium">Transcripts</h2>
        {loading ? (
          <p className="text-[14px] text-muted-foreground">Loading transcripts...</p>
        ) : (
          <TranscriptsList
            key={folderName}
            jobs={items}
            onOpenTranscript={onOpenTranscript}
            emptyLabel="No transcripts in this folder yet."
          />
        )}
      </section>
    </div>
  );
}
