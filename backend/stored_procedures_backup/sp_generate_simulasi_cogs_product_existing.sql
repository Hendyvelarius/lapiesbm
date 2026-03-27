


--exec sp_generate_simulasi_cogs_product_existing '01','GLC#-#B#A'
----select * from vw_COGS_Product_Group where Group_ProductID='01'
--select * from t_COGS_HPP_Product_Header_Simulasi
--select * from dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan

CREATE procedure [dbo].[sp_generate_simulasi_cogs_product_existing] 
(@product_id as varchar(255),
 @formulaPPPIKPKS as varchar(255)
)
as

declare @simulasi_id as int
select @simulasi_id =isnull(MAX(simulasi_id),0)+1 from t_COGS_HPP_Product_Header_Simulasi

declare @_product_id as varchar(255) 
set @_product_id = @product_id;--'01'
declare @_formulaPPPIKPKS as varchar(255) 
set @_formulaPPPIKPKS = @formulaPPPIKPKS--'GLC#-#B#A';

DECLARE @s VARCHAR(50) = @_formulaPPPIKPKS;

;WITH parts AS (
    SELECT 
        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS part_no,
        x.value('.', 'VARCHAR(50)') AS part_value
    FROM (
        SELECT CAST('<x>' + REPLACE(@s, '#', '</x><x>') + '</x>' AS XML) AS xmlData
    ) t
    CROSS APPLY xmlData.nodes('/x') AS n(x)
)
SELECT 
@simulasi_id as Simulasi_ID,
@_product_id as Product_ID,
case 
	when part_no='1' then 'PI' 
	when part_no='2' then 'PS' 
	when part_no='3' then 'KP' 
	when part_no='4' then 'KS' 
end as TypeCode
, part_value 
into #tmpProductFormula
FROM parts;

--DECLARE @s VARCHAR(50) = @_formulaPPPIKPKS;
--SELECT
--	@_product_id as Product_ID,
--    x.value('/x[1]', 'VARCHAR(50)') AS PP,
--    x.value('/x[2]', 'VARCHAR(50)') AS PI,
--    x.value('/x[3]', 'VARCHAR(50)') AS KP,
--    x.value('/x[4]', 'VARCHAR(50)') AS KS
--    into #tmpFormula
--FROM (
--    SELECT CAST('<x>' + REPLACE(@s, '#', '</x><x>') + '</x>' AS XML) AS xmlData
--) t
--CROSS APPLY (SELECT xmlData.query('.')) q(y)
--CROSS APPLY (SELECT y AS x) a;


insert into t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
select YEAR(getdate()) Periode, b.Simulasi_ID,ROW_NUMBER() over (partition by a.item_type order by a.ppi_itemid)
seq_id, a.item_type, PPI_ItemID, c.Item_Name, PPI_QTY, PPI_UnitID, UnitStdPrice Unit_Price
from vw_COGS_FORMULA_List_detail a 
	join #tmpProductFormula b
		on a.Product_ID = b.Product_ID and a.TypeCode=b.TypeCode and a.PPI_SubID=part_value
	left join m_item_manufacturing c on c.ITEM_ID=a.PPI_ItemID


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
 
           ,[Toll_Fee]
           ,[Margin]
           ,[Rounded]
           ,[Rate_PLN]
           ,[Direct_Labor]
           ,[Factory_Over_Head]
           ,[Depresiasi])
--select * from [t_COGS_HPP_Product_Header_Simulasi]
select distinct 
YEAR(GETDATE()) periode, @simulasi_id,'',GETDATE(), 'Product Existing',@formulaPPPIKPKS Formula,

 a.Group_ProductID, prod.Product_Name,  Group_PNCategory, Group_PNCategoryName,  Group_Dept, 
 group_rendemen, Std_Output, 
 case 
	when prod.Product_Name like '%generik%' then 'GENERIC' 
	when otc.Product_ID is not null then 'OTC'
	when prl.Name like 'EKSPOR' then 'EXPORT'
	else 'ETHICAL'
	end LOB,1,
	
Group_ManHourPros, Group_ManHourPack, Group_MH_Analisa, Group_MHT_BB, Group_MHT_BK, Group_KWH_Mesin,
isnull(b.Group_Proses_Rate,c.Group_Proses_Rate) Group_Proses_Rate, isnull(b.Group_Kemas_Rate, c.Group_Kemas_Rate) Group_Kemas_Rate,
--isnull(b.Group_Generik_Rate, c.Group_Generik_Rate) 
0 Group_Generik_Rate,
isnull(b.Group_Analisa_Rate, c.Group_Analisa_Rate) Biaya_Analisa, 
isnull(reagen.Reagen_Rate, 0) Biaya_Reagen,
--tf.toll_Fee,
case when isnumeric(tf.toll_Fee)=1 then tf.toll_Fee else 0 end,
case when isnumeric(tf.toll_Fee)=0 then cast(replace(tf.toll_Fee,'%','')as decimal(10,2))/100  else 0 end,
ISNULL(tf.rounded,0) rounded,
c.Group_PLN_Rate, 
isnull(rg.Direct_Labor,0) Direct_Labor, 
isnull(rg.Factory_Over_Head,0)  Factory_Over_Head, 
isnull(rg.Depresiasi,0)  Depresiasi
from (select * from vw_COGS_Product_Group where periode=year(GETDATE())) a left join (select * from vw_COGS_Pembebanan where group_periode=YEAR(GETDATE())) b 
on a.Group_PNCategory=b.Group_PNCategoryID and a.Group_ProductID=b.Group_ProductID
join (select * from vw_COGS_Pembebanan where group_periode=YEAR(GETDATE())) c
on a.Group_PNCategory=c.Group_PNCategoryID and c.Group_ProductID is null
join M_COGS_PRODUCT_FORMULA_FIX ff on ff.Product_ID=a.group_productid--and a.Periode=ff.Periode 
join m_product prod on a.Group_ProductID=prod.Product_ID
left join m_Product_RuangLingkup prl on prod.Product_RuangLingkup=prl.ID
left join m_product_otc otc on prod.Product_ID = otc.Product_ID and otc.isActive=1
left join M_COGS_RATE_GENERAL_per_SEDIAAN rg on rg.Bentuk_Sediaan=a.Jenis_Sediaan and rg.Periode=year(GETDATE()) and rg.Line_Production=a.Group_Dept
left join (select * from M_COGS_PEMBEBANAN_reagen where periode = YEAR(getdate())) reagen on reagen.ProductID = prod.Product_ID 
left join (select * from M_COGS_PEMBEBANAN_TollFee where periode = YEAR(getdate())) tf on tf.ProductID = prod.Product_ID 
, M_COGS_STD_PARAMETER stdParam 

where a.Group_ProductID=@product_id


update [t_COGS_HPP_Product_Header_Simulasi] set 
Beban_Sisa_Bahan_Exp=isnull(b.Beban_Sisa_Bahan_Exp,0)
from [t_COGS_HPP_Product_Header_Simulasi] a join 
(select periode, product_id, SUM(Beban_Sisa_Bahan_Exp) beban_sisa_bahan_exp from M_COGS_PEMBEBANAN_EXPIRED group by periode, product_id) 
b on a.Product_ID=b.product_id and b.periode=a.periode



 
select * from [t_COGS_HPP_Product_Header_Simulasi] where simulasi_id=@simulasi_id

--select * from #tmpProductFormula
--select * from t_COGS_HPP_Product_Header_Simulasi
----select * from vw_COGS_FORMULA_List_detail 
--SELECT * FROM m_Product_RuangLingkup
--select * from vw_COGS_Product_Group where Group_ProductID='FR'

--SELECT * FROM M_PRODUCT WHERE Product_RuangLingkup='09'
--SELECT * FROM t_Product_Stock_Position WHERE St_ProductID='FR'
--SELECT * FROM vw_COGS_FORMULA_List_detail WHERE Product_ID='fr'
--select * from vw_COGS_FORMULA_List_detail where Product_ID='01' and PPI_SubID='GLC'
--select * from [t_COGS_HPP_Product_Header_Simulasi]


--select product_id, item_type, PPI_ItemID, PPI_QTY, PPI_UnitID, total / ppi_qty Item_unit, total  from t_COGS_HPP_Product_Detail_Formula 
--order by product_id, ITEM_TYPE, PPI_ItemID

--drop table #tmpProductFormula