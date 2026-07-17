-- =====================================================================
-- Migration: 019 - Feed "Pelarut" half-manufactured products into the
--                  standard price table during HPP generation.
--
-- PROBLEM
--   Product FP (ANFUROX INJEKSI) uses FW (PELARUT ANFUROX INJEKSI) as a
--   component of its Kemasan Sekunder formula. FW is a half-manufactured
--   product with its own computed HPP, but FP booked it at Rp 0.
--
-- ROOT CAUSE
--   sp_COGS_GenerateHPP feeds a half-manufactured product's own computed
--   HPP back into M_COGS_STD_HRG_BAHAN.ITEM_PURCHASE_STD_PRICE (and into
--   t_COGS_HPP_Product_Detail_Formula.total), but only for products picked
--   by a hardcoded whitelist:
--
--       where Product_Name like '%granulat%' or b.Product_ID in ('H4','CQ')
--
--   FW is neither a "granulat" nor listed, so its standard price was never
--   populated and stayed 0 -> FP booked 9174 x 0 = Rp 0.
--
--   Evidence (period 2026), using the procedure's own HPP formula:
--       CQ  Water For Injection   computed 7752  / std price 7752  (whitelisted)
--       H4  Pelarut Lameson       computed 4544  / std price 4544  (whitelisted)
--       FW  Pelarut Anfurox       computed 10553 / std price 0     (NOT whitelisted)
--
-- FIX
--   Extend the whitelist with Product_Name LIKE '%pelarut%', so every
--   Pelarut product is fed the same way H4 already is. DB collation is
--   SQL_Latin1_General_CP1_CI_AS (case-insensitive), so '%pelarut%'
--   matches 'PELARUT ANFUROX INJEKSI'.
--
-- SCOPE (verified against live data, period 2026)
--   Products matching '%pelarut%':
--     FW      - the fix. Gains std price 10553; FP's KS line goes 0 -> 96,813,222
--     H4      - already whitelisted via 'H4'; matches again, identical result
--     02SMRB  - has own HPP but no M_COGS_STD_HRG_BAHAN row and is not used
--               as a component -> both UPDATEs no-op
--     HO      - has no generated HPP header -> never enters #tmp_utk_granul
--
-- EFFECT
--   Takes effect on the NEXT run of sp_COGS_GenerateHPP. That run updates
--   both ITEM_PURCHASE_STD_PRICE and t_COGS_HPP_Product_Detail_Formula.total
--   in the same pass, so FP's HPP corrects without a second generate.
--   ANFUROX INJEKSI's HPP will RISE (it was understating by ~96.8M/batch).
--
-- This migration patches only the WHERE clause in place, so it cannot drift
-- from the rest of the live procedure body. It is idempotent and verifies
-- the expected text exists before changing anything.
-- =====================================================================

SET NOCOUNT ON;

DECLARE @def   nvarchar(max);
DECLARE @old   nvarchar(200) = N'where Product_Name like ''%granulat%'' or b.Product_ID in (''H4'',''CQ'')';
DECLARE @new   nvarchar(200) = N'where Product_Name like ''%granulat%'' or Product_Name like ''%pelarut%'' or b.Product_ID in (''H4'',''CQ'')';

SELECT @def = definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('dbo.sp_COGS_GenerateHPP');

IF @def IS NULL
BEGIN
    RAISERROR('sp_COGS_GenerateHPP not found. Aborting.', 16, 1);
    RETURN;
END

IF CHARINDEX(@new, @def) > 0
BEGIN
    PRINT 'Already patched: sp_COGS_GenerateHPP already includes the %pelarut% rule. No change made.';
    RETURN;
END

IF CHARINDEX(@old, @def) = 0
BEGIN
    RAISERROR('Expected whitelist clause not found in sp_COGS_GenerateHPP. The procedure has changed since this migration was written - review manually before applying.', 16, 1);
    RETURN;
END

-- Swap CREATE -> ALTER and apply the one-line whitelist change.
SET @def = REPLACE(@def, @old, @new);
SET @def = STUFF(@def, CHARINDEX('CREATE', @def), 6, 'ALTER');

EXEC sp_executesql @def;

PRINT 'Patched sp_COGS_GenerateHPP: whitelist now includes Product_Name LIKE ''%pelarut%''.';
PRINT 'Run sp_COGS_GenerateHPP for the target period to apply the corrected prices.';
GO
