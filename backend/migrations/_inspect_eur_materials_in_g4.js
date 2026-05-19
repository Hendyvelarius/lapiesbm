require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const CONFIG = {
  user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
  server: process.env.SQL_HOST, port: parseInt(process.env.SQL_PORT, 10) || 1433,
  database: process.env.SQL_DATABASE,
  options: { encrypt: false, trustServerCertificate: true },
};

(async () => {
  const pool = await sql.connect(CONFIG);
  const PRODUCT_ID = 'G4';
  const OLD_KURS = 21000;
  const NEW_KURS = 23100;

  // Find which materials in G4's standard recipe are EUR-denominated
  const eurMatsInRecipe = await pool.request()
    .input('pid', sql.VarChar(50), PRODUCT_ID)
    .query(`
      DECLARE @periode varchar(4);
      SELECT @periode = MAX(periode) FROM t_COGS_HPP_Product_Header;

      SELECT d.ITEM_TYPE, d.PPI_ItemID, d.PPI_QTY, d.PPI_UnitID,
             CAST(d.total / NULLIF(d.PPI_QTY,0) AS decimal(18,4)) AS std_unit_price,
             h.ITEM_CURRENCY, h.ITEM_PURCHASE_STD_PRICE, h.ITEM_PURCHASE_UNIT
      FROM t_COGS_HPP_Product_Detail_Formula d
      JOIN M_COGS_STD_HRG_BAHAN h ON h.ITEM_ID = d.PPI_ItemID
      WHERE d.Product_ID = @pid
        AND d.Periode = @periode
        AND h.ITEM_CURRENCY = 'EUR'
        AND h.Periode = (SELECT MAX(Periode) FROM M_COGS_STD_HRG_BAHAN WHERE ITEM_ID = h.ITEM_ID)
      ORDER BY d.ITEM_TYPE, d.PPI_ItemID
    `);

  console.log(`EUR-denominated materials in product ${PRODUCT_ID}'s recipe:`);
  console.log(`Mat ID      | Type | qty x unit         | std unit price (IDR) | foreign price`);
  eurMatsInRecipe.recordset.forEach(r => {
    console.log(`  ${r.PPI_ItemID.padEnd(10)}|  ${r.ITEM_TYPE.padEnd(3)} | ${String(r.PPI_QTY).padEnd(8)} ${r.PPI_UnitID.padEnd(4)}    | ${String(r.std_unit_price).padEnd(20)} | EUR ${r.ITEM_PURCHASE_STD_PRICE} per ${r.ITEM_PURCHASE_UNIT}`);
  });

  // Now compare to the persisted simulation's prices for THE SAME materials
  const simMats = await pool.request()
    .input('pid', sql.VarChar(50), PRODUCT_ID)
    .query(`
      SELECT TOP 1 Simulasi_ID FROM t_COGS_HPP_Product_Header_Simulasi
      WHERE Product_ID = @pid AND user_id = 'TEST_FLOW'
      ORDER BY Simulasi_ID DESC
    `);
  if (simMats.recordset.length === 0) {
    console.log('\nNo TEST_FLOW simulation row for this product (was it cleaned up?). Exiting.');
    await pool.close();
    return;
  }
  const simId = simMats.recordset[0].Simulasi_ID;
  console.log(`\nLatest simulation Simulasi_ID=${simId}`);

  const simPrices = await pool.request()
    .input('id', sql.Int, simId)
    .query(`
      SELECT Tipe_Bahan, Item_ID, Item_QTY, Item_Unit, Item_Unit_Price
      FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
      WHERE Simulasi_ID = @id
        AND Item_ID IN (SELECT PPI_ItemID FROM t_COGS_HPP_Product_Detail_Formula d
                        WHERE d.Product_ID = (SELECT TOP 1 Product_ID FROM t_COGS_HPP_Product_Header_Simulasi WHERE Simulasi_ID = @id)
                          AND d.Periode = (SELECT MAX(periode) FROM t_COGS_HPP_Product_Header))
      ORDER BY Tipe_Bahan, Item_ID
    `);

  // Build a map of EUR mat -> std + sim prices for easy comparison
  const stdMap = {};
  eurMatsInRecipe.recordset.forEach(r => { stdMap[r.PPI_ItemID] = r; });

  console.log('\nSide-by-side: EUR materials in G4 (std unit price vs simulated unit price)');
  console.log('Mat ID      | std price  | sim price   | ratio  | expected ratio (NEW/OLD kurs = ' + (NEW_KURS/OLD_KURS).toFixed(4) + ')');
  simPrices.recordset
    .filter(r => stdMap[r.Item_ID])
    .forEach(r => {
      const std = stdMap[r.Item_ID];
      const stdPrice = parseFloat(std.std_unit_price);
      const simPrice = parseFloat(r.Item_Unit_Price);
      const ratio = stdPrice ? (simPrice / stdPrice).toFixed(4) : 'n/a';
      console.log(`  ${r.Item_ID.padEnd(10)}| ${String(stdPrice).padEnd(11)}| ${String(simPrice).padEnd(12)}| ${ratio.padEnd(7)}|`);
    });

  await pool.close();
})();
