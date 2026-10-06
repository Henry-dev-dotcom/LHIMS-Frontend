import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, HardDrive, Monitor, Upload } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DicomViewer } from '../../components/dicom/DicomViewer';
import { useAppStore } from '../../store/AppStore';
import { requestArrayBuffer } from '../../api/apiClient';
import { getScanOrders } from '../../utils/orderViews';
import { formatDateTime } from '../../utils/formatters';

/*
  Looking at images.

  Two ways in, because both happen:

    - A study attached to a report in this system, opened from the report.
    - A disc or a stick the modality wrote, opened straight off it. Most of the
      facilities this is built for have no PACS and will not have one soon; the
      CT writes a CD and somebody carries it. Those files never touch the server,
      which is also why there is no size limit on this path.

  Files are read as they are asked for rather than all at once, so putting in a
  folder of four hundred slices costs nothing until they are looked at.
*/

const DICOM_HINT = '.dcm, .DCM, or files with no extension, as a modality writes them';

/** A modality often writes DICOM with no extension at all, so suffix is a hint, not a rule. */
function looksLikeDicom(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.dcm') || name.endsWith('.dicom')) return true;
  if (name === 'dicomdir') return false;
  return !name.includes('.');
}

export function DicomViewerPage() {
  const { state } = useAppStore();
  const [localSources, setLocalSources] = useState([]);
  const [attachedId, setAttachedId] = useState(state.ui.activeDicomResultId || '');
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Reports in this facility that have DICOM attached, newest first.
  const studies = useMemo(() => {
    const orders = getScanOrders(state.data);
    return (state.data.scanAcceptances || [])
      .filter((acceptance) => acceptance.dicomCount > 0)
      .map((acceptance) => {
        const order = orders.find((candidate) => candidate.id === acceptance.orderId) || null;
        return { acceptance, order };
      })
      .sort((a, b) => String(b.acceptance.acceptedAt || '').localeCompare(String(a.acceptance.acceptedAt || '')));
  }, [state.data]);

  const activeStudy = studies.find((entry) => entry.acceptance.id === attachedId) || null;

  // The attachments are named on the study; each file's bytes are fetched only
  // when the viewer reaches it.
  const attachedSources = useMemo(() => (activeStudy?.acceptance.dicomFiles || []).map((file) => ({
    key: file.id,
    name: file.fileName,
    load: () => requestArrayBuffer(`/files/${file.id}/download`)
  })), [activeStudy]);

  const addFiles = useCallback((fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const usable = picked.filter(looksLikeDicom);
    const skipped = picked.length - usable.length;
    if (!usable.length) {
      setNotice(`None of those ${picked.length} file(s) look like DICOM images. Expected ${DICOM_HINT}.`);
      return;
    }
    setNotice(skipped > 0 ? `${usable.length} image(s) opened. ${skipped} other file(s) were left out.` : '');
    setAttachedId('');
    setLocalSources(usable
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((file) => ({
        key: `${file.name}:${file.size}:${file.lastModified}`,
        name: file.name,
        load: () => file.arrayBuffer()
      })));
  }, []);

  // Dropping a folder anywhere on the page opens it, which is what a person
  // holding a disc expects to be able to do.
  useEffect(() => {
    const onDragOver = (event) => { event.preventDefault(); setDragging(true); };
    const onDragLeave = (event) => { if (event.relatedTarget === null) setDragging(false); };
    const onDrop = (event) => {
      event.preventDefault();
      setDragging(false);
      addFiles(event.dataTransfer?.files);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [addFiles]);

  const sources = localSources.length ? localSources : attachedSources;
  const title = localSources.length
    ? `${localSources.length} image(s) from this computer`
    : activeStudy
      ? `${activeStudy.acceptance.testName} · ${activeStudy.order?.patient?.fullName || ''}`
      : '';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Imaging · Viewer"
        title="DICOM Viewer"
        description="Open a study attached to a report, or read one straight off a disc or USB stick. Drag the folder anywhere on this page."
        actions={(
          <>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Open files
            </Button>
            <Button variant="secondary" onClick={() => folderInputRef.current?.click()}>
              <FolderOpen className="h-4 w-4" /> Open a folder
            </Button>
          </>
        )}
      />

      {/* Kept out of the accessibility tree but driven by the buttons above. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        aria-label="Open DICOM files"
        onChange={(event) => addFiles(event.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        webkitdirectory=""
        directory=""
        className="sr-only"
        aria-label="Open a DICOM folder"
        onChange={(event) => addFiles(event.target.files)}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-6">
          <p className="rounded-3xl bg-white px-6 py-4 text-lg font-bold text-slate-900 shadow-lift">Drop the images to open them</p>
        </div>
      )}

      {notice && <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{notice}</p>}

      <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
        <Card title="Studies in this facility" subtitle="Reports with DICOM attached." compact>
          {studies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
              <HardDrive className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-slate-900">No attached studies yet.</p>
              <p className="mt-1 text-xs text-slate-500">Attach images when writing a report, or open a disc with the buttons above.</p>
            </div>
          ) : (
            <div className="max-h-[22rem] space-y-1.5 overflow-y-auto">
              {studies.map(({ acceptance, order }) => {
                const selected = acceptance.id === attachedId && !localSources.length;
                return (
                  <button
                    key={acceptance.id}
                    type="button"
                    onClick={() => { setLocalSources([]); setNotice(''); setAttachedId(acceptance.id); }}
                    className={`block w-full rounded-2xl border p-3 text-left transition ${selected ? 'border-clinical-400 bg-clinical-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <span className="block truncate font-bold text-slate-900">{order?.patient?.fullName || 'Unknown patient'}</span>
                    <span className="block truncate text-xs font-semibold text-slate-500">{acceptance.testName}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-slate-500">
                      {acceptance.dicomCount} image(s){acceptance.acceptedAt ? ` · ${formatDateTime(acceptance.acceptedAt)}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {localSources.length > 0 && (
            <div className="mt-3 rounded-2xl border border-clinical-200 bg-clinical-50 p-3">
              <p className="text-sm font-bold text-clinical-900">{localSources.length} image(s) open from this computer</p>
              <p className="mt-1 text-xs text-clinical-800">These are read on this machine and are not uploaded.</p>
              <div className="mt-2"><Button size="sm" variant="secondary" onClick={() => { setLocalSources([]); setNotice(''); }}>Close them</Button></div>
            </div>
          )}
        </Card>

        <div className="min-h-[34rem]">
          {sources.length === 0 ? (
            <Card title="Nothing open" subtitle="Choose a study on the left, or open a disc or folder.">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                <Monitor className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
                <p className="mt-3 font-bold text-slate-900">No images to show</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  The viewer reads uncompressed and JPEG Baseline DICOM. Anything else is named and refused rather than guessed at.
                </p>
              </div>
            </Card>
          ) : (
            <div className="h-[36rem]"><DicomViewer sources={sources} title={title} /></div>
          )}
        </div>
      </div>
    </div>
  );
}
