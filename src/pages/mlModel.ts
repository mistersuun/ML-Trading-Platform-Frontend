// Pure helpers for the ML page: calibration wording and abstain reasons, all read from the response.
import { int, isNum } from '../lib/format';

const REASONS: Record<string, string> = {
  stale: 'Model or data too old',
  nan: 'A feature was missing',
  drift: 'Inputs drifted from the training data',
  no_skill: 'Model did not beat the base rate',
  no_validation: 'Too little history to calibrate',
  band: 'Probability inside the no-trade band',
};

export function abstainReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'None: the latest bar can signal';
  return REASONS[reason] ?? reason.replace(/_/g, ' ');
}

/** Abstain counts as [label, count] rows, most frequent first. */
export function abstainRows(counts: Record<string, number> | null | undefined): [string, number][] {
  return Object.entries(counts ?? {})
    .filter(([, n]) => isNum(n) && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => [abstainReasonLabel(k), n]);
}

export function calibrationLabel(calibrated: boolean | null | undefined): string {
  if (calibrated === true) return 'Calibrated';
  if (calibrated === false) return 'Uncalibrated (fixed 0.60 / 0.40 band)';
  return 'n/a';
}

/** Column header for the probability: only call it calibrated when the model was. */
export function probabilityHeader(calibrated: boolean | null | undefined): string {
  return calibrated ? 'Calibrated P(up)' : 'P(up)';
}

export function abstainTitle(counts: Record<string, number> | null | undefined, nOos: number): string {
  const total = Object.values(counts ?? {}).reduce((a, b) => a + (isNum(b) ? b : 0), 0);
  if (!nOos) return 'No out-of-sample bars';
  return total === 0 ? 'The model signalled whenever it had a prediction' : `The model abstained on ${int(total)} of ${int(nOos)} out-of-sample bars`;
}
