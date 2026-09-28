import { FormField, inputClass } from '../../components/ui/FormField';

const SEX_OK = (ward, gender) => {
  const sex = String(gender || '').toUpperCase();
  return ward.gender === 'MIXED' || !['MALE', 'FEMALE'].includes(sex) || ward.gender === sex;
};

/** Ward and bed selectors limited to active wards that suit the patient, and to free beds. */
export function BedPicker({ wards, gender, value, onChange, excludeBedId }) {
  const usable = wards.filter((w) => w.isActive && SEX_OK(w, gender));
  const ward = usable.find((w) => w.id === value.wardId);
  const beds = (ward?.beds || []).filter((b) => b.status === 'AVAILABLE' && b.id !== excludeBedId);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="Ward" required help={usable.length < wards.filter((w) => w.isActive).length ? 'Wards for the other sex are hidden.' : undefined}>
        <select className={inputClass} value={value.wardId} onChange={(e) => onChange({ wardId: e.target.value, bedId: '' })}>
          <option value="">Choose a ward…</option>
          {usable.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.occupancy.available} free</option>)}
        </select>
      </FormField>
      <FormField label="Bed" required help={ward && beds.length === 0 ? 'No free beds on this ward.' : undefined}>
        <select className={inputClass} value={value.bedId} disabled={!ward} onChange={(e) => onChange({ ...value, bedId: e.target.value })}>
          <option value="">Choose a bed…</option>
          {beds.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </FormField>
    </div>
  );
}
