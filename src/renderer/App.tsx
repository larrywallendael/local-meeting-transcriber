import React from 'react';
import { JobProvider } from './contexts/JobContext';
import { JobOptions } from '../shared/types';
import * as ipc from './utils/ipc';
import { AppShell, AppView } from './components/layout/AppShell';
import { HomeScreen } from './components/screens/HomeScreen';
import { FolderScreen } from './components/screens/FolderScreen';
import { TranscriptScreen } from './components/screens/TranscriptScreen';
import { SettingsOverlay } from './components/settings/SettingsOverlay';

function App() {
  const pickPreferredModel = (models: string[]): string | undefined => {
    const normalized = models.map((name) => name.toLowerCase());
    const findBy = (predicate: (name: string) => boolean) => {
      const index = normalized.findIndex(predicate);
      return index >= 0 ? models[index] : undefined;
    };

    return (
      findBy((name) => name.includes('medium') && name.includes('q5')) ||
      findBy((name) => name.includes('medium')) ||
      findBy((name) => name.includes('small') && name.includes('q8')) ||
      findBy((name) => name.includes('small')) ||
      findBy((name) => name.includes('base')) ||
      findBy((name) => name.includes('large')) ||
      findBy((name) => name.includes('tiny')) ||
      models[0]
    );
  };

  const getDefaultOptions = (models: string[]): JobOptions => ({
    modelName: pickPreferredModel(models) || 'ggml-medium-q5_0.bin',
    language: 'auto',
    vad: false,
    beamSize: 2,
    bestOf: 2,
    noFallback: true,
    threads: 4,
  });

  const [availableModels, setAvailableModels] = React.useState<string[]>([]);
  const [savedOptions, setSavedOptions] = React.useState<JobOptions>({
    modelName: 'ggml-medium-q5_0.bin',
    language: 'auto',
    vad: false,
    beamSize: 2,
    bestOf: 2,
    noFallback: true,
    threads: 4,
  });
  const [draftOptions, setDraftOptions] = React.useState<JobOptions>(savedOptions);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const settingsReadyRef = React.useRef(false);

  const [view, setView] = React.useState<AppView>('home');
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>(null);
  const [lastListView, setLastListView] = React.useState<AppView>('home');
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);

  const optionsMatch = (left: JobOptions, right: JobOptions) => (
    left.modelName === right.modelName &&
    (left.language || 'auto') === (right.language || 'auto') &&
    left.vad === right.vad &&
    left.noFallback === right.noFallback &&
    left.threads === right.threads &&
    left.beamSize === right.beamSize &&
    left.bestOf === right.bestOf
  );

  React.useEffect(() => {
    const loadModelsAndSettings = async () => {
      try {
        if (!ipc.isAvailable()) {
          return;
        }
        const [modelsResponse, settingsResponse] = await Promise.all([
          ipc.getModels(),
          ipc.getSettings(),
        ]);

        const models = Array.isArray(modelsResponse.data) ? modelsResponse.data : [];
        if (modelsResponse.success) {
          setAvailableModels(models);
        }
        const defaults = getDefaultOptions(models);
        const savedFromDisk: JobOptions | undefined = settingsResponse?.data?.transcriptionOptions;
        const resolvedModel = savedFromDisk?.modelName && models.includes(savedFromDisk.modelName)
          ? savedFromDisk.modelName
          : defaults.modelName;
        const resolvedOptions = {
          ...defaults,
          ...savedFromDisk,
          modelName: resolvedModel,
        };

        setSavedOptions(resolvedOptions);
        setDraftOptions(resolvedOptions);
        settingsReadyRef.current = true;
      } catch {
        // Ignore model discovery errors; fallback to manual defaults
      }
    };
    loadModelsAndSettings();
  }, []);

  React.useEffect(() => {
    if (!settingsReadyRef.current) {
      return;
    }
    if (optionsMatch(draftOptions, savedOptions)) {
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        const payload = { transcriptionOptions: draftOptions };
        const response = await ipc.setSettings(payload);
        if (!response.success) {
          throw new Error(response.error || 'Failed to save settings');
        }
        setSavedOptions(draftOptions);
      } catch (error) {
        console.error('Failed to auto-save settings:', error);
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [draftOptions, savedOptions]);

  const handleNavigate = (nextView: AppView, payload?: { folder?: string; jobId?: string }) => {
    if (payload?.folder) {
      setSelectedFolder(payload.folder);
    }
    if (payload?.jobId) {
      setSelectedJobId(payload.jobId);
    }
    if (nextView === 'home' || nextView === 'folder') {
      setLastListView(nextView);
    }
    setView(nextView);
  };

  const handleOpenTranscript = (jobId: string) => {
    setSelectedJobId(jobId);
    setView('transcript');
  };

  return (
    <JobProvider>
      <AppShell
        view={view}
        selectedFolder={selectedFolder}
        onNavigate={handleNavigate}
        onSettingsOpen={() => setIsSettingsOpen(true)}
      >
        {view === 'home' && (
          <HomeScreen onOpenTranscript={handleOpenTranscript} options={savedOptions} />
        )}
        {view === 'folder' && (
          <FolderScreen folderName={selectedFolder || 'Folder'} onOpenTranscript={handleOpenTranscript} />
        )}
        {view === 'transcript' && (
          <TranscriptScreen
            jobId={selectedJobId}
            onBack={() => setView(lastListView)}
            backLabel={lastListView === 'folder' && selectedFolder ? selectedFolder : 'My transcripts'}
            backTooltip={
              lastListView === 'folder' && selectedFolder
                ? `Back to ${selectedFolder}`
                : 'Back to My transcripts'
            }
          />
        )}
      </AppShell>
      {isSettingsOpen && (
        <SettingsOverlay
          onClose={() => setIsSettingsOpen(false)}
          availableModels={availableModels}
          draftOptions={draftOptions}
          setDraftOptions={setDraftOptions}
        />
      )}
    </JobProvider>
  );
}

export default App;
