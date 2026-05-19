/**
 * End-to-end smoke test for the Currency Simulation flow.
 *
 *   Step 1: getForeignCurrencies              -> pick one with materials
 *   Step 2: scanCurrencyImpact                -> first affected product
 *   Step 3: generateCurrencyChangeSimulation  -> persist single-product run
 *   Step 4: Compare standard HPP vs simulated HPP for that product
 *   Cleanup: delete the test simulation rows so we don't leave junk behind
 *
 * Run:  node migrations/_test_currency_flow.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');
const {
  getForeignCurrencies,
  scanCurrencyImpact,
  generateCurrencyChangeSimulation,
  getCurrencyChangeAffectedProducts,
} = require('../src/models/hppModel');
const { connect } = require('../config/sqlserver');

const RATE_BUMP_PCT = 10; // +10% bump for the test

async function run() {
  console.log('=== Currency Simulation Flow Test ===\n');

  // ---- Step 1: foreign currencies ----
  console.log('Step 1: getForeignCurrencies()');
  const currencies = await getForeignCurrencies();
  console.log(`  -> ${currencies.length} foreign currencies returned`);
  currencies.forEach((c) =>
    console.log(`     ${c.Curr_Code.padEnd(5)} kurs=${c.Kurs} (${c.Curr_Name})`)
  );

  // Pick the one we know has materials referencing it (EUR, per earlier inspection)
  const target = currencies.find((c) => c.Curr_Code === 'EUR') || currencies[0];
  const oldKurs = parseFloat(target.Kurs);
  const newKurs = +(oldKurs * (1 + RATE_BUMP_PCT / 100)).toFixed(2);
  console.log(`\n  Selected: ${target.Curr_Code}  ${oldKurs} -> ${newKurs} (+${RATE_BUMP_PCT}%)\n`);

  // ---- Step 2: scan impact ----
  console.log('Step 2: scanCurrencyImpact()');
  const scan = await scanCurrencyImpact([target.Curr_Code]);
  console.log(`  -> ${scan.materials.length} materials affected`);
  console.log(`  -> ${scan.products.length} products affected`);
  if (scan.products.length === 0) {
    console.log('No affected products — aborting.');
    return;
  }
  console.log('\n  Sample materials (first 5):');
  scan.materials.slice(0, 5).forEach((m) =>
    console.log(`     ${m.ITEM_ID.padEnd(10)} ${m.ITEM_PURCHASE_STD_PRICE} ${m.ITEM_CURRENCY}  ${m.Item_Name}`)
  );
  console.log('\n  Sample products (first 5):');
  scan.products.slice(0, 5).forEach((p) =>
    console.log(`     ${p.Product_ID.padEnd(6)} ${p.LOB.padEnd(8)} ${p.Product_Name}`)
  );

  // Pick the first affected product for our single-product simulation
  const testProduct = scan.products[0];
  console.log(`\n  Will simulate against ONE product: ${testProduct.Product_ID} - ${testProduct.Product_Name} (${testProduct.LOB})\n`);

  // ---- Step 3: generate (persisted) ----
  console.log('Step 3: generateCurrencyChangeSimulation()');
  const result = await generateCurrencyChangeSimulation(
    [{ currCode: target.Curr_Code, newKurs }],
    [testProduct.Product_ID],
    'TEST_FLOW'
  );

  const recordsets = result.recordsets || [];
  const impactRows = recordsets[recordsets.length - 1] || [];
  console.log(`  -> SP returned ${impactRows.length} impact row(s)`);
  if (impactRows.length === 0) {
    console.log('Unexpected: no impact rows. Aborting.');
    return;
  }
  const row = impactRows[0];
  console.log('  ', JSON.stringify(row, null, 2));

  // ---- Step 4: compare to standard HPP ----
  console.log('\nStep 4: compare simulation vs standard HPP');
  const db = await connect();

  // Standard HPP for current year (from sp_COGS_HPP_List)
  const stdResult = await db.request()
    .input('year', sql.VarChar(4), new Date().getFullYear().toString())
    .query(`exec sp_COGS_HPP_List @year`);
  const allStd = []
    .concat(stdResult.recordsets[0] || [])
    .concat(stdResult.recordsets[1] || [])
    .concat(stdResult.recordsets[2] || []);
  const stdEntry = allStd.find((p) => p.Product_ID === testProduct.Product_ID);

  console.log('  Standard HPP row for product:');
  if (stdEntry) {
    console.log('     HPP:', stdEntry.HPP, ' Product_SalesHNA:', stdEntry.Product_SalesHNA, ' LOB:', stdEntry.LOB);
  } else {
    console.log('     <not found in sp_COGS_HPP_List output>');
  }

  console.log('\n  Simulation row for product:');
  console.log('     HPPSebelum (SP-computed before):', row.HPPSebelum);
  console.log('     HPPSesudah (SP-computed after) :', row.HPPSesudah);
  console.log('     totalBahanSebelum:', row.totalBahanSebelum, ' totalBahanSesudah:', row.totalBahanSesudah);

  const hppBefore = parseFloat(row.HPPSebelum) || 0;
  const hppAfter  = parseFloat(row.HPPSesudah) || 0;
  const delta = hppAfter - hppBefore;
  const deltaPct = hppBefore ? (delta / hppBefore) * 100 : 0;
  console.log(`     Change: ${delta > 0 ? '+' : ''}${delta.toFixed(4)}  (${deltaPct.toFixed(3)}%)`);

  // Sanity check: HPP should generally INCREASE when foreign currency strengthens (our +10% bump on EUR)
  if (delta < 0) {
    console.log('   ! Note: HPP decreased — would expect an increase for a +10% currency bump. Inspect the formula.');
  }

  // Also verify the persisted records — Simulasi_ID + Simulasi_Type
  const newRows = await db.request()
    .input('pid', sql.VarChar(50), testProduct.Product_ID)
    .input('uid', sql.VarChar(50), 'TEST_FLOW')
    .query(`
      SELECT TOP 5 Simulasi_ID, Simulasi_Type, Simulasi_Deskripsi, versi, user_id, Simulasi_Date
      FROM t_COGS_HPP_Product_Header_Simulasi
      WHERE Product_ID = @pid AND user_id = @uid
      ORDER BY Simulasi_ID DESC
    `);
  console.log('\n  Persisted header rows (user_id=TEST_FLOW):');
  newRows.recordset.forEach((r) =>
    console.log(`     id=${r.Simulasi_ID} type=${r.Simulasi_Type} versi=${r.versi} date=${r.Simulasi_Date.toISOString()}`)
  );

  // Also print first few BB material rows for the new simulation
  if (newRows.recordset.length > 0) {
    const newId = newRows.recordset[0].Simulasi_ID;
    const mats = await db.request()
      .input('id', sql.Int, newId)
      .query(`
        SELECT TOP 8 Tipe_Bahan, Item_ID, Item_Name, Item_QTY, Item_Unit, Item_Unit_Price
        FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
        WHERE Simulasi_ID = @id
        ORDER BY Tipe_Bahan, Item_ID
      `);
    console.log(`\n  First few materials in Simulasi_ID=${newId}:`);
    mats.recordset.forEach((r) =>
      console.log(`     [${r.Tipe_Bahan}] ${r.Item_ID.padEnd(10)} qty=${r.Item_QTY} ${r.Item_Unit}  unitPrice=${r.Item_Unit_Price}  ${r.Item_Name}`)
    );

    // Compare against the standard formula detail for this product to show what changed
    const stdMats = await db.request()
      .input('pid', sql.VarChar(50), testProduct.Product_ID)
      .query(`
        DECLARE @periode varchar(4);
        SELECT @periode = MAX(periode) FROM t_COGS_HPP_Product_Header;
        SELECT TOP 8 ITEM_TYPE AS Tipe_Bahan, PPI_ItemID AS Item_ID,
               PPI_QTY AS Item_QTY, PPI_UnitID AS Item_Unit,
               CAST(total / NULLIF(PPI_QTY, 0) AS decimal(18,2)) AS Item_Unit_Price
        FROM t_COGS_HPP_Product_Detail_Formula
        WHERE Product_ID = @pid AND Periode = @periode
        ORDER BY ITEM_TYPE, PPI_ItemID
      `);
    console.log(`\n  Same rows from t_COGS_HPP_Product_Detail_Formula (standard):`);
    stdMats.recordset.forEach((r) =>
      console.log(`     [${r.Tipe_Bahan}] ${r.Item_ID.padEnd(10)} qty=${r.Item_QTY} ${r.Item_Unit}  unitPrice=${r.Item_Unit_Price}`)
    );
  }

  // Print summary so user can decide to keep or delete
  console.log('\n=== Test summary ===');
  console.log(`  Currency simulated   : ${target.Curr_Code}  ${oldKurs} -> ${newKurs}`);
  console.log(`  Product simulated    : ${testProduct.Product_ID} - ${testProduct.Product_Name}`);
  console.log(`  Standard HPP         : ${stdEntry?.HPP ?? 'n/a'}`);
  console.log(`  Simulated HPP before : ${hppBefore.toFixed(4)}`);
  console.log(`  Simulated HPP after  : ${hppAfter.toFixed(4)}`);
  console.log(`  HPP change           : ${delta > 0 ? '+' : ''}${delta.toFixed(4)} (${deltaPct.toFixed(3)}%)`);
  console.log(`\n  Test rows are PERSISTED with user_id='TEST_FLOW'. To remove them run:`);
  console.log(`     DELETE d FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan d`);
  console.log(`        JOIN t_COGS_HPP_Product_Header_Simulasi h ON h.Simulasi_ID = d.Simulasi_ID`);
  console.log(`        WHERE h.user_id = 'TEST_FLOW';`);
  console.log(`     DELETE FROM t_COGS_HPP_Product_Header_Simulasi WHERE user_id = 'TEST_FLOW';`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nFATAL:', err.message);
    if (err.precedingErrors) {
      err.precedingErrors.forEach((e) => console.error('  -', e.message));
    }
    process.exit(1);
  });
