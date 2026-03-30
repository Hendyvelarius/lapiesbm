-- FIXED VERSION: Removed .xxx suffix stripping from item_id
-- All item codes are now used as-is (e.g., 'AC 009C.000' stays 'AC 009C.000')
-- Original backup: sp_COGS_Generate_STD_Harga_Bahan.sql

ALTER procedure [dbo].[sp_COGS_Generate_STD_Harga_Bahan]
as
select a.item_id as Item_ID, a.ITEM_TYPE, ITEM_PURCHASE_UNIT, ITEM_PURCHASE_STD_PRICE, a.ITEM_CURRENCY, 
c.item_unit, dbo.fnConvertBJ(a.ITEM_ID, 1, item_purchase_unit, c.Item_Unit)*(ITEM_PURCHASE_STD_PRICE*Kurs) NilaiDalamRupiah
into #tmpDataSTDHrgBahan
from tmp_M_COGS_STD_HRG_BAHAN a left join m_item_manufacturing c on a.ITEM_ID= c.Item_ID
left join vw_COGS_Currency_List curr on curr.periode=YEAR(getdate()) and Curr_Code=a.ITEM_CURRENCY
