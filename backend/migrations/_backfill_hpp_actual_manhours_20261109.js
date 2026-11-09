/**
 * One-time repair: copy actual manhours from the production report onto batches calculated
 * before their hours were reported.
 *
 * Dry run (default):  node migrations/_backfill_hpp_actual_manhours_20261109.js
 * Apply:              node migrations/_backfill_hpp_actual_manhours_20261109.js --apply
 *
 * --apply first saves the old values of every row it will change to a JSON file next to this
 * script. It refuses to run twice over the same backup file.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getHPPActualManhourChanges, refreshHPPActualManhours } = require('../src/models/hppModel');

const FROM = '202501';
const TO = '209912';
const BACKUP_FILE = path.join(__dirname, '_backfill_hpp_actual_manhours_20261109_backup.json');

(async () => {
  const apply = process.argv.includes('--apply');
  const changes = await getHPPActualManhourChanges(FROM, TO);

  const wasEmpty = changes.filter((c) => c.MH_Proses_Actual === null || c.MH_Kemas_Actual === null);
  const byPeriod = {};
  changes.forEach((c) => { byPeriod[c.Periode] = (byPeriod[c.Periode] || 0) + 1; });

  console.log(`Batches to update: ${changes.length} (no hours yet: ${wasEmpty.length}, different hours: ${changes.length - wasEmpty.length})`);
  console.log('By period:', JSON.stringify(byPeriod));

  if (!apply) {
    console.log('Dry run only. Nothing was changed. Use --apply to write.');
    process.exit(0);
  }
  if (fs.existsSync(BACKUP_FILE)) throw new Error(`Backup already exists, refusing to overwrite: ${BACKUP_FILE}`);

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(changes, null, 1));
  console.log(`Backup written: ${BACKUP_FILE}`);

  const updated = await refreshHPPActualManhours(FROM, TO);
  const remaining = await getHPPActualManhourChanges(FROM, TO);
  console.log(`Updated: ${updated}. Still differing: ${remaining.length}.`);
  process.exit(updated === changes.length && remaining.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
