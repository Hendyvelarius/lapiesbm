

--select ITEM_TYPE, SUM(unitprice)  from vw_COGS_FORMULA_List_detail where Product_ID='48' and DefaultCOGS='Aktif' group by ITEM_TYPE
--select *  from vw_COGS_FORMULA_List_detail where Product_ID='48' and DefaultCOGS='Aktif' group by ITEM_TYPE
--exec [sp_COGS_HPP_List_Simulasi_PriceChange] 'Price Changes : IN 003: 22000 -> 32000; ','2025-09-30 10:18:58.340'



CREATE procedure [dbo].[sp_COGS_HPP_List_Simulasi_PriceChange] 
@Simulasi_Deskripsi as nvarchar(4000)='%', @Simulasi_Date as datetime=null
as
declare @currentPeriode as varchar(4);

select @currentPeriode = MAX(periode) from t_COGS_HPP_Product_Header
--E#-#-#-#F#-#G
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--delete t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--delete t_COGS_HPP_Product_Header_Simulasi
--select * from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
--select * from t_COGS_HPP_Product_Header_Simulasi order by simulasi_date desc
select a.*, isnull(bb.total,0) totalBB,  isnull(bk.total,0) totalBK
into #tmpCurrentHPP
from t_COGS_HPP_Product_Header a left join
(select periode, product_id, sum(total) total 
from t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BB'
group by  product_id, periode) bb on a.Periode=bb.periode and a.Product_ID=bb.Product_ID
left join 
(select periode, product_id,  sum(total) total 
from t_COGS_HPP_Product_Detail_Formula where ITEM_TYPE='BK'
group by  product_id, periode) bk on a.Periode=bk.periode and a.Product_ID=bk.Product_ID
where a.Periode = @currentPeriode






select a.*, isnull(bb.total,0) totalBB,  isnull(bk.total,0) totalBK
into #tmp
from t_COGS_HPP_Product_Header_Simulasi a join
(select periode, simulasi_id, sum(item_qty*item_unit_price) total 
from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where Tipe_Bahan='BB'
group by  simulasi_id, periode) bb on a.Periode=bb.periode and a.simulasi_id=bb.simulasi_id
left join 
(select periode, simulasi_id,  sum(item_qty*item_unit_price) total 
from t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan where Tipe_Bahan='BK'
group by  simulasi_id, periode) bk on a.Periode=bk.periode and a.simulasi_id=bk.simulasi_id
where a.Simulasi_Type='Price Changes'
--and a.Simulasi_Deskripsi like @Simulasi_Deskripsi --and a.Simulasi_Date like isnull(@Simulasi_Date,'%')

select * into #tmpDataAfter from (
select a.Simulasi_Deskripsi, Simulasi_Date, a.Product_ID, Product_Name, totalBB+totalBK totalBahanSesudah, 
((isnull(totalBB,0)+isnull(totalBK,0))+
 (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+
 (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
 isnull(Beban_Sisa_Bahan_Exp,0) 
)/(Batch_Size*Group_Rendemen/100) HPPSesudah, 0 HPP2Sebelum
from #tmp a --join m_product b on a.product_id=b.product_id
where lob in ('Ethical','OTC','EXPORT')
union all
select a.Simulasi_Deskripsi, Simulasi_Date, a.Product_ID, Product_Name, totalBB+totalBK totalBahanSesudah, 
((isnull(totalBB,0)+isnull(totalBK,0))+ 
(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Timbang_BB,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Timbang_BK,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Analisa_Std,0)*isnull(Biaya_Analisa,0))
+Biaya_Reagen
+isnull(Beban_Sisa_Bahan_Exp,0) 
+(MH_Mesin_Std * a.Rate_PLN))
/(Batch_Size*Group_Rendemen/100) HPPGen1Sesudah,
((isnull(totalBB,0)+isnull(totalBK,0))+ 
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ 
--(isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
--(isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
	isnull(a.MH_Proses_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_kemas_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_Proses_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_Proses_Std,0)*isnull(Depresiasi,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Depresiasi,0)
)/(Batch_Size*Group_Rendemen/100) HPPGen2Sesudah
from #tmp a 
where Lob='GENERIK' ) dataAfter

select * into #tmpDataBefore from (
select a.Product_ID, Product_Name, totalBB+totalBK totalBahanSebelum,
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+
 (isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+
 (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))+
 isnull(Beban_Sisa_Bahan_Exp,0) 
)/(Batch_Size*Group_Rendemen/100) end HPPSebelum, 0 HPP2Sebelum
from #tmpCurrentHPP a join m_product b on a.Product_ID=b.Product_ID
where lob in ('Ethical','OTC')
union all
select a.Product_ID, Product_Name, totalBB+totalBK totalBahanSebelum, 
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+ 
(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Timbang_BB,0)*isnull(Biaya_Proses,0)
+isnull(a.MH_Timbang_BK,0)*isnull(Biaya_Kemas,0)
+isnull(a.MH_Analisa_Std,0)*isnull(Biaya_Analisa,0))
+Biaya_Reagen
+isnull(Beban_Sisa_Bahan_Exp,0) 
+(MH_Mesin_Std * a.Rate_PLN))/(Batch_Size*Group_Rendemen/100) end HPPGen1Sebelum,
case when isnull(Batch_Size,0)=0 or isnull(Group_Rendemen,0)=0 then 0 else
((isnull(totalBB,0)+isnull(totalBK,0))+ 
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*Depresiasi+
--(isnull(a.MH_Proses_Std,0)*isnull(Biaya_Proses,0))+ (isnull(a.MH_Kemas_Std,0)*isnull(Biaya_Kemas,0))*(Factory_Over_Head*50/100)
	isnull(a.MH_Proses_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_kemas_Std,0)*isnull((Factory_Over_Head*50/100),0)+
	isnull(a.MH_Proses_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Direct_Labor,0)+
	isnull(a.MH_Proses_Std,0)*isnull(Depresiasi,0)+
	isnull(a.MH_kemas_Std,0)*isnull(Depresiasi,0)
)/(Batch_Size*Group_Rendemen/100) end HPPGen2Sebelum
from #tmpCurrentHPP a join m_product b on a.Product_ID=b.Product_ID 
where Lob='GENERIK' ) dataBefore

select distinct a.Simulasi_Deskripsi, a.Simulasi_Date, a.Product_ID, a.Product_Name, b.totalBahanSebelum, a.totalBahanSesudah, b.HPPSebelum, a.HPPSesudah,
(HPPSesudah-HPPSebelum)/HPPSebelum*100
persentase_perubahan
, c.Product_SalesHNA, 
case when isnull(Product_SalesHNA,0)=0 then 0 else HPPSebelum/Product_SalesHNA end  Rasio_HPP_Sebelum, 
case when isnull(Product_SalesHNA,0)=0 then 0 else HPPSesudah/Product_SalesHNA end Rasio_HPP_Sesudah
 from #tmpDataAfter a left join #tmpDataBefore b on
a.Product_ID=b.Product_ID 
 left join m_product c on a.product_id=c.product_id and a.Product_ID=c.Product_ID
where a.Simulasi_Deskripsi like @Simulasi_Deskripsi 
and
CONVERT(varchar(25),a.Simulasi_Date,120) = 
isnull(CONVERT(varchar(25),@Simulasi_Date,120),'%')

order by Simulasi_Date desc, Simulasi_Deskripsi, Product_Name


--select CONVERT(varchar(25),'2025-09-24 00:27:38.087',120)
drop table #tmp
drop table #tmpCurrentHPP
drop table #tmpDataAfter
drop table #tmpDataBefore
