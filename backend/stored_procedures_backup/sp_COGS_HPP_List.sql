--exec [sp_COGS_HPP_List]

--delete t_COGS_HPP_Product_Detail_Formula
--delete t_COGS_HPP_Product_Header
CREATE procedure [dbo].[sp_COGS_HPP_List] @periode as varchar(255)=''
as
if @periode='' begin set @periode = YEAR(GETDATE()) end
select a.*, bb.total totalBB,  bk.total totalBK
into #tmp
from t_COGS_HPP_Product_Header a left join
(select periode, product_id, sum(total) total 
from t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BB'
group by  product_id, periode) bb on a.Periode=bb.periode and a.Product_ID=bb.Product_ID
left join 
(select periode, product_id,  sum(total) total 
from t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BK'
group by  product_id, periode) bk on a.Periode=bk.periode and a.Product_ID=bk.Product_ID


--update nilai nilai tollfee sesuai margin
update #tmp set Toll_Fee=round((case when (Batch_Size*Group_Rendemen/100) = 0 then 0 else
(round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ (isnull(MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0)) end) * margin,0)
where margin>0

--etical & otc
select a.Periode, a.Product_ID, Product_Name, jenis_sediaan [Sediaan],Group_PNCategory_Dept,  LOB,Category,Group_PNCategory, Group_PNCategory_Name, 
Batch_Size, Group_Rendemen, 
totalBB, totalBK, Beban_Sisa_Bahan_Exp, a.MH_Proses_Std, a.MH_Kemas_Std,
Biaya_Proses, Biaya_Kemas, isnull(toll_fee,0) toll_fee, isnull(margin,0) margin, isnull(rounded,0) rounded,
case when (Batch_Size*Group_Rendemen/100) = 0 then 0 else
(round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0)) end HPP,
case when (Batch_Size*Group_Rendemen/100) = 0 or isnull(toll_fee,0)=0 then 0 else
(round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0)) + ISNULL(toll_fee,0)+ISNULL(rounded,0) end HPP2,
b.Product_SalesHNA, 
cast(round(case when isnull(b.Product_SalesHNA,0) = 0  or (Batch_Size*Group_Rendemen/100) = 0 then 0 else
(round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)))/(Batch_Size*Group_Rendemen/100),0)) + ISNULL(toll_fee,0)+ISNULL(rounded,0) end  / case when b.Product_SalesHNA=0 then 1 else b.Product_SalesHNA end * 100,2) as decimal(16,2)) as HPP_Ratio,
Formula

from #tmp a join m_product b on a.product_id=b.product_id
left join m_product_sediaan_produksi c on c.product_id = b.product_id
where Product_Name not like '%generik%'
--and b.Product_RuangLingkup in ('01','05','08','02','04')
and a.Periode=@periode
--select ID from m_Product_RuangLingkup where ID not in ('07','06','02','03','09')

--Generik1
select a.Periode, a.Product_ID, Product_Name, jenis_sediaan [Sediaan],Group_PNCategory_Dept,  LOB,Category,Group_PNCategory, Group_PNCategory_Name, 
Batch_Size, Group_Rendemen, 
totalBB, totalBK, Beban_Sisa_Bahan_Exp,
a.MH_Proses_Std, a.MH_Kemas_Std, isnull(MH_Analisa_Std,0) MH_Analisa_Std, isnull(MH_Timbang_BB,0) MH_Timbang_BB, isnull(MH_Timbang_BK,0) MH_Timbang_BK, 
isnull(a.Biaya_Proses,0)  Biaya_Proses,  isnull(a.Biaya_Kemas,0)  Biaya_Kemas, 
--isnull(Biaya_Generik,0) Biaya_Generik, 
isnull(a.Biaya_Analisa,0) Biaya_Analisa, 
Biaya_Reagen,
isnull(MH_Mesin_Std,0) MH_Mesin_Std, isnull(a.Rate_PLN,0) Rate_PLN, 

case when (Batch_Size*Group_Rendemen/100) = 0 then 0
else round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ 
(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Timbang_BB,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Timbang_BK,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Analisa_Std,0)*isnull(Biaya_Analisa,0))
+Biaya_Reagen+
(MH_Mesin_Std * a.Rate_PLN))/(Batch_Size*Group_Rendemen/100),0) end HPP,
b.Product_SalesHNA, 
cast(round(case when isnull(b.Product_SalesHNA,0) = 0  or (Batch_Size*Group_Rendemen/100) = 0 then 0
else round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+ 
(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Timbang_BB,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Timbang_BK,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Analisa_Std,0)*isnull(Biaya_Analisa,0))
+Biaya_Reagen+
(MH_Mesin_Std * a.Rate_PLN))/(Batch_Size*Group_Rendemen/100),0) end / case when b.Product_SalesHNA=0 then 1 else b.Product_SalesHNA end * 100,2) as decimal(16,2)) as HPP_Ratio
,
Formula
from #tmp a join m_product b on a.product_id=b.product_id
left join m_product_sediaan_produksi c on c.product_id = b.product_id
where Product_Name like '%generik%'
and a.Periode=@periode

--Generik2
select a.Periode, a.Product_ID, Product_Name, jenis_sediaan [Sediaan],Group_PNCategory_Dept,  LOB, Category,
Group_PNCategory, Group_PNCategory_Name, 
Batch_Size, Group_Rendemen, 
 totalBB, totalBK,  Beban_Sisa_Bahan_Exp,
a.MH_Proses_Std, a.MH_Kemas_Std,-- Biaya_Proses, Biaya_Kemas, 
Direct_Labor, 
case when Product_Name like '%generik%' then Factory_Over_Head*50/100 else Factory_Over_Head end
Factory_Over_Head_50, 
case when Product_Name like '%generik%' then 0 else Depresiasi end Depresiasi,

case when (Batch_Size*Group_Rendemen/100) = 0 then 0
else
round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+
isnull(a.MH_Proses_Std,0)*isnull(case when Product_Name like '%generik%' then Factory_Over_Head*50/100 else Factory_Over_Head end,0)+
isnull(a.MH_kemas_Std,0)*isnull(case when Product_Name like '%generik%' then Factory_Over_Head*50/100 else Factory_Over_Head end,0)+
isnull(a.MH_Proses_Std,0)*isnull(Direct_Labor,0)+
isnull(a.MH_kemas_Std,0)*isnull(Direct_Labor,0)+
isnull(a.MH_Proses_Std,0)*isnull(case when Product_Name like '%generik%' then 0 else Depresiasi end,0)+
isnull(a.MH_kemas_Std,0)*isnull(case when Product_Name like '%generik%' then 0 else Depresiasi end,0)
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
)/(Batch_Size*Group_Rendemen/100),0) end HPP,
b.Product_SalesHNA, 
cast(round(case when isnull(b.Product_SalesHNA,0) = 0  or (Batch_Size*Group_Rendemen/100) = 0 then 0
else
round(((isnull(totalBB,0)+isnull(totalBK,0)+isnull(Beban_Sisa_Bahan_Exp,0))+
isnull(a.MH_Proses_Std,0)*isnull(case when Product_Name like '%generik%' then Factory_Over_Head*50/100 else Factory_Over_Head end,0)+
isnull(a.MH_kemas_Std,0)*isnull(case when Product_Name like '%generik%' then Factory_Over_Head*50/100 else Factory_Over_Head end,0)+
isnull(a.MH_Proses_Std,0)*isnull(Direct_Labor,0)+
isnull(a.MH_kemas_Std,0)*isnull(Direct_Labor,0)+
isnull(a.MH_Proses_Std,0)*isnull(case when Product_Name like '%generik%' then 0 else Depresiasi end,0)+
isnull(a.MH_kemas_Std,0)*isnull(case when Product_Name like '%generik%' then 0 else Depresiasi end,0)
)/(Batch_Size*Group_Rendemen/100),0) end / case when b.Product_SalesHNA=0 then 1 else b.Product_SalesHNA end  * 100,2) as decimal(16,2)) as HPP_Ratio


,
Formula
from #tmp a join m_product b on a.product_id=b.product_id
left join m_product_sediaan_produksi c on c.product_id = b.product_id
where --Product_Name like '%generik%'
--and 
a.Periode=@periode

drop table #tmp