--select * from vw_COGS_FORMULA_List_detail where Product_ID='02SFXA'
--exec sp_COGS_generate_all_formula_detail 
--exec sp_COGS_generate_all_formula_detail 'SumPerSubID'
CREATE procedure [dbo].[sp_COGS_generate_all_formula_detail]
(@type as varchar(25)='')
 as

--
--SumPerSubID

if @type='' 
begin
	select ppi_owner, TypeCode, TYPENAME, PPI_SubID, Product_ID, Product_Name, 
		BatchSize, PPI_SeqID, PPI_ItemID, PPI_QTY, PPI_UnitID, PurchaseUnit [UnitPO], PurchaseQTYUnit [QtyUnitPO], unitstdprice [UnitPrice], UnitPrice [Total],
		DefaultCOGS, ITEM_TYPE, 
		case when PPI_UnitID<>PurchaseUnit then 'Ya' else 'Tidak' end as [Beda_Unit]
	from vw_COGS_FORMULA_List_detail
	where Source='ePengembanganFormula'
	and isnumeric(LEFT(PPI_ItemID,2))=0
	order by Product_ID, PPI_SeqID
end

if @type='SumPerSubID' 
begin
	select ppi_owner, TypeCode, TYPENAME, PPI_SubID, Product_ID, Product_Name, 
		BatchSize, sum(isnull(UnitPrice,0)) [Total],
		DefaultCOGS HPP, case when typecode in ('PI','PS') then 'BB' else 'BK' end ITEM_TYPE, 
		case when [Default]='Aktif' then '1' else '' end  Default_PC
		
	from vw_COGS_FORMULA_List_detail
	where Source='ePengembanganFormula'
	--and isnumeric(LEFT(PPI_ItemID,2))=0
	--and Product_ID='02SFXA'
	group by ppi_owner, TypeCode, TYPENAME, PPI_SubID, Product_ID, Product_Name,
	BatchSize,DefaultCOGS, case when typecode in ('PI','PS') then 'BB' else 'BK' end ,[Default]
	order by Product_ID, typename
end

--select * from vw_COGS_FORMULA_List_detail where Product_ID=	'01LFXB'

--select * from m_PPI_Owner
--select * from vw_COGS_FORMULA_List_detail
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan