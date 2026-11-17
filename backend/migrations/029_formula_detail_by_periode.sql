-- 029: Product Formula page and "Export All Formula" priced at a chosen year.
--
-- vw_COGS_FORMULA_List_detail prices every formula line at ONE year it picks itself (the latest
-- M_COGS_PRODUCT_FORMULA_FIX periode with an unlocked row, else the latest periode), and its
-- DefaultCOGS ("HPP" badge) follows that same year's Formula Assignment. There was no way to see
-- a formula priced at another year, e.g. 2027 prices while the view still resolves to 2026.
--
-- 1. dbo.fn_COGS_FORMULA_List_detail_ByPeriode(@Periode)
--    Same rows and columns as the view (formula structure comes from the view, so later view changes
--    still apply), with the year-dependent columns re-derived for @Periode:
--      UnitPrice, UnitStdPrice, PurchaseQTYUnit, PurchaseUnit  <- @Periode material price + kurs
--      DefaultCOGS                                             <- @Periode Formula Assignment
--      ITEM_TYPE                                               <- @Periode material row
--    plus Price_Periode = @Periode. Lines whose material has no @Periode price keep their row with
--    NULL prices (the view behaves the same way for its own year).
--
-- 2. sp_COGS_generate_all_formula_detail gets an optional @Periode (default NULL = the view's own
--    year, so existing callers get the same output as before).
--
-- Pre-change definition of the procedure is archived in backend/stored_procedures_backup/pre_fix_20261117/.

GO

CREATE FUNCTION [dbo].[fn_COGS_FORMULA_List_detail_ByPeriode] (@Periode VARCHAR(4))
RETURNS TABLE
AS
RETURN
    SELECT
        f.Product_ID, f.Product_Name, f.PPI_SubID, f.PPI_Owner, f.TypeName, f.TypeCode, f.[Source],
        f.BatchSize, f.[Default], f.PPI_SeqID, f.PPI_ItemID, f.PPI_UnitID, f.PPI_QTY,
        dbo.fnConvertBJ(sb.ITEM_ID, f.PPI_QTY, sb.ITEM_PURCHASE_UNIT, f.PPI_UnitID) * sb.ITEM_PURCHASE_STD_PRICE * kurs.Kurs AS UnitPrice,
        dbo.fnConvertBJ(sb.ITEM_ID, sb.ITEM_PURCHASE_STD_PRICE, sb.ITEM_PURCHASE_UNIT, f.PPI_UnitID) * kurs.Kurs AS UnitStdPrice,
        dbo.fnConvertBJ(sb.ITEM_ID, f.PPI_QTY, sb.ITEM_PURCHASE_UNIT, f.PPI_UnitID) AS PurchaseQTYUnit,
        sb.ITEM_PURCHASE_UNIT AS PurchaseUnit,
        CASE
            WHEN f.TypeCode = 'PI' AND f.PPI_SubID = fix.PI THEN 'Aktif'
            WHEN f.TypeCode = 'PS' AND f.PPI_SubID = fix.PS THEN 'Aktif'
            WHEN f.TypeCode = 'KP' AND f.PPI_SubID = fix.KP THEN 'Aktif'
            WHEN f.TypeCode = 'KS' AND f.PPI_SubID = fix.KS THEN 'Aktif'
            ELSE ''
        END AS DefaultCOGS,
        sb.ITEM_TYPE,
        @Periode AS Price_Periode
    FROM vw_COGS_FORMULA_List_detail f
    LEFT JOIN M_COGS_STD_HRG_BAHAN sb
        ON sb.ITEM_ID = f.PPI_ItemID AND sb.Periode = @Periode
    LEFT JOIN vw_COGS_Currency_List kurs
        ON kurs.Curr_Code = sb.ITEM_CURRENCY AND kurs.Periode = @Periode
    LEFT JOIN M_COGS_PRODUCT_FORMULA_FIX fix
        ON fix.Product_ID = f.Product_ID AND fix.Periode = @Periode

GO

--select * from vw_COGS_FORMULA_List_detail where Product_ID='02SFXA'
--exec sp_COGS_generate_all_formula_detail
--exec sp_COGS_generate_all_formula_detail 'SumPerSubID'
--exec sp_COGS_generate_all_formula_detail '', '2027'
ALTER procedure [dbo].[sp_COGS_generate_all_formula_detail]
(@type as varchar(25)='', @Periode as varchar(4)=NULL)
 as

-- 029: @Periode NULL = the year vw_COGS_FORMULA_List_detail resolves to (previous behaviour)
if @Periode is null
	set @Periode = isnull((select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0),
	                      (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX))

--SumPerSubID

if @type=''
begin
	select ppi_owner, TypeCode, TYPENAME, PPI_SubID, Product_ID, Product_Name,
		BatchSize, PPI_SeqID, PPI_ItemID, PPI_QTY, PPI_UnitID, PurchaseUnit [UnitPO], PurchaseQTYUnit [QtyUnitPO], unitstdprice [UnitPrice], UnitPrice [Total],
		DefaultCOGS, ITEM_TYPE,
		case when PPI_UnitID<>PurchaseUnit then 'Ya' else 'Tidak' end as [Beda_Unit]
	from dbo.fn_COGS_FORMULA_List_detail_ByPeriode(@Periode)
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

	from dbo.fn_COGS_FORMULA_List_detail_ByPeriode(@Periode)
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
GO
