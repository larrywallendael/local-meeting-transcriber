import React from 'react';
import { X, Clock, Play } from 'lucide-react';
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

function JobItem({ job }: { job: Job }) {
  const { cancelJob } = useJobs();
  const fileName = job.originalAudioPath.split(/[/\\]/).pop() || 'Unknown file';
  const audioLength = job.audioDurationSeconds ? formatTime(job.audioDurationSeconds) : null;

  if (job.status === JobStatus.RUNNING) {
    return (
      <Card className="border-transparent bg-muted/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Play className="h-4 w-4 text-muted-foreground" />
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
        <JobItem key={job.id} job={job} />
      ))}
    </div>
  );
}
