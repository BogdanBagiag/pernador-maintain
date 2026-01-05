-- Fix Trigger: Add Anon Key în Headers

DROP TRIGGER IF EXISTS trigger_notify_wo_assigned ON work_orders;
DROP FUNCTION IF EXISTS notify_wo_assigned();

CREATE OR REPLACE FUNCTION notify_wo_assigned()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  anon_key TEXT;
  payload JSON;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND 
     (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    
    function_url := 'https://fjwtshswivothknotlzs.supabase.co/functions/v1/send-email';
    
    -- ANON KEY (get from Supabase Dashboard → Settings → API)
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqd3RzaHN3aXZvdGhrbm90bHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMzMTQ4MDUsImV4cCI6MjA0ODg5MDgwNX0.W9RVut5AYcQm-QjH5xH5NhJ4M9r_c-hFSt5d69-m7YE';
    
    payload := json_build_object(
      'type', 'wo_assigned',
      'work_order_id', NEW.id,
      'user_id', NEW.assigned_to
    );
    
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', anon_key,
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload::jsonb
    );
    
    RAISE NOTICE 'Email notification triggered for WO %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_wo_assigned
  AFTER INSERT OR UPDATE OF assigned_to
  ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_wo_assigned();

SELECT 'Trigger fixed with anon key! ✅' as status;
