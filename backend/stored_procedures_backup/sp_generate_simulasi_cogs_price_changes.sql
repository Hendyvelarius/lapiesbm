
--exec sp_generate_simulasi_cogs_product_existing '01','GLC#-#B#A'
----select * from vw_COGS_Product_Group where Group_ProductID='01'
--select * from t_COGS_HPP_Product_Header_Simulasi order by simulasi_id desc
--select * from dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--exec sp_generate_simulasi_cogs_price_changes 'AC 009C:6#AC 015B:25'
--select * from 
CREATE procedure [dbo].[sp_generate_simulasi_cogs_price_changes] 
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


declare @ringkasan_perubahan as nvarchar(max);
SELECT @ringkasan_perubahan=
    STUFF((
        SELECT CHAR(10) + kode_bahan + ': ' 
               + CAST(harga_sebelum AS VARCHAR(50)) 
               + ' -> ' + CAST(harga_sesudah AS VARCHAR(50)) + '; '
        
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