import React from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { JobOptions } from '../../../shared/types';

type ModeKey = 'fast' | 'balanced' | 'accurate';

interface SettingsOverlayProps {
  onClose: () => void;
  availableModels: string[];
  draftOptions: JobOptions;
  setDraftOptions: React.Dispatch<React.SetStateAction<JobOptions>>;
}

const findPreferredBalancedModel = (models: string[]) => {
  const lower = models.map((name) => name.toLowerCase());
  const index = lower.findIndex((name) => name.includes('medium') && name.includes('q5'));
  if (index >= 0) return models[index];
  const mediumIndex = lower.findIndex((name) => name.includes('medium'));
  if (mediumIndex >= 0) return models[mediumIndex];
  const smallQ8Index = lower.findIndex((name) => name.includes('small') && name.includes('q8'));
  if (smallQ8Index >= 0) return models[smallQ8Index];
  const smallIndex = lower.findIndex((name) => name.includes('small'));
  return smallIndex >= 0 ? models[smallIndex] : models[0];
};

const findBestModel = (models: string[]) => {
  const lower = models.map((name) => name.toLowerCase());
  const pick = (keyword: string) => {
    const index = lower.findIndex((name) => name.includes(keyword));
    return index >= 0 ? models[index] : undefined;
  };
  return pick('large') || pick('medium') || pick('base') || pick('small') || models[0];
};

export function SettingsOverlay({
  onClose,
  availableModels,
  draftOptions,
  setDraftOptions,
}: SettingsOverlayProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [selectedMode, setSelectedMode] = React.useState<ModeKey | 'custom'>('balanced');

  const presets = React.useMemo(() => {
    const balancedModel = findPreferredBalancedModel(availableModels);
    return {
      fast: {
        modelName: balancedModel,
        language: 'auto',
        threads: 8,
        beamSize: 1,
        bestOf: 1,
      },
      balanced: {
        modelName: balancedModel,
        language: 'auto',
        threads: 6,
        beamSize: 1,
        bestOf: 1,
      },
      accurate: {
        modelName: findBestModel(availableModels),
        language: 'auto',
        threads: 6,
        beamSize: 5,
        bestOf: 5,
      },
    } as Record<ModeKey, Partial<JobOptions>>;
  }, [availableModels]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const applyMode = (mode: ModeKey) => {
    setSelectedMode(mode);
    setDraftOptions((prev) => ({
      ...prev,
      ...presets[mode],
    }));
  };

  React.useEffect(() => {
    const matchesPreset = (preset: Partial<JobOptions>) => (
      preset.modelName === draftOptions.modelName &&
      preset.language === (draftOptions.language || 'auto') &&
      preset.threads === draftOptions.threads &&
      preset.beamSize === draftOptions.beamSize &&
      preset.bestOf === draftOptions.bestOf
    );
    if (matchesPreset(presets.fast)) {
      setSelectedMode('fast');
    } else if (matchesPreset(presets.balanced)) {
      setSelectedMode('balanced');
    } else if (matchesPreset(presets.accurate)) {
      setSelectedMode('accurate');
    } else {
      setSelectedMode('custom');
    }
  }, [draftOptions, presets]);

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-start justify-center bg-black/30 px-6 py-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border/70 bg-card p-6 shadow-xl max-h-[82vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold">Settings</h2>
            <p className="text-[14px] text-muted-foreground">Adjust transcription quality and speed.</p>
          </div>
          <button
            className="tooltip close-button rounded-md border border-border/60 bg-background px-2 py-1 text-muted-foreground hover:bg-muted"
            data-tooltip="Close"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-[16px] font-medium mb-3">Transcription quality & speed</h3>
            <div className="grid gap-3">
              {([
                {
                  key: 'fast',
                  title: 'Fast',
                  desc: 'Quick results • Lower accuracy • ~0.5× audio length',
                },
                {
                  key: 'balanced',
                  title: 'Balanced (default)',
                  desc: 'Recommended • ~1× audio length',
                },
                {
                  key: 'accurate',
                  title: 'Accurate',
                  desc: 'Highest quality • Slower • ~2× audio length',
                },
              ] as const).map((item) => {
                const isActive = selectedMode === item.key;
                return (
                  <button
                    key={item.key}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
                      isActive ? 'border-[#9DBAE6] bg-[#9DBAE6]/15 text-[#9DBAE6]' : 'border-border/70 bg-background'
                    }`}
                    onClick={() => applyMode(item.key)}
                    type="button"
                  >
                    <div>
                      <p className={`text-[15px] font-medium ${isActive ? 'text-[#9DBAE6]' : 'text-foreground'}`}>
                        {item.title}
                      </p>
                      <p className="text-[13px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <button
              className="flex items-center gap-2 text-[15px] text-muted-foreground hover:text-foreground"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              type="button"
            >
              {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Advanced settings
              {selectedMode === 'custom' && (
                <span className="ml-2 rounded-full border border-[#9DBAE6] px-2 py-0.5 text-[13px] text-[#9DBAE6]">
                  Selected
                </span>
              )}
            </button>
            {advancedOpen && (
              <div className="mt-3 rounded-lg border border-border/70 bg-background p-4">
                <div className="grid gap-4">
                  <div>
                    <p className="text-[13px] text-muted-foreground mb-1">Model</p>
                    <select
                      className="w-full rounded-md border border-border/70 bg-card px-2 py-1 text-[14px]"
                      value={draftOptions.modelName || ''}
                      onChange={(event) => setDraftOptions((prev) => ({ ...prev, modelName: event.target.value }))}
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[13px] text-muted-foreground mb-1">Threads</p>
                      <input
                        type="number"
                        className="w-full rounded-md border border-border/70 bg-card px-2 py-1 text-[14px]"
                        value={draftOptions.threads ?? ''}
                        onChange={(event) => setDraftOptions((prev) => ({ ...prev, threads: event.target.value ? Number(event.target.value) : undefined }))}
                        min={1}
                        max={32}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[13px] text-muted-foreground mb-1">Beam size</p>
                      <input
                        type="number"
                        className="w-full rounded-md border border-border/70 bg-card px-2 py-1 text-[14px]"
                        value={draftOptions.beamSize ?? ''}
                        onChange={(event) => setDraftOptions((prev) => ({ ...prev, beamSize: event.target.value ? Number(event.target.value) : undefined }))}
                        min={1}
                        max={10}
                      />
                    </div>
                    <div>
                      <p className="text-[13px] text-muted-foreground mb-1">Best of</p>
                      <input
                        type="number"
                        className="w-full rounded-md border border-border/70 bg-card px-2 py-1 text-[14px]"
                        value={draftOptions.bestOf ?? ''}
                        onChange={(event) => setDraftOptions((prev) => ({ ...prev, bestOf: event.target.value ? Number(event.target.value) : undefined }))}
                        min={1}
                        max={10}
                      />
                    </div>
                  </div>

                  <div className="text-[13px] text-muted-foreground">
                    Language stays on auto. VAD and fallback are managed automatically.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
