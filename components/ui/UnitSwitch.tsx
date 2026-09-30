"use client";
import { useUnit } from '../UnitProvider';
export function UnitSwitch() {
  const { unit, setUnit } = useUnit();
  return <div className="tt-segmented" role="group" aria-label="Display time in">
    <button type="button" aria-pressed={unit === 'hr'} onClick={() => setUnit('hr')}>Hours</button>
    <button type="button" aria-pressed={unit === 'min'} onClick={() => setUnit('min')}>Minutes</button>
  </div>;
}
