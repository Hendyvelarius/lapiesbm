
--exec sp_generate_simulasi_cogs_product_existing '01','GLC#-#B#A'
----select * from vw_COGS_Product_Group where Group_ProductID='01'
--select * from t_COGS_HPP_Product_Header_Simulasi order by simulasi_id desc
--select * from dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--exec sp_generate_simulasi_cogs_price_changes 'AC 009C:6#AC 015B:25'
--select * from 261360000.000000000000
---select 24.200000*18000*600.000000 =261360.000000
--exec sp_generate_simulasi_cogs_price_update_commit 'IN 009:30', '2026'
--exec sp_generate_simulasi_cogs_price_update_commit 'IN 155:20', '2025'
--select * from t_COGS_HPP_Product_Detail_Formula where Product_ID='AS' and PPI_ItemID='IN 155'
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where  Item_ID='IN 155'
CREATE procedure [dbo].[sp_generate_simulasi_cogs_price_update_commit] 
(@var_data_perubahanBahan as nvarchar(4000), @periode as varchar(4))
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
	join M_COGS_STD_HRG_BAHAN b on kode_bahan=b.ITEM_ID and b.Periode=@periode
	join m_item_manufacturing c on c.Item_ID = b.ITEM_ID
	join vw_COGS_Currency_List d on d.Curr_Code=b.ITEM_CURRENCY and d.Periode = @periode --year(GETDATE())

select distinct a.Product_ID into #tmp_list_product_terdampak
from	t_COGS_HPP_Product_Header a join 
		t_COGS_HPP_Product_Detail_Formula b 
	on a.Product_ID = b.Product_ID
	join #tmp_list_material_changes c on c.kode_bahan = b.PPI_ItemID and a.Periode=b.Periode
	where a.Periode=@periode


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
           , 'Price Update : ' + @ringkasan_perubahan [Simulasi_Deskripsi]
           , @simulasi_date [Simulasi_Date]
           , 'Price Update' [Simulasi_Type]
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
where a.Periode=@periode--@currentPeriode


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
where a.Periode=@periode--@currentPeriode


-- update harga bahan
update #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan set Unit_Price=
	dbo.fnConvertBJ(a.kode_bahan,1,item_purchase_unit, ppi_unitid) * harga_sesudah * kurs
from #tmp_list_material_changes a join #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan b
on a.kode_bahan=b.PPI_ItemID 

--select * from #tmp_list_product_terdampak

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
--           ,[Biaya_Analisa]
--           ,[Biaya_Reagen]
 
--           ,[Toll_Fee]
--           ,[Margin]
--           ,[Rounded]
--           ,[Rate_PLN]
--           ,[Direct_Labor]
--           ,[Factory_Over_Head]
--           ,[Depresiasi])
           
--select [Periode]
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
--           ,[Biaya_Analisa]
--           ,[Biaya_Reagen]
 
--           ,[Toll_Fee]
--           ,[Margin]
--           ,[Rounded]
--           ,[Rate_PLN]
--           ,[Direct_Labor]
--           ,[Factory_Over_Head]
--           ,[Depresiasi] from #t_COGS_HPP_Product_Header_Simulasi



--INSERT INTO [Lapifactory].[dbo].[t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan]
--           ([Periode]
--           ,[Simulasi_ID]
--           ,[Seq_ID]
--           ,[Tipe_Bahan]
--           ,[Item_ID]
--           ,[Item_Name]
--           ,[Item_QTY]
--           ,[Item_Unit]
--           ,[Item_Unit_Price])
           
--select [Periode]
--           ,[Simulasi_ID]
--           ,[PPI_SeqID]
--           ,ITEM_TYPE
--           ,PPI_ItemID
--           ,[Item_Name]
--           ,PPI_QTY
--           ,PPI_UnitID
--           ,Unit_Price 
--           from #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan y
--           join #tmp_list_material_changes x on x.kode_bahan=y.PPI_ItemID
--select * from t_COGS_HPP_Product_Detail_Formula
--update t_COGS_HPP_Product_Detail_Bahan set 

update m_cogs_std_hrg_bahan set ITEM_PURCHASE_STD_PRICE=b.harga_sesudah
from m_cogs_std_hrg_bahan a join #tmp_list_material_changes b on a.ITEM_ID=b.kode_bahan
and a.Periode=@periode

update t_COGS_HPP_Product_Detail_Formula set ITEM_PURCHASE_STD_PRICE=c.harga_sesudah,total=dbo.fnConvertBJ(a.PPI_ItemID,a.ppi_qty,a.item_purchase_unit, a.ppi_unitid)*c.harga_sesudah*kurs.Kurs
from t_COGS_HPP_Product_Detail_Formula a join #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan b
on a.Periode=b.Periode and a.Product_ID=b.Product_ID and a.PPI_ItemID=b.PPI_ItemID
join #tmp_list_material_changes c on c.kode_bahan=b.PPI_ItemID 
LEFT JOIN vw_COGS_Currency_List kurs ON kurs.Curr_Code = a.ITEM_CURRENCY AND kurs.Periode = @periode
where a.Periode=@periode
			
			
drop table #t_COGS_HPP_Product_Header_Simulasi
drop table #t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
drop table #tmp_list_material_changes
drop table #tmp_list_product_terdampak
