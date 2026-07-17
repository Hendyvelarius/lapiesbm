-- =====================================================================
-- Migration: 020 - Drop sp_COGS_GenerateHPP_perProduct.
--
-- There is now ONE HPP generator: sp_COGS_GenerateHPP. It regenerates every
-- UNLOCKED product for the period and never touches locked ones (verified on
-- the live definition - all four gates filter isnull(isLock,0)=0):
--     L36/L37  the header + detail DELETEs join M_COGS_PRODUCT_FORMULA_FIX
--              ... and isnull(b.isLock,0)=0
--     L123     the header INSERT: where isnull(ff.isLock,0)=0
--     L129     the product cursor: where isnull(islock,0)=0
--
-- WHY THE PER-PRODUCT PROCEDURE IS BEING REMOVED RATHER THAN FIXED
--   It had drifted badly from the full generator and was actively destructive:
--
--   1. DATA LOSS (the reason it must go). Its header INSERT ended with
--        , (SELECT * FROM M_COGS_STD_PARAMETER WHERE Periode = @Periode) stdParam
--      and selected stdParam.Rate_KWH_Mesin. M_COGS_STD_PARAMETER holds rows for
--      2025 ONLY. A cross join to an empty set yields zero rows, so from 2026 on
--      the INSERT produced nothing while the preceding DELETE still ran: the
--      product's header row was deleted and never restored, leaving orphaned
--      detail rows and removing the product from HPP Standard.
--      Observed live: EXEC ... '2026','0','1','FP' took the header count 337 -> 336.
--      The full generator had already migrated off stdParam to c.Group_PLN_Rate
--      and commented the cross join out; the per-product copy never did.
--
--   2. It deleted header/detail with no isLock guard, so running it against a
--      locked product deleted rows the re-INSERT then refused to restore.
--
--   3. Its granulat/pelarut price feed lacked isnull(fnConvertBJOpponent(...),1),
--      so non-gram units (every 'ampul' pelarut) would be written as NULL.
--
--   4. That same UPDATE had no period filter and rewrote detail rows in EVERY
--      period, not just the one being generated.
--
--   Rather than carry a second, divergent copy of this logic, the application
--   now calls sp_COGS_GenerateHPP (see productModel.generateHPP), which is the
--   procedure the Generate HPP page already used.
--
-- The last definition is preserved at
--   backend/stored_procedures_backup/sp_COGS_GenerateHPP_perProduct.sql
--
-- Idempotent.
-- =====================================================================

SET NOCOUNT ON;

IF OBJECT_ID('dbo.sp_COGS_GenerateHPP_perProduct', 'P') IS NULL
BEGIN
    PRINT 'sp_COGS_GenerateHPP_perProduct does not exist - nothing to drop.';
END
ELSE
BEGIN
    DROP PROCEDURE dbo.sp_COGS_GenerateHPP_perProduct;
    PRINT 'Dropped sp_COGS_GenerateHPP_perProduct. sp_COGS_GenerateHPP is now the only HPP generator.';
END
GO
