import { useEffect, useState } from 'react';
import { publicService } from '../../services/publicService';

let cached = null;

/** Plans, add-on prices and department descriptions from the public pricing API. */
export function useCatalogue() {
  const [state, setState] = useState(() => ({ data: cached, loading: !cached, error: '' }));
  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;
    publicService.catalogue()
      .then((data) => { cached = data; if (!cancelled) setState({ data, loading: false, error: '' }); })
      .catch((error) => { if (!cancelled) setState({ data: null, loading: false, error: error?.message || 'Prices could not be loaded. Check your connection and try again.' }); });
    return () => { cancelled = true; };
  }, []);
  return state;
}
