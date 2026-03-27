CREATE procedure [dbo].[sp_COGS_GeneratePembebananSisaBahanExp] @Periode as varchar(4)
as --select * from vw_COGS_FORMULA_List
--exec [sp_COGS_GeneratePembebananSisaBahanExp] '2025'
--SELECT * FROM M_COGS_BEBAN_SISA_BAHAN_EXP
--select * from M_COGS_PEMBEBANAN_EXPIRED

select distinct a.Product_ID, a.PPI_ItemID into #tmp from vw_COGS_FORMULA_List_detail a 
join M_COGS_BEBAN_SISA_BAHAN_EXP b on a.PPI_ItemID = b.item_id 
where a.DefaultCOGS='Aktif' and b.periode = @Periode

select a.Product_ID, b.PPI_ItemID,  SUM(jumlahbatch) totalBets, c.Std_Output  into #tmp2 from t_rencanaproduksitahunan a join #tmp b on  a.Product_ID=b.Product_ID and a.TahunBulan like @periode+'%' 
join M_COGS_PRODUCT_FORMULA_FIX c on c.Product_ID = a.Product_ID 
where c.Periode=@Periode
group by a.Product_ID,b.PPI_ItemID, c.Std_Output

select a.Product_ID, a.PPI_ItemID, totalBets*Std_Output/b.total Proporsi, 
d.item_qty TotalQtyExp,
dbo.fnConvertBJ(a.PPI_ItemID,ITEM_PURCHASE_STD_PRICE,item_purchase_unit, item_unit) UnitPrice,
dbo.fnConvertBJ(a.PPI_ItemID,ITEM_PURCHASE_STD_PRICE,item_purchase_unit, item_unit)* d.item_qty TotalPrice,
TotalBets, Std_Output BatchSize,
round((dbo.fnConvertBJ(a.PPI_ItemID,ITEM_PURCHASE_STD_PRICE,item_purchase_unit, item_unit)
* d.item_qty*(totalBets*Std_Output/b.total))/TotalBets,0)
TotalBebanBahanPerBatch
,(dbo.fnConvertBJ(a.PPI_ItemID,ITEM_PURCHASE_STD_PRICE,item_purchase_unit, item_unit)
* d.item_qty*(totalBets*Std_Output/b.total))
TotalBebanBahanPerProduct
from #tmp2 a join
(select PPI_ItemID, sum(totalBets*Std_Output) total from #tmp2 group by PPI_ItemID) b
on a.PPI_ItemID=b.PPI_ItemID
join (select * from M_COGS_STD_HRG_BAHAN where periode=@Periode) c on c.ITEM_ID = a.PPI_ItemID 
join M_COGS_BEBAN_SISA_BAHAN_EXP d on d.item_id = a.PPI_ItemID and d.periode=@Periode
order by a.PPI_ItemID

delete [M_COGS_PEMBEBANAN_EXPIRED] where periode=@periode

INSERT INTO [M_COGS_PEMBEBANAN_EXPIRED]
           ([Periode]
           ,[Product_ID]
           ,[Item_ID]
           ,[Proporsi]
           ,[Total_Unit]
           ,[Total_Price]
           ,Total_Batch
           ,BatchSize
           ,[Beban_Sisa_Bahan_Exp]
           ,[user_id]
           ,[delegated_to]
           ,[process_date]
           ,[flag_update]
           ,[from_update])

     select @Periode, a.Product_ID, a.PPI_ItemID, totalBets*Std_Output/b.total Proporsi, 
			d.item_qty TotalQtyExp,
			--dbo.fnConvertBJ(a.PPI_ItemID,ITEM_PURCHASE_STD_PRICE,item_purchase_unit, item_unit) UnitPrice,
			dbo.fnConvertBJ(a.PPI_ItemID,ITEM_PURCHASE_STD_PRICE,item_purchase_unit, item_unit) *d.item_qty TotalPrice,
			TotalBets, Std_Output BatchSize,
			round((dbo.fnConvertBJ(a.PPI_ItemID,ITEM_PURCHASE_STD_PRICE,item_purchase_unit, item_unit) *d.item_qty*
			(totalBets*Std_Output/b.total))/Totalbets,0)
			TotalBebanBahanPerProduk,'System','System',GETDATE(),null, null
			from #tmp2 a join
			(select PPI_ItemID, sum(totalBets*Std_Output) total from #tmp2 group by PPI_ItemID) b
			on a.PPI_ItemID=b.PPI_ItemID
			join (select * from M_COGS_STD_HRG_BAHAN where periode=@Periode) c on c.ITEM_ID = a.PPI_ItemID 
			join M_COGS_BEBAN_SISA_BAHAN_EXP d on d.item_id = a.PPI_ItemID
			where d.PERIODE=@Periode
			order by a.PPI_ItemID

