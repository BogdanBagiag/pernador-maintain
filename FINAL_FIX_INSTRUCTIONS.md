# FINAL FIX - Email Notifications

## 🎯 Problema:
Edge functions în Supabase Cloud necesită authentication (anon key)!

## ✅ Soluția Completă:

### Pas 1: Restore Edge Function Original

```powershell
# Restore backup (dacă există):
copy supabase\functions\send-email\index.ts.backup supabase\functions\send-email\index.ts

# SAU copiază din package-ul original: fix-edge-function-auth.zip
# Dar FĂRĂ config.toml!

# Delete config.toml:
del supabase\functions\send-email\config.toml

# Deploy:
npx supabase functions deploy send-email
```

---

### Pas 2: Fix Trigger cu Anon Key

**SQL Editor - Run:**

```sql
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
```

---

### Pas 3: Test

```sql
-- Test trigger:
UPDATE work_orders 
SET assigned_to = (SELECT id FROM profiles WHERE email IS NOT NULL LIMIT 1)
WHERE id = (SELECT id FROM work_orders ORDER BY created_at DESC LIMIT 1);

-- Check logs:
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 1;
```

**Ar trebui să vezi:**
- status: 'sent'
- resend_id: (un ID)
- ✅ EMAIL TRIMIS!

---

### Pas 4: Check Email Inbox

```
1. Check inbox-ul user-ului asignat
2. From: Pernador Maintenance <noreply@resend.dev>
3. Subject: 🔧 Comandă Nouă Asignată
4. ✅ Email frumos formatat!
```

---

## 📊 Flow Final:

```
User asignează WO în aplicație
  ↓
Trigger se activează
  ↓
Call edge function CU anon key ✅
  ↓
Edge function verifică JWT (OK cu anon key)
  ↓
Folosește SERVICE_ROLE_KEY pentru database
  ↓
Send email via Resend
  ↓
Log în email_logs
  ↓
📧 Email sosește!
```

---

**Restore function → Fix trigger → Test → Email magic! ✨📧**
