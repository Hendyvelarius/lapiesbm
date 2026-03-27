--exec [sp_COGS_HPP_List_Simulasi] '%'
CREATE procedure [dbo].[sp_COGS_HPP_List_Simulasi] @Simulasi_ID as nvarchar(25)
as
--E#-#-#-#F#-#G
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--delete t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--delete t_COGS_HPP_Product_Header_Simulasi
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--select * from t_COGS_HPP_Product_Header_Simulasi
select a.*, bb.total totalBB,  bk.total totalBK
into #tmp
from t_COGS_HPP_Product_Header_Simulasi a join
(select periode, simulasi_id, sum(item_qty*item_unit_price) total 
from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where Tipe_Bahan='BB'
group by  simulasi_id, periode) bb on a.Periode=bb.periode and a.simulasi_id=bb.simulasi_id
left join 
(select periode, simulasi_id,  sum(item_qty*item_unit_price) total 
from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where Tipe_Bahan='BK'
group by  simulasi_id, periode) bk on a.Periode=bk.periode and a.simulasi_id=bk.simulasi_id
where a.simulasi_id like @Simulasi_ID

--select * from t_COGS_HPP_Product_Header_Simulasi
--update nilai nilai tollfee sesuai margin
update #tmp set Toll_Fee=round((case when (Batch_Size*Group_Rendemen/100) = 0 then 0 else
(round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ (isnull(MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0)) end) * margin,0)
where margin>0



if exists(select * from #tmp where simulasi_id like @simulasi_id and LOB in ('Ethical','OTC'))
begin
	--etical & otc
	select Group_PNCategory, Group_PNCategory_Name, LOB,Formula, a.Product_ID, a.Product_Name, totalBB, totalBK, Beban_Sisa_Bahan_Exp, a.MH_Proses_Std, a.MH_Kemas_Std,
	Biaya_Proses, Biaya_Kemas, isnull(toll_fee,0) toll_fee, isnull(margin,0) margin, isnull(rounded,0) rounded,
	Group_Rendemen, Batch_Size, 
	((isnull(totalBB,0)+isnull(totalBK,0))+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100) HPP,
	(((isnull(totalBB,0)+isnull(totalBK,0))+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100) + ISNULL(toll_fee,0)+ISNULL(rounded,0)) as HPP2,
	b.Product_SalesHNA, 
	case when isnull(b.Product_SalesHNA,0) = 0  or (Batch_Size*Group_Rendemen/100) = 0 then 0 else
		round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0)+ ISNULL(toll_fee,0)+ISNULL(rounded,0) end
	/ case when b.Product_SalesHNA=0 then 1 else b.Product_SalesHNA end as HPP_Ratio

	from #tmp a left join m_product b on a.product_id=b.product_id and a.Product_ID=b.Product_ID
	where lob in ('Ethical','OTC')
end
--return
--if (select distinct lob from #tmp where simulasi_id like @simulasi_id and versi=1) in ('Generik')
if exists(select * from #tmp where simulasi_id like @simulasi_id and versi=1 and LOB in ('Generic'))
begin
	--Generik1
	select Group_PNCategory, Group_PNCategory_Name, LOB,Formula, a.Product_ID, a.Product_Name, totalBB, totalBK, Beban_Sisa_Bahan_Exp,
	a.MH_Proses_Std, a.MH_Kemas_Std, isnull(MH_Analisa_Std,0) MH_Analisa_Std, isnull(MH_Timbang_BB,0) MH_Timbang_BB, isnull(MH_Timbang_BK,0) MH_Timbang_BK, 
	isnull(Biaya_Generik,0) Biaya_Generik, isnull(a.biaya_reagen,0) biaya_reagen, isnull(MH_Mesin_Std,0) MH_Mesin_Std, isnull(a.Rate_PLN,0) Rate_PLN, 
	Group_Rendemen, Batch_Size, 
	((isnull(totalBB,0)+isnull(totalBK,0))+ (isnull(a.MH_Proses_Std,0)+isnull(a.MH_Kemas_Std,0)+isnull(a.MH_Timbang_BB,0)+isnull(a.MH_Timbang_BK,0)+isnull(a.MH_Analisa_Std,0))*isnull(Biaya_Generik,0)+biaya_reagen+
	(MH_Mesin_Std * a.Rate_PLN))/(Batch_Size*Group_Rendemen/100) HPP
	,b.Product_SalesHNA, 
	case when isnull(b.Product_SalesHNA,0) = 0  or (Batch_Size*Group_Rendemen/100) = 0 then 0 else
	round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0) end / case when b.Product_SalesHNA=0 then 1 else b.Product_SalesHNA end as HPP_Ratio
	from #tmp a left join m_product b on a.product_id=b.product_id and a.Product_ID=b.Product_ID
	where Lob='GENERIC' and versi=1
end

--if(select distinct lob from #tmp where simulasi_id like @simulasi_id and versi=2) in ('Generik')
if exists(select * from #tmp where simulasi_id like @simulasi_id and versi=2 and LOB in ('Generic'))
begin
	--Generik2
	select Group_PNCategory, Group_PNCategory_Name, LOB,Formula, a.Product_ID, a.Product_Name, totalBB, totalBK,  Beban_Sisa_Bahan_Exp,
	a.MH_Proses_Std, a.MH_Kemas_Std, Biaya_Proses, Biaya_Kemas, 
	Direct_Labor, Factory_Over_Head*50/100 Factory_Over_Head_50, Depresiasi, 
	Group_Rendemen, Batch_Size, 
	((isnull(totalBB,0)+isnull(totalBK,0))+ 
	(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
	(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
	)/(Batch_Size*Group_Rendemen/100) HPP
	,b.Product_SalesHNA, 
	case when isnull(b.Product_SalesHNA,0) = 0  or (Batch_Size*Group_Rendemen/100) = 0 then 0
	else round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ (isnull(a.MH_Proses_Std,0)+isnull(a.MH_Kemas_Std,0)+isnull(a.MH_Timbang_BB,0)+isnull(a.MH_Timbang_BK,0)+isnull(a.MH_Analisa_Std,0))*isnull(Biaya_Generik,0)+Biaya_Reagen+
	(MH_Mesin_Std * a.Rate_PLN))/(Batch_Size*Group_Rendemen/100),0) end / case when b.Product_SalesHNA=0 then 1 else b.Product_SalesHNA end as HPP_Ratio
	from #tmp a left join m_product b on a.product_id=b.product_id and a.Product_ID=b.Product_ID
	where Lob='GENERIC' and versi=2
end
drop table #tmp