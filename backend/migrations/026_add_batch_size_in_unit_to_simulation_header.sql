-- =====================================================================
-- Migration 026: Add Batch_Size_In_Unit to the simulation header
--
-- Batch_Size is expressed in packs/boxes (KOTAK). Batch_Size_In_Unit is the
-- same batch expanded to individual dosage units (tablets / capsules). It is
-- informational only - no calculation, stored procedure or HPP result reads
-- it. Named Batch_Size_In_Unit rather than Batch_Size_Unit to avoid confusion
-- with Batch_Unit, which is the unit *name* ("KOTAK") returned by the
-- simulation stored procedures.
--
-- Because migration 025 rewrote the audit triggers with explicit column
-- lists, adding this column does NOT break DML at any point: until the
-- triggers below are replaced, the new column is simply absent from history.
-- The base table is therefore altered first, then _Hist, then the triggers.
-- (Compare migration 024, which broke every write on this table precisely
-- because the triggers were still positional `select *`.)
-- =====================================================================

SET LOCK_TIMEOUT 10000;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi') AND name = 'Batch_Size_In_Unit')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi ADD Batch_Size_In_Unit DECIMAL(18, 2) NULL;
    PRINT 'Added Batch_Size_In_Unit to t_COGS_HPP_Product_Header_Simulasi';
END
ELSE PRINT 'Batch_Size_In_Unit already on t_COGS_HPP_Product_Header_Simulasi';
GO

SET LOCK_TIMEOUT 10000;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi_Hist') AND name = 'Batch_Size_In_Unit')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi_Hist ADD Batch_Size_In_Unit DECIMAL(18, 2) NULL;
    PRINT 'Added Batch_Size_In_Unit to _Hist';
END
ELSE PRINT 'Batch_Size_In_Unit already on _Hist';
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
        Kemasan, Komposisi, Forecast, Batch_Size_In_Unit,
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
        Kemasan, Komposisi, Forecast, Batch_Size_In_Unit,
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
        Kemasan, Komposisi, Forecast, Batch_Size_In_Unit,
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
        Kemasan, Komposisi, Forecast, Batch_Size_In_Unit,
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
        Kemasan, Komposisi, Forecast, Batch_Size_In_Unit,
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
        Kemasan, Komposisi, Forecast, Batch_Size_In_Unit,
        'DELETE', GETDATE()
    FROM deleted;
END
GO

PRINT 'Migration 026 completed: Batch_Size_In_Unit added to base + _Hist, triggers updated';
GO
