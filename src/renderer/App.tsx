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
    const findByKeyword = (keyword: string) => {
      const index = normalized.findIndex((name) => name.includes(keyword));
      return index >= 0 ? models[index] : undefined;
    };

    return (
      findByKeyword('small') ||
      findByKeyword('base') ||
      findByKeyword('medium') ||
      findByKeyword('large') ||
      findByKeyword('tiny') ||
      models[0]
    );
  };

  const getDefaultOptions = (models: string[]): JobOptions => ({
    modelName: pickPreferredModel(models) || 'ggml-medium.bin',
    language: 'auto',
    vad: false,
    beamSize: 2,
    bestOf: 2,
    noFallback: true,
    threads: 4,
  });

  const [availableModels, setAvailableModels] = React.useState<string[]>([]);
  const [savedOptions, setSavedOptions] = React.useState<JobOptions>({
    modelName: 'ggml-medium.bin',
    language: 'auto',
    vad: false,
    beamSize: 2,
    bestOf: 2,
    noFallback: true,
    threads: 4,
  });
  const [draftOptions, setDraftOptions] = React.useState<JobOptions>(savedOptions);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSavedToast, setShowSavedToast] = React.useState(false);

  const [view, setView] = React.useState<AppView>('home');
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>('ADP');
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);

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
      } catch {
        // Ignore model discovery errors; fallback to manual defaults
      }
    };
    loadModelsAndSettings();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const payload = { transcriptionOptions: draftOptions };
      const response = await ipc.setSettings(payload);
      if (!response.success) {
        throw new Error(response.error || 'Failed to save settings');
      }
      setSavedOptions(draftOptions);
      setIsSettingsOpen(false);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNavigate = (nextView: AppView, payload?: { folder?: string; jobId?: string }) => {
    if (payload?.folder) {
      setSelectedFolder(payload.folder);
    }
    if (payload?.jobId) {
      setSelectedJobId(payload.jobId);
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
          <TranscriptScreen jobId={selectedJobId} />
        )}
      </AppShell>
      {isSettingsOpen && (
        <SettingsOverlay
          onClose={() => setIsSettingsOpen(false)}
          availableModels={availableModels}
          draftOptions={draftOptions}
          setDraftOptions={setDraftOptions}
          onSave={saveSettings}
          isSaving={isSaving}
        />
      )}
      {showSavedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border/70 bg-card px-4 py-2 text-[14px] text-foreground shadow-md">
          Transcription quality & speed saved.
        </div>
      )}
    </JobProvider>
  );
}

export default App;
