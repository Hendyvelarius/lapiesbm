-- ============================================================================
-- STEP 0: SETUP — Create Linked Server from DEV to LIVE
-- ============================================================================
-- RUN THIS ON: DEV server (192.168.1.49) via DBeaver
-- RUN ONCE:    Only need to run this once, then run the table scripts
--
-- INSTRUCTIONS FOR DBEAVER:
--   Select PART A first, run it (Ctrl+Enter or Alt+X).
--   Wait for it to finish.
--   Then select PART B, run it.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PART A: Run this FIRST (select all lines below until PART B)           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Drop if exists
IF EXISTS (SELECT 1 FROM sys.servers WHERE name = 'LIVE_SERVER')
BEGIN
    EXEC sp_dropserver @server = 'LIVE_SERVER', @droplogins = 'droplogins';
END;

-- Create linked server pointing to LIVE (192.168.1.21)
-- NOTE: If this fails with a provider error, change SQLNCLI to SQLOLEDB
EXEC sp_addlinkedserver 
    @server     = 'LIVE_SERVER',
    @srvproduct = '',
    @provider   = 'SQLNCLI',
    @datasrc    = '192.168.1.21,1433';

-- Set login mapping
EXEC sp_addlinkedsrvlogin 
    @rmtsrvname  = 'LIVE_SERVER',
    @useself     = 'FALSE',
    @locallogin  = NULL,
    @rmtuser     = 'sa',
    @rmtpassword = 'ygi_dny_jny_0902_apl';

-- Configure for better performance
EXEC sp_serveroption @server = 'LIVE_SERVER', @optname = 'rpc',              @optvalue = 'true';
EXEC sp_serveroption @server = 'LIVE_SERVER', @optname = 'rpc out',          @optvalue = 'true';
EXEC sp_serveroption @server = 'LIVE_SERVER', @optname = 'lazy schema validation', @optvalue = 'true';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PART B: Run this AFTER Part A succeeds (select from here to the end)   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Test the connection
SELECT COUNT(*) AS live_m_Product_rows
FROM [LIVE_SERVER].[lapifactory].[dbo].[m_Product] WITH (NOLOCK);
