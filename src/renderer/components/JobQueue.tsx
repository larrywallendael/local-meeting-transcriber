import React from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { useJobs } from '../contexts/JobContext';
import { Job, JobStatus } from '../../shared/types';

function formatTime(seconds?: number): string {
  if (!seconds || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function JobItem({ job, zeroProgressSince }: { job: Job; zeroProgressSince?: number }) {
  const { cancelJob } = useJobs();
  const fileName = job.originalAudioPath
    ? job.originalAudioPath.split(/[/\\]/).pop() || 'Unknown file'
    : 'Unknown file';
  const audioLength = job.audioDurationSeconds ? formatTime(job.audioDurationSeconds) : null;
  const showStuckNotice = zeroProgressSince
    ? Date.now() - zeroProgressSince >= 7 * 60 * 1000
    : false;

  if (job.status === JobStatus.RUNNING) {
    return (
      <Card className="border-transparent bg-muted/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                <p className="text-[15px] font-medium truncate">{fileName}</p>
              </div>
              {audioLength && (
                <p className="text-[13px] text-muted-foreground mb-2">Audio length: {audioLength}</p>
              )}
              <Progress value={job.progress || 0} className="h-1.5 mb-2" />
              <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                <span>{Math.round(job.progress || 0)}%</span>
                {job.estimatedTimeRemaining && (
                  <span>ETA: {formatTime(job.estimatedTimeRemaining)}</span>
                )}
              </div>
              {showStuckNotice && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Still at 0% after a few minutes. If it stays stuck, try again.
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => cancelJob(job.id)}
              className="shrink-0 border-border/70"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (job.status === JobStatus.WAITING) {
    return (
      <Card className="border-transparent bg-muted/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-[15px] font-medium truncate flex-1">{fileName}</p>
            <span className="text-[13px] text-muted-foreground">Waiting</span>
          </div>
          {audioLength && (
            <p className="text-[13px] text-muted-foreground mt-1">Audio length: {audioLength}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

export function JobQueueDisplay() {
  const { queue } = useJobs();
  const [zeroProgressMap, setZeroProgressMap] = React.useState<Record<string, number>>({});
  const [, forceTick] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => forceTick((prev) => prev + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    setZeroProgressMap((prev) => {
      const next = { ...prev };
      const runningIds = new Set<string>();
      queue.forEach((job) => {
        if (job.status === JobStatus.RUNNING) {
          runningIds.add(job.id);
          const progress = job.progress ?? 0;
          if (progress <= 0 && !next[job.id]) {
            next[job.id] = Date.now();
          }
          if (progress > 0 && next[job.id]) {
            delete next[job.id];
          }
        }
      });
      Object.keys(next).forEach((jobId) => {
        if (!runningIds.has(jobId)) {
          delete next[jobId];
        }
      });
      return next;
    });
  }, [queue]);

  if (queue.length === 0) {
    return (
      <Card className="border-transparent bg-muted/40">
        <CardContent className="p-8 text-center text-muted-foreground">
          <p className="text-[14px]">No jobs in queue</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {queue.map((job) => (
        <JobItem key={job.id} job={job} zeroProgressSince={zeroProgressMap[job.id]} />
      ))}
    </div>
  );
}
