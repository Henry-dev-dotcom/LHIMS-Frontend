import { useCallback, useEffect, useRef, useState } from 'react';

/*
  Voice dictation, using the browser's own speech recognition (the Web Speech API).

  Nothing is recorded or kept by CurataMed: the words arrive as text and are put in the
  note the clinician is writing. But in Chrome and Edge the browser itself sends the audio
  to its maker's speech service to turn it into text, so patient details spoken aloud leave
  the building. That is the browser's behaviour and not ours to change, which is why the
  screen asks each clinician to acknowledge it once on a device before the microphone works.
*/

const ACK_KEY = 'curatamed.dictationAcknowledged';

export function dictationSupported() {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function dictationAcknowledged() {
  try {
    return window.localStorage.getItem(ACK_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function acknowledgeDictation() {
  try {
    window.localStorage.setItem(ACK_KEY, 'yes');
  } catch {
    // Without storage the notice simply returns next time.
  }
}

const ERRORS = {
  'not-allowed': 'The microphone is blocked. Allow it from the address bar and try again.',
  'service-not-allowed': 'The microphone is blocked. Allow it from the address bar and try again.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice dictation needs an internet connection.'
};

/** Starts and stops dictation; `onText` receives each finished phrase. */
export function useDictation({ onText }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognition = useRef(null);
  const handler = useRef(onText);

  useEffect(() => {
    handler.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Voice dictation is not available in this browser. Chrome or Edge will work.');
      return;
    }
    recognition.current?.abort?.();
    const next = new Recognition();
    next.continuous = true;
    next.interimResults = true;
    next.lang = 'en-GB';
    next.onresult = (event) => {
      let done = '';
      let partial = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) done += result[0].transcript;
        else partial += result[0].transcript;
      }
      setInterim(partial);
      if (done.trim()) handler.current?.(done.trim());
    };
    next.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') setError(ERRORS[event.error] || 'Voice dictation stopped unexpectedly.');
    };
    next.onend = () => {
      setListening(false);
      setInterim('');
    };
    setError('');
    next.start();
    recognition.current = next;
    setListening(true);
  }, []);

  useEffect(() => () => recognition.current?.abort?.(), []);

  return { supported: dictationSupported(), listening, interim, error, start, stop };
}
