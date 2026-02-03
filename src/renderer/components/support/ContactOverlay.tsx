import React from 'react';
import { X, AlertTriangle, Lightbulb } from 'lucide-react';
import * as ipc from '../../utils/ipc';

type ContactMode = 'bug' | 'feature';

interface ContactOverlayProps {
  onClose: () => void;
}

const emailAddress = 'larrywallendael@hotmail.com';

export function ContactOverlay({ onClose }: ContactOverlayProps) {
  const [mode, setMode] = React.useState<ContactMode>('bug');
  const [details, setDetails] = React.useState('');
  const [isBlocking, setIsBlocking] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const openExternal = async (url: string) => {
    try {
      if (ipc.isAvailable()) {
        const response = await ipc.openExternal(url);
        if (response.success) {
          return;
        }
      }
    } catch {
      // ignore
    }
    alert('Unable to open the external app. Please restart LocalScribe and try again.');
  };

  const buildMail = async () => {
    const subject = mode === 'bug' ? 'LocalScribe Bug Report' : 'LocalScribe Feature Request';
    const lines = [
      mode === 'bug' ? 'Report a bug' : 'Feature request',
      '',
      details || 'No details provided.',
      '',
      `Blocking: ${isBlocking ? 'Yes' : 'No'}`,
      '',
      '',
      'Tip: If it helps, please attach a screenshot or short video.',
    ];
    const body = encodeURIComponent(lines.join('\n'));
    const mailto = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${body}`;
    await openExternal(mailto);
  };

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-start justify-center bg-black/30 px-6 py-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border/70 bg-card p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'bug' ? <AlertTriangle className="h-4 w-4 text-muted-foreground" /> : <Lightbulb className="h-4 w-4 text-muted-foreground" />}
            <h2 className="text-[20px] font-semibold">Contact us</h2>
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

        <div className="mt-4 inline-flex rounded-full border border-border/70 bg-background p-1 text-[14px]">
          <button
            className={`flex items-center gap-2 rounded-full px-3 py-1 ${mode === 'bug' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
            onClick={() => setMode('bug')}
            type="button"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Problem
          </button>
          <button
            className={`flex items-center gap-2 rounded-full px-3 py-1 ${mode === 'feature' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
            onClick={() => setMode('feature')}
            type="button"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Feature request
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <p className="text-[15px] font-medium">{mode === 'bug' ? 'Report a bug' : 'Feature request'}</p>
            <p className="text-[13px] text-muted-foreground">
              {mode === 'bug'
                ? 'What steps led to the bug? What happened vs. what you expected?'
                : 'Describe the idea and how it would help your workflow.'}
            </p>
          </div>
          <textarea
            className="min-h-[140px] w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-[14px] outline-none"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={
              mode === 'bug'
                ? 'Steps...\nExpected...\nActual...\nAttempts to fix...'
                : 'Describe the feature, the benefit, and any examples.'
            }
          />
          {mode === 'bug' && (
            <label className="flex items-center gap-2 text-[14px] text-muted-foreground">
              <input
                type="checkbox"
                checked={isBlocking}
                onChange={(event) => setIsBlocking(event.target.checked)}
              />
              This bug completely blocks me from using LocalScribe
            </label>
          )}
          <div className="flex items-center justify-between">
            <span />
            <button
              className="rounded-md border border-border/70 bg-foreground px-4 py-2 text-[14px] text-background hover:opacity-90"
              onClick={buildMail}
              type="button"
            >
              {mode === 'bug' ? 'Report bug' : 'Send request'}
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Got a question? email us at{' '}
            <button
              className="underline underline-offset-2"
              onClick={() => openExternal(`mailto:${emailAddress}`)}
              type="button"
            >
              {emailAddress}
            </button>{' '}
            or via{' '}
            <button
              className="underline underline-offset-2"
              onClick={() => openExternal('https://linkedin.com/in/larryvanwallendael')}
              type="button"
            >
              linkedin
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
