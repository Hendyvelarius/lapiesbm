-- 030: keep products used as ingredients in the formula view (Simdrol pelarut fix).
--
-- vw_COGS_FORMULA_List_detail ended with WHERE ISNUMERIC(LEFT(PPI_ItemID,2))=0. That rule is intentional:
-- item codes like '02 BR 047' / '01 ...' are materials supplied by the toll-in principal (512 active
-- toll-in recipe lines, none ever priced) and stay excluded. But toll-in product codes also start with a
-- number, so 02SMRB (PELARUT SIMDROL-125, an intermediate by the '%pelarut%' rule) was dropped from
-- 02SMRA's KS recipe: missing on the Product Formula page and from every HPP Standard since 2024.
--
-- Change: items that exist in m_product pass the filter. Same change in sp_COGS_generate_all_formula_detail
-- (type '', "Export All Formula"), which repeats the filter. fn_COGS_FORMULA_List_detail_ByPeriode wraps
-- the view and inherits it. At the time of writing the only line this adds is 02SMRA / KS / A / 02SMRB.
--
-- Pre-change definitions: backend/stored_procedures_backup/pre_fix_20261123/.

GO

ALTER VIEW [dbo].[vw_COGS_FORMULA_List_detail]--_BKF_20251203_before_addperiode]
AS



SELECT 
    formula.*,
    CASE 
        WHEN TypeCode='PI' AND PPI_SubID = fix.PI THEN 'Aktif'
        WHEN TypeCode='PS' AND PPI_SubID = fix.PS THEN 'Aktif'
        WHEN TypeCode='KP' AND PPI_SubID = fix.KP THEN 'Aktif'
        WHEN TypeCode='KS' AND PPI_SubID = fix.KS THEN 'Aktif'
        ELSE ''
    END AS [DefaultCOGS],
    item.ITEM_TYPE
FROM (
    SELECT 
        c.Product_ID, c.Product_Name, a.PPI_SubID, 
        CASE    
            WHEN a.ppi_id LIKE '%/PS' THEN 'PUNYA SENDIRI' 
            WHEN a.ppi_id LIKE '%/TI' THEN 'TOLL IN' 
            WHEN a.ppi_id LIKE '%/TO' THEN 'TOLL OUT' 
        END AS PPI_Owner,
        CASE 
            WHEN a.PPI_ID LIKE '%A%PK%' THEN '2. KEMAS PRIMER'
            WHEN a.PPI_ID LIKE '%B%PK%' THEN '2. KEMAS SEKUNDER'
            WHEN a.PPI_ID LIKE '%A%PP%' THEN '1. PENGOLAHAN INTI'
            WHEN a.PPI_ID LIKE '%B%PP%' THEN '1. PENGOLAHAN SALUT'
        END TypeName,
        CASE 
            WHEN a.PPI_ID LIKE '%A%PK%' THEN 'KP'
            WHEN a.PPI_ID LIKE '%B%PK%' THEN 'KS'
            WHEN a.PPI_ID LIKE '%A%PP%' THEN 'PI'
            WHEN a.PPI_ID LIKE '%B%PP%' THEN 'PS'
        END TypeCode,
        'ePengembanganFormula' [Source],
        (CASE WHEN a.PPI_ProductID LIKE 'ä%' THEN ISNULL(a.PPI_BatchSize,pPI_batchsizekemasan) ELSE pPI_batchsizekemasan END) BatchSize,
        CASE WHEN ISNULL(a.status_default,0)='0' THEN '' ELSE 'Aktif' END [Default],
        b.PPI_SeqID,
        --(CASE WHEN b.PPI_ItemID LIKE '%.%' THEN LEFT(b.PPI_ItemID,LEN(b.PPI_ItemID)-4) ELSE b.PPI_ItemID END) PPI_ItemID, 
        (b.PPI_ItemID) PPI_ItemID,
        b.PPI_UnitID, 
        b.PPI_QTY,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE*kurs.Kurs UnitPrice,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ITEM_PURCHASE_STD_PRICE ,item_purchase_unit, ppi_unitid)*kurs.Kurs UnitStdPrice,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid) PurchaseQTYUnit,
        item_purchase_unit PurchaseUnit
    FROM m_ppi_header a 
    JOIN m_ppi_detail b ON a.PPI_ID=b.PPI_ID AND a.PPI_SubID = b.PPI_SubID AND a.PPI_ProductID=b.PPI_ProductID
    JOIN m_product c ON a.PPI_ProductID= c.Product_ID
    LEFT JOIN M_COGS_STD_HRG_BAHAN stdBahan ON 
        stdBahan.ITEM_ID= b.PPI_ItemID --(CASE WHEN b.PPI_ItemID LIKE '%.%' THEN LEFT(b.PPI_ItemID,LEN(b.PPI_ItemID)-4) ELSE b.PPI_ItemID END)
        AND stdBahan.Periode = (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
        --YEAR(GETDATE())
    LEFT JOIN vw_COGS_Currency_List kurs ON kurs.Curr_Code = stdBahan.ITEM_CURRENCY AND kurs.Periode = (select 
																											case 
																												when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
																													then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
																												when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
																													then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
																											end)
																				--YEAR(GETDATE())
    WHERE a.isActive=1 AND PPI_Status='A'
    
    UNION ALL
    
    SELECT DISTINCT 
        ppi_productid Product_ID,  
        Product_Name, 
        PPI_SubID,
        '' PPI_Owner, 
        (CASE 
            WHEN PPI_Type LIKE 'KP' THEN '2. KEMAS PRIMER'
            WHEN PPI_Type LIKE 'KS' THEN '2. KEMAS SEKUNDER'
            WHEN PPI_Type LIKE 'PI' THEN '1. PENGOLAHAN INTI'
            WHEN PPI_Type LIKE 'PS' THEN '1. PENGOLAHAN SALUT'
        END) TypeName, 
        PPI_Type TypeCode,
        'Manual' Source, 
        a.PPI_BatchSize BatchSize, 
        '' [Default],
        a.PPI_SeqID, 
        --(CASE WHEN a.PPI_ItemID LIKE '%.%' THEN LEFT(a.PPI_ItemID,LEN(a.PPI_ItemID)-4) ELSE a.PPI_ItemID END) PPI_ItemID, 
        (a.PPI_ItemID) PPI_ItemID, 
        a.PPI_UnitID, 
        a.PPI_QTY,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE*kurs.Kurs UnitPrice,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ITEM_PURCHASE_STD_PRICE ,item_purchase_unit, ppi_unitid)*kurs.Kurs UnitStdPrice,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid) PurchaseQTYUnit,
        item_purchase_unit PurchaseUnit
    FROM m_cogs_formula_manual a 
    JOIN m_product b ON a.ppi_productid=b.product_id
    LEFT JOIN M_COGS_STD_HRG_BAHAN stdBahan ON 
        stdBahan.ITEM_ID = a.PPI_ItemID --(CASE WHEN a.PPI_ItemID LIKE '%.%' THEN LEFT(a.PPI_ItemID,LEN(a.PPI_ItemID)-4) ELSE a.PPI_ItemID END)
        AND stdBahan.Periode =  (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
        --YEAR(GETDATE())
    LEFT JOIN vw_COGS_Currency_List kurs ON kurs.Curr_Code = stdBahan.ITEM_CURRENCY AND kurs.Periode = (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
        --YEAR(GETDATE())
) formula 
LEFT JOIN M_COGS_PRODUCT_FORMULA_FIX fix ON formula.product_id = fix.product_id AND fix.periode = (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
        --YEAR(GETDATE())
LEFT JOIN M_COGS_STD_HRG_BAHAN item ON item.ITEM_ID=formula.PPI_ItemID AND item.Periode = (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
        --YEAR(GETDATE())
-- 030: '01 X'/'02 X' codes are toll-in principal materials and stay excluded, but toll-in PRODUCT
-- codes also start with a number (02SMRB, the Simdrol pelarut) - a product used as an ingredient is kept.
WHERE ISNUMERIC(LEFT(PPI_ItemID,2))=0
   OR PPI_ItemID IN (SELECT Product_ID FROM m_product);

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
	and (isnumeric(LEFT(PPI_ItemID,2))=0 or PPI_ItemID in (select Product_ID from m_product)) -- 030
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
