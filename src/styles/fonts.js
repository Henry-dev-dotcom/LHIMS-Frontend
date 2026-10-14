/*
  The app's fonts, served with the app instead of from Google.

  Loading them from fonts.googleapis.com meant every first visit waited on another company's
  servers before the page counted as loaded, and on a slow line that wait was seconds. Served from
  here they come with the build, are cached by the service worker with everything else, and still
  work when the internet is poor.

  Latin and Latin Extended only: Extended covers the Ghanaian letters (Ɛ, Ɔ and others) in patient
  names, and nothing else the app shows needs more.
*/
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-ext-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-ext-700.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-ext-400.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-ext-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-ext-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/plus-jakarta-sans/latin-ext-800.css';
