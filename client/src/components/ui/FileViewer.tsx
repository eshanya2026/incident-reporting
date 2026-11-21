import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Download, ExternalLink, X, ZoomIn, ZoomOut, Maximize2, FileText, Loader2 } from 'lucide-react';

/**
 * In-app file viewer: attachments and reports open here first (image, PDF, text, audio/video
 * preview) with a Download button, instead of being downloaded straight away.
 */
interface ViewerFile {
  url: string; // object URL of the fetched file
  name: string;
  mimeType: string;
}

interface ViewerState {
  file: ViewerFile | null;
  loadingName: string | null;
  open: (file: ViewerFile) => void;
  loading: (name: string | null) => void;
  close: () => void;
}

export const useFileViewer = create<ViewerState>((set, get) => ({
  file: null,
  loadingName: null,
  open: (file) => {
    const prev = get().file;
    if (prev) URL.revokeObjectURL(prev.url);
    set({ file, loadingName: null });
  },
  loading: (name) => set({ loadingName: name }),
  close: () => {
    const prev = get().file;
    if (prev) setTimeout(() => URL.revokeObjectURL(prev.url), 1000);
    set({ file: null, loadingName: null });
  },
}));

/** Shows a fetched file in the viewer. */
export const showInViewer = (blob: Blob, name: string, mimeType?: string) => {
  const type = mimeType || blob.type || 'application/octet-stream';
  // Give the blob its real type so the browser can render it (PDF viewer, images...)
  const typed = blob.type === type ? blob : new Blob([blob], { type });
  useFileViewer.getState().open({ url: URL.createObjectURL(typed), name, mimeType: type });
};

const kindOf = (mime: string, name: string): 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'other' => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || ['txt', 'csv', 'log'].includes(ext)) return 'text';
  return 'other';
};

export default function FileViewer() {
  const { file, loadingName, close } = useFileViewer();
  const [zoom, setZoom] = useState(1);
  const [text, setText] = useState<string | null>(null);

  const kind = file ? kindOf(file.mimeType, file.name) : null;

  useEffect(() => {
    setZoom(1);
    setText(null);
    if (file && kind === 'text') {
      fetch(file.url)
        .then((r) => r.text())
        .then((t) => setText(t.slice(0, 200_000)))
        .catch(() => setText('Could not show this file.'));
    }
  }, [file, kind]);

  useEffect(() => {
    if (!file && !loadingName) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [file, loadingName, close]);

  if (!file && !loadingName) return null;

  const download = () => {
    if (!file) return;
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const btn =
    'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold transition cursor-pointer border border-white/20 bg-white/10 hover:bg-white/20 text-white';

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/85 backdrop-blur-sm flex flex-col" role="dialog" aria-modal="true" aria-label={file?.name || 'Opening file'}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5 border-b border-white/10 bg-slate-900/80">
        <FileText className="w-4 h-4 text-white/70 shrink-0" />
        <span className="text-sm font-semibold text-white truncate flex-1 min-w-0" title={file?.name || loadingName || ''}>
          {file?.name || loadingName}
        </span>
        {file && kind === 'image' && (
          <div className="hidden sm:flex items-center gap-1">
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="Zoom out" aria-label="Zoom out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-white/80 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))} title="Zoom in" aria-label="Zoom in">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button type="button" className={btn} onClick={() => setZoom(1)} title="Fit to screen" aria-label="Fit to screen">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {file && (
          <>
            <a href={file.url} target="_blank" rel="noopener noreferrer" className={`${btn} hidden sm:inline-flex`} title="Open in a new tab">
              <ExternalLink className="w-4 h-4" /> <span className="hidden md:inline">New tab</span>
            </a>
            <button type="button" className={`${btn} !bg-white !text-[#5C1A22] !border-white hover:!bg-[#FAF3EC]`} onClick={download}>
              <Download className="w-4 h-4" /> Download
            </button>
          </>
        )}
        <button type="button" className={btn} onClick={close} title="Close (Esc)" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto" onMouseDown={(e) => e.target === e.currentTarget && close()}>
        {!file ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Opening…</span>
          </div>
        ) : kind === 'image' ? (
          <div className="min-h-full flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <img
              src={file.url}
              alt={file.name}
              className="shadow-2xl rounded-lg bg-white"
              style={zoom === 1 ? { maxWidth: '100%', maxHeight: 'calc(100vh - 110px)', objectFit: 'contain' } : { width: `${zoom * 100}%`, maxWidth: 'none' }}
            />
          </div>
        ) : kind === 'pdf' ? (
          <iframe src={file.url} title={file.name} className="w-full h-full bg-white" />
        ) : kind === 'video' ? (
          <div className="h-full flex items-center justify-center p-4">
            <video src={file.url} controls className="max-w-full max-h-full rounded-lg" />
          </div>
        ) : kind === 'audio' ? (
          <div className="h-full flex items-center justify-center p-4">
            <audio src={file.url} controls />
          </div>
        ) : kind === 'text' ? (
          <pre className="m-4 p-4 bg-white rounded-lg text-sm text-slate-800 whitespace-pre-wrap break-words">{text ?? 'Loading…'}</pre>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <FileText className="w-14 h-14 text-white/60" />
            <div>
              <p className="text-white font-semibold">{file.name}</p>
              <p className="text-white/70 text-sm mt-1">This type of file can't be shown in the browser. Download it to open it.</p>
            </div>
            <button type="button" onClick={download} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#5C1A22] font-semibold text-sm cursor-pointer">
              <Download className="w-4 h-4" /> Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
