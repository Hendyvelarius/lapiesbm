-- =====================================================================
-- Migration: Add Granulate Costing Columns to HPP Actual Tables
-- Purpose: Support granulate material cost tracking in v7
-- =====================================================================

-- Add columns to Header table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 't_COGS_HPP_Actual_Header' 
               AND COLUMN_NAME = 'Total_Cost_Granulate')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Header
    ADD Total_Cost_Granulate DECIMAL(18,2) DEFAULT 0;
    PRINT 'Added Total_Cost_Granulate to t_COGS_HPP_Actual_Header';
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 't_COGS_HPP_Actual_Header' 
               AND COLUMN_NAME = 'Granulate_Count')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Header
    ADD Granulate_Count INT DEFAULT 0;
    PRINT 'Added Granulate_Count to t_COGS_HPP_Actual_Header';
END

-- Add columns to Detail table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
               AND COLUMN_NAME = 'Is_Granulate')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail
    ADD Is_Granulate BIT DEFAULT 0;
    PRINT 'Added Is_Granulate to t_COGS_HPP_Actual_Detail';
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
               AND COLUMN_NAME = 'Granulate_Batch')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail
    ADD Granulate_Batch VARCHAR(50) NULL;
    PRINT 'Added Granulate_Batch to t_COGS_HPP_Actual_Detail';
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
               AND COLUMN_NAME = 'Granulate_MR_No')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail
    ADD Granulate_MR_No VARCHAR(100) NULL;
    PRINT 'Added Granulate_MR_No to t_COGS_HPP_Actual_Detail';
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
               AND COLUMN_NAME = 'Granulate_Raw_Material_Cost')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail
    ADD Granulate_Raw_Material_Cost DECIMAL(18,4) NULL;
    PRINT 'Added Granulate_Raw_Material_Cost to t_COGS_HPP_Actual_Detail';
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
               AND COLUMN_NAME = 'Granulate_Output_Qty')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail
    ADD Granulate_Output_Qty DECIMAL(18,4) NULL;
    PRINT 'Added Granulate_Output_Qty to t_COGS_HPP_Actual_Detail';
END

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
               AND COLUMN_NAME = 'Granulate_Cost_Per_Gram')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail
    ADD Granulate_Cost_Per_Gram DECIMAL(18,6) NULL;
    PRINT 'Added Granulate_Cost_Per_Gram to t_COGS_HPP_Actual_Detail';
END

PRINT '';
PRINT 'Granulate costing columns migration completed';
GO
