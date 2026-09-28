// Checkbox list of department modules. Switching a module on also switches on
// what it depends on; switching one off also switches off what depends on it,
// so the selection always passes the backend's dependency check.
export function ModulePicker({ catalog, value, onChange, idPrefix = 'module' }) {
  const selected = new Set(value);

  function toggle(key) {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
      for (const module of catalog) if (module.dependsOn?.includes(key)) next.delete(module.key);
    } else {
      next.add(key);
      for (const dependency of catalog.find((m) => m.key === key)?.dependsOn || []) next.add(dependency);
    }
    onChange(catalog.map((m) => m.key).filter((k) => next.has(k)));
  }

  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Departments</legend>
      {catalog.map((module) => {
        const id = `${idPrefix}-${module.key}`;
        const requires = (module.dependsOn || []).map((key) => catalog.find((m) => m.key === key)?.name || key);
        return (
          <label key={module.key} htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm hover:border-clinical-300">
            <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-clinical-600" checked={selected.has(module.key)} onChange={() => toggle(module.key)} />
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{module.name}</span>
              <span className="block text-xs leading-5 text-slate-500">{module.description}</span>
              {requires.length > 0 && <span className="mt-0.5 block text-xs font-semibold text-slate-500">Requires {requires.join(', ')}</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
