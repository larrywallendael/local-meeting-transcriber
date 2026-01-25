import React, { useState } from 'react';
import { FileText, FolderOpen, Trash2, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { useJobs } from '../contexts/JobContext';
import { Job, JobStatus } from '../../shared/types';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function getStatusIcon(status: JobStatus) {
  switch (status) {
    case JobStatus.DONE:
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case JobStatus.FAILED:
      return <XCircle className="h-4 w-4 text-red-600" />;
    case JobStatus.CANCELLED:
      return <Ban className="h-4 w-4 text-yellow-600" />;
    default:
      return null;
  }
}

function getStatusText(status: JobStatus): string {
  switch (status) {
    case JobStatus.DONE:
      return 'Completed';
    case JobStatus.FAILED:
      return 'Failed';
    case JobStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status;
  }
}

function HistoryItem({ job }: { job: Job }) {
  const { openTranscript, openTranscriptFolder, deleteJob } = useJobs();
  const [isDeleting, setIsDeleting] = useState(false);
  const fileName = job.originalAudioPath.split(/[/\\]/).pop() || 'Unknown file';

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteJob(job.id);
    } catch (error) {
      console.error('Error deleting job:', error);
      alert(`Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(job.status)}
              <p className="font-medium truncate">{fileName}</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{getStatusText(job.status)}</span>
              {job.completedAt && (
                <span>{formatDate(job.completedAt)}</span>
              )}
            </div>
            {job.errorMessage && (
              <p className="text-sm text-red-600 mt-1">{job.errorMessage}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {job.status === JobStatus.DONE && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openTranscript(job.id)}
                  title="Open transcript"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openTranscriptFolder(job.id)}
                  title="Open folder"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobHistory() {
  const { history, loading } = useJobs();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Loading history...</p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>No completed jobs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((job) => (
        <HistoryItem key={job.id} job={job} />
      ))}
    </div>
  );
}
