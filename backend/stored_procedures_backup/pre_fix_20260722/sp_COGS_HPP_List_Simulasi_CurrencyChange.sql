CREATE PROCEDURE [dbo].[sp_COGS_HPP_List_Simulasi_CurrencyChange]
    @Simulasi_Deskripsi AS nvarchar(4000) = '%',
    @Simulasi_Date      AS datetime       = NULL
AS
SET NOCOUNT ON

DECLARE @currentPeriode AS varchar(4);
SELECT @currentPeriode = MAX(periode) FROM t_COGS_HPP_Product_Header;

SELECT a.*, ISNULL(bb.total, 0) totalBB, ISNULL(bk.total, 0) totalBK
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

SELECT a.*, ISNULL(bb.total, 0) totalBB, ISNULL(bk.total, 0) totalBK
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
WHERE a.Simulasi_Type = 'Currency Changes';

SELECT * INTO #tmpDataAfter FROM (
    SELECT a.Simulasi_Deskripsi, Simulasi_Date, a.Product_ID, Product_Name, totalBB + totalBK totalBahanSesudah,
           ((ISNULL(totalBB,0) + ISNULL(totalBK,0))
            + (ISNULL(a.MH_Proses_Std,0) * ISNULL(Biaya_Proses,0))
            + (ISNULL(a.MH_Kemas_Std,0)  * ISNULL(Biaya_Kemas,0))
            + ISNULL(Beban_Sisa_Bahan_Exp,0)
           ) / NULLIF(Batch_Size * Group_Rendemen / 100, 0) HPPSesudah,
           0 HPP2Sebelum
    FROM #tmp a
    WHERE LOB IN ('Ethical', 'OTC', 'EXPORT')
    UNION ALL
    SELECT a.Simulasi_Deskripsi, Simulasi_Date, a.Product_ID, Product_Name, totalBB + totalBK totalBahanSesudah,
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
    a.Simulasi_Deskripsi,
    a.Simulasi_Date,
    a.Product_ID,
    a.Product_Name,
    b.totalBahanSebelum,
    a.totalBahanSesudah,
    b.HPPSebelum,
    a.HPPSesudah,
    CASE WHEN ISNULL(b.HPPSebelum, 0) = 0 THEN 0
         ELSE (a.HPPSesudah - b.HPPSebelum) / b.HPPSebelum * 100
    END persentase_perubahan,
    c.Product_SalesHNA,
    CASE WHEN ISNULL(c.Product_SalesHNA, 0) = 0 THEN 0
         ELSE b.HPPSebelum / c.Product_SalesHNA
    END Rasio_HPP_Sebelum,
    CASE WHEN ISNULL(c.Product_SalesHNA, 0) = 0 THEN 0
         ELSE a.HPPSesudah / c.Product_SalesHNA
    END Rasio_HPP_Sesudah
FROM #tmpDataAfter a
LEFT JOIN #tmpDataBefore b ON a.Product_ID = b.Product_ID
LEFT JOIN m_product c     ON a.Product_ID = c.Product_ID
WHERE a.Simulasi_Deskripsi LIKE @Simulasi_Deskripsi
  AND CONVERT(varchar(25), a.Simulasi_Date, 120) =
      ISNULL(CONVERT(varchar(25), @Simulasi_Date, 120), '%')
ORDER BY Simulasi_Date DESC, Simulasi_Deskripsi, Product_Name;

DROP TABLE #tmp;
DROP TABLE #tmpCurrentHPP;
DROP TABLE #tmpDataAfter;
DROP TABLE #tmpDataBefore;