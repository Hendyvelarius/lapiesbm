-- =============================================
-- Migration: 003_create_hpp_actual_tables.sql
-- Description: Create HPP Actual (True Cost) tables for batch-level cost tracking
-- Created: 2026-01-19
-- =============================================

-- =============================================
-- TABLE 1: t_COGS_HPP_Actual_Header
-- Purpose: Store batch-level cost summary with clear breakdown
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 't_COGS_HPP_Actual_Header')
BEGIN
    CREATE TABLE t_COGS_HPP_Actual_Header (
        -- Primary Key
        HPP_Actual_ID           INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Batch Identification
        DNc_ProductID           NVARCHAR(50) NOT NULL,      -- Links to t_dnc_product
        Product_ID              NVARCHAR(50) NOT NULL,      -- Product code (e.g., '01', 'S8')
        Product_Name            NVARCHAR(200) NULL,         -- Product description
        BatchNo                 NVARCHAR(50) NOT NULL,      -- Batch number
        BatchDate               DATE NULL,                  -- Batch production date
        TempelLabel_Date        DATE NULL,                  -- Label affixed date (release date)
        Periode                 NVARCHAR(6) NULL,           -- Period YYYYMM
        
        -- Product Classification
        LOB                     NVARCHAR(50) NULL,          -- Line of Business (ETHICAL/GENERIK)
        Group_PNCategory        NVARCHAR(50) NULL,          -- Product category group
        Group_PNCategory_Name   NVARCHAR(250) NULL,         -- Category description
        Group_PNCategory_Dept   NVARCHAR(10) NULL,          -- Department (PN1/PN2)
        
        -- Output & Yield
        Batch_Size_Std          DECIMAL(18,4) NULL,         -- Standard batch size
        Output_Actual           DECIMAL(18,4) NOT NULL,     -- Actual output (from DNC_Diluluskan)
        Rendemen_Std            DECIMAL(10,4) NULL,         -- Standard yield %
        Rendemen_Actual         DECIMAL(10,4) NULL,         -- Actual yield %
        
        -- Material Costs (BB = Bahan Baku, BK = Bahan Kemas)
        Total_Cost_BB           DECIMAL(18,2) NULL DEFAULT 0,   -- Total raw material cost
        Total_Cost_BK           DECIMAL(18,2) NULL DEFAULT 0,   -- Total packaging material cost
        Total_Cost_Material     AS (ISNULL(Total_Cost_BB, 0) + ISNULL(Total_Cost_BK, 0)) PERSISTED,
        
        -- Manhour - Processing (Proses)
        MH_Proses_Std           DECIMAL(18,4) NULL,         -- Standard processing manhours
        MH_Proses_Actual        DECIMAL(18,4) NULL,         -- Actual processing manhours
        Rate_MH_Proses          DECIMAL(18,2) NULL,         -- Cost per manhour (Direct Labor)
        Cost_MH_Proses          AS (ISNULL(MH_Proses_Actual, 0) * ISNULL(Rate_MH_Proses, 0)) PERSISTED,
        
        -- Manhour - Packaging (Kemas)
        MH_Kemas_Std            DECIMAL(18,4) NULL,         -- Standard packaging manhours
        MH_Kemas_Actual         DECIMAL(18,4) NULL,         -- Actual packaging manhours
        Rate_MH_Kemas           DECIMAL(18,2) NULL,         -- Cost per manhour (Direct Labor)
        Cost_MH_Kemas           AS (ISNULL(MH_Kemas_Actual, 0) * ISNULL(Rate_MH_Kemas, 0)) PERSISTED,
        
        -- Manhour - Weighing (Timbang)
        MH_Timbang_BB           DECIMAL(18,4) NULL,         -- Manhours for weighing raw materials
        MH_Timbang_BK           DECIMAL(18,4) NULL,         -- Manhours for weighing packaging
        Rate_MH_Timbang         DECIMAL(18,2) NULL,         -- Cost per manhour for weighing
        
        -- Overhead Costs
        Direct_Labor            DECIMAL(18,2) NULL,         -- Direct labor overhead
        Factory_Overhead        DECIMAL(18,2) NULL,         -- Factory overhead
        Depresiasi              DECIMAL(18,2) NULL,         -- Depreciation
        
        -- Analysis & QC Costs
        MH_Analisa_Std          DECIMAL(18,4) NULL,         -- Standard analysis manhours
        Biaya_Analisa           DECIMAL(18,2) NULL,         -- Analysis cost
        Biaya_Reagen            DECIMAL(18,2) NULL,         -- Reagent cost
        
        -- Machine/Utility Costs
        MH_Mesin_Std            DECIMAL(18,4) NULL,         -- Standard machine hours
        Rate_PLN                DECIMAL(18,2) NULL,         -- Electricity rate (kWh)
        Cost_Utility            DECIMAL(18,2) NULL,         -- Utility cost
        
        -- Other Costs
        Toll_Fee                DECIMAL(18,2) NULL DEFAULT 0,   -- Toll manufacturing fee
        Beban_Sisa_Bahan_Exp    DECIMAL(18,2) NULL DEFAULT 0,   -- Expired material burden
        Biaya_Lain              DECIMAL(18,2) NULL DEFAULT 0,   -- Other costs
        
        -- Total Calculations (computed columns)
        Total_Overhead          AS (
            ISNULL(Direct_Labor, 0) + 
            ISNULL(Factory_Overhead, 0) + 
            ISNULL(Depresiasi, 0) +
            ISNULL(Biaya_Analisa, 0) +
            ISNULL(Biaya_Reagen, 0) +
            ISNULL(Cost_Utility, 0)
        ) PERSISTED,
        
        Total_Cost_Batch        AS (
            ISNULL(Total_Cost_BB, 0) + 
            ISNULL(Total_Cost_BK, 0) + 
            (ISNULL(MH_Proses_Actual, 0) * ISNULL(Rate_MH_Proses, 0)) +
            (ISNULL(MH_Kemas_Actual, 0) * ISNULL(Rate_MH_Kemas, 0)) +
            ISNULL(Direct_Labor, 0) + 
            ISNULL(Factory_Overhead, 0) + 
            ISNULL(Depresiasi, 0) +
            ISNULL(Biaya_Analisa, 0) +
            ISNULL(Biaya_Reagen, 0) +
            ISNULL(Cost_Utility, 0) +
            ISNULL(Toll_Fee, 0) +
            ISNULL(Beban_Sisa_Bahan_Exp, 0) +
            ISNULL(Biaya_Lain, 0)
        ) PERSISTED,
        
        -- Processing Status
        Calculation_Status      NVARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PROCESSING, COMPLETED, ERROR
        Calculation_Date        DATETIME NULL,              -- When calculation was performed
        Error_Message           NVARCHAR(500) NULL,         -- Error details if failed
        
        -- Price Source Statistics
        Count_Materials_PO      INT DEFAULT 0,              -- Materials with direct PO price
        Count_Materials_MR      INT DEFAULT 0,              -- Materials traced via MR/RTR
        Count_Materials_BPHP    INT DEFAULT 0,              -- Materials from granule calculation
        Count_Materials_STD     INT DEFAULT 0,              -- Materials using standard price (fallback)
        Count_Materials_PM      INT DEFAULT 0,              -- Toll materials (cost = 0)
        
        -- Audit Fields
        Created_Date            DATETIME DEFAULT GETDATE(),
        Created_By              NVARCHAR(50) NULL,
        Modified_Date           DATETIME NULL,
        Modified_By             NVARCHAR(50) NULL,
        
        -- Unique constraint: one record per batch
        CONSTRAINT UQ_HPP_Actual_Batch UNIQUE (DNc_ProductID)
    );
    
    -- Create indexes for common queries
    CREATE INDEX IX_HPP_Actual_Product ON t_COGS_HPP_Actual_Header (Product_ID);
    CREATE INDEX IX_HPP_Actual_Periode ON t_COGS_HPP_Actual_Header (Periode);
    CREATE INDEX IX_HPP_Actual_BatchNo ON t_COGS_HPP_Actual_Header (BatchNo);
    CREATE INDEX IX_HPP_Actual_TempelLabel ON t_COGS_HPP_Actual_Header (TempelLabel_Date);
    CREATE INDEX IX_HPP_Actual_Status ON t_COGS_HPP_Actual_Header (Calculation_Status);
    
    PRINT 'Table t_COGS_HPP_Actual_Header created successfully';
END
ELSE
BEGIN
    PRINT 'Table t_COGS_HPP_Actual_Header already exists';
END
GO

-- =============================================
-- TABLE 2: t_COGS_HPP_Actual_Detail
-- Purpose: Store material-level cost breakdown per batch
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 't_COGS_HPP_Actual_Detail')
BEGIN
    CREATE TABLE t_COGS_HPP_Actual_Detail (
        -- Primary Key
        HPP_Detail_ID           INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Foreign Key to Header
        HPP_Actual_ID           INT NOT NULL,               -- Links to t_COGS_HPP_Actual_Header
        DNc_ProductID           NVARCHAR(50) NOT NULL,      -- Denormalized for performance
        
        -- Material Identification
        Item_ID                 NVARCHAR(20) NOT NULL,      -- Material code (e.g., 'BB 001', 'BK 005')
        Item_Name               NVARCHAR(200) NULL,         -- Material description
        Item_Type               NVARCHAR(10) NOT NULL,      -- 'BB' or 'BK'
        Item_Unit               NVARCHAR(20) NULL,          -- Unit of measure
        
        -- Quantity Used
        Qty_Required            DECIMAL(18,6) NULL,         -- Formula quantity (standard)
        Qty_Used                DECIMAL(18,6) NOT NULL,     -- Actual quantity used (from Bon Keluar)
        
        -- Pricing Information
        Unit_Price              DECIMAL(18,4) NOT NULL,     -- Price per unit
        Currency_Original       NVARCHAR(10) NULL,          -- Original currency (USD/EUR/IDR)
        Exchange_Rate           DECIMAL(18,6) NULL,         -- Exchange rate used
        Unit_Price_IDR          DECIMAL(18,4) NULL,         -- Price converted to IDR
        
        -- Total Cost
        Total_Cost              AS (ISNULL(Qty_Used, 0) * ISNULL(Unit_Price_IDR, ISNULL(Unit_Price, 0))) PERSISTED,
        
        -- Price Source & Traceability
        Price_Source            NVARCHAR(20) NOT NULL,      -- 'PO', 'MR', 'RTR', 'BPHP', 'STD', 'PM'
        Price_Source_Level      INT DEFAULT 1,              -- Trace depth (1=direct, >1=recursive)
        
        -- Document Links for Backtracking
        MR_No                   NVARCHAR(50) NULL,          -- Material Request number (Bon Keluar)
        MR_SeqID                INT NULL,                   -- MR sequence
        DNc_No                  NVARCHAR(50) NULL,          -- DNc number for material
        DNc_Original            NVARCHAR(50) NULL,          -- Original DNc (for MR/RTR trace)
        TTBA_No                 NVARCHAR(50) NULL,          -- TTBA document number
        TTBA_SeqID              INT NULL,                   -- TTBA sequence
        PO_No                   NVARCHAR(50) NULL,          -- Purchase Order number
        PO_SeqID                INT NULL,                   -- PO sequence
        
        -- For BPHP (Granule) Materials
        BPHP_BatchNo            NVARCHAR(50) NULL,          -- Granule batch number
        BPHP_Total_Cost         DECIMAL(18,2) NULL,         -- Total cost of granule batch
        BPHP_Output             DECIMAL(18,4) NULL,         -- Granule batch output
        BPHP_Unit_Cost          DECIMAL(18,4) NULL,         -- Calculated unit cost of granule
        
        -- Notes & Audit
        Calculation_Notes       NVARCHAR(500) NULL,         -- Any notes about price calculation
        Created_Date            DATETIME DEFAULT GETDATE(),
        
        -- Foreign key constraint
        CONSTRAINT FK_HPP_Detail_Header FOREIGN KEY (HPP_Actual_ID) 
            REFERENCES t_COGS_HPP_Actual_Header (HPP_Actual_ID) ON DELETE CASCADE
    );
    
    -- Create indexes for common queries
    CREATE INDEX IX_HPP_Detail_Header ON t_COGS_HPP_Actual_Detail (HPP_Actual_ID);
    CREATE INDEX IX_HPP_Detail_DNcProduct ON t_COGS_HPP_Actual_Detail (DNc_ProductID);
    CREATE INDEX IX_HPP_Detail_ItemID ON t_COGS_HPP_Actual_Detail (Item_ID);
    CREATE INDEX IX_HPP_Detail_ItemType ON t_COGS_HPP_Actual_Detail (Item_Type);
    CREATE INDEX IX_HPP_Detail_PriceSource ON t_COGS_HPP_Actual_Detail (Price_Source);
    CREATE INDEX IX_HPP_Detail_PONo ON t_COGS_HPP_Actual_Detail (PO_No);
    
    PRINT 'Table t_COGS_HPP_Actual_Detail created successfully';
END
ELSE
BEGIN
    PRINT 'Table t_COGS_HPP_Actual_Detail already exists';
END
GO

-- =============================================
-- VIEW: vw_COGS_HPP_Actual_Summary
-- Purpose: Easy access to batch cost summary with per-unit calculations
-- =============================================
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_COGS_HPP_Actual_Summary')
    DROP VIEW vw_COGS_HPP_Actual_Summary;
GO

CREATE VIEW vw_COGS_HPP_Actual_Summary AS
SELECT 
    h.HPP_Actual_ID,
    h.DNc_ProductID,
    h.Product_ID,
    h.Product_Name,
    h.BatchNo,
    h.TempelLabel_Date,
    h.Periode,
    h.LOB,
    h.Group_PNCategory_Dept,
    
    -- Output
    h.Output_Actual,
    h.Rendemen_Actual,
    
    -- Material Costs
    h.Total_Cost_BB,
    h.Total_Cost_BK,
    h.Total_Cost_Material,
    
    -- Per Unit Material Costs
    CASE WHEN h.Output_Actual > 0 THEN h.Total_Cost_BB / h.Output_Actual ELSE 0 END AS Cost_BB_PerUnit,
    CASE WHEN h.Output_Actual > 0 THEN h.Total_Cost_BK / h.Output_Actual ELSE 0 END AS Cost_BK_PerUnit,
    
    -- Manhour Costs
    h.MH_Proses_Actual,
    h.MH_Kemas_Actual,
    h.Cost_MH_Proses,
    h.Cost_MH_Kemas,
    
    -- Overhead
    h.Total_Overhead,
    h.Toll_Fee,
    
    -- Total Batch Cost
    h.Total_Cost_Batch,
    
    -- HPP Per Unit (Total / Output)
    CASE WHEN h.Output_Actual > 0 THEN h.Total_Cost_Batch / h.Output_Actual ELSE 0 END AS HPP_Per_Unit,
    
    -- Price Source Statistics
    h.Count_Materials_PO,
    h.Count_Materials_MR,
    h.Count_Materials_BPHP,
    h.Count_Materials_STD,
    h.Count_Materials_PM,
    (h.Count_Materials_PO + h.Count_Materials_MR + h.Count_Materials_BPHP + h.Count_Materials_STD + h.Count_Materials_PM) AS Total_Materials,
    
    -- Status
    h.Calculation_Status,
    h.Calculation_Date
FROM t_COGS_HPP_Actual_Header h;
GO

PRINT 'View vw_COGS_HPP_Actual_Summary created successfully';
GO

-- =============================================
-- VIEW: vw_COGS_HPP_Actual_Detail_Full
-- Purpose: Detail view with full item and document information
-- =============================================
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_COGS_HPP_Actual_Detail_Full')
    DROP VIEW vw_COGS_HPP_Actual_Detail_Full;
GO

CREATE VIEW vw_COGS_HPP_Actual_Detail_Full AS
SELECT 
    d.HPP_Detail_ID,
    d.HPP_Actual_ID,
    d.DNc_ProductID,
    
    -- From Header
    h.Product_ID,
    h.Product_Name AS Product_Name,
    h.BatchNo,
    h.TempelLabel_Date,
    h.Periode,
    
    -- Material Info
    d.Item_ID,
    d.Item_Name,
    d.Item_Type,
    d.Item_Unit,
    
    -- Quantity
    d.Qty_Required,
    d.Qty_Used,
    
    -- Pricing
    d.Unit_Price,
    d.Currency_Original,
    d.Exchange_Rate,
    d.Unit_Price_IDR,
    d.Total_Cost,
    
    -- Price Source
    d.Price_Source,
    d.Price_Source_Level,
    
    -- Backlink Documents
    d.MR_No,
    d.DNc_No,
    d.DNc_Original,
    d.TTBA_No,
    d.PO_No,
    
    -- BPHP Info
    d.BPHP_BatchNo,
    d.BPHP_Total_Cost,
    d.BPHP_Output,
    d.BPHP_Unit_Cost,
    
    d.Calculation_Notes,
    d.Created_Date
FROM t_COGS_HPP_Actual_Detail d
JOIN t_COGS_HPP_Actual_Header h ON d.HPP_Actual_ID = h.HPP_Actual_ID;
GO

PRINT 'View vw_COGS_HPP_Actual_Detail_Full created successfully';
GO

-- =============================================
-- Summary of Created Objects
-- =============================================
PRINT '';
PRINT '=== HPP Actual Tables Created Successfully ===';
PRINT 'Tables:';
PRINT '  - t_COGS_HPP_Actual_Header (Batch cost summary)';
PRINT '  - t_COGS_HPP_Actual_Detail (Material breakdown)';
PRINT '';
PRINT 'Views:';
PRINT '  - vw_COGS_HPP_Actual_Summary (Per-unit cost calculations)';
PRINT '  - vw_COGS_HPP_Actual_Detail_Full (Full detail with backlinks)';
PRINT '';
PRINT 'Header Key Fields:';
PRINT '  - Total_Cost_BB/BK: Material costs by type';
PRINT '  - MH_Proses/Kemas_Actual: Actual manhours';
PRINT '  - Rate_MH_Proses/Kemas: Cost per manhour';
PRINT '  - Direct_Labor, Factory_Overhead, Depresiasi: Overhead costs';
PRINT '  - Total_Cost_Batch: Computed total batch cost';
PRINT '';
PRINT 'Detail Key Fields:';
PRINT '  - Price_Source: PO/MR/RTR/BPHP/STD/PM';
PRINT '  - Price_Source_Level: Trace depth for recursive lookup';
PRINT '  - PO_No, TTBA_No, DNc_No: Document backlinks';
GO
