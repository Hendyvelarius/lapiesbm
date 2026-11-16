import { productsAPI } from '../services/api';

// Every dataset that is entered per year (Periode). Keys match the backend's
// GET /api/products/year-readiness response (productModel.getYearReadiness).
// `where` is the menu path users see; `path` is the in-app link to fix it.
export const YEAR_DATASETS = {
  manhourYield: {
    label: 'Manhour & Yield',
    where: 'Cost Management → Manhour & Yield',
    path: '/cost-management?tab=product-group',
  },
  materialPrices: {
    label: 'Material prices',
    where: 'Material Prices',
    path: '/harga-bahan',
  },
  exchangeRates: {
    label: 'Standard exchange rates',
    where: 'Exchange Rates (filled from the ERP currency master, not editable in this app)',
    path: '/currency',
  },
  formulaAssignments: {
    label: 'Formula assignments',
    where: 'Formula Assignment',
    path: '/formula-assignment',
  },
  rates: {
    label: 'Rates',
    where: 'Cost Management → Rates',
    path: '/cost-management?tab=cost-allocation',
  },
  generalCosts: {
    label: 'Generik Operational costs',
    where: 'Cost Management → Generik Operational',
    path: '/cost-management?tab=general-costs',
  },
  margins: {
    label: 'Margins',
    where: 'Cost Management → Margin',
    path: '/cost-management?tab=toll-fee',
  },
  reagen: {
    label: 'Reagen rates',
    where: 'Cost Management → Reagen',
    path: '/cost-management?tab=reagen',
  },
  expiredMaterials: {
    label: 'Expired materials',
    where: 'Cost Management → Expiry',
    path: '/cost-management?tab=expiry-cost',
  },
  hppResults: {
    label: 'Generated HPP',
    where: 'Generate HPP',
    path: '/generate-hpp',
  },
};

// Fetch row counts for every year-scoped dataset. Returns null if the check itself fails,
// so callers can stay silent rather than show a misleading warning.
export async function fetchYearReadiness(periode) {
  if (!periode) return null;
  try {
    const response = await productsAPI.getYearReadiness(periode);
    return response?.success ? response.data.counts : null;
  } catch (error) {
    console.warn(`Year readiness check failed for ${periode}:`, error);
    return null;
  }
}

// Keys from `requires` whose dataset has no rows for the year.
export function getMissingDatasets(counts, requires) {
  if (!counts) return [];
  return requires.filter(key => !(Number(counts[key]) > 0));
}

// One-line, human-readable summary for toasts, e.g.
// "Manhour & Yield (Cost Management → Manhour & Yield) has no data for 2027."
export function describeMissing(missingKeys, periode) {
  const parts = missingKeys.map(key => `${YEAR_DATASETS[key].label} (${YEAR_DATASETS[key].where})`);
  if (parts.length === 0) return '';
  const verb = parts.length === 1 ? 'has' : 'have';
  return `${parts.join(', ')} ${verb} no data for ${periode}.`;
}

// Convenience for post-action messages: fetch + describe in one call.
// Returns '' when nothing is missing or the check could not run.
export async function checkMissingForYear(periode, requires) {
  const counts = await fetchYearReadiness(periode);
  return describeMissing(getMissingDatasets(counts, requires), periode);
}
