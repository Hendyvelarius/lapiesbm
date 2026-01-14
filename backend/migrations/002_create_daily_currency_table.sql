-- Migration: Create m_COGS_Daily_Currency table
-- Description: Stores daily exchange rates for various currencies against IDR (Indonesian Rupiah)
-- Data source: Frankfurter API (https://api.frankfurter.app)
-- Date: 2026-01-14

-- Create the daily currency table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='m_COGS_Daily_Currency' AND xtype='U')
BEGIN
    CREATE TABLE m_COGS_Daily_Currency (
        [date] DATE NOT NULL PRIMARY KEY,
        [USD] FLOAT NULL,          -- US Dollar
        [EUR] FLOAT NULL,          -- Euro
        [CHF] FLOAT NULL,          -- Swiss Franc
        [SGD] FLOAT NULL,          -- Singapore Dollar
        [JPY] FLOAT NULL,          -- Japanese Yen
        [MYR] FLOAT NULL,          -- Malaysian Ringgit
        [GBP] FLOAT NULL,          -- British Pound
        [RMB] FLOAT NULL,          -- Chinese Yuan (CNY in Frankfurter API)
        [AUD] FLOAT NULL,          -- Australian Dollar
        [created_at] DATETIME DEFAULT GETDATE(),
        [updated_at] DATETIME DEFAULT GETDATE()
    );

    PRINT 'Table m_COGS_Daily_Currency created successfully.';
END
ELSE
BEGIN
    PRINT 'Table m_COGS_Daily_Currency already exists.';
END
GO

-- Create index on date for faster lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_m_COGS_Daily_Currency_date' AND object_id = OBJECT_ID('m_COGS_Daily_Currency'))
BEGIN
    CREATE INDEX IX_m_COGS_Daily_Currency_date ON m_COGS_Daily_Currency([date]);
    PRINT 'Index IX_m_COGS_Daily_Currency_date created successfully.';
END
GO
