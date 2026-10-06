import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Contrast, Info, Maximize, Move, Pause, Play, RotateCcw, SunMedium, X, ZoomIn, ZoomOut
} from 'lucide-react';
import { WINDOW_PRESETS, parseDicomBuffer, renderFrame } from '../../dicom/dicomImage';

/*
  The DICOM viewport.

  Takes `sources`: [{ key, name, load: () => Promise<ArrayBuffer> }]. Where they
  come from is the caller's business - a report's attachments, or a folder on a
  CD the radiographer just put in - so the same viewport serves both.

  The controls are the ones a radiographer reaches for without being told:

    drag            window and level, which is the one that matters most
    wheel           through the images, or the frames of a cine loop
    ctrl + wheel    zoom
    middle drag     pan, right drag zoom, whichever tool is selected
    arrow keys      step through, Escape closes

  Window and level deserve a note: dragging left-right widens or narrows the
  window and up-down moves the level, with sensitivity scaled to the current
  width so the gesture feels the same on a CT in Hounsfield units as on an
  ultrasound in bytes. Once it has been touched by hand it is not reset when
  moving between images in a series, because the whole point of setting it is to
  compare like with like.
*/
export function DicomViewer({ sources = [], title, onClose }) {
  const [index, setIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [image, setImage] = useState(null);
  const [grayscale, setGrayscale] = useState(false);
  const [error, setError] = useState('');
  const [errorInfo, setErrorInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [windowing, setWindowing] = useState({ windowCenter: 0, windowWidth: 1 });
  const [touchedWindow, setTouchedWindow] = useState(false);
  const [invert, setInvert] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fit, setFit] = useState(1);
  const [tool, setTool] = useState('window');
  const [playing, setPlaying] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const parsedCache = useRef(new Map());
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const frameRef = useRef(null);
  const touchedWindowRef = useRef(false);
  touchedWindowRef.current = touchedWindow;

  const computeFit = useCallback((parsed) => {
    const viewport = viewportRef.current;
    if (!viewport || !parsed) return;
    setFit(Math.min(viewport.clientWidth / parsed.columns, viewport.clientHeight / parsed.rows) * 0.96);
  }, []);

  // Load and decode the selected file. Parsed studies are kept, so stepping
  // back and forth through a series does not decode the same file twice.
  useEffect(() => {
    if (!sources.length) {
      setImage(null);
      return undefined;
    }
    let cancelled = false;
    const source = sources[Math.min(index, sources.length - 1)];
    setLoading(true);
    setError('');
    setErrorInfo(null);

    (async () => {
      try {
        let parsed = parsedCache.current.get(source.key);
        if (!parsed) {
          parsed = await parseDicomBuffer(await source.load());
          parsedCache.current.set(source.key, parsed);
        }
        if (cancelled) return;
        setImage((previous) => {
          // A different size is a different picture, so the view starts over.
          if (!previous || previous.rows !== parsed.rows || previous.columns !== parsed.columns) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }
          return parsed;
        });
        setFrameIndex(0);
        if (!touchedWindowRef.current) {
          setWindowing(parsed.defaultWindow);
          setInvert(parsed.defaultInvert);
        }
        computeFit(parsed);
      } catch (caught) {
        if (cancelled) return;
        setImage(null);
        setError(caught.message || 'This file could not be opened.');
        // A study whose pixels we cannot decode can still say what it is.
        setErrorInfo(caught.info || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [index, sources, computeFit]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !frameRef.current) return;
    canvas.width = image.columns;
    canvas.height = image.rows;
    renderFrame(canvas.getContext('2d'), frameRef.current, image.rows, image.columns, windowing.windowCenter, windowing.windowWidth, invert);
  }, [image, windowing, invert]);

  // Decode the frame being shown, then draw it.
  useEffect(() => {
    if (!image) return undefined;
    let cancelled = false;
    image.getFrame(frameIndex)
      .then((frame) => {
        if (cancelled) return;
        frameRef.current = frame;
        setGrayscale(frame.grayscale);
        draw();
      })
      .catch((caught) => { if (!cancelled) setError(caught.message); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, frameIndex]);

  // Windowing changes on every mouse move, so redraw on a frame rather than
  // once per event.
  useEffect(() => {
    const handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [draw]);

  useEffect(() => {
    const onResize = () => computeFit(image);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [image, computeFit]);
  useEffect(() => { computeFit(image); }, [showTags, image, computeFit]);

  const multiFrame = Boolean(image && image.numFrames > 1);

  /* Within a cine loop, step frames; otherwise step through the series. */
  const step = useCallback((delta) => {
    if (multiFrame) setFrameIndex((current) => (current + delta + image.numFrames) % image.numFrames);
    else if (sources.length > 1) setIndex((current) => (current + delta + sources.length) % sources.length);
  }, [multiFrame, image, sources.length]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => step(1), 100);
    return () => window.clearInterval(timer);
  }, [playing, step]);

  // Non-passive, because scrolling the page instead of the series is useless.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      if (event.ctrlKey) setZoom((current) => Math.min(20, Math.max(0.1, current * (event.deltaY < 0 ? 1.1 : 0.9))));
      else step(event.deltaY > 0 ? 1 : -1);
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [step]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') step(-1);
      if (event.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, onClose]);

  function onPointerDown(event) {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // The middle and right buttons pan and zoom whatever tool is selected,
    // which is how every other viewer behaves.
    const mode = event.button === 2 ? 'zoom' : event.button === 1 ? 'pan' : tool;
    dragRef.current = { x: event.clientX, y: event.clientY, mode, windowing: { ...windowing }, pan: { ...pan }, zoom };
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (drag.mode === 'window') {
      // Scaled to the current width so the gesture feels the same whatever the
      // units: a CT in Hounsfield numbers, an ultrasound in bytes.
      const sensitivity = Math.max(drag.windowing.windowWidth / 300, 0.25);
      setWindowing({
        windowWidth: Math.max(1, drag.windowing.windowWidth + dx * sensitivity),
        windowCenter: drag.windowing.windowCenter + dy * sensitivity
      });
      setTouchedWindow(true);
    } else if (drag.mode === 'pan') {
      setPan({ x: drag.pan.x + dx, y: drag.pan.y + dy });
    } else {
      setZoom(Math.min(20, Math.max(0.1, drag.zoom * Math.exp(-dy / 200))));
    }
  }

  const onPointerUp = () => { dragRef.current = null; };

  function reset() {
    if (!image) return;
    setWindowing(image.defaultWindow);
    setInvert(image.defaultInvert);
    setTouchedWindow(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    computeFit(image);
  }

  function applyPreset(value) {
    if (value === '') return;
    if (value === 'default') {
      setWindowing(image.defaultWindow);
      setTouchedWindow(false);
      return;
    }
    const preset = WINDOW_PRESETS[Number(value)];
    if (!preset) return;
    setWindowing({ windowCenter: preset.windowCenter, windowWidth: preset.windowWidth });
    setTouchedWindow(true);
  }

  const info = image?.info || errorInfo;
  const scale = fit * zoom;
  const toolButton = (id, label, Icon, hint) => (
    <button
      type="button"
      onClick={() => setTool(id)}
      title={hint}
      aria-pressed={tool === id}
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${tool === id ? 'bg-clinical-500 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
    </button>
  );
  const plainButton = 'inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.25rem] bg-slate-950 text-slate-100">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 p-2">
        {title && <strong className="mr-1 truncate text-sm">{title}</strong>}
        {toolButton('window', 'W/L', SunMedium, 'Drag to adjust window and level')}
        {toolButton('pan', 'Pan', Move, 'Drag to pan')}
        {toolButton('zoom', 'Zoom', ZoomIn, 'Drag up and down to zoom')}
        <span className="mx-1 h-5 w-px bg-slate-700" />
        <button type="button" className={plainButton} onClick={() => setZoom((z) => Math.min(20, z * 1.25))} title="Zoom in" aria-label="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
        <button type="button" className={plainButton} onClick={() => setZoom((z) => Math.max(0.1, z / 1.25))} title="Zoom out" aria-label="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
        <button type="button" className={plainButton} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); computeFit(image); }} title="Fit to window" aria-label="Fit to window"><Maximize className="h-3.5 w-3.5" /></button>
        <button type="button" className={`${plainButton} ${invert ? 'ring-2 ring-clinical-400' : ''}`} onClick={() => setInvert((v) => !v)} title="Invert"><Contrast className="h-3.5 w-3.5" /> Invert</button>
        <select
          className="rounded-xl bg-slate-800 px-2 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-40"
          value=""
          onChange={(event) => applyPreset(event.target.value)}
          disabled={!image || !grayscale}
          aria-label="Window preset"
        >
          <option value="">Presets</option>
          <option value="default">As stored</option>
          {WINDOW_PRESETS.map((preset, position) => <option key={preset.label} value={position}>{preset.label}</option>)}
        </select>
        <button type="button" className={plainButton} onClick={reset} title="Reset"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
        <span className="mx-1 h-5 w-px bg-slate-700" />
        <button type="button" className={plainButton} onClick={() => step(-1)} disabled={!multiFrame && sources.length < 2} aria-label="Previous image"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <button type="button" className={plainButton} onClick={() => setPlaying((p) => !p)} disabled={!multiFrame && sources.length < 2}>
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? 'Stop' : 'Cine'}
        </button>
        <button type="button" className={plainButton} onClick={() => step(1)} disabled={!multiFrame && sources.length < 2} aria-label="Next image"><ChevronRight className="h-3.5 w-3.5" /></button>
        {multiFrame && (
          <input
            type="range"
            className="ml-1 w-32"
            min={0}
            max={image.numFrames - 1}
            value={frameIndex}
            onChange={(event) => setFrameIndex(Number(event.target.value))}
            aria-label="Frame"
          />
        )}
        <span className="flex-1" />
        <button type="button" className={`${plainButton} ${showTags ? 'ring-2 ring-clinical-400' : ''}`} onClick={() => setShowTags((v) => !v)}><Info className="h-3.5 w-3.5" /> Tags</button>
        {onClose && <button type="button" className={plainButton} onClick={onClose}><X className="h-3.5 w-3.5" /> Close</button>}
      </div>

      <div className="flex min-h-0 flex-1">
        {sources.length > 1 && (
          <div className="hidden w-44 shrink-0 overflow-y-auto border-r border-slate-800 p-1.5 sm:block">
            {sources.map((source, position) => (
              <button
                key={source.key}
                type="button"
                onClick={() => setIndex(position)}
                className={`mb-1 block w-full truncate rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition ${position === index ? 'bg-clinical-500 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                {position + 1}. {source.name}
              </button>
            ))}
          </div>
        )}

        <div
          ref={viewportRef}
          className="relative min-h-[320px] flex-1 overflow-hidden bg-black"
          style={{ touchAction: 'none', cursor: tool === 'pan' ? 'grab' : tool === 'zoom' ? 'zoom-in' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(event) => event.preventDefault()}
        >
          {image && !error && (
            <canvas
              ref={canvasRef}
              className="absolute left-1/2 top-1/2 origin-center"
              style={{
                width: image.columns,
                height: image.rows,
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
                imageRendering: scale > 2 ? 'pixelated' : 'auto'
              }}
            />
          )}

          {!sources.length && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-400">No images to show.</p>}
          {loading && !image && <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Opening…</p>}
          {error && (
            <div role="alert" className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md rounded-2xl bg-slate-900/90 p-4 text-center">
                <p className="font-bold text-rose-300">This image cannot be shown</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{error}</p>
              </div>
            </div>
          )}

          {/* The corner overlays a radiographer expects: who, what, and how it is windowed. */}
          {image && !error && info && (
            <>
              <pre className="pointer-events-none absolute left-2 top-2 whitespace-pre-wrap font-sans text-[11px] leading-4 text-slate-300/90">
                {[info.patientName, info.patientId, [info.sex, info.age].filter(Boolean).join(' ')].filter(Boolean).join('\n')}
              </pre>
              <pre className="pointer-events-none absolute right-2 top-2 whitespace-pre-wrap text-right font-sans text-[11px] leading-4 text-slate-300/90">
                {[info.institution, info.studyDescription, info.seriesDescription, [info.modality, info.bodyPart].filter(Boolean).join(' · '), info.studyDate].filter(Boolean).join('\n')}
              </pre>
              <pre className="pointer-events-none absolute bottom-2 left-2 whitespace-pre-wrap font-sans text-[11px] leading-4 text-slate-300/90">
                {`W ${Math.round(windowing.windowWidth)}  L ${Math.round(windowing.windowCenter)}${invert ? '  (inverted)' : ''}\nZoom ${Math.round(scale * 100)}%`}
              </pre>
              <pre className="pointer-events-none absolute bottom-2 right-2 whitespace-pre-wrap text-right font-sans text-[11px] leading-4 text-slate-300/90">
                {[`Image ${index + 1}/${sources.length}`, multiFrame ? `Frame ${frameIndex + 1}/${image.numFrames}` : '', `${info.columns} × ${info.rows}`].filter(Boolean).join('\n')}
              </pre>
            </>
          )}
        </div>

        {showTags && (
          <div className="w-60 shrink-0 overflow-y-auto border-l border-slate-800 p-2 text-[11px]">
            {info ? Object.entries(info).filter(([, value]) => value !== '' && value != null).map(([key, value]) => (
              <div key={key} className="border-b border-slate-800 py-1 last:border-b-0">
                <span className="block text-slate-500">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                <span className="break-words font-semibold text-slate-200">{String(value)}</span>
              </div>
            )) : <p className="text-slate-500">Nothing to show.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
