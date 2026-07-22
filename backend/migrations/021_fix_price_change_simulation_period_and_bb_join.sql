-- 021: Fix two defects in the price-change simulation pipeline.
--
-- 1) sp_COGS_HPP_List_Simulasi_PriceChange / _CurrencyChange
--    The "after" query INNER JOINed the BB (raw material) subtotal, while the matching
--    "before" query (#tmpCurrentHPP) LEFT JOINs it. Any product whose formula has no BB
--    lines (packaging-only products, e.g. ACLAM-500) was therefore dropped from the
--    result set even though its simulation row existed -- surfacing in the UI as
--    "No Products found that use this material". Both totals are already wrapped in
--    ISNULL(...,0) in the SELECT, so LEFT JOIN is safe.
--
-- 2) sp_generate_simulasi_cogs_price_changes
--    #tmp_list_product_terdampak joined t_COGS_HPP_Product_Detail_Formula with no period
--    filter, so a product that used the changed material in an older period but not in
--    the current one was flagged as affected. Its detail rows are then built with
--    "where Periode = @currentPeriode", where the material is absent, so before and
--    after were identical and the product reported exactly 0.00% change.
--
-- Pre-change definitions are archived in
-- backend/stored_procedures_backup/pre_fix_20260722/.

GO


--select ITEM_TYPE, SUM(unitprice)  from vw_COGS_FORMULA_List_detail where Product_ID='48' and DefaultCOGS='Aktif' group by ITEM_TYPE
--select *  from vw_COGS_FORMULA_List_detail where Product_ID='48' and DefaultCOGS='Aktif' group by ITEM_TYPE
--exec [sp_COGS_HPP_List_Simulasi_PriceChange] 'Price Changes : IN 003: 22000 -> 32000; ','2025-09-30 10:18:58.340'



ALTER PROCEDURE [dbo].[sp_COGS_HPP_List_Simulasi_PriceChange] 
@Simulasi_Deskripsi as nvarchar(4000)='%', @Simulasi_Date as datetime=null
as
declare @currentPeriode as varchar(4);

select @currentPeriode = MAX(periode) from t_COGS_HPP_Product_Header
--E#-#-#-#F#-#G
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--delete t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--delete t_COGS_HPP_Product_Header_Simulasi
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--select * from t_COGS_HPP_Product_Header_Simulasi order by simulasi_date desc
select a.*, isnull(bb.total,0) totalBB,  isnull(bk.total,0) totalBK
into #tmpCurrentHPP
from t_COGS_HPP_Product_Header a left join
(select periode, product_id, sum(total) total 
from t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BB'
group by  product_id, periode) bb on a.Periode=bb.periode and a.Product_ID=bb.Product_ID
left join 
(select periode, product_id,  sum(total) total 
from t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BK'
group by  product_id, periode) bk on a.Periode=bk.periode and a.Product_ID=bk.Product_ID
where a.Periode = @currentPeriode






select a.*, isnull(bb.total,0) totalBB,  isnull(bk.total,0) totalBK
into #tmp
from t_COGS_HPP_Product_Header_Simulasi a left join
(select periode, simulasi_id, sum(item_qty*item_unit_price) total 
from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where Tipe_Bahan='BB'
group by  simulasi_id, periode) bb on a.Periode=bb.periode and a.simulasi_id=bb.simulasi_id
left join 
(select periode, simulasi_id,  sum(item_qty*item_unit_price) total 
from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where Tipe_Bahan='BK'
group by  simulasi_id, periode) bk on a.Periode=bk.periode and a.simulasi_id=bk.simulasi_id
where a.Simulasi_Type='Price Changes'
--and a.Simulasi_Deskripsi like @Simulasi_Deskripsi --and a.Simulasi_Date like isnull(@Simulasi_Date,'%')

select * into #tmpDataAfter from (
select a.Simulasi_Deskripsi, Simulasi_Date, a.Product_ID, Product_Name, totalBB+totalBK totalBahanSesudah, 
((isnull(totalBB,0)+isnull(totalBK,0))+
 (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+
 (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
 isnull(Beban_Sisa_Bahan_Exp,0) 
)/(Batch_Size*Group_Rendemen/100) HPPSesudah, 0 HPP2Sebelum
from #tmp a --join m_product b on a.product_id=b.product_id
where lob in ('Ethical','OTC','EXPORT')
union all
select a.Simulasi_Deskripsi, Simulasi_Date, a.Product_ID, Product_Name, totalBB+totalBK totalBahanSesudah, 
((isnull(totalBB,0)+isnull(totalBK,0))+ 
(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Timbang_BB,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Timbang_BK,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Analisa_Std,0)*isnull(Biaya_Analisa,0))
+Biaya_Reagen
+isnull(Beban_Sisa_Bahan_Exp,0) 
+(MH_Mesin_Std * a.Rate_PLN))
/(Batch_Size*Group_Rendemen/100) HPPGen1Sesudah,
((isnull(totalBB,0)+isnull(totalBK,0))+ 
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ 
--(isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
--(isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
	isnull(a.MH_Proses_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_kemas_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_Proses_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_Proses_Std,0)*isnull(Depresiasi,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Depresiasi,0)
)/(Batch_Size*Group_Rendemen/100) HPPGen2Sesudah
from #tmp a 
where Lob='GENERIK' ) dataAfter

select * into #tmpDataBefore from (
select a.Product_ID, Product_Name, totalBB+totalBK totalBahanSebelum,
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+
 (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+
 (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
 isnull(Beban_Sisa_Bahan_Exp,0) 
)/(Batch_Size*Group_Rendemen/100) end HPPSebelum, 0 HPP2Sebelum
from #tmpCurrentHPP a join m_product b on a.Product_ID=b.Product_ID
where lob in ('Ethical','OTC')
union all
select a.Product_ID, Product_Name, totalBB+totalBK totalBahanSebelum, 
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+ 
(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Timbang_BB,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Timbang_BK,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Analisa_Std,0)*isnull(Biaya_Analisa,0))
+Biaya_Reagen
+isnull(Beban_Sisa_Bahan_Exp,0) 
+(MH_Mesin_Std * a.Rate_PLN))/(Batch_Size*Group_Rendemen/100) end HPPGen1Sebelum,
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+ 
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
	isnull(a.MH_Proses_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_kemas_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_Proses_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_Proses_Std,0)*isnull(Depresiasi,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Depresiasi,0)
)/(Batch_Size*Group_Rendemen/100) end HPPGen2Sebelum
from #tmpCurrentHPP a join m_product b on a.Product_ID=b.Product_ID 
where Lob='GENERIK' ) dataBefore

select distinct a.Simulasi_Deskripsi, a.Simulasi_Date, a.Product_ID, a.Product_Name, b.totalBahanSebelum, a.totalBahanSesudah, b.HPPSebelum, a.HPPSesudah,
(HPPSesudah-HPPSebelum)/HPPSebelum*100
persentase_perubahan
, c.Product_SalesHNA, 
case when isnull(Product_SalesHNA,0)=0 then 0 else HPPSebelum/Product_SalesHNA end  Rasio_HPP_Sebelum, 
case when isnull(Product_SalesHNA,0)=0 then 0 else HPPSesudah/Product_SalesHNA end Rasio_HPP_Sesudah
 from #tmpDataAfter a left join #tmpDataBefore b on
a.Product_ID=b.Product_ID 
 left join m_product c on a.product_id=c.product_id and a.Product_ID=c.Product_ID
where a.Simulasi_Deskripsi like @Simulasi_Deskripsi 
and
CONVERT(varchar(25),a.Simulasi_Date,120) = 
isnull(CONVERT(varchar(25),@Simulasi_Date,120),'%')

order by Simulasi_Date desc, Simulasi_Deskripsi, Product_Name


--select CONVERT(varchar(25),'2025-09-24 00:27:38.087',120)
drop table #tmp
drop table #tmpCurrentHPP
drop table #tmpDataAfter
drop table #tmpDataBefore

GO
ALTER PROCEDURE [dbo].[sp_COGS_HPP_List_Simulasi_CurrencyChange]
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
LEFT JOIN (
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
GO

--exec sp_generate_simulasi_cogs_product_existing '01','GLC#-#B#A'
----select * from vw_COGS_Product_Group where Group_ProductID='01'
--select * from t_COGS_HPP_Product_Header_Simulasi order by simulasi_id desc
--select * from dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--exec sp_generate_simulasi_cogs_price_changes 'AC 009C:6#AC 015B:25'
--select * from 
ALTER PROCEDURE [dbo].[sp_generate_simulasi_cogs_price_changes] 
(@var_data_perubahanBahan as nvarchar(4000))
as
set nocount on
--exec [sp_generate_simulasi_cogs_price_changes]
--declare @var_data_perubahanBahan as nvarchar(4000)
--set @var_data_perubahanBahan='IN 028:125#AC 049C:90'
--set @var_data_perubahanBahan='AC 079:1208.60'
--set @var_data_perubahanBahan='AC 014B:31'

declare @currentPeriode as varchar(4);
select @currentPeriode = MAX(periode) from t_COGS_HPP_Product_Header

--select * from #tmp_list_material_changes

select distinct x.kode_bahan, x.harga_sesudah,
ITEM_PURCHASE_STD_PRICE --dbo.fnConvertBJ(b.ITEM_ID,ITEM_PURCHASE_STD_PRICE,
--item_purchase_unit, c.Item_Unit) 
harga_sebelum,
ITEM_PURCHASE_STD_PRICE harga_beli,
c.item_unit, item_purchase_unit, b.ITEM_CURRENCY, d.Kurs
into #tmp_list_material_changes
 from 
	(select   LEFT(items, CHARINDEX(':', items) - 1) AS kode_bahan,
	--b.ITEM_PURCHASE_STD_PRICE,
	--dbo.fnConvertBJ(stdBahan.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE UnitPrice,
	RIGHT(items, LEN(items) - CHARINDEX(':', items)) AS harga_sesudah
	from dbo.Split(@var_data_perubahanBahan,'#') a) x 
	join M_COGS_STD_HRG_BAHAN b on kode_bahan=b.ITEM_ID
	join m_item_manufacturing c on c.Item_ID = b.ITEM_ID
	join vw_COGS_Currency_List d on d.Curr_Code=b.ITEM_CURRENCY 
		and b.Periode=d.Periode
		and d.Periode = year(GETDATE())
	
	
	
select distinct a.Product_ID into #tmp_list_product_terdampak
from	t_COGS_HPP_Product_Header a join 
		t_COGS_HPP_Product_Detail_Formula b 
	on a.Product_ID = b.Product_ID
	join #tmp_list_material_changes c on c.kode_bahan = b.PPI_ItemID
	where a.Periode = @currentPeriode and b.Periode = @currentPeriode


declare @ringkasan_perubahan as nvarchar(max);
SELECT @ringkasan_perubahan=
    STUFF((
        SELECT CHAR(10) + kode_bahan + ': ' 
               --+ CAST(harga_sebelum AS VARCHAR(50)) 
               --+ ' -> ' + CAST(harga_sesudah AS VARCHAR(50)) + '; '
			   + CAST(cast(harga_sebelum as decimal(18,3)) AS VARCHAR(50)) 
               + ' -> ' + CAST(cast(harga_sesudah as decimal(18,3)) AS VARCHAR(50)) + '; '
        FROM #tmp_list_material_changes
        FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '') --AS ringkasan_perubahan;


declare @simulasi_id as int
declare @simulasi_date as datetime
select @simulasi_id =isnull(MAX(simulasi_id),0) from t_COGS_HPP_Product_Header_Simulasi
select @simulasi_date =GETDATE()

--data header
select [Periode]
           , @simulasi_id+ ROW_NUMBER() over (order by c.product_name)  [Simulasi_ID]
           , 'Price Changes : ' + @ringkasan_perubahan [Simulasi_Deskripsi]
           , @simulasi_date [Simulasi_Date]
           , 'Price Changes' [Simulasi_Type]
           , replace(replace(replace(replace(replace([Formula],'PI:',''),'PS:',''),'KP:',''),'KS:',''),', ','#')[Formula]
 
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
into #t_COGS_HPP_Product_Header_Simulasi
from t_COGS_HPP_Product_Header a join #tmp_list_product_terdampak b
on a.Product_ID=b.Product_ID 
join m_product c on c.Product_ID=a.Product_ID
where a.Periode=@currentPeriode


--data detail
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--insert into t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
select --YEAR(getdate()) Periode, b.Simulasi_ID,ROW_NUMBER() over (partition by a.item_type order by a.ppi_itemid)
--seq_id, 
d.Periode,
d.Simulasi_id,
a.PPI_SeqID,
a.product_id,
a.item_type, PPI_ItemID, c.Item_Name, PPI_QTY, PPI_UnitID, cast(a.total/PPI_QTY  as decimal(18,2)) Unit_Price
into #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
from t_COGS_HPP_Product_Detail_Formula a 
	join #tmp_list_product_terdampak b
		on a.Product_ID = b.Product_ID --and a.TypeCode=b.TypeCode and a.PPI_SubID=part_value
	left join m_item_manufacturing c on c.ITEM_ID=a.PPI_ItemID
	join #t_COGS_HPP_Product_Header_Simulasi d on d.Product_ID= a.Product_ID
--select * from t_
where a.Periode=@currentPeriode


-- update harga bahan
update #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan set Unit_Price=
	dbo.fnConvertBJ(a.kode_bahan,1,item_purchase_unit, ppi_unitid) * harga_sesudah * kurs
from #tmp_list_material_changes a join #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan b
on a.kode_bahan=b.PPI_ItemID 

--select * from #tmp_list_product_terdampak

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
           
select [Periode]
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
           ,[Depresiasi] from #t_COGS_HPP_Product_Header_Simulasi



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
           
select [Periode]
           ,[Simulasi_ID]
           ,[PPI_SeqID]
           ,ITEM_TYPE
           ,PPI_ItemID
           ,[Item_Name]
           ,PPI_QTY
           ,PPI_UnitID
           ,Unit_Price from #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan


drop table #t_COGS_HPP_Product_Header_Simulasi
drop table #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
drop table #tmp_list_material_changes
drop table #tmp_list_product_terdampak

--select * from t_ppk_header where no_ppk='00876/IX/2025'
--select * from t_ppk_detail where pk_id='7297' and seq_id='3'
--update t_ppk_detail set exp_date='Nov 2026' where pk_id='7297' and seq_id='3'


--declare @_product_id as varchar(255) 
--set @_product_id = @product_id;--'01'
--declare @_formulaPPPIKPKS as varchar(255) 
--set @_formulaPPPIKPKS = @formulaPPPIKPKS--'GLC#-#B#A';

--DECLARE @s VARCHAR(50) = @_formulaPPPIKPKS;

--;WITH parts AS (
--    SELECT 
--        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS part_no,
--        x.value('.', 'VARCHAR(50)') AS part_value
--    FROM (
--        SELECT CAST('<x>' + REPLACE(@s, '#', '</x><x>') + '</x>' AS XML) AS xmlData
--    ) t
--    CROSS APPLY xmlData.nodes('/x') AS n(x)
--)
--SELECT 
--@simulasi_id as Simulasi_ID,
--@_product_id as Product_ID,
--case 
--	when part_no='1' then 'PI' 
--	when part_no='2' then 'PS' 
--	when part_no='3' then 'KP' 
--	when part_no='4' then 'KS' 
--end as TypeCode
--, part_value 
--into #tmpProductFormula
--FROM parts;

----DECLARE @s VARCHAR(50) = @_formulaPPPIKPKS;
----SELECT
----	@_product_id as Product_ID,
----    x.value('/x[1]', 'VARCHAR(50)') AS PP,
----    x.value('/x[2]', 'VARCHAR(50)') AS PI,
----    x.value('/x[3]', 'VARCHAR(50)') AS KP,
----    x.value('/x[4]', 'VARCHAR(50)') AS KS
----    into #tmpFormula
----FROM (
----    SELECT CAST('<x>' + REPLACE(@s, '#', '</x><x>') + '</x>' AS XML) AS xmlData
----) t
----CROSS APPLY (SELECT xmlData.query('.')) q(y)
----CROSS APPLY (SELECT y AS x) a;


--insert into t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--select YEAR(getdate()) Periode, b.Simulasi_ID,ROW_NUMBER() over (partition by a.item_type order by a.ppi_itemid)
--seq_id, a.item_type, PPI_ItemID, c.Item_Name, PPI_QTY, PPI_UnitID, UnitStdPrice Unit_Price
--from vw_COGS_FORMULA_List_detail a 
--	join #tmpProductFormula b
--		on a.Product_ID = b.Product_ID and a.TypeCode=b.TypeCode and a.PPI_SubID=part_value
--	left join m_item_manufacturing c on c.ITEM_ID=a.PPI_ItemID


--INSERT INTO [Lapifactory].[dbo].[t_COGS_HPP_Product_Header_Simulasi]
--           ([Periode]
--           ,[Simulasi_ID]
--           ,[Simulasi_Deskripsi]
--           ,[Simulasi_Date]
--           ,[Simulasi_Type]
--           ,[Formula]
 
--           ,[Product_ID]
--           ,[Product_Name]
--           ,[Group_PNCategory]
--           ,[Group_PNCategory_Name]
--           ,[Group_PNCategory_Dept]
--           ,[Group_Rendemen]
--           ,[Batch_Size]
--           ,[LOB]
--           ,[versi]
 
--           ,[MH_Proses_Std]
--           ,[MH_Kemas_Std]
--           ,[MH_Analisa_Std]
--           ,[MH_Timbang_BB]
--           ,[MH_Timbang_BK]
--           ,[MH_Mesin_Std]
 
--           ,[Biaya_Proses]
--           ,[Biaya_Kemas]
--           ,[Biaya_Generik]
--           ,[Biaya_Reagen]
 
--           ,[Toll_Fee]
--           ,[Rate_PLN]
--           ,[Direct_Labor]
--           ,[Factory_Over_Head]
--           ,[Depresiasi])
----select * from [t_COGS_HPP_Product_Header_Simulasi]
--select distinct 
--YEAR(GETDATE()) periode, @simulasi_id,'',GETDATE(), 'Product Existing',@formulaPPPIKPKS Formula,

-- a.Group_ProductID, prod.Product_Name,  Group_PNCategory, Group_PNCategoryName,  Group_Dept, 
-- group_rendemen, Std_Output, 
-- case 
--	when prod.Product_Name like '%generik%' then 'GENERIC' 
--	when otc.Product_ID is not null then 'OTC'
--	when prl.Name like 'EKSPOR' then 'EXPORT'
--	else 'ETHICAL'
--	end LOB,1,
	
--Group_ManHourPros, Group_ManHourPack, Group_MH_Analisa, Group_MHT_BB, Group_MHT_BK, Group_KWH_Mesin,
--isnull(b.Group_Proses_Rate,c.Group_Proses_Rate) Group_Proses_Rate, isnull(b.Group_Kemas_Rate, c.Group_Kemas_Rate) Group_Kemas_Rate,
--isnull(b.Group_Generik_Rate, c.Group_Generik_Rate) Group_Generik_Rate,
--isnull(b.Group_Analisa_Rate, c.Group_Analisa_Rate) Biaya_Analisa, 
-- b.toll_Fee, 
--stdParam.Rate_KWH_Mesin, 
--case 
--when Group_Dept='PN1' then Direct_Labor_PN1 
--when Group_Dept='PN2' then Direct_Labor_PN2
--else 0 end Direct_Labor, 
--case 
--when Group_Dept='PN1' then Factory_Over_Head_PN1 
--when Group_Dept='PN2' then Factory_Over_Head_PN2
--else 0 end Factory_Over_Head, 
--case 
--when Group_Dept='PN1' then Depresiasi_PN1 
--when Group_Dept='PN2' then Depresiasi_PN2
--else 0 end Depresiasi
--from vw_COGS_Product_Group a left join M_COGS_PEMBEBANAN b 
--on a.Group_PNCategory=b.Group_PNCategoryID and a.Group_ProductID=b.Group_ProductID
--join M_COGS_PEMBEBANAN c
--on a.Group_PNCategory=c.Group_PNCategoryID and c.Group_ProductID is null
--join M_COGS_PRODUCT_FORMULA_FIX ff on ff.Product_ID=a.group_productid--and a.Periode=ff.Periode 
--join m_product prod on a.Group_ProductID=prod.Product_ID
--left join m_Product_RuangLingkup prl on prod.Product_RuangLingkup=prl.ID
--left join m_product_otc otc on prod.Product_ID = otc.Product_ID and otc.isActive=1
--, M_COGS_STD_PARAMETER stdParam 

--where a.Group_ProductID=@product_id


--update [t_COGS_HPP_Product_Header_Simulasi] set 
--Beban_Sisa_Bahan_Exp=isnull(b.Beban_Sisa_Bahan_Exp,0)
--from [t_COGS_HPP_Product_Header_Simulasi] a join 
--(select periode, product_id, SUM(Beban_Sisa_Bahan_Exp) beban_sisa_bahan_exp from M_COGS_PEMBEBANAN_EXPIRED group by periode, product_id) 
--b on a.Product_ID=b.product_id and b.periode=a.periode



 
--select * from [t_COGS_HPP_Product_Header_Simulasi] where simulasi_id=@simulasi_id

----select * from #tmpProductFormula
----select * from t_COGS_HPP_Product_Header_Simulasi
------select * from vw_COGS_FORMULA_List_detail 
----SELECT * FROM m_Product_RuangLingkup
----select * from vw_COGS_Product_Group where Group_ProductID='FR'

----SELECT * FROM M_PRODUCT WHERE Product_RuangLingkup='09'
----SELECT * FROM t_Product_Stock_Position WHERE St_ProductID='FR'
----SELECT * FROM vw_COGS_FORMULA_List_detail WHERE Product_ID='fr'
----select * from vw_COGS_FORMULA_List_detail where Product_ID='01' and PPI_SubID='GLC'
----select * from [t_COGS_HPP_Product_Header_Simulasi]


----select product_id, item_type, PPI_ItemID, PPI_QTY, PPI_UnitID, total / ppi_qty Item_unit, total  from t_COGS_HPP_Product_Detail_Formula 
----order by product_id, ITEM_TYPE, PPI_ItemID

----drop table #tmpProductFormula


select a.*, bb.total totalBB,  bk.total totalBK
into #tmpCurrentHPP
from t_COGS_HPP_Product_Header a left join
(select periode, product_id, sum(total) total 
from t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BB'
group by  product_id, periode) bb on a.Periode=bb.periode and a.Product_ID=bb.Product_ID
left join 
(select periode, product_id,  sum(total) total 
from t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BK'
group by  product_id, periode) bk on a.Periode=bk.periode and a.Product_ID=bk.Product_ID
where a.Periode = @currentPeriode

--select * from t_COGS_HPP_Product_Header_Simulasi order by simulasi_id desc
--declare @ringkasan_perubahan as nvarchar(4000) = 'Price Changes : AC 209A: 0.00187 -> 50.4; '
--declare @simulasi_date as datetime ='2025-09-23 20:51:50.573' 
--select @simulasi_date, @ringkasan_perubahan
select a.*, bb.total totalBB,  bk.total totalBK
into #tmp
from t_COGS_HPP_Product_Header_Simulasi a join
(select periode, simulasi_id, sum(item_qty*item_unit_price) total 
from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where Tipe_Bahan='BB'
group by  simulasi_id, periode) bb on a.Periode=bb.periode and a.simulasi_id=bb.simulasi_id
left join 
(select periode, simulasi_id,  sum(item_qty*item_unit_price) total 
from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where Tipe_Bahan='BK'
group by  simulasi_id, periode) bk on a.Periode=bk.periode and a.simulasi_id=bk.simulasi_id
where a.Simulasi_Deskripsi='Price Changes : ' + @ringkasan_perubahan and a.Simulasi_Date=@simulasi_date

select * into #tmpDataAfter from (
select a.Product_ID, Product_Name, totalBB+totalBK totalBahanSesudah, 
((isnull(totalBB,0)+isnull(totalBK,0))+
 (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+
 (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
 isnull(Beban_Sisa_Bahan_Exp,0) 
)/(Batch_Size*Group_Rendemen/100) HPPSesudah, 0 HPP2Sebelum
from #tmp a --join m_product b on a.product_id=b.product_id
where lob in ('Ethical','OTC','Export')
union all
select a.Product_ID, Product_Name, totalBB+totalBK totalBahanSesudah, 
((isnull(totalBB,0)+isnull(totalBK,0))+ 
(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Timbang_BB,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Timbang_BK,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Analisa_Std,0)*isnull(Biaya_Analisa,0))
+Biaya_Reagen
+isnull(Beban_Sisa_Bahan_Exp,0) 
+(MH_Mesin_Std * a.Rate_PLN))
/(Batch_Size*Group_Rendemen/100) HPPGen1Sesudah,
((isnull(totalBB,0)+isnull(totalBK,0))+ 
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ 
--(isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
--(isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
	isnull(a.MH_Proses_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_kemas_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_Proses_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_Proses_Std,0)*isnull(Depresiasi,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Depresiasi,0)
)/(Batch_Size*Group_Rendemen/100) HPPGen2Sesudah
from #tmp a 
where Lob='GENERIK' ) dataAfter

select * into #tmpDataBefore from (
select a.Product_ID, Product_Name, totalBB+totalBK totalBahanSebelum,
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+
 (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+
 (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
 isnull(Beban_Sisa_Bahan_Exp,0) 
)/(Batch_Size*Group_Rendemen/100) end HPPSebelum, 0 HPP2Sebelum

from #tmpCurrentHPP a join m_product b on a.Product_ID=b.Product_ID
where lob in ('Ethical','OTC')
union all
select a.Product_ID, Product_Name, totalBB+totalBK totalBahanSebelum, 
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+ 
(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Timbang_BB,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Timbang_BK,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Analisa_Std,0)*isnull(Biaya_Analisa,0))
+Biaya_Reagen
+isnull(Beban_Sisa_Bahan_Exp,0) 
+(MH_Mesin_Std * a.Rate_PLN))/(Batch_Size*Group_Rendemen/100) end HPPGen1Sebelum,
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+ 
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
	isnull(a.MH_Proses_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_kemas_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_Proses_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_Proses_Std,0)*isnull(Depresiasi,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Depresiasi,0)
)/(Batch_Size*Group_Rendemen/100) end HPPGen2Sebelum
from #tmpCurrentHPP a join m_product b on a.Product_ID=b.Product_ID 
where Lob='GENERIK' ) dataBefore

select distinct a.Product_ID, a.Product_Name, b.totalBahanSebelum, a.totalBahanSesudah, b.HPPSebelum, a.HPPSesudah from #tmpDataAfter a left join #tmpDataBefore b on
a.Product_ID=b.Product_ID order by Product_Name

--select * from #tmpDataAfter

drop table #tmp
drop table #tmpCurrentHPP
drop table #tmpDataAfter
drop table #tmpDataBefore
--2025-09-23 20:55:48.837 Price Changes : AC 209A: 0.00187 -> 50.4; 
--2025-09-23 20:55:48.837	AC 209A: 0.00187 -> 50.4; 
--select * from t_COGS_HPP_Product_Header_Simulasi order by Simulasi_ID desc
--select * from #tmpDataafter
--select * from #tmpDatabefore where product_id='AO'

--select * from #tmpCurrentHPP where isnull(Group_Rendemen  ,0)=0 
--select * from m_product where Product_ID='GF'
GO
