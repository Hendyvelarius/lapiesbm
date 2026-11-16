import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { YEAR_DATASETS, fetchYearReadiness, getMissingDatasets } from '../utils/yearReadiness';
import '../styles/YearReadinessNotice.css';

/**
 * Explains why a page is (or will be) empty for the selected year because data it depends on
 * hasn't been set up for that year yet. Renders nothing when everything required exists,
 * or when the check itself fails (so it never shows a misleading warning).
 *
 * Props:
 *  - periode:    selected year, e.g. "2027"
 *  - requires:   dataset keys from YEAR_DATASETS this page depends on
 *  - purpose:    what is affected, e.g. "Margins for this year will not be listed"
 *  - refreshKey: change it (e.g. after an import) to re-run the check
 */
const YearReadinessNotice = ({ periode, requires, purpose, refreshKey }) => {
  const [missing, setMissing] = useState([]);
  const requiresKey = requires.join(',');

  useEffect(() => {
    let cancelled = false;
    setMissing([]);
    fetchYearReadiness(periode).then(counts => {
      if (!cancelled) setMissing(getMissingDatasets(counts, requiresKey.split(',')));
    });
    return () => { cancelled = true; };
  }, [periode, requiresKey, refreshKey]);

  if (missing.length === 0) return null;

  return (
    <div className="year-readiness-notice" role="status">
      <AlertTriangle size={18} className="year-readiness-icon" aria-hidden="true" />
      <div className="year-readiness-body">
        <strong>{periode} is not fully set up yet.</strong>
        {purpose && <span> {purpose} until the following {missing.length === 1 ? 'has' : 'have'} data for {periode}:</span>}
        <ul>
          {missing.map(key => (
            <li key={key}>
              <Link to={YEAR_DATASETS[key].path}>{YEAR_DATASETS[key].label}</Link>
              <span className="year-readiness-where"> — {YEAR_DATASETS[key].where}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default YearReadinessNotice;
