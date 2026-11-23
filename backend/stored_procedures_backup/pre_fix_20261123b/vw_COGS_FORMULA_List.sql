


--select * from m_ppi_header where PPI_ProductID='01'

--select * from dbo.vw_COGS_FORMULA_List where Product_ID='O4'

--select * from [vw_COGS_FORMULA_List]

--select * from m_ppi_header
CREATE view [dbo].[vw_COGS_FORMULA_List]
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
from m_ppi_header a 
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






