--exec [sp_COGS_get_formula_product_cost] '64'
CREATE procedure [dbo].[sp_COGS_get_formula_product_cost] (@product_id as varchar(25)='%')as 
SET NOCOUNT ON

select Product_ID, Std_Output, PI, PS, KP, KS, null PI_Val, null PS_Val, null KP_Val, null KS_Val into #M_COGS_PRODUCT_FORMULA_FIX from M_COGS_PRODUCT_FORMULA_FIX
delete #M_COGS_PRODUCT_FORMULA_FIX

select product_id,  PPI_SubID, batchsize, sum(TotalHarga) valPIPS into #tmpPPPS_formulaList from vw_COGS_FORMULA_List 
where TypeCode in ('PI','PS')--and BatchSize= '5000'
and Product_ID like @product_id
group by product_id,  PPI_SubID, batchsize--, TypeCode


DECLARE @ProductID VARCHAR(50)
DECLARE @ProductName VARCHAR(50)
DECLARE @BatchSize VARCHAR(50)

-- Deklarasi cursor
DECLARE product_cursor CURSOR FOR
select Product_ID, Product_Name, BatchSize 
from [vw_COGS_FORMULA_List] 
where Product_ID like @product_id
group by Product_ID, Product_Name, BatchSize

-- Buka cursor
OPEN product_cursor

-- Ambil data pertama
FETCH NEXT FROM product_cursor INTO @ProductID, @ProductName, @BatchSize

-- Loop selama masih ada data
WHILE @@FETCH_STATUS = 0
BEGIN
    -- PRINT 'ProductID: ' + CAST(@ProductID AS VARCHAR) + ' | Name: ' + @ProductName
	insert into #M_COGS_PRODUCT_FORMULA_FIX (Product_ID, Std_Output)
	values (@ProductID, @batchsize);
	
	--PI
	update #M_COGS_PRODUCT_FORMULA_FIX set PI = c.ppi_subid, PI_Val=isnull(c.val,0) 
	from #M_COGS_PRODUCT_FORMULA_FIX a 
	join (select product_id,  PPI_SubID, batchsize, MAX(TotalHarga) val from vw_COGS_FORMULA_List 
		where Product_ID=@ProductID and BatchSize= @BatchSize and TypeCode in ('PI')
		group by product_id,  PPI_SubID, batchsize) c
		on a.Product_ID=c.Product_ID and Std_Output = c.batchsize	
	join (select Product_ID, PPI_SubID, BatchSize, MAX(valPIPS) valMax from #tmpPPPS_formulaList group by Product_ID, PPI_SubID, BatchSize) b
	on a.Product_ID=b.Product_ID and Std_Output = c.batchsize and c.PPI_SubID=b.PPI_SubID
	where a.Product_ID=@ProductID and a.Std_Output=@BatchSize
	
	--PI
	update #M_COGS_PRODUCT_FORMULA_FIX set PS = c.ppi_subid, PS_Val=isnull(c.val,0)
	from #M_COGS_PRODUCT_FORMULA_FIX a 
	join (select product_id,  PPI_SubID, batchsize, MAX(TotalHarga) val from vw_COGS_FORMULA_List 
		where Product_ID=@ProductID and BatchSize= @BatchSize and TypeCode in ('PS')
		group by product_id,  PPI_SubID, batchsize) c
		on a.Product_ID=c.Product_ID and Std_Output = c.batchsize	
	join (select Product_ID, PPI_SubID, BatchSize, MAX(valPIPS) valMax from #tmpPPPS_formulaList group by Product_ID, PPI_SubID, BatchSize) b
	on a.Product_ID=b.Product_ID and Std_Output = c.batchsize and c.PPI_SubID=b.PPI_SubID
	where a.Product_ID=@ProductID and a.Std_Output=@BatchSize
	
	--KP
	update #M_COGS_PRODUCT_FORMULA_FIX set KP = ppi_subid, KP_Val=isnull(val,0)
	from #M_COGS_PRODUCT_FORMULA_FIX a 
	join (select top(1) product_id,  PPI_SubID, batchsize, MAX(TotalHarga) val from vw_COGS_FORMULA_List 
		where Product_ID=@ProductID and BatchSize= @BatchSize and TypeCode='KP' 
		group by product_id,  PPI_SubID, batchsize order by MAX(totalharga) desc) b
		on a.Product_ID=b.Product_ID and Std_Output = batchsize
	where a.Product_ID=@ProductID and a.Std_Output=@BatchSize
	
	--KS
	update #M_COGS_PRODUCT_FORMULA_FIX set KS = ppi_subid, KS_Val=isnull(val,0)
	from #M_COGS_PRODUCT_FORMULA_FIX a 
	join (select top(1) product_id,  PPI_SubID, batchsize, MAX(TotalHarga) val from vw_COGS_FORMULA_List 
		where Product_ID=@ProductID and BatchSize= @BatchSize and TypeCode='KS' 
		group by product_id,  PPI_SubID, batchsize order by MAX(totalharga) desc) b
		on a.Product_ID=b.Product_ID and Std_Output = batchsize
	where a.Product_ID=@ProductID and a.Std_Output=@BatchSize
	
    -- Ambil data berikutnya
    FETCH NEXT FROM product_cursor INTO @ProductID, @ProductName, @BatchSize
END

-- Tutup dan dealokasi cursor
CLOSE product_cursor
DEALLOCATE product_cursor


select a.* from #M_COGS_PRODUCT_FORMULA_FIX a join M_COGS_PRODUCT_FORMULA_FIX b on
a.Product_ID=b.Product_ID 
where (isnull(b.isManual,'')='' and @product_id ='%') or @product_id<>'%'


drop table #tmpPPPS_formulaList
drop table #M_COGS_PRODUCT_FORMULA_FIX