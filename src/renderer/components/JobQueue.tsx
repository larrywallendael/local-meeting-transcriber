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

  if (job.status === JobStatus.RUNNING) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-4 w-4 text-primary" />
                <p className="font-medium truncate">{fileName}</p>
              </div>
              <Progress value={job.progress || 0} className="h-2 mb-2" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
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
              className="shrink-0"
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
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium truncate flex-1">{fileName}</p>
            <span className="text-sm text-muted-foreground">Waiting</span>
          </div>
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
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>No jobs in queue</p>
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
