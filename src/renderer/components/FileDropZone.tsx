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
  const supportedExtensions = ['.wav', '.mp3', '.m4a', '.ogg', '.flac', '.aac'];

  const isSupported = (filePath: string) => {
    const lower = filePath.toLowerCase();
    return supportedExtensions.some((ext) => lower.endsWith(ext));
  };

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
    
    const files = Array.from(e.dataTransfer.files);
    const filePaths = files.map((file: any) => file.path).filter(Boolean);
    const supported = filePaths.filter(isSupported);
    const rejected = filePaths.filter((path) => !isSupported(path));

    if (rejected.length > 0) {
      alert(`Unsupported format:\n${rejected.join('\n')}\n\nSupported: ${supportedExtensions.join(', ')}`);
    }

    if (supported.length > 0) {
      await handleFiles(supported);
    }
  }, [handleFiles]);

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
        isDragging ? 'bg-[#9DBAE6]/10' : 'bg-card'
      )}
      style={{ borderColor: '#9DBAE6' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center px-10 py-10">
        <div className="flex flex-col items-center gap-3">
          {isDragging ? (
            <Upload className="h-10 w-10 text-[#9DBAE6]" />
          ) : (
            <FileAudio className="h-10 w-10 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-[17px] font-medium">
              {isDragging ? 'Drop audio files here' : 'Drag & drop audio files here or'}
            </p>
          </div>
          <Button
            onClick={handleFilePicker}
            disabled={isProcessing}
            variant="outline"
            className="border-[#9DBAE6] text-foreground hover:bg-[#9DBAE6]/20"
          >
            {isProcessing ? 'Processing...' : 'Select files'}
          </Button>
          <p className="text-[13px] text-muted-foreground">
            Supported formats: WAV, MP3, M4A, OGG, FLAC, AAC
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
