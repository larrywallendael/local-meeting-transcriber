import React, { useCallback, useState } from 'react';
import { Upload, FileAudio } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useJobs } from '../contexts/JobContext';
import { JobOptions } from '../../shared/types';
import { cn } from '../lib/utils';
import * as ipc from '../utils/ipc';

export function FileDropZone({ options }: { options?: JobOptions }) {
  const { addJob } = useJobs();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFiles = useCallback(async (filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) return;

    setIsProcessing(true);
    try {
      for (const filePath of filePaths) {
        await addJob(filePath, options);
      }
    } catch (error) {
      console.error('Error adding files:', error);
      alert(`Failed to add files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [addJob, options]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // Extract file paths from dropped files
    const files = Array.from(e.dataTransfer.files);
    const filePaths: string[] = [];
    
    // Note: In Electron, we need to get the actual file paths
    // For drag & drop, we'll need to use a different approach
    // For now, use file picker as fallback
    alert('Please use the "Select Files" button. Drag & drop requires additional Electron integration.');
  }, []);

  const handleFilePicker = useCallback(async () => {
    try {
      const result = await ipc.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Audio Files', extensions: ['wav', 'mp3', 'm4a', 'ogg', 'flac', 'aac'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        await handleFiles(result.filePaths);
      }
    } catch (error) {
      console.error('Error selecting files:', error);
      alert(`Failed to select files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [handleFiles]);

  return (
    <Card
      className={cn(
        'border-2 border-dashed transition-colors',
        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          {isDragging ? (
            <Upload className="h-12 w-12 text-primary" />
          ) : (
            <FileAudio className="h-12 w-12 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-lg font-medium">
              {isDragging ? 'Drop audio files here' : 'Drag & drop audio files here'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              or
            </p>
          </div>
          <Button
            onClick={handleFilePicker}
            disabled={isProcessing}
            variant="outline"
          >
            {isProcessing ? 'Processing...' : 'Select Files'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Supported formats: WAV, MP3, M4A, OGG, FLAC, AAC
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
