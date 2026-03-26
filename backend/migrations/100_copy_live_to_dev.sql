-- ============================================================================
-- MIGRATION: Copy Live Server Data to Dev Server
-- ============================================================================
-- PURPOSE: Copy all eSBM (COGS) tables, views, and stored procedures
--          from LIVE server (192.168.1.21) to DEV server (192.168.1.49)
--
-- HOW TO RUN:
--   1. Connect SSMS to DEV server (192.168.1.49), database: lapifactory
--   2. Run STEP 1 first (linked server setup)
--   3. Run STEP 2 (copy table data)
--   4. Run STEP 3 (copy views)
--   5. Run STEP 4 (copy stored procedures)
--   6. Run STEP 5 (cleanup linked server - optional)
--
-- NOTE: Run each step separately. Do NOT run the entire script at once.
-- ============================================================================


-- ============================================================================
-- STEP 1: CREATE LINKED SERVER TO LIVE
-- ============================================================================
-- Run this on DEV server (192.168.1.49)

-- Drop linked server if it already exists
IF EXISTS (SELECT * FROM sys.servers WHERE name = 'LIVE_SERVER')
BEGIN
    EXEC sp_dropserver @server = 'LIVE_SERVER', @droplogins = 'droplogins';
END
GO

-- Create linked server pointing to live (192.168.1.21)
EXEC sp_addlinkedserver
    @server = 'LIVE_SERVER',
    @srvproduct = '',
    @provider = 'SQLNCLI',
    @datasrc = '192.168.1.21,1433';
GO

-- Configure login mapping
EXEC sp_addlinkedsrvlogin
    @rmtsrvname = 'LIVE_SERVER',
    @useself = 'FALSE',
    @locallogin = NULL,
    @rmtuser = 'sa',
    @rmtpassword = 'ygi_dny_jny_0902_apl';
GO

-- Enable RPC for executing remote procedures
EXEC sp_serveroption @server = 'LIVE_SERVER', @optname = 'rpc out', @optvalue = 'true';
GO

-- Test the connection
SELECT TOP 1 name FROM [LIVE_SERVER].lapifactory.sys.tables;
GO

PRINT '=== STEP 1 COMPLETE: Linked server created and verified ==='
GO


-- ============================================================================
-- STEP 2: COPY TABLE DATA (Live -> Dev)
-- ============================================================================
-- Run this on DEV server (192.168.1.49), database: lapifactory
-- For each table: if exists on dev -> truncate & re-insert; if not -> SELECT INTO

USE lapifactory;
GO

-- --------------------------------------------------------------------------
-- 2a. M_COGS_STD_HRG_BAHAN (Standard Material Pricing)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_STD_HRG_BAHAN', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_STD_HRG_BAHAN...';
    DELETE FROM dbo.M_COGS_STD_HRG_BAHAN;
    SET IDENTITY_INSERT dbo.M_COGS_STD_HRG_BAHAN ON;
    INSERT INTO dbo.M_COGS_STD_HRG_BAHAN
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_STD_HRG_BAHAN;
    SET IDENTITY_INSERT dbo.M_COGS_STD_HRG_BAHAN OFF;
    PRINT 'Done: M_COGS_STD_HRG_BAHAN copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_STD_HRG_BAHAN from live...';
    SELECT * INTO dbo.M_COGS_STD_HRG_BAHAN
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_STD_HRG_BAHAN;
    PRINT 'Done: M_COGS_STD_HRG_BAHAN created.';
END
GO

-- --------------------------------------------------------------------------
-- 2b. M_COGS_STD_PARAMETER (Calculation Constants)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_STD_PARAMETER', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_STD_PARAMETER...';
    DELETE FROM dbo.M_COGS_STD_PARAMETER;
    INSERT INTO dbo.M_COGS_STD_PARAMETER
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_STD_PARAMETER;
    PRINT 'Done: M_COGS_STD_PARAMETER copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_STD_PARAMETER from live...';
    SELECT * INTO dbo.M_COGS_STD_PARAMETER
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_STD_PARAMETER;
    PRINT 'Done: M_COGS_STD_PARAMETER created.';
END
GO

-- --------------------------------------------------------------------------
-- 2c. M_COGS_PRODUCT_GROUP_MANUAL (Product Categories)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_PRODUCT_GROUP_MANUAL', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_PRODUCT_GROUP_MANUAL...';
    DELETE FROM dbo.M_COGS_PRODUCT_GROUP_MANUAL;
    INSERT INTO dbo.M_COGS_PRODUCT_GROUP_MANUAL
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PRODUCT_GROUP_MANUAL;
    PRINT 'Done: M_COGS_PRODUCT_GROUP_MANUAL copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_PRODUCT_GROUP_MANUAL from live...';
    SELECT * INTO dbo.M_COGS_PRODUCT_GROUP_MANUAL
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PRODUCT_GROUP_MANUAL;
    PRINT 'Done: M_COGS_PRODUCT_GROUP_MANUAL created.';
END
GO

-- --------------------------------------------------------------------------
-- 2d. M_COGS_RATE_GENERAL_per_SEDIAAN (General Rates by Dosage Form)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_RATE_GENERAL_per_SEDIAAN', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_RATE_GENERAL_per_SEDIAAN...';
    DELETE FROM dbo.M_COGS_RATE_GENERAL_per_SEDIAAN;
    INSERT INTO dbo.M_COGS_RATE_GENERAL_per_SEDIAAN
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_RATE_GENERAL_per_SEDIAAN;
    PRINT 'Done: M_COGS_RATE_GENERAL_per_SEDIAAN copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_RATE_GENERAL_per_SEDIAAN from live...';
    SELECT * INTO dbo.M_COGS_RATE_GENERAL_per_SEDIAAN
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_RATE_GENERAL_per_SEDIAAN;
    PRINT 'Done: M_COGS_RATE_GENERAL_per_SEDIAAN created.';
END
GO

-- --------------------------------------------------------------------------
-- 2e. M_COGS_PEMBEBANAN (Burden/Allocation Master)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_PEMBEBANAN', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_PEMBEBANAN...';
    DELETE FROM dbo.M_COGS_PEMBEBANAN;
    INSERT INTO dbo.M_COGS_PEMBEBANAN
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PEMBEBANAN;
    PRINT 'Done: M_COGS_PEMBEBANAN copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_PEMBEBANAN from live...';
    SELECT * INTO dbo.M_COGS_PEMBEBANAN
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PEMBEBANAN;
    PRINT 'Done: M_COGS_PEMBEBANAN created.';
END
GO

-- --------------------------------------------------------------------------
-- 2f. M_COGS_PEMBEBANAN_REAGEN (Reagent Allocation Rates)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_PEMBEBANAN_REAGEN', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_PEMBEBANAN_REAGEN...';
    DELETE FROM dbo.M_COGS_PEMBEBANAN_REAGEN;
    INSERT INTO dbo.M_COGS_PEMBEBANAN_REAGEN
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PEMBEBANAN_REAGEN;
    PRINT 'Done: M_COGS_PEMBEBANAN_REAGEN copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_PEMBEBANAN_REAGEN from live...';
    SELECT * INTO dbo.M_COGS_PEMBEBANAN_REAGEN
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PEMBEBANAN_REAGEN;
    PRINT 'Done: M_COGS_PEMBEBANAN_REAGEN created.';
END
GO

-- --------------------------------------------------------------------------
-- 2g. M_COGS_PEMBEBANAN_TollFee (Toll Fee Charges)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_PEMBEBANAN_TollFee', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_PEMBEBANAN_TollFee...';
    DELETE FROM dbo.M_COGS_PEMBEBANAN_TollFee;
    INSERT INTO dbo.M_COGS_PEMBEBANAN_TollFee
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PEMBEBANAN_TollFee;
    PRINT 'Done: M_COGS_PEMBEBANAN_TollFee copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_PEMBEBANAN_TollFee from live...';
    SELECT * INTO dbo.M_COGS_PEMBEBANAN_TollFee
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PEMBEBANAN_TollFee;
    PRINT 'Done: M_COGS_PEMBEBANAN_TollFee created.';
END
GO

-- --------------------------------------------------------------------------
-- 2h. M_COGS_BEBAN_SISA_BAHAN_EXP (Expired Material Burden)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_BEBAN_SISA_BAHAN_EXP', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_BEBAN_SISA_BAHAN_EXP...';
    DELETE FROM dbo.M_COGS_BEBAN_SISA_BAHAN_EXP;
    INSERT INTO dbo.M_COGS_BEBAN_SISA_BAHAN_EXP
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_BEBAN_SISA_BAHAN_EXP;
    PRINT 'Done: M_COGS_BEBAN_SISA_BAHAN_EXP copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_BEBAN_SISA_BAHAN_EXP from live...';
    SELECT * INTO dbo.M_COGS_BEBAN_SISA_BAHAN_EXP
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_BEBAN_SISA_BAHAN_EXP;
    PRINT 'Done: M_COGS_BEBAN_SISA_BAHAN_EXP created.';
END
GO

-- --------------------------------------------------------------------------
-- 2i. M_COGS_PRODUCT_FORMULA_FIX (Assigned Formulas per Product)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_PRODUCT_FORMULA_FIX', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_PRODUCT_FORMULA_FIX...';
    DELETE FROM dbo.M_COGS_PRODUCT_FORMULA_FIX;
    INSERT INTO dbo.M_COGS_PRODUCT_FORMULA_FIX
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PRODUCT_FORMULA_FIX;
    PRINT 'Done: M_COGS_PRODUCT_FORMULA_FIX copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_PRODUCT_FORMULA_FIX from live...';
    SELECT * INTO dbo.M_COGS_PRODUCT_FORMULA_FIX
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_PRODUCT_FORMULA_FIX;
    PRINT 'Done: M_COGS_PRODUCT_FORMULA_FIX created.';
END
GO

-- --------------------------------------------------------------------------
-- 2j. M_COGS_FORMULA_MANUAL (Recipe Definitions)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_FORMULA_MANUAL', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_FORMULA_MANUAL...';
    DELETE FROM dbo.M_COGS_FORMULA_MANUAL;
    INSERT INTO dbo.M_COGS_FORMULA_MANUAL
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_FORMULA_MANUAL;
    PRINT 'Done: M_COGS_FORMULA_MANUAL copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_FORMULA_MANUAL from live...';
    SELECT * INTO dbo.M_COGS_FORMULA_MANUAL
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_FORMULA_MANUAL;
    PRINT 'Done: M_COGS_FORMULA_MANUAL created.';
END
GO

-- --------------------------------------------------------------------------
-- 2k. M_COGS_Unit_Conversion (Unit Conversion Factors)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.M_COGS_Unit_Conversion', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating M_COGS_Unit_Conversion...';
    DELETE FROM dbo.M_COGS_Unit_Conversion;
    INSERT INTO dbo.M_COGS_Unit_Conversion
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_Unit_Conversion;
    PRINT 'Done: M_COGS_Unit_Conversion copied.';
END
ELSE
BEGIN
    PRINT 'Creating M_COGS_Unit_Conversion from live...';
    SELECT * INTO dbo.M_COGS_Unit_Conversion
    FROM [LIVE_SERVER].lapifactory.dbo.M_COGS_Unit_Conversion;
    PRINT 'Done: M_COGS_Unit_Conversion created.';
END
GO

-- --------------------------------------------------------------------------
-- 2l. m_COGS_Daily_Currency (Daily Exchange Rates)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.m_COGS_Daily_Currency', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating m_COGS_Daily_Currency...';
    DELETE FROM dbo.m_COGS_Daily_Currency;
    INSERT INTO dbo.m_COGS_Daily_Currency
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.m_COGS_Daily_Currency;
    PRINT 'Done: m_COGS_Daily_Currency copied.';
END
ELSE
BEGIN
    PRINT 'Creating m_COGS_Daily_Currency from live...';
    SELECT * INTO dbo.m_COGS_Daily_Currency
    FROM [LIVE_SERVER].lapifactory.dbo.m_COGS_Daily_Currency;
    PRINT 'Done: m_COGS_Daily_Currency created.';
END
GO

-- --------------------------------------------------------------------------
-- 2m. t_COGS_HPP_Actual_Header (Batch-level HPP Header)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.t_COGS_HPP_Actual_Header', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating t_COGS_HPP_Actual_Header...';
    DELETE FROM dbo.t_COGS_HPP_Actual_Header;
    INSERT INTO dbo.t_COGS_HPP_Actual_Header
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Actual_Header;
    PRINT 'Done: t_COGS_HPP_Actual_Header copied.';
END
ELSE
BEGIN
    PRINT 'Creating t_COGS_HPP_Actual_Header from live...';
    SELECT * INTO dbo.t_COGS_HPP_Actual_Header
    FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Actual_Header;
    PRINT 'Done: t_COGS_HPP_Actual_Header created.';
END
GO

-- --------------------------------------------------------------------------
-- 2n. t_COGS_HPP_Actual_Detail (Material Details per Batch)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.t_COGS_HPP_Actual_Detail', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating t_COGS_HPP_Actual_Detail...';
    DELETE FROM dbo.t_COGS_HPP_Actual_Detail;
    INSERT INTO dbo.t_COGS_HPP_Actual_Detail
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Actual_Detail;
    PRINT 'Done: t_COGS_HPP_Actual_Detail copied.';
END
ELSE
BEGIN
    PRINT 'Creating t_COGS_HPP_Actual_Detail from live...';
    SELECT * INTO dbo.t_COGS_HPP_Actual_Detail
    FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Actual_Detail;
    PRINT 'Done: t_COGS_HPP_Actual_Detail created.';
END
GO

-- --------------------------------------------------------------------------
-- 2o. t_COGS_HPP_Product_Header_Simulasi (Simulation Header)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.t_COGS_HPP_Product_Header_Simulasi', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating t_COGS_HPP_Product_Header_Simulasi...';
    DELETE FROM dbo.t_COGS_HPP_Product_Header_Simulasi;
    INSERT INTO dbo.t_COGS_HPP_Product_Header_Simulasi
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Product_Header_Simulasi;
    PRINT 'Done: t_COGS_HPP_Product_Header_Simulasi copied.';
END
ELSE
BEGIN
    PRINT 'Creating t_COGS_HPP_Product_Header_Simulasi from live...';
    SELECT * INTO dbo.t_COGS_HPP_Product_Header_Simulasi
    FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Product_Header_Simulasi;
    PRINT 'Done: t_COGS_HPP_Product_Header_Simulasi created.';
END
GO

-- --------------------------------------------------------------------------
-- 2p. t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan (Simulation Details)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan...';
    DELETE FROM dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan;
    INSERT INTO dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan;
    PRINT 'Done: t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan copied.';
END
ELSE
BEGIN
    PRINT 'Creating t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan from live...';
    SELECT * INTO dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan
    FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan;
    PRINT 'Done: t_COGS_HPP_Product_Header_Simulasi_Detail_Bahan created.';
END
GO

-- --------------------------------------------------------------------------
-- 2q. t_COGS_HPP_Product_Detail_Formula (Product Formula Details)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.t_COGS_HPP_Product_Detail_Formula', 'U') IS NOT NULL
BEGIN
    PRINT 'Truncating t_COGS_HPP_Product_Detail_Formula...';
    DELETE FROM dbo.t_COGS_HPP_Product_Detail_Formula;
    INSERT INTO dbo.t_COGS_HPP_Product_Detail_Formula
        SELECT * FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Product_Detail_Formula;
    PRINT 'Done: t_COGS_HPP_Product_Detail_Formula copied.';
END
ELSE
BEGIN
    PRINT 'Creating t_COGS_HPP_Product_Detail_Formula from live...';
    SELECT * INTO dbo.t_COGS_HPP_Product_Detail_Formula
    FROM [LIVE_SERVER].lapifactory.dbo.t_COGS_HPP_Product_Detail_Formula;
    PRINT 'Done: t_COGS_HPP_Product_Detail_Formula created.';
END
GO

PRINT '=== STEP 2 COMPLETE: All table data copied ==='
GO


-- ============================================================================
-- STEP 3: COPY VIEWS FROM LIVE TO DEV
-- ============================================================================
-- This copies the view definitions from live and recreates them on dev.
-- Run this on DEV server (192.168.1.49), database: lapifactory

USE lapifactory;
GO

-- Helper: Dynamic SQL to copy a view definition from live server
-- We query sys.sql_modules on the live server to get the CREATE VIEW statement

-- --------------------------------------------------------------------------
-- 3a. vw_COGS_Currency_List
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.vw_COGS_Currency_List', 'V') IS NOT NULL
    DROP VIEW dbo.vw_COGS_Currency_List;
GO

DECLARE @viewDef NVARCHAR(MAX);
SELECT @viewDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'vw_COGS_Currency_List' AND so.type = 'V';

IF @viewDef IS NOT NULL
BEGIN
    -- Replace CREATE with CREATE OR ALTER for safety
    SET @viewDef = REPLACE(@viewDef, 'CREATE VIEW', 'CREATE VIEW');
    EXEC sp_executesql @viewDef;
    PRINT 'Done: vw_COGS_Currency_List created.';
END
ELSE
    PRINT 'WARNING: vw_COGS_Currency_List not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 3b. vw_COGS_Product_Group
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.vw_COGS_Product_Group', 'V') IS NOT NULL
    DROP VIEW dbo.vw_COGS_Product_Group;
GO

DECLARE @viewDef NVARCHAR(MAX);
SELECT @viewDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'vw_COGS_Product_Group' AND so.type = 'V';

IF @viewDef IS NOT NULL
BEGIN
    EXEC sp_executesql @viewDef;
    PRINT 'Done: vw_COGS_Product_Group created.';
END
ELSE
    PRINT 'WARNING: vw_COGS_Product_Group not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 3c. vw_COGS_FORMULA_List
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.vw_COGS_FORMULA_List', 'V') IS NOT NULL
    DROP VIEW dbo.vw_COGS_FORMULA_List;
GO

DECLARE @viewDef NVARCHAR(MAX);
SELECT @viewDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'vw_COGS_FORMULA_List' AND so.type = 'V';

IF @viewDef IS NOT NULL
BEGIN
    EXEC sp_executesql @viewDef;
    PRINT 'Done: vw_COGS_FORMULA_List created.';
END
ELSE
    PRINT 'WARNING: vw_COGS_FORMULA_List not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 3d. vw_COGS_FORMULA_List_detail
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.vw_COGS_FORMULA_List_detail', 'V') IS NOT NULL
    DROP VIEW dbo.vw_COGS_FORMULA_List_detail;
GO

DECLARE @viewDef NVARCHAR(MAX);
SELECT @viewDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'vw_COGS_FORMULA_List_detail' AND so.type = 'V';

IF @viewDef IS NOT NULL
BEGIN
    EXEC sp_executesql @viewDef;
    PRINT 'Done: vw_COGS_FORMULA_List_detail created.';
END
ELSE
    PRINT 'WARNING: vw_COGS_FORMULA_List_detail not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 3e. vw_COGS_Pembebanan_TollFee
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.vw_COGS_Pembebanan_TollFee', 'V') IS NOT NULL
    DROP VIEW dbo.vw_COGS_Pembebanan_TollFee;
GO

DECLARE @viewDef NVARCHAR(MAX);
SELECT @viewDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'vw_COGS_Pembebanan_TollFee' AND so.type = 'V';

IF @viewDef IS NOT NULL
BEGIN
    EXEC sp_executesql @viewDef;
    PRINT 'Done: vw_COGS_Pembebanan_TollFee created.';
END
ELSE
    PRINT 'WARNING: vw_COGS_Pembebanan_TollFee not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 3f. vw_COGS_HPP_Actual_Summary
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.vw_COGS_HPP_Actual_Summary', 'V') IS NOT NULL
    DROP VIEW dbo.vw_COGS_HPP_Actual_Summary;
GO

DECLARE @viewDef NVARCHAR(MAX);
SELECT @viewDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'vw_COGS_HPP_Actual_Summary' AND so.type = 'V';

IF @viewDef IS NOT NULL
BEGIN
    EXEC sp_executesql @viewDef;
    PRINT 'Done: vw_COGS_HPP_Actual_Summary created.';
END
ELSE
    PRINT 'WARNING: vw_COGS_HPP_Actual_Summary not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 3g. vw_COGS_HPP_Actual_Detail_Full
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.vw_COGS_HPP_Actual_Detail_Full', 'V') IS NOT NULL
    DROP VIEW dbo.vw_COGS_HPP_Actual_Detail_Full;
GO

DECLARE @viewDef NVARCHAR(MAX);
SELECT @viewDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'vw_COGS_HPP_Actual_Detail_Full' AND so.type = 'V';

IF @viewDef IS NOT NULL
BEGIN
    EXEC sp_executesql @viewDef;
    PRINT 'Done: vw_COGS_HPP_Actual_Detail_Full created.';
END
ELSE
    PRINT 'WARNING: vw_COGS_HPP_Actual_Detail_Full not found on live server.';
GO

PRINT '=== STEP 3 COMPLETE: All views copied ==='
GO


-- ============================================================================
-- STEP 4: COPY STORED PROCEDURES FROM LIVE TO DEV
-- ============================================================================
-- Run this on DEV server (192.168.1.49), database: lapifactory

USE lapifactory;
GO

-- --------------------------------------------------------------------------
-- 4a. sp_COGS_HPP_List
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.sp_COGS_HPP_List', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_COGS_HPP_List;
GO

DECLARE @spDef NVARCHAR(MAX);
SELECT @spDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'sp_COGS_HPP_List' AND so.type = 'P';

IF @spDef IS NOT NULL
BEGIN
    EXEC sp_executesql @spDef;
    PRINT 'Done: sp_COGS_HPP_List created.';
END
ELSE
    PRINT 'WARNING: sp_COGS_HPP_List not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 4b. sp_COGS_GenerateHPP
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.sp_COGS_GenerateHPP', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_COGS_GenerateHPP;
GO

DECLARE @spDef NVARCHAR(MAX);
SELECT @spDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'sp_COGS_GenerateHPP' AND so.type = 'P';

IF @spDef IS NOT NULL
BEGIN
    EXEC sp_executesql @spDef;
    PRINT 'Done: sp_COGS_GenerateHPP created.';
END
ELSE
    PRINT 'WARNING: sp_COGS_GenerateHPP not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 4c. sp_COGS_Calculate_HPP_Actual
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.sp_COGS_Calculate_HPP_Actual', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_COGS_Calculate_HPP_Actual;
GO

DECLARE @spDef NVARCHAR(MAX);
SELECT @spDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'sp_COGS_Calculate_HPP_Actual' AND so.type = 'P';

IF @spDef IS NOT NULL
BEGIN
    EXEC sp_executesql @spDef;
    PRINT 'Done: sp_COGS_Calculate_HPP_Actual created.';
END
ELSE
    PRINT 'WARNING: sp_COGS_Calculate_HPP_Actual not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 4d. sp_COGS_Calculate_HPP_Actual_TEST
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.sp_COGS_Calculate_HPP_Actual_TEST', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_COGS_Calculate_HPP_Actual_TEST;
GO

DECLARE @spDef NVARCHAR(MAX);
SELECT @spDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'sp_COGS_Calculate_HPP_Actual_TEST' AND so.type = 'P';

IF @spDef IS NOT NULL
BEGIN
    EXEC sp_executesql @spDef;
    PRINT 'Done: sp_COGS_Calculate_HPP_Actual_TEST created.';
END
ELSE
    PRINT 'WARNING: sp_COGS_Calculate_HPP_Actual_TEST not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 4e. sp_COGS_generate_all_formula_detail
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.sp_COGS_generate_all_formula_detail', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_COGS_generate_all_formula_detail;
GO

DECLARE @spDef NVARCHAR(MAX);
SELECT @spDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'sp_COGS_generate_all_formula_detail' AND so.type = 'P';

IF @spDef IS NOT NULL
BEGIN
    EXEC sp_executesql @spDef;
    PRINT 'Done: sp_COGS_generate_all_formula_detail created.';
END
ELSE
    PRINT 'WARNING: sp_COGS_generate_all_formula_detail not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 4f. sp_generate_simulasi_cogs_product_existing
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.sp_generate_simulasi_cogs_product_existing', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_generate_simulasi_cogs_product_existing;
GO

DECLARE @spDef NVARCHAR(MAX);
SELECT @spDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'sp_generate_simulasi_cogs_product_existing' AND so.type = 'P';

IF @spDef IS NOT NULL
BEGIN
    EXEC sp_executesql @spDef;
    PRINT 'Done: sp_generate_simulasi_cogs_product_existing created.';
END
ELSE
    PRINT 'WARNING: sp_generate_simulasi_cogs_product_existing not found on live server.';
GO

-- --------------------------------------------------------------------------
-- 4g. sp_COGS_GeneratePembebananSisaBahanExp
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.sp_COGS_GeneratePembebananSisaBahanExp', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_COGS_GeneratePembebananSisaBahanExp;
GO

DECLARE @spDef NVARCHAR(MAX);
SELECT @spDef = definition
FROM [LIVE_SERVER].lapifactory.sys.sql_modules sm
JOIN [LIVE_SERVER].lapifactory.sys.objects so ON sm.object_id = so.object_id
WHERE so.name = 'sp_COGS_GeneratePembebananSisaBahanExp' AND so.type = 'P';

IF @spDef IS NOT NULL
BEGIN
    EXEC sp_executesql @spDef;
    PRINT 'Done: sp_COGS_GeneratePembebananSisaBahanExp created.';
END
ELSE
    PRINT 'WARNING: sp_COGS_GeneratePembebananSisaBahanExp not found on live server.';
GO

PRINT '=== STEP 4 COMPLETE: All stored procedures copied ==='
GO


-- ============================================================================
-- STEP 5: VERIFICATION & CLEANUP
-- ============================================================================
-- Run this on DEV server to verify all objects exist

USE lapifactory;
GO

-- 5a. Verify tables
PRINT '--- TABLES ---';
SELECT 'TABLE' AS ObjectType, name, 
       (SELECT SUM(rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)) AS RowCount
FROM sys.tables t
WHERE name LIKE '%COGS%'
ORDER BY name;
GO

-- 5b. Verify views
PRINT '--- VIEWS ---';
SELECT 'VIEW' AS ObjectType, name 
FROM sys.views
WHERE name LIKE '%COGS%'
ORDER BY name;
GO

-- 5c. Verify stored procedures
PRINT '--- STORED PROCEDURES ---';
SELECT 'PROCEDURE' AS ObjectType, name
FROM sys.procedures
WHERE name LIKE '%COGS%' OR name LIKE 'sp_generate_simulasi%'
ORDER BY name;
GO

-- 5d. (OPTIONAL) Remove linked server when done
-- Uncomment the lines below to remove the linked server after migration
/*
EXEC sp_dropserver @server = 'LIVE_SERVER', @droplogins = 'droplogins';
PRINT 'Linked server LIVE_SERVER removed.';
*/
GO

PRINT '=== STEP 5 COMPLETE: Verification done ==='
PRINT '=== MIGRATION COMPLETE ==='
GO
