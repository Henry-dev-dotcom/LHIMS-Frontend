/*
  Reading a DICOM file in the browser.

  A modality burns a study to a CD or a USB stick and the radiographer wants to
  look at it. There is no PACS here and, for most of the facilities this is built
  for, there will not be one for a long time — so the pixels have to be decoded
  in the browser, from a file the person picks or from one attached to a report.

  What is supported, and why only this much:

    - Implicit and Explicit VR Little Endian, and Explicit VR Big Endian. These
      are what a modality writes when asked for uncompressed output, and are
      plain arrays of pixels once the header is parsed.
    - JPEG Baseline, which the browser itself can decode, so the work is handing
      the fragment to createImageBitmap.

  Anything else — JPEG 2000, JPEG-LS, RLE — needs a codec we would have to ship
  and maintain, and getting it subtly wrong means showing a clinician the wrong
  picture. So those are refused by name, with what to export instead, rather than
  rendered as something that might be plausible and wrong.

  Only the header is read up front. Frames are decoded when asked for and kept,
  so a multi-frame study scrolls without re-decoding and without holding every
  frame of a long series at once.
*/
import dicomParser from 'dicom-parser';

const TRANSFER_SYNTAX_NAMES = {
  '1.2.840.10008.1.2': 'Implicit VR Little Endian',
  '1.2.840.10008.1.2.1': 'Explicit VR Little Endian',
  '1.2.840.10008.1.2.2': 'Explicit VR Big Endian',
  '1.2.840.10008.1.2.4.50': 'JPEG Baseline',
  '1.2.840.10008.1.2.4.51': 'JPEG Extended',
  '1.2.840.10008.1.2.4.57': 'JPEG Lossless',
  '1.2.840.10008.1.2.4.70': 'JPEG Lossless (first-order prediction)',
  '1.2.840.10008.1.2.4.80': 'JPEG-LS Lossless',
  '1.2.840.10008.1.2.4.81': 'JPEG-LS Near-lossless',
  '1.2.840.10008.1.2.4.90': 'JPEG 2000 Lossless',
  '1.2.840.10008.1.2.4.91': 'JPEG 2000',
  '1.2.840.10008.1.2.5': 'RLE Lossless'
};

const UNCOMPRESSED = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2'];
const BIG_ENDIAN = '1.2.840.10008.1.2.2';
const JPEG_BASELINE = '1.2.840.10008.1.2.4.50';
const SUPPORTED_PHOTOMETRIC = ['MONOCHROME1', 'MONOCHROME2', 'RGB', 'YBR_FULL', 'YBR_FULL_422'];

/** DICOM dates are YYYYMMDD with no separators. */
function formatDicomDate(value) {
  return value && value.length === 8 ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value || '';
}

/**
 * Parses one DICOM file. Returns the study's details, its size, and a getFrame
 * that decodes a frame on demand. Throws with a message meant to be shown.
 */
export async function parseDicomBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let dataSet;
  try {
    dataSet = dicomParser.parseDicom(bytes);
  } catch {
    throw new Error('This is not a readable DICOM file.');
  }

  const str = (tag) => (dataSet.string(tag) || '').trim();
  const float = (tag, fallback) => {
    const value = dataSet.floatString(tag);
    return Number.isFinite(value) ? value : fallback;
  };

  const transferSyntax = str('x00020010') || '1.2.840.10008.1.2';
  const rows = dataSet.uint16('x00280010');
  const columns = dataSet.uint16('x00280011');
  const pixelData = dataSet.elements.x7fe00010;
  if (!pixelData || !rows || !columns) {
    throw new Error('This file holds no image — it may be a structured report or a DICOMDIR index.');
  }

  const bitsAllocated = dataSet.uint16('x00280100') || 16;
  const bitsStored = dataSet.uint16('x00280101') || bitsAllocated;
  const pixelIsSigned = (dataSet.uint16('x00280103') || 0) === 1;
  const samplesPerPixel = dataSet.uint16('x00280002') || 1;
  const photometric = str('x00280004') || 'MONOCHROME2';
  const isPlanar = (dataSet.uint16('x00280006') || 0) === 1;
  const numFrames = Math.max(1, parseInt(str('x00280008') || '1', 10) || 1);
  // Rescale turns stored values into real units, which is what Hounsfield
  // windowing on a CT depends on.
  const slope = float('x00281053', 1);
  const intercept = float('x00281052', 0);

  const info = {
    patientName: str('x00100010').replace(/\^/g, ' '),
    patientId: str('x00100020'),
    sex: str('x00100040'),
    age: str('x00101010'),
    modality: str('x00080060'),
    studyDate: formatDicomDate(str('x00080020')),
    studyDescription: str('x00081030'),
    seriesDescription: str('x0008103e'),
    bodyPart: str('x00180015'),
    institution: str('x00080080'),
    instanceNumber: str('x00200013'),
    sliceThickness: str('x00180050'),
    studyUid: str('x0020000d'),
    seriesUid: str('x0020000e'),
    instanceUid: str('x00080018'),
    rows,
    columns,
    bitsAllocated,
    bitsStored,
    photometric,
    numFrames,
    transferSyntax: TRANSFER_SYNTAX_NAMES[transferSyntax] || transferSyntax
  };

  if (!UNCOMPRESSED.includes(transferSyntax) && transferSyntax !== JPEG_BASELINE) {
    // The details are still worth showing even though the pixels cannot be, so
    // they ride along on the error.
    throw Object.assign(
      new Error(`This study is stored as ${TRANSFER_SYNTAX_NAMES[transferSyntax] || transferSyntax}, which the built-in viewer cannot decode. Export it as uncompressed (Explicit VR Little Endian) or JPEG Baseline and open it again.`),
      { info }
    );
  }
  if (!SUPPORTED_PHOTOMETRIC.includes(photometric)) {
    throw Object.assign(new Error(`This study uses "${photometric}" colour, which the built-in viewer cannot decode.`), { info });
  }

  const isGrayscale = samplesPerPixel === 1;
  const frames = new Map();

  function readUncompressedFrame(index) {
    const bytesPerSample = bitsAllocated / 8;
    const frameLength = rows * columns * samplesPerPixel * bytesPerSample;
    const offset = pixelData.dataOffset + index * frameLength;
    if (offset + frameLength > bytes.length) throw new Error('The pixel data in this file is incomplete.');
    // A copy, because the typed-array views below need their own aligned buffer.
    const slice = bytes.slice(offset, offset + frameLength);

    if (transferSyntax === BIG_ENDIAN && bytesPerSample > 1) {
      for (let i = 0; i < slice.length; i += bytesPerSample) slice.subarray(i, i + bytesPerSample).reverse();
    }

    if (isGrayscale) {
      let data;
      if (bitsAllocated === 8) data = pixelIsSigned ? new Int8Array(slice.buffer) : slice;
      else if (bitsAllocated === 16) data = pixelIsSigned ? new Int16Array(slice.buffer) : new Uint16Array(slice.buffer);
      else if (bitsAllocated === 32) data = pixelIsSigned ? new Int32Array(slice.buffer) : new Uint32Array(slice.buffer);
      else throw new Error(`This study stores ${bitsAllocated} bits per pixel, which the built-in viewer cannot decode.`);

      // Where fewer bits are used than allocated, the unused high bits are not
      // guaranteed to be zero, and left in place they wash the image out.
      if (!pixelIsSigned && bitsStored < bitsAllocated) {
        const mask = (1 << bitsStored) - 1;
        for (let i = 0; i < data.length; i += 1) data[i] &= mask;
      }
      return { grayscale: true, data, slope, intercept };
    }

    if (bitsAllocated !== 8) throw new Error('Only 8-bit colour studies can be decoded by the built-in viewer.');
    const pixels = rows * columns;
    const rgba = new Uint8ClampedArray(pixels * 4);
    for (let i = 0; i < pixels; i += 1) {
      let r;
      let g;
      let b;
      if (isPlanar) {
        r = slice[i];
        g = slice[i + pixels];
        b = slice[i + 2 * pixels];
      } else {
        r = slice[i * 3];
        g = slice[i * 3 + 1];
        b = slice[i * 3 + 2];
      }
      if (photometric.startsWith('YBR')) {
        const y = r;
        const cb = g - 128;
        const cr = b - 128;
        r = y + 1.402 * cr;
        g = y - 0.344136 * cb - 0.714136 * cr;
        b = y + 1.772 * cb;
      }
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = b;
      rgba[i * 4 + 3] = 255;
    }
    return { grayscale: false, data: rgba };
  }

  async function readJpegFrame(index) {
    let frameBytes;
    if (numFrames === 1) {
      frameBytes = dicomParser.readEncapsulatedPixelDataFromFragments(dataSet, pixelData, 0, pixelData.fragments.length);
    } else {
      // Without a basic offset table the fragments have to be walked to find
      // where each frame starts.
      const offsetTable = pixelData.basicOffsetTable?.length
        ? undefined
        : dicomParser.createJPEGBasicOffsetTable(dataSet, pixelData);
      frameBytes = dicomParser.readEncapsulatedImageFrame(dataSet, pixelData, index, offsetTable);
    }

    const bitmap = await createImageBitmap(new Blob([frameBytes], { type: 'image/jpeg' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    bitmap.close?.();

    if (!isGrayscale) return { grayscale: false, data: new Uint8ClampedArray(rgba) };
    // The browser gave back RGB; for a grayscale study every channel is the same.
    const data = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < data.length; i += 1) data[i] = rgba[i * 4];
    return { grayscale: true, data, slope: 1, intercept: 0 };
  }

  async function getFrame(index) {
    if (!frames.has(index)) {
      frames.set(index, transferSyntax === JPEG_BASELINE ? await readJpegFrame(index) : readUncompressedFrame(index));
    }
    return frames.get(index);
  }

  /*
    The window to open on. The file usually says, and that is what the modality
    intended. Where it does not, the first frame's own range is used, which is
    always better than a fixed guess: a CT and a plain film share no scale.
  */
  let windowCenter = dataSet.floatString('x00281050');
  let windowWidth = dataSet.floatString('x00281051');
  if (!isGrayscale) {
    windowCenter = 127.5;
    windowWidth = 256;
  } else if (!Number.isFinite(windowCenter) || !Number.isFinite(windowWidth) || windowWidth <= 1) {
    const frame = await getFrame(0);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < frame.data.length; i += 1) {
      const value = frame.data[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    min = min * frame.slope + frame.intercept;
    max = max * frame.slope + frame.intercept;
    windowCenter = (min + max) / 2;
    windowWidth = Math.max(1, max - min);
  }

  return {
    info,
    rows,
    columns,
    numFrames,
    getFrame,
    defaultWindow: { windowCenter, windowWidth },
    // MONOCHROME1 stores white as the low value, so it reads inverted.
    defaultInvert: photometric === 'MONOCHROME1'
  };
}

/**
 * Draws one frame through a window/level onto a 2D context sized rows x columns.
 * This is the hot path - it touches every pixel - so it stays a plain loop.
 */
export function renderFrame(context, frame, rows, columns, windowCenter, windowWidth, invert) {
  const image = context.createImageData(columns, rows);
  const out = image.data;
  const width = Math.max(1, windowWidth - 1);
  const centre = windowCenter - 0.5;

  if (frame.grayscale) {
    const { data, slope, intercept } = frame;
    for (let i = 0, j = 0; i < data.length; i += 1, j += 4) {
      let value = ((data[i] * slope + intercept - centre) / width + 0.5) * 255;
      value = value < 0 ? 0 : value > 255 ? 255 : value;
      if (invert) value = 255 - value;
      out[j] = value;
      out[j + 1] = value;
      out[j + 2] = value;
      out[j + 3] = 255;
    }
  } else {
    const source = frame.data;
    for (let j = 0; j < source.length; j += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        let value = ((source[j + channel] - centre) / width + 0.5) * 255;
        value = value < 0 ? 0 : value > 255 ? 255 : value;
        out[j + channel] = invert ? 255 - value : value;
      }
      out[j + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
}

/** Window presets, in the units a radiographer asks for them by. */
export const WINDOW_PRESETS = [
  { label: 'Soft tissue', windowCenter: 40, windowWidth: 400 },
  { label: 'Lung', windowCenter: -600, windowWidth: 1500 },
  { label: 'Bone', windowCenter: 300, windowWidth: 1500 },
  { label: 'Brain', windowCenter: 40, windowWidth: 80 },
  { label: 'Liver', windowCenter: 60, windowWidth: 160 }
];
