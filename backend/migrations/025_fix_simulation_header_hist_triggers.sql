-- =====================================================================
-- Migration 025: Repair the t_COGS_HPP_Product_Header_Simulasi audit triggers
--
-- PROBLEM
--   The three audit triggers (2015) copied rows into ..._Hist positionally:
--       Insert into t_COGS_HPP_Product_Header_Simulasi_hist
--           select *, 'INSERT', getdate() from inserted
--   Migration 024 added Kemasan / Komposisi / Forecast to the base table, so
--   `inserted` became 42 columns and the trigger supplied 44 values to a
--   41-column _Hist table. Result: SQL Server error 213
--   ("Column name or number of supplied values does not match table
--   definition") raised inside the trigger on EVERY insert, update and delete
--   against the simulation header - breaking Run Simulation, Save, Clone and
--   soft-delete.
--
-- FIX
--   1. Give _Hist the three new columns so history stays complete.
--   2. Rewrite all three triggers with EXPLICIT column lists, so the audit
--      trail no longer depends on the two tables having identical column
--      order. Adding a column to the base table can no longer break DML;
--      at worst the new column is absent from history until listed here.
--
--   _Hist column order is [39 mirrored columns] + deleteStatus + deleteDate,
--   so the new columns land AFTER the audit columns. That mismatch is exactly
--   why the explicit lists are required rather than just adding the columns.
--
-- Pre-change definitions archived in
-- backend/stored_procedures_backup/pre_fix_20260804/.
-- =====================================================================

SET LOCK_TIMEOUT 10000;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi_Hist') AND name = 'Kemasan')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi_Hist ADD Kemasan VARCHAR(255) NULL;
    PRINT 'Added Kemasan to _Hist';
END
ELSE PRINT 'Kemasan already on _Hist';
GO

SET LOCK_TIMEOUT 10000;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi_Hist') AND name = 'Komposisi')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi_Hist ADD Komposisi VARCHAR(2000) NULL;
    PRINT 'Added Komposisi to _Hist';
END
ELSE PRINT 'Komposisi already on _Hist';
GO

SET LOCK_TIMEOUT 10000;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi_Hist') AND name = 'Forecast')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi_Hist ADD Forecast VARCHAR(255) NULL;
    PRINT 'Added Forecast to _Hist';
END
ELSE PRINT 'Forecast already on _Hist';
GO

-- ---------------------------------------------------------------------
-- INSERT trigger
-- ---------------------------------------------------------------------
ALTER TRIGGER [dbo].[trigger_t_COGS_HPP_Product_Header_Simulasi_INSERT]
    ON dbo.t_COGS_HPP_Product_Header_Simulasi
    AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO t_COGS_HPP_Product_Header_Simulasi_Hist (
        Periode, Simulasi_ID, Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Formula,
        Product_ID, Product_Name, Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
        Group_Rendemen, Batch_Size, LOB, Versi,
        MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
        Biaya_Proses, Biaya_Kemas, Biaya_Generik, Biaya_Reagen, Biaya_Analisa,
        Toll_Fee, Margin, Rounded, Rate_PLN, Direct_Labor, Factory_Over_Head, Depresiasi,
        Beban_Sisa_Bahan_Exp, HNA, user_id, delegated_to, process_date, flag_delete,
        Kemasan, Komposisi, Forecast,
        deleteStatus, deleteDate
    )
    SELECT
        Periode, Simulasi_ID, Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Formula,
        Product_ID, Product_Name, Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
        Group_Rendemen, Batch_Size, LOB, Versi,
        MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
        Biaya_Proses, Biaya_Kemas, Biaya_Generik, Biaya_Reagen, Biaya_Analisa,
        Toll_Fee, Margin, Rounded, Rate_PLN, Direct_Labor, Factory_Over_Head, Depresiasi,
        Beban_Sisa_Bahan_Exp, HNA, user_id, delegated_to, process_date, flag_delete,
        Kemasan, Komposisi, Forecast,
        'INSERT', GETDATE()
    FROM inserted;
END
GO

-- ---------------------------------------------------------------------
-- UPDATE trigger
-- ---------------------------------------------------------------------
ALTER TRIGGER [dbo].[trigger_t_COGS_HPP_Product_Header_Simulasi_UPDATE]
    ON dbo.t_COGS_HPP_Product_Header_Simulasi
    AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO t_COGS_HPP_Product_Header_Simulasi_Hist (
        Periode, Simulasi_ID, Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Formula,
        Product_ID, Product_Name, Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
        Group_Rendemen, Batch_Size, LOB, Versi,
        MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
        Biaya_Proses, Biaya_Kemas, Biaya_Generik, Biaya_Reagen, Biaya_Analisa,
        Toll_Fee, Margin, Rounded, Rate_PLN, Direct_Labor, Factory_Over_Head, Depresiasi,
        Beban_Sisa_Bahan_Exp, HNA, user_id, delegated_to, process_date, flag_delete,
        Kemasan, Komposisi, Forecast,
        deleteStatus, deleteDate
    )
    SELECT
        Periode, Simulasi_ID, Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Formula,
        Product_ID, Product_Name, Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
        Group_Rendemen, Batch_Size, LOB, Versi,
        MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
        Biaya_Proses, Biaya_Kemas, Biaya_Generik, Biaya_Reagen, Biaya_Analisa,
        Toll_Fee, Margin, Rounded, Rate_PLN, Direct_Labor, Factory_Over_Head, Depresiasi,
        Beban_Sisa_Bahan_Exp, HNA, user_id, delegated_to, process_date, flag_delete,
        Kemasan, Komposisi, Forecast,
        'UPDATE', GETDATE()
    FROM inserted;
END
GO

-- ---------------------------------------------------------------------
-- DELETE trigger (reads from `deleted`)
-- ---------------------------------------------------------------------
ALTER TRIGGER [dbo].[trigger_t_COGS_HPP_Product_Header_Simulasi_DELETE]
    ON dbo.t_COGS_HPP_Product_Header_Simulasi
    AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO t_COGS_HPP_Product_Header_Simulasi_Hist (
        Periode, Simulasi_ID, Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Formula,
        Product_ID, Product_Name, Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
        Group_Rendemen, Batch_Size, LOB, Versi,
        MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
        Biaya_Proses, Biaya_Kemas, Biaya_Generik, Biaya_Reagen, Biaya_Analisa,
        Toll_Fee, Margin, Rounded, Rate_PLN, Direct_Labor, Factory_Over_Head, Depresiasi,
        Beban_Sisa_Bahan_Exp, HNA, user_id, delegated_to, process_date, flag_delete,
        Kemasan, Komposisi, Forecast,
        deleteStatus, deleteDate
    )
    SELECT
        Periode, Simulasi_ID, Simulasi_Deskripsi, Simulasi_Date, Simulasi_Type, Formula,
        Product_ID, Product_Name, Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
        Group_Rendemen, Batch_Size, LOB, Versi,
        MH_Proses_Std, MH_Kemas_Std, MH_Analisa_Std, MH_Timbang_BB, MH_Timbang_BK, MH_Mesin_Std,
        Biaya_Proses, Biaya_Kemas, Biaya_Generik, Biaya_Reagen, Biaya_Analisa,
        Toll_Fee, Margin, Rounded, Rate_PLN, Direct_Labor, Factory_Over_Head, Depresiasi,
        Beban_Sisa_Bahan_Exp, HNA, user_id, delegated_to, process_date, flag_delete,
        Kemasan, Komposisi, Forecast,
        'DELETE', GETDATE()
    FROM deleted;
END
GO

PRINT 'Migration 025 completed: _Hist columns added and audit triggers rewritten with explicit column lists';
GO
