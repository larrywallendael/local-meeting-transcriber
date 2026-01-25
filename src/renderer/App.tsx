import React from 'react';
import { Shield, FileAudio } from 'lucide-react';
import { JobProvider } from './contexts/JobContext';
import { FileDropZone } from './components/FileDropZone';
import { JobQueueDisplay } from './components/JobQueue';
import { JobHistory } from './components/JobHistory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Button } from './components/ui/button';
import { JobOptions } from '../shared/types';
import * as ipc from './utils/ipc';

function App() {
  const [availableModels, setAvailableModels] = React.useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [draftOptions, setDraftOptions] = React.useState<JobOptions>({
    modelName: 'ggml-medium.bin',
    language: 'auto',
    vad: false,
    beamSize: 5,
    bestOf: 5,
    noFallback: false,
    threads: 8,
  });
  const [savedOptions, setSavedOptions] = React.useState<JobOptions>(draftOptions);

  React.useEffect(() => {
    const loadModels = async () => {
      try {
        if (!ipc.isAvailable()) {
          return;
        }
        const response = await ipc.getModels();
        if (response.success && Array.isArray(response.data)) {
          setAvailableModels(response.data);
          if (response.data.length > 0) {
            setDraftOptions(prev => ({
              ...prev,
              modelName: prev.modelName && response.data.includes(prev.modelName)
                ? prev.modelName
                : response.data[0],
            }));
            setSavedOptions(prev => ({
              ...prev,
              modelName: prev.modelName && response.data.includes(prev.modelName)
                ? prev.modelName
                : response.data[0],
            }));
          }
        }
      } catch {
        // Ignore model discovery errors; fallback to manual defaults
      }
    };
    loadModels();
  }, []);

  const saveSettings = () => {
    setSavedOptions(draftOptions);
    setIsSettingsOpen(false);
  };

  return (
    <JobProvider>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-8 max-w-4xl">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FileAudio className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">Local Meeting Transcriber</h1>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" />
                <p className="text-sm">
                  Runs entirely on your computer • Safe for confidential data
                </p>
              </div>
            </div>
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setIsSettingsOpen(prev => !prev)}
              >
                Settings
              </Button>
              {isSettingsOpen && (
                <div className="absolute right-0 mt-2 w-[360px] rounded-md border border-border bg-background p-4 shadow-lg z-10">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Transcription Settings</p>
                    <p className="text-xs text-muted-foreground">
                      Saved settings apply to all new jobs
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium">Model</label>
                      <select
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={draftOptions.modelName || ''}
                        onChange={(e) => setDraftOptions(prev => ({ ...prev, modelName: e.target.value }))}
                        disabled={availableModels.length === 0}
                      >
                        {availableModels.length === 0 ? (
                          <option value="">No models found</option>
                        ) : (
                          availableModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))
                        )}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Models are read from resources/models
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Language</label>
                        <input
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={draftOptions.language || ''}
                          onChange={(e) => setDraftOptions(prev => ({ ...prev, language: e.target.value.trim() }))}
                          placeholder="auto"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Threads</label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={draftOptions.threads ?? ''}
                          onChange={(e) => setDraftOptions(prev => ({ ...prev, threads: e.target.value ? Number(e.target.value) : undefined }))}
                          min={1}
                          max={32}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Beam size</label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={draftOptions.beamSize ?? ''}
                          onChange={(e) => setDraftOptions(prev => ({ ...prev, beamSize: e.target.value ? Number(e.target.value) : undefined }))}
                          min={1}
                          max={10}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Best of</label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={draftOptions.bestOf ?? ''}
                          onChange={(e) => setDraftOptions(prev => ({ ...prev, bestOf: e.target.value ? Number(e.target.value) : undefined }))}
                          min={1}
                          max={10}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!draftOptions.vad}
                          onChange={(e) => setDraftOptions(prev => ({ ...prev, vad: e.target.checked }))}
                        />
                        Enable VAD
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!draftOptions.noFallback}
                          onChange={(e) => setDraftOptions(prev => ({ ...prev, noFallback: e.target.checked }))}
                        />
                        No fallback
                      </label>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Saved model: {savedOptions.modelName || 'auto'}
                      </p>
                      <Button onClick={saveSettings}>Save</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* File Drop Zone */}
          <div className="mb-8">
            <FileDropZone options={savedOptions} />
          </div>

          {/* Active Queue */}
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Active Queue</CardTitle>
                <CardDescription>
                  Jobs currently processing or waiting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JobQueueDisplay />
              </CardContent>
            </Card>
          </div>

          {/* History */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>
                  Completed, cancelled, and failed jobs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JobHistory />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </JobProvider>
  );
}

export default App;
