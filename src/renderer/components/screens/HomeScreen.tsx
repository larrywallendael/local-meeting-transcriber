import React from 'react';
import { Shield } from 'lucide-react';
import { FileDropZone } from '../FileDropZone';
import { JobQueueDisplay } from '../JobQueue';
import { useJobs } from '../../contexts/JobContext';
import { JobOptions } from '../../../shared/types';
import { TranscriptsList } from '../TranscriptsList';

interface HomeScreenProps {
  onOpenTranscript: (jobId: string) => void;
  options?: JobOptions;
}

function TranscriptsSection({ onOpenTranscript }: { onOpenTranscript: (jobId: string) => void }) {
  const { history, loading } = useJobs();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading transcripts...</p>;
  }

  return <TranscriptsList jobs={history} onOpenTranscript={onOpenTranscript} />;
}

export function HomeScreen({ onOpenTranscript, options }: HomeScreenProps) {
  return (
    <div className="space-y-10">
      <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
        <Shield className="h-4 w-4" />
        <p>Runs entirely on your computer – safe for confidential data</p>
      </div>

      <section>
        <FileDropZone options={options} />
      </section>

      <section className="space-y-3">
        <h2 className="text-[17px] font-medium">Active queue</h2>
        <JobQueueDisplay />
      </section>

      <section className="space-y-4">
        <h2 className="text-[17px] font-medium">Transcripts</h2>
        <TranscriptsSection onOpenTranscript={onOpenTranscript} />
      </section>
    </div>
  );
}
