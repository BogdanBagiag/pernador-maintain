-- ============================================
-- QR CODE FEATURE - PUBLIC POLICIES
-- ============================================
-- Run this to allow public reporting via QR codes

-- Allow anyone (including unauthenticated users) to create work orders
-- This is needed for the public report form accessed via QR codes
DROP POLICY IF EXISTS "Anyone can create work orders for reporting" ON work_orders;
CREATE POLICY "Anyone can create work orders for reporting" ON work_orders
  FOR INSERT 
  WITH CHECK (true);

-- Verify that equipment can be read publicly (should already exist)
-- This allows the report page to display equipment details
DROP POLICY IF EXISTS "Everyone can view equipment" ON equipment;
CREATE POLICY "Everyone can view equipment" ON equipment
  FOR SELECT USING (true);

-- Allow public access to location info (for displaying on report page)
DROP POLICY IF EXISTS "Everyone can view locations" ON locations;
CREATE POLICY "Everyone can view locations" ON locations
  FOR SELECT USING (true);

-- ============================================
-- SECURITY NOTES
-- ============================================
-- These policies allow:
-- 1. Anyone to VIEW equipment and location details
-- 2. Anyone to CREATE work orders (for issue reporting)
--
-- These policies DO NOT allow:
-- - Editing equipment
-- - Deleting work orders
-- - Viewing other users' data
-- - Accessing admin features
--
-- The report form only collects:
-- - Issue title and description
-- - Priority level
-- - Reporter name and email (stored in description)
--
-- All other operations still require authentication!
-- ============================================

-- Optional: Add a trigger to notify admins when public work orders are created
-- (Implement this in your application logic or with database triggers)
