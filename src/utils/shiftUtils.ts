import type { Shift } from '../services/teamApi';

export interface ShiftOption {
  code: string;
  label: string;
  color?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export const DEFAULT_SHIFT_OPTIONS: ShiftOption[] = [];

export const normalizeShiftCode = (value?: string | null) =>
  String(value || '').trim().toUpperCase();

export const formatShiftLabel = (value?: string | null) => {
  const normalized = normalizeShiftCode(value);
  if (!normalized) return 'Shift';

  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const normalizeOption = (option: ShiftOption): ShiftOption => ({
  ...option,
  code: normalizeShiftCode(option.code || option.label),
  label: option.label?.trim() || formatShiftLabel(option.code),
});

export const dedupeShiftOptions = (options: ShiftOption[]) => {
  const byCode = new Map<string, ShiftOption>();

  options.forEach((option) => {
    const normalized = normalizeOption(option);
    if (!normalized.code) return;
    byCode.set(normalized.code, {
      ...byCode.get(normalized.code),
      ...normalized,
      label: normalized.label || byCode.get(normalized.code)?.label || formatShiftLabel(normalized.code),
    });
  });

  return Array.from(byCode.values());
};

export const buildShiftOptions = (
  shifts: Shift[] = [],
  includeCodes: Array<string | null | undefined> = [],
) => {
  const configuredOptions = shifts.map((shift) => ({
    code: shift.name,
    label: shift.name || formatShiftLabel(shift.name),
    color: shift.color,
    startTime: shift.start_time,
    endTime: shift.end_time,
  }));
  const includedOptions = includeCodes
    .filter((code) => normalizeShiftCode(code))
    .map((code) => ({
      code: normalizeShiftCode(code),
      label: formatShiftLabel(code),
    }));

  return dedupeShiftOptions([
    ...configuredOptions,
    ...includedOptions,
  ]);
};

export const getShiftOption = (code: string | null | undefined, options: ShiftOption[]) => {
  const normalized = normalizeShiftCode(code);
  return options.find((option) => option.code === normalized);
};

export const getShiftLabel = (code: string | null | undefined, options: ShiftOption[]) =>
  getShiftOption(code, options)?.label || formatShiftLabel(code);

export const getShiftColor = (code: string | null | undefined, options: ShiftOption[]) => {
  const normalized = normalizeShiftCode(code);
  const configured = getShiftOption(normalized, options)?.color;
  if (configured) return configured;

  const palette = ['#f59e0b', '#2563eb', '#7c3aed', '#059669', '#dc2626', '#0891b2'];
  const index = Math.abs(
    normalized.split('').reduce((total, char) => total + char.charCodeAt(0), 0),
  ) % palette.length;
  return palette[index];
};

export const getShiftSortValue = (code: string | null | undefined, options: ShiftOption[]) => {
  const normalized = normalizeShiftCode(code);
  const index = options.findIndex((option) => option.code === normalized);
  return index >= 0 ? index : options.length + 1;
};
