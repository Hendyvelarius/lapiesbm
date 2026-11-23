-- 031: one recipe per product + type + version in the formula views (X9 / G0 / L7 doubled lines).
--
-- e-Pengembangan Formula can hold the same recipe version under several owners: X9 (Mucovy Sirup),
-- G0 (Labumin) and L7 (Ciflon) got Toll Out copies (/TO) next to the Punya Sendiri ones (/PS), both with
-- version '' and both active. Both views take the type (PI/PS/KP/KS) from the PPI_ID pattern and ignore
-- the owner, and Formula Assignment stores only type + version, so every copy matched: the lines showed
-- twice in Formula Management and the 2027 HPP Standard summed both recipes.
--
-- Change: per product + type + version keep ONE header - the one marked default (status_default),
-- else Punya Sendiri, then Toll In, then Toll Out (then PPI_ID). Applied in vw_COGS_FORMULA_List_detail
-- (lines; fn_COGS_FORMULA_List_detail_ByPeriode and the generator read it) and vw_COGS_FORMULA_List
-- (version list; its pick also requires the m_PPI_Status approval it already filtered on).
-- Products with a single copy per version are unchanged.
--
-- Pre-change definitions: backend/stored_procedures_backup/pre_fix_20261123b/.

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
    FROM (
        -- 031: one recipe per product + type + version. e-Pengembangan Formula can hold the same version
        -- under several owners (/PS, /TI, /TO); Formula Assignment has no owner, so all copies used to be
        -- merged. Keep the copy marked default, else Punya Sendiri, then Toll In, then Toll Out.
        SELECT h.* FROM (
            SELECT h0.*, ROW_NUMBER() OVER (
                PARTITION BY h0.PPI_ProductID, h0.PPI_SubID, CASE WHEN h0.PPI_ID LIKE '%A%PK%' THEN 'KP' WHEN h0.PPI_ID LIKE '%B%PK%' THEN 'KS' WHEN h0.PPI_ID LIKE '%A%PP%' THEN 'PI' WHEN h0.PPI_ID LIKE '%B%PP%' THEN 'PS' END
                ORDER BY CASE WHEN ISNULL(h0.status_default,0)='0' THEN 1 ELSE 0 END, CASE WHEN h0.PPI_ID LIKE '%/PS' THEN 0 WHEN h0.PPI_ID LIKE '%/TI' THEN 1 WHEN h0.PPI_ID LIKE '%/TO' THEN 2 ELSE 3 END, h0.PPI_ID) AS rn_031
            FROM m_ppi_header h0
            WHERE h0.isActive=1 AND h0.PPI_Status='A'
        ) h WHERE h.rn_031 = 1
    ) a
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

--select * from m_ppi_header where PPI_ProductID='01'

--select * from dbo.vw_COGS_FORMULA_List where Product_ID='O4'

--select * from [vw_COGS_FORMULA_List]

--select * from m_ppi_header
ALTER VIEW [dbo].[vw_COGS_FORMULA_List]
as
select formula.*, TotalHarga from (
select 
--PPI_Owner,
formula.*, 
case 
	when TypeCode='PI' then (case when fixpi.pi IS null then '' else 'Aktif' end)--isnull(fixpi.pi,'')
	when TypeCode='PS' then (case when fixps.ps IS null then '' else 'Aktif' end)--isnull(fixps.ps,'')
	when TypeCode='KP' then (case when fixkp.kp IS null then '' else 'Aktif' end)--isnull(fixkp.kp,'')
	when TypeCode='KS' then (case when fixks.ks IS null then '' else 'Aktif' end)--isnull(fixks.ks,'')
 end as [DefaultCOGS]
from (
select c.Product_ID, c.Product_Name, a.PPI_SubID, 
	case	when a.ppi_id like '%/PS' then 'PUNYA SENDIRI' 
			when a.ppi_id like '%/TI' then 'TOLL IN' 
			when a.ppi_id like '%/TO' then 'TOLL OUT' 
	end as PPI_Owner,
	case 
		when PPI_ID like '%A%PK%' then '2. KEMAS PRIMER'
		when PPI_ID like '%B%PK%' then '2. KEMAS SEKUNDER'
		when PPI_ID like '%A%PP%' then '1. PENGOLAHAN INTI'
		when PPI_ID like '%B%PP%' then '1. PENGOLAHAN SALUT'
	end TypeName,
	case 
		when PPI_ID like '%A%PK%' then 'KP'
		when PPI_ID like '%B%PK%' then 'KS'
		when PPI_ID like '%A%PP%' then 'PI'
		when PPI_ID like '%B%PP%' then 'PS'
	end TypeCode,
	'ePengembanganFormula' [Source],
	(case when PPI_ProductID like 'ä%' then a.PPI_BatchSize else a.pPI_batchsizekemasan end) BatchSize,
	case when isnull(a.status_default,0)='0' then '' else 'Aktif' end [Default]--,
	--case when isnull(a.status_default,0)='0' then '' else 'Aktif' end [DefaultCOGS]
from (
    -- 031: one recipe per product + type + version. e-Pengembangan Formula can hold the same version
    -- under several owners (/PS, /TI, /TO); Formula Assignment has no owner, so all copies used to be
    -- merged. Keep the copy marked default, else Punya Sendiri, then Toll In, then Toll Out.
    SELECT h.* FROM (
        SELECT h0.*, ROW_NUMBER() OVER (
            PARTITION BY h0.PPI_ProductID, h0.PPI_SubID, CASE WHEN h0.PPI_ID LIKE '%A%PK%' THEN 'KP' WHEN h0.PPI_ID LIKE '%B%PK%' THEN 'KS' WHEN h0.PPI_ID LIKE '%A%PP%' THEN 'PI' WHEN h0.PPI_ID LIKE '%B%PP%' THEN 'PS' END
            ORDER BY CASE WHEN ISNULL(h0.status_default,0)='0' THEN 1 ELSE 0 END, CASE WHEN h0.PPI_ID LIKE '%/PS' THEN 0 WHEN h0.PPI_ID LIKE '%/TI' THEN 1 WHEN h0.PPI_ID LIKE '%/TO' THEN 2 ELSE 3 END, h0.PPI_ID) AS rn_031
        FROM m_ppi_header h0
        WHERE h0.isActive=1 AND h0.PPI_Status='A'
            AND ((h0.PPI_ID + h0.PPI_SubID + h0.PPI_ProductID + CONVERT(nvarchar(1), h0.PPI_ProductInit)) IN (SELECT PPI_No FROM dbo.m_PPI_Status))
    ) h WHERE h.rn_031 = 1
) a
--join m_ppi_detail b on a.PPI_ID=b.PPI_ID and a.PPI_SubID = b.PPI_SubID and a.PPI_ProductID=b.PPI_ProductID
join m_product c on a.PPI_ProductID= c.Product_ID

where a.isActive=1 and PPI_Status='A'
	and ((a.PPI_ID + a.PPI_SubID + a.PPI_ProductID + CONVERT(nvarchar(1), a.PPI_ProductInit)) 
                      IN
                          (SELECT     PPI_No
                            FROM          dbo.m_PPI_Status))

--ORDER BY TypeName
union all
select distinct ppi_productid Product_ID,  Product_Name, PPI_SubID, '' PPI_Owner, (case 
	when PPI_Type like 'KP' then '2. KEMAS PRIMER'
	when PPI_Type like 'KS' then '2. KEMAS SEKUNDER'
	when PPI_Type like 'PI' then '1. PENGOLAHAN INTI'
	when PPI_Type like 'PS' then '1. PENGOLAHAN SALUT'
end) TypeName, PPI_Type TypeCode,'Manual' Source,
	a.PPI_BatchSize BatchSize, '' [Default] 
	from m_cogs_formula_manual a join m_product b on a.ppi_productid=b.product_id
) formula 
left join (select product_id, PI from M_COGS_PRODUCT_FORMULA_FIX where periode = (select case when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null  then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX) end)) fixPI 
	on formula.product_id = fixpi.product_id and TypeCode='PI' and PPI_SubID = PI
left join (select product_id, PS from M_COGS_PRODUCT_FORMULA_FIX where periode = (select case when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null  then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX) end)) fixPS 
	on formula.product_id = fixps.product_id and TypeCode='PS' and PPI_SubID = PS
left join (select product_id, KP from M_COGS_PRODUCT_FORMULA_FIX where periode = (select case when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null  then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX) end)) fixKP 
	on formula.product_id = fixKP.product_id and TypeCode='KP' and PPI_SubID = KP	
left join (select product_id, KS from M_COGS_PRODUCT_FORMULA_FIX where periode = (select case when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is not null then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) when (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX where isnull(isLock,0)=0) is null  then (select max(Periode) from M_COGS_PRODUCT_FORMULA_FIX) end)) fixKS 
	on formula.product_id = fixKS.product_id and TypeCode='KS' and PPI_SubID = KS		
) formula 
 join (select a.Product_ID, Product_Name, a.PPI_SubID, a.TypeCode, case when b.PPI_SubID is null then sum(UnitPrice) else '0' end TotalHarga 
from vw_COGS_FORMULA_List_detail a
left join (select Product_ID, PPI_SubID, TypeCode from vw_COGS_FORMULA_List_detail where PurchaseUnit is null group by Product_ID, PPI_SubID, TypeCode) b
on a.Product_ID=b.Product_ID and a.PPI_SubID = b.PPI_SubID and a.TypeCode=b.TypeCode

group by a.Product_ID, Product_Name, a.PPI_SubID, b.PPI_SubID, a.TypeCode) ttlHrg on ttlHrg.PPI_SubID=formula.PPI_SubID and ttlHrg.Product_ID=formula.Product_ID and formula.TypeCode=ttlHrg.TypeCode


--select * from vw_COGS_FORMULA_List_detail

--	g	2328.75	1038738,9375	2,32875	kg	Aktif
--446050
--select * From M_COGS_STD_HRG_BAHAN where ITEM_ID='IN 094'

GO
