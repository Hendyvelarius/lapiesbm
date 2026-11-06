import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarRange, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { hppAPI } from '../services/api';
import {
  buildPeriodReport,
  buildPeriodReportFilename,
  downloadPeriodReport,
  formatPeriodLabel,
  listPeriodsBetween,
  resolvePeriodSelection,
} from '../utils/hppPeriodReport';

const MODES = [
  { value: 'month', label: 'Single Month' },
  { value: 'year', label: 'Full Year' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom Range' },
];

const PeriodSelect = ({ id, label, value, onChange, options, disabled }) => (
  <div className="calculate-field">
    <label htmlFor={id}>{label}</label>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </div>
);

const HPPPeriodReportModal = ({ isOpen, onClose, periods, defaultPeriod, testMode, user }) => {
  const [mode, setMode] = useState('month');
  const [period, setPeriod] = useState('');
  const [year, setYear] = useState('');
  const [through, setThrough] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Periods with data, oldest first
  const available = useMemo(() => periods.map((p) => p.Periode).sort(), [periods]);
  const years = useMemo(
    () => [...new Set(available.map((p) => p.substring(0, 4)))].reverse(),
    [available],
  );
  const monthsOfYear = useMemo(() => available.filter((p) => p.startsWith(year)), [available, year]);

  useEffect(() => {
    if (!isOpen || available.length === 0) return;
    const latest = available[available.length - 1];
    const start = defaultPeriod || latest;
    setMode('month');
    setPeriod(start);
    setYear(start.substring(0, 4));
    setThrough(available.filter((p) => p.startsWith(start.substring(0, 4))).pop());
    setFrom(start);
    setTo(start);
    setError(null);
  }, [isOpen, available, defaultPeriod]);

  const handleYearChange = (value) => {
    setYear(value);
    setThrough(available.filter((p) => p.startsWith(value)).pop());
  };

  const selection = useMemo(() => {
    const isReady = { month: period, year, ytd: year && through, custom: from && to }[mode];
    return isReady ? resolvePeriodSelection({ mode, period, year, through, from, to }) : null;
  }, [mode, period, year, through, from, to]);

  const isRangeValid = selection && selection.from <= selection.to;

  const preview = useMemo(() => {
    if (!isRangeValid) return null;
    const months = listPeriodsBetween(selection.from, selection.to);
    const withData = periods.filter((p) => months.includes(p.Periode));
    return {
      months: months.length,
      withData: withData.length,
      missing: months.filter((m) => !available.includes(m)),
    };
  }, [isRangeValid, selection, periods, available]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const response = await hppAPI.getActualPeriodReport(selection.from, selection.to, testMode);
      if (!response.data?.batches?.length) {
        setError('No product batches found for this period.');
        return;
      }
      const generatedAt = new Date();
      const bytes = buildPeriodReport({
        batches: response.data.batches,
        standards: response.data.standards,
        period: selection,
        testMode,
        generatedBy: user?.nama || user?.inisialNama || 'User',
        generatedAt,
      });
      downloadPeriodReport(bytes, buildPeriodReportFilename(selection, testMode, generatedAt));
      onClose();
    } catch (err) {
      console.error('Error generating period report:', err);
      setError(err.message || 'Failed to generate the report');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  const toOption = (value) => ({ value, label: formatPeriodLabel(value) });
  const periodOptions = [...available].reverse().map(toOption);
  const yearOptions = years.map((value) => ({ value, label: value }));

  return (
    <div className="hpp-actual-modal-overlay" onClick={generating ? undefined : onClose}>
      <div className="hpp-actual-calculate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hpp-actual-modal-header">
          <h2><FileSpreadsheet size={20} /> Generate Period Report</h2>
          <button onClick={onClose} className="hpp-actual-close-btn" disabled={generating}>
            <X size={20} />
          </button>
        </div>

        <div className="hpp-actual-calculate-content">
          <div className="calculate-form-section">
            <h3>Report Period</h3>
            <div className="period-report-modes" role="radiogroup" aria-label="Report period type">
              {MODES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === option.value}
                  className={`period-report-mode ${mode === option.value ? 'active' : ''}`}
                  onClick={() => setMode(option.value)}
                  disabled={generating}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="calculate-period-row">
              {mode === 'month' && (
                <PeriodSelect id="report-month" label="Month" value={period} onChange={setPeriod} options={periodOptions} disabled={generating} />
              )}
              {(mode === 'year' || mode === 'ytd') && (
                <PeriodSelect id="report-year" label="Year" value={year} onChange={handleYearChange} options={yearOptions} disabled={generating} />
              )}
              {mode === 'ytd' && (
                <PeriodSelect id="report-through" label="Through" value={through} onChange={setThrough} options={[...monthsOfYear].reverse().map(toOption)} disabled={generating} />
              )}
              {mode === 'custom' && (
                <>
                  <PeriodSelect id="report-from" label="From" value={from} onChange={setFrom} options={periodOptions} disabled={generating} />
                  <PeriodSelect id="report-to" label="To" value={to} onChange={setTo} options={periodOptions} disabled={generating} />
                </>
              )}
            </div>
          </div>

          {selection && !isRangeValid && (
            <div className="calculate-error">
              <AlertCircle size={18} />
              <span>The From month must not be later than the To month.</span>
            </div>
          )}

          {preview && (
            <div className="period-report-preview">
              <CalendarRange size={18} />
              <div>
                <strong>{selection.label}</strong>
                <p>
                  {preview.withData} of {preview.months} month{preview.months !== 1 ? 's' : ''} with data
                  {preview.missing.length > 0 && ` (no data: ${preview.missing.map(formatPeriodLabel).join(', ')})`}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="calculate-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="hpp-actual-calculate-footer">
          <button className="calculate-cancel-btn" onClick={onClose} disabled={generating}>Cancel</button>
          <button
            className="calculate-submit-btn"
            onClick={handleGenerate}
            disabled={generating || !isRangeValid || preview?.withData === 0}
          >
            {generating ? <Loader2 className="spin" size={16} /> : <FileSpreadsheet size={16} />}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HPPPeriodReportModal;
