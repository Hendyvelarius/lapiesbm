-- FIXED VERSION: Removed .xxx suffix stripping from PPI_ItemID
-- All item codes are now used as-is (e.g., 'AC 009C.000' stays 'AC 009C.000')
-- Changed 4 locations: 2x SELECT output, 2x JOIN conditions to M_COGS_STD_HRG_BAHAN
-- Original backup: vw_COGS_FORMULA_List_detail_ORIGINAL.sql

ALTER VIEW [dbo].[vw_COGS_FORMULA_List_detail]
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
        b.PPI_ItemID,
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
        stdBahan.ITEM_ID = b.PPI_ItemID
        AND stdBahan.Periode = (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
    LEFT JOIN vw_COGS_Currency_List kurs ON kurs.Curr_Code = stdBahan.ITEM_CURRENCY AND kurs.Periode = (select 
																											case 
																												when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
																													then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
																												when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
																													then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
																											end)
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
        a.PPI_ItemID,
        a.PPI_UnitID, 
        a.PPI_QTY,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE*kurs.Kurs UnitPrice,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ITEM_PURCHASE_STD_PRICE ,item_purchase_unit, ppi_unitid)*kurs.Kurs UnitStdPrice,
        dbo.fnConvertBJ(stdBahan.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid) PurchaseQTYUnit,
        item_purchase_unit PurchaseUnit
    FROM m_cogs_formula_manual a 
    JOIN m_product b ON a.ppi_productid=b.product_id
    LEFT JOIN M_COGS_STD_HRG_BAHAN stdBahan ON 
        stdBahan.ITEM_ID = a.PPI_ItemID
        AND stdBahan.Periode =  (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
    LEFT JOIN vw_COGS_Currency_List kurs ON kurs.Curr_Code = stdBahan.ITEM_CURRENCY AND kurs.Periode = (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
) formula 
LEFT JOIN M_COGS_PRODUCT_FORMULA_FIX fix ON formula.product_id = fix.product_id AND fix.periode = (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
LEFT JOIN M_COGS_STD_HRG_BAHAN item ON item.ITEM_ID=formula.PPI_ItemID AND item.Periode = (select 
									case 
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0)
										when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null 
											then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX)
									end)
WHERE ISNUMERIC(LEFT(PPI_ItemID,2))=0;
