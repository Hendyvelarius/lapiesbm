CREATE procedure [dbo].[sp_COGS_GenerateHPP] @Periode as varchar(4),@View as varchar=1, @generate as varchar(1)
as 
--select * from t_COGS_HPP_Product_Header where Periode='2026'
--dbcc opentran
--kill 728
--exec sp_lastQueryExecution 102
set nocount on
--exec sp_COGS_GenerateHPP '2026','0','1'
--declare @periode varchar(25) = '2025'
--declare @view varchar(25)= 1 
--declare @generate varchar(25) = 0
--select * from 


select 
case
when c.ID in ('07','06','08') then 'Toll In'
when c.ID in ('02','03') then 'Toll Out'
when c.ID in ('04') then 'Import'
when c.ID in ('01','05','09') then 'Lapi'
 end as Kategori
, Product_ID, Product_Name
into #catProduct
from 
(
	select product_id, Product_Name, Product_RuangLingkup, isActive from m_product a	
) b 
left join m_Product_RuangLingkup c on b.Product_RuangLingkup = c.id --and b.isActive=1 and c.isActive=1
where b.isActive=1




if(@View=0 and @generate=1)
begin
	delete t_COGS_HPP_Product_Header from t_COGS_HPP_Product_Header a join M_COGS_PRODUCT_FORMULA_FIX b on a.Product_ID=b.product_id and a.Periode=b.Periode where a.Periode=@Periode and isnull(b.isLock,0)=0
	delete t_COGS_HPP_Product_Detail_Formula from t_COGS_HPP_Product_Detail_Formula a join M_COGS_PRODUCT_FORMULA_FIX b on a.Product_ID=b.product_id and a.Periode=b.Periode where a.Periode=@Periode and isnull(b.isLock,0)=0
end
--select * from t_COGS_HPP_Product_Header
--select * from t_COGS_HPP_Product_Detail_Formula 
-- Declare variables
DECLARE @pk_id INT;
DECLARE @product_id varchar(25);
DECLARE @pi varchar(25);
DECLARE @ps varchar(25);
DECLARE @kp varchar(25);
DECLARE @ks varchar(25);
DECLARE @std_output varchar(25);
select * into #t_COGS_HPP_Product_Detail_Formula from t_COGS_HPP_Product_Detail_Formula
delete #t_COGS_HPP_Product_Detail_Formula 

select * into #t_COGS_HPP_Product_Header from t_COGS_HPP_Product_Header
delete #t_COGS_HPP_Product_Header
 

insert into #t_COGS_HPP_Product_Header 
			([Periode]
		   ,[LOB]
           ,[Product_ID]
           ,[Group_PNCategory]
           ,[Group_PNCategory_Name]
           ,[Group_PNCategory_Dept]
           ,[Group_Rendemen]
           ,[MH_Proses_Std]
           ,[MH_Kemas_Std]
           ,[MH_Timbang_BB]
           ,[MH_Timbang_BK]
           ,[Biaya_Proses]
           ,[Biaya_Kemas]
           ,[Biaya_Generik]
           ,[Batch_Size]
           ,[MH_Analisa_Std]
           ,[Biaya_Analisa]
           ,[Biaya_Reagen]
           ,[MH_Mesin_Std]
           ,[Rate_PLN]
           ,[Direct_Labor]
           ,[Factory_Over_Head]
           ,[Depresiasi]
           ,[Toll_Fee]
           ,[Margin]
           ,[rounded]
           ,[Formula])

select distinct @Periode,
case 
	when prod.Product_Name like '%generik%' then 'GENERIK' 
	when otc.Product_ID is not null then 'OTC'
	when prl.Name like 'EKSPOR' then 'EXPORT'
	else 'ETHICAL'
	end LOB,
 a.Group_ProductID, Group_PNCategory, Group_PNCategoryName,  Group_Dept, group_rendemen,
Group_ManHourPros, Group_ManHourPack, 
Group_MHT_BB,Group_MHT_BK, 
isnull(b.Group_Proses_Rate,c.Group_Proses_Rate) Group_Proses_Rate, 
isnull(b.Group_Kemas_Rate, c.Group_Kemas_Rate) Group_Kemas_Rate,
--isnull(b.Group_Generik_Rate, c.Group_Generik_Rate)
0 Group_Generik_Rate,
 Std_Output  
, Group_MH_Analisa,
isnull(b.Group_Analisa_Rate, c.Group_Analisa_Rate) Biaya_Analisa, 
isnull(reagen.Reagen_Rate, 0) Biaya_Reagen, 
Group_KWH_Mesin, c.Group_PLN_Rate, 
isnull(rg.Direct_Labor,0) Direct_Labor, 
isnull(rg.Factory_Over_Head,0)  Factory_Over_Head, 
isnull(rg.Depresiasi,0)  Depresiasi, 
case when isnumeric(tf.toll_Fee)=1 then cast(tf.toll_Fee as decimal(18,2)) else 0 end,
case when isnumeric(tf.toll_Fee)=0 then cast(replace(tf.toll_Fee,'%','')as decimal(10,2))/100  else 0 end,
ISNULL(tf.rounded,0) rounded, null
from (select * from vw_COGS_Product_Group where periode=@periode) a left join 
(select * from vw_COGS_Pembebanan where group_periode=@Periode) b 
on a.Group_PNCategory=b.Group_PNCategoryID and a.Group_ProductID=b.Group_ProductID
join (select * from vw_COGS_Pembebanan where group_periode=@Periode) c
on a.Group_PNCategory=c.Group_PNCategoryID and c.Group_ProductID is null
join M_COGS_PRODUCT_FORMULA_FIX ff on ff.Product_ID=a.group_productid and a.Periode=ff.Periode 
join m_product prod on a.Group_ProductID=prod.Product_ID
left join m_Product_RuangLingkup prl on prod.Product_RuangLingkup=prl.ID
left join m_product_otc otc on prod.Product_ID = otc.Product_ID and otc.isActive=1
left join M_COGS_RATE_GENERAL_per_SEDIAAN rg on rg.Bentuk_Sediaan=a.Jenis_Sediaan and rg.Periode=@Periode and rg.Line_Production=a.Group_Dept
left join (select * from M_COGS_PEMBEBANAN_reagen where periode = @Periode) reagen on reagen.ProductID = prod.Product_ID 
left join (select * from M_COGS_PEMBEBANAN_TollFee where periode = @Periode) tf on tf.ProductID = prod.Product_ID 
--, (SELECT * FROM M_COGS_STD_PARAMETER WHERE Periode = @Periode) stdParam
where isnull(ff.isLock,0)=0 and a.Periode=@Periode

 --select * from M_COGS_PEMBEBANAN_reagen
 --select * from vw_COGS_Product_Group
-- Declare the cursor
DECLARE C_Product_List CURSOR FOR
	select pk_id, product_id, pi, ps, kp, ks, std_output from M_COGS_PRODUCT_FORMULA_FIX where periode=@periode and isnull(islock,0)=0

-- Open the cursor
OPEN C_Product_List;

-- Fetch the first row
FETCH NEXT FROM C_Product_List INTO @pk_id, @product_id, @pi, @ps, @kp, @ks, @std_output;

-- Loop through the cursor
WHILE @@FETCH_STATUS = 0
BEGIN
    -- Do something with @MyVar
    --PRINT @MyVar;
    insert into #t_COGS_HPP_Product_Detail_Formula
    (periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
           [ITEM_CURRENCY],[ITEM_PURCHASE_UNIT],[ITEM_PURCHASE_STD_PRICE],[total],[ITEM_TYPE])
    select	@periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
            b.ITEM_CURRENCY, b.ITEM_PURCHASE_UNIT, b.ITEM_PURCHASE_STD_PRICE,
			--dbo.fnConvertBJ(b.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE total, 
			a.UnitPrice,
			b.ITEM_TYPE from vw_COGS_FORMULA_List_detail a join 
			(select * from M_COGS_STD_HRG_BAHAN where periode=@Periode)
			b on a.ppi_itemid=b.ITEM_ID where product_id=@product_id and ppi_subid=@pi and typecode='PI' order by ppi_seqid
    --select * from vw_COGS_FORMULA_List_detail
    insert into #t_COGS_HPP_Product_Detail_Formula
    (periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
           [ITEM_CURRENCY],[ITEM_PURCHASE_UNIT],[ITEM_PURCHASE_STD_PRICE],[total],[ITEM_TYPE])
    select	@periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
			b.ITEM_CURRENCY, b.ITEM_PURCHASE_UNIT, b.ITEM_PURCHASE_STD_PRICE,
			--dbo.fnConvertBJ(b.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE total, 
			a.UnitPrice,
			b.ITEM_TYPE from vw_COGS_FORMULA_List_detail a join 
			(select * from M_COGS_STD_HRG_BAHAN where periode=@Periode)
			 b on a.ppi_itemid=b.ITEM_ID where product_id=@product_id and ppi_subid=@ps and typecode='PS' order by ppi_seqid
    
    insert into #t_COGS_HPP_Product_Detail_Formula
    (periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
           [ITEM_CURRENCY],[ITEM_PURCHASE_UNIT],[ITEM_PURCHASE_STD_PRICE],[total],[ITEM_TYPE])
    select	@periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
			b.ITEM_CURRENCY, b.ITEM_PURCHASE_UNIT, b.ITEM_PURCHASE_STD_PRICE,
			--dbo.fnConvertBJ(b.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE total,
			a.UnitPrice,
			b.ITEM_TYPE from vw_COGS_FORMULA_List_detail a join 
			(select * from M_COGS_STD_HRG_BAHAN where periode=@Periode)
			 b on a.ppi_itemid=b.ITEM_ID where product_id=@product_id and ppi_subid=@kp and typecode='KP' order by ppi_seqid
    
    insert into #t_COGS_HPP_Product_Detail_Formula
    (periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
           [ITEM_CURRENCY],[ITEM_PURCHASE_UNIT],[ITEM_PURCHASE_STD_PRICE],[total],[ITEM_TYPE])
    select	@periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
			b.ITEM_CURRENCY, b.ITEM_PURCHASE_UNIT, b.ITEM_PURCHASE_STD_PRICE,
			--dbo.fnConvertBJ(b.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE total, 
			a.UnitPrice,
			b.ITEM_TYPE from vw_COGS_FORMULA_List_detail a join 
			(select * from M_COGS_STD_HRG_BAHAN where periode=@Periode) b on a.ppi_itemid=b.ITEM_ID where product_id=@product_id and ppi_subid=@ks and typecode='KS' order by ppi_seqid

	update #t_COGS_HPP_Product_Header set 
		Formula='PI:'+isnull(@pi,'-')+', PS:'+isnull(@ps,'-')+', KP:'+isnull(@kp,'-')+', KS:'+isnull(@ks,'-')
	from #t_COGS_HPP_Product_Header a where a.Product_ID=@product_id and a.Periode=@Periode

    -- Fetch the next row
    FETCH NEXT FROM C_Product_List INTO @pk_id, @product_id, @pi, @ps, @kp, @ks, @std_output;
END;

-- Close and deallocate
CLOSE C_Product_List;
DEALLOCATE C_Product_List;


--select * from m_Product_RuangLingkup 

update #t_COGS_HPP_Product_Header set 
Beban_Sisa_Bahan_Exp=isnull(b.Beban_Sisa_Bahan_Exp,0)
from #t_COGS_HPP_Product_Header a join 
(select periode, product_id, SUM(Beban_Sisa_Bahan_Exp) beban_sisa_bahan_exp from M_COGS_PEMBEBANAN_EXPIRED group by periode, product_id) 
b on a.Product_ID=b.product_id and b.periode=@Periode




if(@View=0 and @generate=1)
begin
	insert into t_COGS_HPP_Product_Header ([Periode]
		   ,LOB
           ,[Product_ID]
           ,[Group_PNCategory]
           ,[Group_PNCategory_Name]
           ,[Group_PNCategory_Dept]
           ,[Group_Rendemen]
           ,[MH_Proses_Std]
           ,[MH_Kemas_Std]
           ,[MH_Timbang_BB]
           ,[MH_Timbang_BK]
           ,[Biaya_Proses]
           ,[Biaya_Kemas]
           ,[Biaya_Generik]
           ,Beban_Sisa_Bahan_Exp
           ,[Batch_Size]
           ,[MH_Analisa_Std]
           ,[Biaya_Analisa]
           ,[Biaya_Reagen]
           ,[MH_Mesin_Std]
           ,[Rate_PLN]
           ,[Direct_Labor]
           ,[Factory_Over_Head]
           ,[Depresiasi]
           ,[Toll_Fee]
           ,[Margin]
           ,[Rounded]
           ,[Formula])
           
	select [Periode]
		   ,LOB
           ,[Product_ID]
           ,[Group_PNCategory]
           ,[Group_PNCategory_Name]
           ,[Group_PNCategory_Dept]
           ,[Group_Rendemen]
           ,[MH_Proses_Std]
           ,[MH_Kemas_Std]
           ,[MH_Timbang_BB]
           ,[MH_Timbang_BK]
           ,[Biaya_Proses]
           ,[Biaya_Kemas]
           ,[Biaya_Generik]
           ,Beban_Sisa_Bahan_Exp
           ,[Batch_Size]
           ,[MH_Analisa_Std]
           ,[Biaya_Analisa]
           ,[Biaya_Reagen]
           ,[MH_Mesin_Std]
           ,[Rate_PLN]
           ,[Direct_Labor]
           ,[Factory_Over_Head]
           ,[Depresiasi]
           ,[Toll_Fee]
           ,[Margin]
           ,[Rounded]
           ,[Formula] from #t_COGS_HPP_Product_Header
           
           
	insert into t_COGS_HPP_Product_Detail_Formula (periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
           [ITEM_CURRENCY],[ITEM_PURCHASE_UNIT],[ITEM_PURCHASE_STD_PRICE],[total],[ITEM_TYPE])
    select periode, [Product_ID],[Product_Name],[PPI_SubID],[TypeName],[TypeCode],[Source],
           [Default],[PPI_SeqID],[PPI_ItemID],[PPI_UnitID],[PPI_QTY],[DefaultCOGS],
           [ITEM_CURRENCY],[ITEM_PURCHASE_UNIT],[ITEM_PURCHASE_STD_PRICE],[total],[ITEM_TYPE] from #t_COGS_HPP_Product_Detail_Formula

end

select a.*, bb.total totalBB,  bk.total totalBK 
	into #tmp
	from #t_COGS_HPP_Product_Header a left join
	(select periode, product_id, sum(total) total 
	from #t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BB'
	group by  product_id, periode) bb on a.Periode=bb.periode and a.Product_ID=bb.Product_ID
	left join 
	(select periode, product_id,  sum(total) total 
	from #t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BK'
	group by  product_id, periode) bk on a.Periode=bk.periode and a.Product_ID=bk.Product_ID


if(@View=1)
begin

	
	--etical & otc
	select LOB, a.Product_ID, Product_Name, totalBB, totalBK, a.Beban_Sisa_Bahan_Exp,  a.MH_Proses_Std, a.MH_Kemas_Std,
	Biaya_Proses, Biaya_Kemas, Group_Rendemen, Batch_Size, 
	round(((isnull(totalBB,0)+isnull(totalBK,0))+ISNULL(Beban_Sisa_Bahan_Exp,0)+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0) HPP
	from #tmp a join m_product b on a.product_id=b.product_id
	where Product_Name not like '%generik%'


	--Generik1
	select LOB, a.Product_ID, Product_Name, totalBB, totalBK, a.Beban_Sisa_Bahan_Exp,
	a.MH_Proses_Std, a.MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, 
	a.Biaya_Generik, a.Biaya_Analisa, MH_Mesin_Std, a.Rate_PLN, 
	Group_Rendemen, Batch_Size, 
	round(((isnull(totalBB,0)+isnull(totalBK,0))+ISNULL(Beban_Sisa_Bahan_Exp,0)+ (isnull(a.MH_Proses_Std,0)+isnull(a.MH_Kemas_Std,0)+isnull(a.MH_Timbang_BB,0)+isnull(a.MH_Timbang_BK,0)+isnull(a.MH_Analisa_Std,0))*isnull(Biaya_Generik,0)+Biaya_Analisa+
	(MH_Mesin_Std * a.Rate_PLN))/(Batch_Size*Group_Rendemen/100),0) HPP
	from #tmp a join m_product b on a.product_id=b.product_id
	where Product_Name like '%generik%'


	--Generik2
	select LOB, a.Product_ID, Product_Name, totalBB, totalBK,  a.Beban_Sisa_Bahan_Exp, 
	a.MH_Proses_Std, a.MH_Kemas_Std, Biaya_Proses, Biaya_Kemas, 
	Direct_Labor, Factory_Over_Head*50/100 Factory_Over_Head_50, 
	Group_Rendemen, Batch_Size, 
	round(((isnull(totalBB,0)+isnull(totalBK,0))+ISNULL(Beban_Sisa_Bahan_Exp,0)+ 
	(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
	(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
	)/(Batch_Size*Group_Rendemen/100),0) HPP
	from #tmp a join m_product b on a.product_id=b.product_id
	where Product_Name like '%generik%'
	
end

--select * from t_COGS_HPP_Product_Detail_Formula where Periode=YEAR(GETDATE())
--select * from t_COGS_HPP_Product_Detail_Formula where Periode=YEAR(GETDATE()) and PPI_UnitID in ('kg','l')
--and PPI_ItemID like 'ä%'


--select * from t_COGS_HPP_Product_Header where Product_ID like 'ä%'

--select * from t_COGS_HPP_Product_Detail_Formula 

--update t_COGS_HPP_Product_Detail_Formula set 

----round(((isnull(totalBB,0)+isnull(totalBK,0))+ISNULL(Beban_Sisa_Bahan_Exp,0)+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0)

select LOB, a.Product_ID, Product_Name, totalBB, totalBK, a.Beban_Sisa_Bahan_Exp,  a.MH_Proses_Std, a.MH_Kemas_Std,
Biaya_Proses, Biaya_Kemas, Group_Rendemen, Batch_Size, 
round(((isnull(totalBB,0)+isnull(totalBK,0))+ISNULL(Beban_Sisa_Bahan_Exp,0)+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0) HPP
into #tmp_utk_granul
from #tmp a join m_product b on a.product_id=b.product_id 
where Product_Name like '%granulat%' or b.Product_ID in ('H4','CQ')
--or a.Product_ID in (select item_id from M_COGS_STD_HRG_BAHAN where len(ITEM_ID)=2)

---select * from M_COGS_STD_HRG_BAHAN where len(ITEM_ID) = '2'

update m_cogs_std_hrg_bahan set ITEM_PURCHASE_STD_PRICE=isnull(dbo.fnConvertBJOpponent(ITEM_ID,1,'g',ITEM_PURCHASE_UNIT),1) * b.hpp
from
  m_cogs_std_hrg_bahan a join #tmp_utk_granul b
on replace(a.ITEM_ID,' ','') = b.Product_ID 
where Periode=@Periode

--select * from t_COGS_HPP_Product_Detail_Formula  where Product_ID='92'
update t_COGS_HPP_Product_Detail_Formula set ITEM_PURCHASE_STD_PRICE=
isnull(dbo.fnConvertBJOpponent(PPI_ItemID,1,'g',PPI_UnitID),1) * b.hpp,
total=PPI_QTY*b.HPP*isnull(dbo.fnConvertBJOpponent(PPI_ItemID,1,'g',PPI_UnitID),1)
from t_COGS_HPP_Product_Detail_Formula a 
join #tmp_utk_granul b on replace(a.PPI_ItemID,' ','') = b.Product_ID 
where periode=@periode

update t_COGS_HPP_Product_Header set Category = b.Kategori from t_COGS_HPP_Product_Header a join #catProduct b on a.Product_ID=b.Product_ID where Periode=@Periode

drop table #tmp_utk_granul
drop table #tmp
drop table #t_COGS_HPP_Product_Detail_Formula
drop table #t_COGS_HPP_Product_Header

drop table #catProduct


--select * from M_COGS_PEMBEBANAN
--select a.*, b.ITEM_CURRENCY, b.ITEM_PURCHASE_UNIT, b.ITEM_PURCHASE_STD_PRICE,
--dbo.fnConvertBJ(b.ITEM_ID,ppi_qty,item_purchase_unit, ppi_unitid)*ITEM_PURCHASE_STD_PRICE harga_perUnit
--into h_t_COGS_HPP_Detail_Formula
--from vw_COGS_FORMULA_List_detail a join M_COGS_STD_HRG_BAHAN b on a.ppi_itemid=b.ITEM_ID
--where product_id='01' and ppi_subid=@pi and typecode='PI' order by ppi_seqid
--delete h_t_COGS_HPP_Detail_Formula
--delete t_COGS_HPP_Product_Header
--delete t_COGS_HPP_Product_Detail_Formula



--select * from t_CAPA_Header where CAPA_No = 'CAPA/DV/0007/02/25'
--select * from t_CAPA_Implementasi where pk_id='1209'

--update t_CAPA_Implementasi set Status_Perbaikan='On Progress',
--CAPA_ApprRTL_Ke=null, CAPA_Status_Retimeline=null  where pk_id='1209' and Seq_ID='4'

--delete t_CAPA_Implementasi_Retimeline_Status where PK_ID='1209' and CAPA_ITL_ID=4




--select 
--case 
--	when prod.Product_Name like '%generik%' then 'GENERIK' 
--	when otc.Product_ID is not null then 'OTC'
--	when prl.Name like 'EKSPOR' then 'EXPORT'
--	else 'ETHICAL'
--	end LOB,
-- a.Group_ProductID, Group_PNCategory, Group_PNCategoryName,  Group_Dept, group_rendemen,
--Group_ManHourPros, Group_ManHourPack, 
--Group_MHT_BB,Group_MHT_BK, 
--isnull(b.Group_Proses_Rate,c.Group_Proses_Rate) Group_Proses_Rate, isnull(b.Group_Kemas_Rate, c.Group_Kemas_Rate) Group_Kemas_Rate,
--isnull(b.Group_Generik_Rate, c.Group_Generik_Rate) Group_Generik_Rate,
-- Std_Output  
--, Group_MH_Analisa,
--isnull(b.Group_Analisa_Rate, c.Group_Analisa_Rate) Biaya_Analisa, 
--Group_KWH_Mesin, stdParam.Rate_KWH_Mesin, 
--case 
--when Group_Dept='PN1' then Direct_Labor_PN1 
--when Group_Dept='PN2' then Direct_Labor_PN2
--else 0 end Direct_Labor, 
--case 
--when Group_Dept='PN1' then Factory_Over_Head_PN1 
--when Group_Dept='PN2' then Factory_Over_Head_PN2
--else 0 end Factory_Over_Head, 
--case 
--when Group_Dept='PN1' then Depresiasi_PN1 
--when Group_Dept='PN2' then Depresiasi_PN2
--else 0 end Depresiasi, b.toll_Fee, null
--from vw_COGS_Product_Group a left join M_COGS_PEMBEBANAN b 
--on a.Group_PNCategory=b.Group_PNCategoryID and a.Group_ProductID=b.Group_ProductID
--join M_COGS_PEMBEBANAN c
--on a.Group_PNCategory=c.Group_PNCategoryID and c.Group_ProductID is null
--join M_COGS_PRODUCT_FORMULA_FIX ff on ff.Product_ID=a.group_productid--and a.Periode=ff.Periode 
--join m_product prod on a.Group_ProductID=prod.Product_ID
--left join m_Product_RuangLingkup prl on prod.Product_RuangLingkup=prl.ID
--left join m_product_otc otc on prod.Product_ID = otc.Product_ID and otc.isActive=1
--, M_COGS_STD_PARAMETER stdParam 
 
-- where a.Group_ProductID like 'ä%'