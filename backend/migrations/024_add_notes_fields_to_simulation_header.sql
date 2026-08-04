-- =====================================================================
-- Migration 024: Add Kemasan / Komposisi / Forecast to simulation header
-- Purpose: Free-text note fields the user fills in on a simulation.
--          These are informational only - no calculation, stored procedure
--          or HPP result depends on them.
-- =====================================================================

-- Fail fast rather than queue behind a long-running reader: adding a nullable
-- column is metadata-only, but it still needs a brief schema-modify lock.
SET LOCK_TIMEOUT 10000;

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 't_COGS_HPP_Product_Header_Simulasi' AND COLUMN_NAME = 'Kemasan'
)
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi
    ADD Kemasan VARCHAR(255) NULL;
    PRINT 'Added Kemasan to t_COGS_HPP_Product_Header_Simulasi';
END
ELSE
    PRINT 'Kemasan already exists on t_COGS_HPP_Product_Header_Simulasi';
GO

-- Fail fast rather than queue behind a long-running reader: adding a nullable
-- column is metadata-only, but it still needs a brief schema-modify lock.
SET LOCK_TIMEOUT 10000;

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 't_COGS_HPP_Product_Header_Simulasi' AND COLUMN_NAME = 'Komposisi'
)
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi
    ADD Komposisi VARCHAR(2000) NULL;
    PRINT 'Added Komposisi to t_COGS_HPP_Product_Header_Simulasi';
END
ELSE
    PRINT 'Komposisi already exists on t_COGS_HPP_Product_Header_Simulasi';
GO

-- Fail fast rather than queue behind a long-running reader: adding a nullable
-- column is metadata-only, but it still needs a brief schema-modify lock.
SET LOCK_TIMEOUT 10000;

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 't_COGS_HPP_Product_Header_Simulasi' AND COLUMN_NAME = 'Forecast'
)
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi
    ADD Forecast VARCHAR(255) NULL;
    PRINT 'Added Forecast to t_COGS_HPP_Product_Header_Simulasi';
END
ELSE
    PRINT 'Forecast already exists on t_COGS_HPP_Product_Header_Simulasi';
GO

PRINT 'Migration 024 completed: Kemasan / Komposisi / Forecast note columns added';
GO
