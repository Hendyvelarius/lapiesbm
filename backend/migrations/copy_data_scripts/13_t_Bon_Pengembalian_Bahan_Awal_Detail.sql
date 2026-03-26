-- ============================================================
-- Script 13: Copy t_Bon_Pengembalian_Bahan_Awal_Detail from LIVE to DEV
-- Source: LIVE_SERVER (192.168.1.21)
-- Target: DEV (this server, 192.168.1.49)
-- Expected rows: ~177,000+
-- 
-- ** PRIORITY: This table currently has 0 rows on DEV **
-- ** due to previous failed copy (FK error without transaction) **
-- ** Run script 14 (Header) BEFORE this one! **
-- ============================================================

-- PART 1: Disable ALL FK constraints (incoming + outgoing)
DECLARE @sql_in NVARCHAR(MAX) = N'';
SELECT @sql_in = @sql_in + 
    'ALTER TABLE [' + OBJECT_SCHEMA_NAME(fk.parent_object_id) + '].[' + OBJECT_NAME(fk.parent_object_id) + '] NOCHECK CONSTRAINT [' + fk.name + '];' + CHAR(13)
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID('t_Bon_Pengembalian_Bahan_Awal_Detail');
IF @sql_in <> '' EXEC sp_executesql @sql_in;
PRINT 'Incoming FK constraints disabled.';

DECLARE @sql_out NVARCHAR(MAX) = N'';
SELECT @sql_out = @sql_out + 
    'ALTER TABLE [' + OBJECT_SCHEMA_NAME(fk.parent_object_id) + '].[' + OBJECT_NAME(fk.parent_object_id) + '] NOCHECK CONSTRAINT [' + fk.name + '];' + CHAR(13)
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID('t_Bon_Pengembalian_Bahan_Awal_Detail');
IF @sql_out <> '' EXEC sp_executesql @sql_out;
PRINT 'Outgoing FK constraints disabled.';

-- PART 2: DELETE + INSERT in a transaction (safe: rollback on failure)
BEGIN TRANSACTION;
BEGIN TRY
    DELETE FROM [dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail];
    PRINT 'DELETE completed. Inserting from LIVE...';

    INSERT INTO [dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail]
    SELECT * FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail];

    COMMIT TRANSACTION;
    PRINT 'INSERT committed successfully.';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT 'ERROR - Transaction rolled back. No data was lost.';
    PRINT ERROR_MESSAGE();
END CATCH;

-- PART 3: Re-enable ALL FK constraints (incoming + outgoing)
DECLARE @sql_in2 NVARCHAR(MAX) = N'';
SELECT @sql_in2 = @sql_in2 + 
    'ALTER TABLE [' + OBJECT_SCHEMA_NAME(fk.parent_object_id) + '].[' + OBJECT_NAME(fk.parent_object_id) + '] CHECK CONSTRAINT [' + fk.name + '];' + CHAR(13)
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID('t_Bon_Pengembalian_Bahan_Awal_Detail');
IF @sql_in2 <> '' EXEC sp_executesql @sql_in2;
PRINT 'Incoming FK constraints re-enabled.';

DECLARE @sql_out2 NVARCHAR(MAX) = N'';
SELECT @sql_out2 = @sql_out2 + 
    'ALTER TABLE [' + OBJECT_SCHEMA_NAME(fk.parent_object_id) + '].[' + OBJECT_NAME(fk.parent_object_id) + '] CHECK CONSTRAINT [' + fk.name + '];' + CHAR(13)
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID('t_Bon_Pengembalian_Bahan_Awal_Detail');
IF @sql_out2 <> '' EXEC sp_executesql @sql_out2;
PRINT 'Outgoing FK constraints re-enabled.';

-- PART 4: Verify
SELECT 'DEV' AS [Server], COUNT(*) AS [RowCount] FROM [dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail]
UNION ALL
SELECT 'LIVE', COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail];
