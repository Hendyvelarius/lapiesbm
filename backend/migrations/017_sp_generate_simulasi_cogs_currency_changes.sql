-- =====================================================================
-- Stored Procedure: sp_generate_simulasi_cogs_currency_changes
-- Purpose: Generate HPP simulation rows for a "Currency Changes" what-if
--          scenario. Given a set of currencies with new exchange rates and
--          an optional product filter, finds all materials in the chosen
--          currencies and recomputes the unit prices using the new rates,
--          inserting one simulation header + detail set per affected
--          product into:
--            t_COGS_HPP_Product_Header_Simulasi
--            t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--
-- Inputs:
--   @var_data_perubahanCurrency : 'USD:18000#EUR:17500'
--                                  (currency_code:new_kurs pairs, '#'-sep)
--   @var_product_filter         : '#PROD1#PROD2#'  (optional product allow-list,
--                                  '#'-wrapped so we can do LIKE '%#id#%').
--                                  Pass NULL or '' for "no filter / all".
--
-- Behavior mirrors sp_generate_simulasi_cogs_price_changes, but:
--   * Simulasi_Type = 'Currency Changes'
--   * Description prefix 'Currency Changes : <code>: <old_kurs> -> <new_kurs>; ...'
--   * Affected materials = every M_COGS_STD_HRG_BAHAN row whose
--     ITEM_CURRENCY is in the user's currency list.
--   * Unit_Price for affected materials in the simulation detail =
--       dbo.fnConvertBJ(item, 1, purchase_unit, usage_unit)
--       * ITEM_PURCHASE_STD_PRICE
--       * NEW kurs   (instead of current kurs)
-- =====================================================================

IF OBJECT_ID('dbo.sp_generate_simulasi_cogs_currency_changes', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_generate_simulasi_cogs_currency_changes;
GO

CREATE PROCEDURE [dbo].[sp_generate_simulasi_cogs_currency_changes]
(
    @var_data_perubahanCurrency AS nvarchar(4000),
    @var_product_filter         AS nvarchar(MAX) = NULL
)
AS
SET NOCOUNT ON

DECLARE @currentPeriode AS varchar(4);
SELECT @currentPeriode = MAX(periode) FROM t_COGS_HPP_Product_Header;

DECLARE @currentYear AS varchar(4) = CAST(YEAR(GETDATE()) AS varchar(4));

-- Normalize empty filter to NULL
IF @var_product_filter IS NOT NULL AND LTRIM(RTRIM(@var_product_filter)) = ''
    SET @var_product_filter = NULL;

-- 1. Parse currency:new_kurs pairs
SELECT
    LTRIM(RTRIM(LEFT(items, CHARINDEX(':', items) - 1))) AS curr_code,
    CAST(RIGHT(items, LEN(items) - CHARINDEX(':', items)) AS DECIMAL(18,4)) AS new_kurs
INTO #tmp_currency_changes
FROM dbo.Split(@var_data_perubahanCurrency, '#') a
WHERE CHARINDEX(':', items) > 0;

-- 2. Attach current (old) kurs from vw_COGS_Currency_List for the current year
ALTER TABLE #tmp_currency_changes ADD old_kurs DECIMAL(18,4) NULL;

UPDATE c
SET old_kurs = d.Kurs
FROM #tmp_currency_changes c
LEFT JOIN vw_COGS_Currency_List d
    ON d.Curr_Code = c.curr_code
   AND d.Periode  = @currentYear;

-- 3. Build the description summary up front so we can use it on the headers
DECLARE @ringkasan_perubahan AS nvarchar(max);
SELECT @ringkasan_perubahan =
    STUFF((
        SELECT CHAR(10) + curr_code + ': '
               + CAST(ISNULL(old_kurs, 0) AS VARCHAR(50))
               + ' -> ' + CAST(new_kurs AS VARCHAR(50)) + '; '
        FROM #tmp_currency_changes
        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '');

-- 4. Collect every material whose CURRENT (latest periode) entry is in one
--    of the affected currencies. IMPORTANT: pick the latest row per material
--    FIRST, then filter on currency — otherwise a material that USED to be
--    in a foreign currency but has since switched to IDR would resurface its
--    old row and be incorrectly treated as affected.
WITH latest_harga AS (
    SELECT b.*,
           ROW_NUMBER() OVER (PARTITION BY b.ITEM_ID ORDER BY b.Periode DESC) AS rn
    FROM M_COGS_STD_HRG_BAHAN b
)
SELECT
    b.ITEM_ID                       AS kode_bahan,
    b.ITEM_PURCHASE_STD_PRICE       AS harga_beli,
    b.ITEM_PURCHASE_STD_PRICE       AS harga_sebelum,
    b.ITEM_PURCHASE_STD_PRICE       AS harga_sesudah,
    c.Item_Unit                     AS item_unit,
    b.ITEM_PURCHASE_UNIT            AS item_purchase_unit,
    b.ITEM_CURRENCY                 AS ITEM_CURRENCY,
    cc.old_kurs                     AS kurs,
    cc.new_kurs                     AS new_kurs
INTO #tmp_list_material_changes
FROM latest_harga b
JOIN #tmp_currency_changes cc ON b.ITEM_CURRENCY = cc.curr_code
JOIN m_item_manufacturing c   ON c.Item_ID = b.ITEM_ID
WHERE b.rn = 1;

-- 5. Find products that use any of these materials. Optionally restrict
--    to the user-selected product list.
SELECT DISTINCT a.Product_ID
INTO #tmp_list_product_terdampak
FROM t_COGS_HPP_Product_Header a
JOIN t_COGS_HPP_Product_Detail_Formula b ON a.Product_ID = b.Product_ID
JOIN #tmp_list_material_changes c        ON c.kode_bahan = b.PPI_ItemID
WHERE a.Periode = @currentPeriode
  AND (
        @var_product_filter IS NULL
        OR @var_product_filter LIKE '%#' + a.Product_ID + '#%'
      );

-- 6. Allocate a contiguous block of Simulasi_IDs for the new headers.
DECLARE @simulasi_id   AS int;
DECLARE @simulasi_date AS datetime;
SELECT @simulasi_id   = ISNULL(MAX(simulasi_id), 0)
FROM t_COGS_HPP_Product_Header_Simulasi;
SELECT @simulasi_date = GETDATE();

-- 7. Stage the simulation headers (one per affected product).
SELECT [Periode]
     , @simulasi_id + ROW_NUMBER() OVER (ORDER BY c.product_name) [Simulasi_ID]
     , 'Currency Changes : ' + @ringkasan_perubahan [Simulasi_Deskripsi]
     , @simulasi_date [Simulasi_Date]
     , 'Currency Changes' [Simulasi_Type]
     , REPLACE(REPLACE(REPLACE(REPLACE(REPLACE([Formula],'PI:',''),'PS:',''),'KP:',''),'KS:',''),', ','#') [Formula]
     , a.[Product_ID]
     , c.[Product_Name]
     ,[Group_PNCategory]
     ,[Group_PNCategory_Name]
     ,[Group_PNCategory_Dept]
     ,[Group_Rendemen]
     ,[Batch_Size]
     ,[LOB]
     ,'1' [versi]
     ,[MH_Proses_Std]
     ,[MH_Kemas_Std]
     ,[MH_Analisa_Std]
     ,[MH_Timbang_BB]
     ,[MH_Timbang_BK]
     ,[MH_Mesin_Std]
     ,[Biaya_Proses]
     ,[Biaya_Kemas]
     ,[Biaya_Generik]
     ,[Biaya_Analisa]
     ,[Biaya_Reagen]
     ,[Beban_Sisa_Bahan_Exp]
     ,[Toll_Fee]
     ,[Margin]
     ,[Rounded]
     ,[Rate_PLN]
     ,[Direct_Labor]
     ,[Factory_Over_Head]
     ,[Depresiasi]
INTO #t_COGS_HPP_Product_Header_Simulasi
FROM t_COGS_HPP_Product_Header a
JOIN #tmp_list_product_terdampak b ON a.Product_ID = b.Product_ID
JOIN m_product c                   ON c.Product_ID = a.Product_ID
WHERE a.Periode = @currentPeriode;

-- 8. Stage the simulation detail (every material line for the affected products).
SELECT d.Periode,
       d.Simulasi_id,
       a.PPI_SeqID,
       a.product_id,
       a.item_type,
       a.PPI_ItemID,
       c.Item_Name,
       a.PPI_QTY,
       a.PPI_UnitID,
       CAST(a.total / NULLIF(a.PPI_QTY, 0) AS decimal(18,2)) AS Unit_Price
INTO #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
FROM t_COGS_HPP_Product_Detail_Formula a
JOIN #tmp_list_product_terdampak b           ON a.Product_ID = b.Product_ID
LEFT JOIN m_item_manufacturing c             ON c.ITEM_ID = a.PPI_ItemID
JOIN #t_COGS_HPP_Product_Header_Simulasi d   ON d.Product_ID = a.Product_ID
WHERE a.Periode = @currentPeriode;

-- 9. Recompute Unit_Price for every detail row whose material is in an affected
--    currency, applying the NEW kurs.
UPDATE b
SET Unit_Price =
    dbo.fnConvertBJ(a.kode_bahan, 1, a.item_purchase_unit, b.PPI_UnitID)
    * a.harga_beli
    * a.new_kurs
FROM #tmp_list_material_changes a
JOIN #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan b
  ON a.kode_bahan = b.PPI_ItemID;

-- 10. Persist the simulation rows.
INSERT INTO [Lapifactory].[dbo].[t_COGS_HPP_Product_Header_Simulasi]
           ([Periode]
           ,[Simulasi_ID]
           ,[Simulasi_Deskripsi]
           ,[Simulasi_Date]
           ,[Simulasi_Type]
           ,[Formula]
           ,[Product_ID]
           ,[Product_Name]
           ,[Group_PNCategory]
           ,[Group_PNCategory_Name]
           ,[Group_PNCategory_Dept]
           ,[Group_Rendemen]
           ,[Batch_Size]
           ,[LOB]
           ,[versi]
           ,[MH_Proses_Std]
           ,[MH_Kemas_Std]
           ,[MH_Analisa_Std]
           ,[MH_Timbang_BB]
           ,[MH_Timbang_BK]
           ,[MH_Mesin_Std]
           ,[Biaya_Proses]
           ,[Biaya_Kemas]
           ,[Biaya_Generik]
           ,[Biaya_Analisa]
           ,[Biaya_Reagen]
           ,[Beban_Sisa_Bahan_Exp]
           ,[Toll_Fee]
           ,[Margin]
           ,[Rounded]
           ,[Rate_PLN]
           ,[Direct_Labor]
           ,[Factory_Over_Head]
           ,[Depresiasi])
SELECT [Periode]
     ,[Simulasi_ID]
     ,[Simulasi_Deskripsi]
     ,[Simulasi_Date]
     ,[Simulasi_Type]
     ,[Formula]
     ,[Product_ID]
     ,[Product_Name]
     ,[Group_PNCategory]
     ,[Group_PNCategory_Name]
     ,[Group_PNCategory_Dept]
     ,[Group_Rendemen]
     ,[Batch_Size]
     ,[LOB]
     ,[versi]
     ,[MH_Proses_Std]
     ,[MH_Kemas_Std]
     ,[MH_Analisa_Std]
     ,[MH_Timbang_BB]
     ,[MH_Timbang_BK]
     ,[MH_Mesin_Std]
     ,[Biaya_Proses]
     ,[Biaya_Kemas]
     ,[Biaya_Generik]
     ,[Biaya_Analisa]
     ,[Biaya_Reagen]
     ,[Beban_Sisa_Bahan_Exp]
     ,[Toll_Fee]
     ,[Margin]
     ,[Rounded]
     ,[Rate_PLN]
     ,[Direct_Labor]
     ,[Factory_Over_Head]
     ,[Depresiasi]
FROM #t_COGS_HPP_Product_Header_Simulasi;

INSERT INTO [Lapifactory].[dbo].[t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan]
           ([Periode]
           ,[Simulasi_ID]
           ,[Seq_ID]
           ,[Tipe_Bahan]
           ,[Item_ID]
           ,[Item_Name]
           ,[Item_QTY]
           ,[Item_Unit]
           ,[Item_Unit_Price])
SELECT [Periode]
     ,[Simulasi_ID]
     ,[PPI_SeqID]
     ,ITEM_TYPE
     ,PPI_ItemID
     ,[Item_Name]
     ,PPI_QTY
     ,PPI_UnitID
     ,Unit_Price
FROM #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan;

-- 11. Return before/after summary so the caller can render the impact list,
--     mirroring the shape that sp_generate_simulasi_cogs_price_changes returns.

SELECT a.*, bb.total totalBB, bk.total totalBK
INTO #tmpCurrentHPP
FROM t_COGS_HPP_Product_Header a
LEFT JOIN (
    SELECT periode, product_id, SUM(total) total
    FROM t_COGS_HPP_Product_Detail_Formula
    WHERE ITEM_TYPE = 'BB'
    GROUP BY product_id, periode
) bb ON a.Periode = bb.periode AND a.Product_ID = bb.Product_ID
LEFT JOIN (
    SELECT periode, product_id, SUM(total) total
    FROM t_COGS_HPP_Product_Detail_Formula
    WHERE ITEM_TYPE = 'BK'
    GROUP BY product_id, periode
) bk ON a.Periode = bk.periode AND a.Product_ID = bk.Product_ID
WHERE a.Periode = @currentPeriode;

SELECT a.*, bb.total totalBB, bk.total totalBK
INTO #tmp
FROM t_COGS_HPP_Product_Header_Simulasi a
JOIN (
    SELECT periode, simulasi_id, SUM(item_qty * item_unit_price) total
    FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
    WHERE Tipe_Bahan = 'BB'
    GROUP BY simulasi_id, periode
) bb ON a.Periode = bb.periode AND a.simulasi_id = bb.simulasi_id
LEFT JOIN (
    SELECT periode, simulasi_id, SUM(item_qty * item_unit_price) total
    FROM t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
    WHERE Tipe_Bahan = 'BK'
    GROUP BY simulasi_id, periode
) bk ON a.Periode = bk.periode AND a.simulasi_id = bk.simulasi_id
WHERE a.Simulasi_Deskripsi = 'Currency Changes : ' + @ringkasan_perubahan
  AND a.Simulasi_Date = @simulasi_date;

SELECT * INTO #tmpDataAfter FROM (
    SELECT a.Product_ID, Product_Name, totalBB + totalBK totalBahanSesudah,
           ((ISNULL(totalBB,0) + ISNULL(totalBK,0))
            + (ISNULL(a.MH_Proses_Std,0) * ISNULL(Biaya_Proses,0))
            + (ISNULL(a.MH_Kemas_Std,0)  * ISNULL(Biaya_Kemas,0))
            + ISNULL(Beban_Sisa_Bahan_Exp,0)
           ) / NULLIF(Batch_Size * Group_Rendemen / 100, 0) HPPSesudah,
           0 HPP2Sebelum
    FROM #tmp a
    WHERE LOB IN ('Ethical', 'OTC', 'Export')
    UNION ALL
    SELECT a.Product_ID, Product_Name, totalBB + totalBK totalBahanSesudah,
           ((ISNULL(totalBB,0) + ISNULL(totalBK,0))
            + (ISNULL(a.MH_Proses_Std,0)  * ISNULL(Biaya_Proses,0)
             + ISNULL(a.MH_Kemas_Std,0)   * ISNULL(Biaya_Kemas,0)
             + ISNULL(a.MH_Timbang_BB,0)  * ISNULL(Biaya_Proses,0)
             + ISNULL(a.MH_Timbang_BK,0)  * ISNULL(Biaya_Kemas,0)
             + ISNULL(a.MH_Analisa_Std,0) * ISNULL(Biaya_Analisa,0))
            + Biaya_Reagen
            + ISNULL(Beban_Sisa_Bahan_Exp,0)
            + (MH_Mesin_Std * a.Rate_PLN)
           ) / NULLIF(Batch_Size * Group_Rendemen / 100, 0) HPPGen1Sesudah,
           ((ISNULL(totalBB,0) + ISNULL(totalBK,0))
            + ISNULL(a.MH_Proses_Std,0) * ISNULL((Factory_Over_Head * 50 / 100), 0)
            + ISNULL(a.MH_kemas_Std,0)  * ISNULL((Factory_Over_Head * 50 / 100), 0)
            + ISNULL(a.MH_Proses_Std,0) * ISNULL(Direct_Labor, 0)
            + ISNULL(a.MH_kemas_Std,0)  * ISNULL(Direct_Labor, 0)
            + ISNULL(a.MH_Proses_Std,0) * ISNULL(Depresiasi, 0)
            + ISNULL(a.MH_kemas_Std,0)  * ISNULL(Depresiasi, 0)
           ) / NULLIF(Batch_Size * Group_Rendemen / 100, 0) HPPGen2Sesudah
    FROM #tmp a
    WHERE LOB = 'GENERIK'
) dataAfter;

SELECT * INTO #tmpDataBefore FROM (
    SELECT a.Product_ID, Product_Name, totalBB + totalBK totalBahanSebelum,
           CASE WHEN ISNULL(Batch_Size,0) = 0 OR ISNULL(Group_Rendemen,0) = 0 THEN 0 ELSE
                ((ISNULL(totalBB,0) + ISNULL(totalBK,0))
                 + (ISNULL(a.MH_Proses_Std,0) * ISNULL(Biaya_Proses,0))
                 + (ISNULL(a.MH_Kemas_Std,0)  * ISNULL(Biaya_Kemas,0))
                 + ISNULL(Beban_Sisa_Bahan_Exp,0)
                ) / (Batch_Size * Group_Rendemen / 100)
           END HPPSebelum,
           0 HPP2Sebelum
    FROM #tmpCurrentHPP a
    JOIN m_product b ON a.Product_ID = b.Product_ID
    WHERE LOB IN ('Ethical', 'OTC')
    UNION ALL
    SELECT a.Product_ID, Product_Name, totalBB + totalBK totalBahanSebelum,
           CASE WHEN ISNULL(Batch_Size,0) = 0 OR ISNULL(Group_Rendemen,0) = 0 THEN 0 ELSE
                ((ISNULL(totalBB,0) + ISNULL(totalBK,0))
                 + (ISNULL(a.MH_Proses_Std,0)  * ISNULL(Biaya_Proses,0)
                  + ISNULL(a.MH_Kemas_Std,0)   * ISNULL(Biaya_Kemas,0)
                  + ISNULL(a.MH_Timbang_BB,0)  * ISNULL(Biaya_Proses,0)
                  + ISNULL(a.MH_Timbang_BK,0)  * ISNULL(Biaya_Kemas,0)
                  + ISNULL(a.MH_Analisa_Std,0) * ISNULL(Biaya_Analisa,0))
                 + Biaya_Reagen
                 + ISNULL(Beban_Sisa_Bahan_Exp,0)
                 + (MH_Mesin_Std * a.Rate_PLN)
                ) / (Batch_Size * Group_Rendemen / 100)
           END HPPGen1Sebelum,
           CASE WHEN ISNULL(Batch_Size,0) = 0 OR ISNULL(Group_Rendemen,0) = 0 THEN 0 ELSE
                ((ISNULL(totalBB,0) + ISNULL(totalBK,0))
                 + ISNULL(a.MH_Proses_Std,0) * ISNULL((Factory_Over_Head * 50 / 100), 0)
                 + ISNULL(a.MH_kemas_Std,0)  * ISNULL((Factory_Over_Head * 50 / 100), 0)
                 + ISNULL(a.MH_Proses_Std,0) * ISNULL(Direct_Labor, 0)
                 + ISNULL(a.MH_kemas_Std,0)  * ISNULL(Direct_Labor, 0)
                 + ISNULL(a.MH_Proses_Std,0) * ISNULL(Depresiasi, 0)
                 + ISNULL(a.MH_kemas_Std,0)  * ISNULL(Depresiasi, 0)
                ) / (Batch_Size * Group_Rendemen / 100)
           END HPPGen2Sebelum
    FROM #tmpCurrentHPP a
    JOIN m_product b ON a.Product_ID = b.Product_ID
    WHERE LOB = 'GENERIK'
) dataBefore;

SELECT DISTINCT
    a.Product_ID,
    a.Product_Name,
    b.totalBahanSebelum,
    a.totalBahanSesudah,
    b.HPPSebelum,
    a.HPPSesudah
FROM #tmpDataAfter a
LEFT JOIN #tmpDataBefore b ON a.Product_ID = b.Product_ID
ORDER BY Product_Name;

DROP TABLE #tmp;
DROP TABLE #tmpCurrentHPP;
DROP TABLE #tmpDataAfter;
DROP TABLE #tmpDataBefore;
DROP TABLE #t_COGS_HPP_Product_Header_Simulasi;
DROP TABLE #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan;
DROP TABLE #tmp_list_material_changes;
DROP TABLE #tmp_list_product_terdampak;
DROP TABLE #tmp_currency_changes;
GO
