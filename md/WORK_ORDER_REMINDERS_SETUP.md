# 🔔 WORK ORDER REMINDERS SYSTEM - Setup Complet

## 📋 PASUL 1: Setup Database

### A. Rulează Schema SQL:

**Supabase Dashboard → SQL Editor → New Query:**

Copiază și rulează conținutul din: `work-order-reminders-schema.sql`

**Verifică instalarea:**
```sql
-- Trebuie să vezi tabelele noi:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%reminder%';

-- Verifică setările default:
SELECT * FROM reminder_settings;
```

---

## 📋 PASUL 2: Deploy Edge Function

### A. Creează Edge Function în Supabase:

**Dashboard → Edge Functions → "New function":**
1. Name: `check-work-order-reminders`
2. Click "Create"

### B. Deploy Codul:

1. Click "Edit function"
2. **Șterge tot codul existent**
3. **Copiază ÎNTREG codul din:** `check-work-order-reminders.ts`
4. Click "Deploy"

### C. Test Manual:

**Dashboard → Edge Functions → check-work-order-reminders:**

Click "Invoke" → Trebuie să vezi:
```json
{
  "success": true,
  "message": "No reminders needed" / "Reminder system disabled",
  "sent": 0
}
```

---

## 📋 PASUL 3: Setup Cron Job (Automated Checks)

### Opțiunea A: Supabase pg_cron (Recomandat)

**SQL Editor → New Query:**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule reminder checks every hour
SELECT cron.schedule(
  'check-work-order-reminders',     -- Job name
  '0 * * * *',                      -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://fjwtshswivothknotlzs.supabase.co/functions/v1/check-work-order-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Verifică job-ul:
SELECT * FROM cron.job;

-- Vezi history (după o oră):
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**NOTE:**
- Înlocuiește `YOUR_ANON_KEY` cu Supabase Anon Key (Dashboard → Settings → API)
- Înlocuiește URL-ul cu project-ul tău

**Cron Schedule Examples:**
```
'0 * * * *'      → Every hour
'*/30 * * * *'   → Every 30 minutes
'0 */2 * * *'    → Every 2 hours
'0 9,17 * * *'   → 9 AM and 5 PM every day
```

---

### Opțiunea B: Vercel Cron Jobs (Dacă folosești Vercel)

**1. Creează API Route în Next.js/Vite:**

`/api/cron/check-reminders.js`:
```javascript
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/check-work-order-reminders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        }
      }
    );

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

**2. Configurează în `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

**3. Set Environment Variable:**
- Vercel Dashboard → Settings → Environment Variables
- Add: `CRON_SECRET` = `[random-string]`

---

## 📋 PASUL 4: Integrare în Aplicație

### A. Adaugă Components:

**1. Copiază fișierele:**
- `ReminderSettings.jsx` → `src/components/`
- `ReminderDashboard.jsx` → `src/components/`

**2. Creează pagină Settings pentru Admin:**

`src/pages/AdminReminderSettings.jsx`:
```javascript
import ReminderSettings from '../components/ReminderSettings'
import ReminderDashboard from '../components/ReminderDashboard'

export default function AdminReminderSettings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reminder Settings</h1>
      <ReminderSettings />
      <ReminderDashboard />
    </div>
  )
}
```

**3. Adaugă Route:**

`App.jsx`:
```javascript
import AdminReminderSettings from './pages/AdminReminderSettings'

// În routes:
<Route path="/admin/reminders" element={<AdminReminderSettings />} />
```

**4. Adaugă în Navigation (doar pentru Admin):**

```javascript
{isAdmin && (
  <Link to="/admin/reminders" className="...">
    <Bell className="w-5 h-5" />
    Reminders
  </Link>
)}
```

---

## 📋 PASUL 5: Testare

### Test 1: Verifică Setările

1. Login ca Admin
2. Mergi la `/admin/reminders`
3. Verifică setările:
   - ✓ Sistem Activ: ON
   - ✓ Primul reminder: 24 ore
   - ✓ Recurent: 12 ore
   - ✓ Max reminders: 10
   - ✓ Escalation: ON

### Test 2: Creează Work Order de Test

1. Creează un work order NOU
2. **NU îl completa**
3. În SQL, modifică `created_at` să fie în trecut:

```sql
-- Face work order-ul să pară creat acum 25 ore
UPDATE work_orders 
SET created_at = NOW() - INTERVAL '25 hours'
WHERE id = '[WORK_ORDER_ID]';
```

### Test 3: Trigger Manual Check

**Dashboard → Edge Functions → check-work-order-reminders:**

Click "Invoke"

**Trebuie să vezi:**
```json
{
  "success": true,
  "processed": 1,
  "sent": 1,
  "escalated": 0,
  "results": [...]
}
```

### Test 4: Verifică Notificarea

1. Check push notifications pe device
2. Verifică în DB:

```sql
SELECT * FROM work_order_reminders 
ORDER BY sent_at DESC 
LIMIT 5;
```

### Test 5: Verifică Escalation

```sql
-- Simulează 10 reminder-uri
INSERT INTO work_order_reminders (work_order_id, reminder_count, sent_to_user_ids)
SELECT 
  '[WORK_ORDER_ID]', 
  generate_series, 
  ARRAY['[USER_ID]']::UUID[]
FROM generate_series(1, 9);

-- Trigger check din nou - ar trebui să escaleze
```

---

## 📋 PASUL 6: Monitorizare

### Verifică Cron Job History:

**pg_cron:**
```sql
SELECT 
  jobid,
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Verifică Reminder Stats:

```sql
-- Overview
SELECT 
  COUNT(*) as total_reminders,
  COUNT(DISTINCT work_order_id) as unique_work_orders,
  COUNT(*) FILTER (WHERE escalated = true) as escalated_count,
  MAX(reminder_count) as max_reminder_count
FROM work_order_reminders;

-- Top work orders by reminders
SELECT 
  wo.id,
  wo.title,
  wo.status,
  COUNT(r.id) as reminder_count,
  MAX(r.sent_at) as last_reminder,
  BOOL_OR(r.escalated) as has_escalated
FROM work_orders wo
LEFT JOIN work_order_reminders r ON r.work_order_id = wo.id
GROUP BY wo.id, wo.title, wo.status
ORDER BY reminder_count DESC
LIMIT 10;
```

---

## 🔧 Troubleshooting

### Problema: Nu se trimit reminder-uri

**Check 1: Sistemul e activ?**
```sql
SELECT setting_value FROM reminder_settings WHERE setting_key = 'enabled';
-- Trebuie: "true"
```

**Check 2: Există work orders care necesită reminder?**
```sql
SELECT * FROM work_orders_needing_reminder;
-- Trebuie să vezi work orders vechi nerezolvate
```

**Check 3: Cron job-ul rulează?**
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- Trebuie să vezi run-uri recente
```

**Check 4: Edge function logs:**
```
Dashboard → Edge Functions → check-work-order-reminders → Logs
```

### Problema: Prea multe reminder-uri

**Ajustează setările:**
```sql
UPDATE reminder_settings 
SET setting_value = '48' 
WHERE setting_key = 'first_reminder_hours';

UPDATE reminder_settings 
SET setting_value = '24' 
WHERE setting_key = 'recurring_reminder_hours';
```

---

## ✅ Checklist Final

- [ ] Schema SQL deployed
- [ ] Edge function deployed
- [ ] Cron job configured (pg_cron or Vercel)
- [ ] Components adăugate în aplicație
- [ ] Routes configurate
- [ ] Navigation updated (admin only)
- [ ] Test work order creat și testat
- [ ] Reminder primit cu success
- [ ] Dashboard afișează statistici
- [ ] Settings pot fi modificate

---

## 🎯 Best Practices

1. **Start Conservative:** 
   - First reminder: 24h
   - Recurring: 12h
   - Testează și ajustează

2. **Monitor Regular:**
   - Check dashboard weekly
   - Adjust settings based on team feedback

3. **Escalation Strategy:**
   - Set max_reminders realistic (8-10)
   - Ensure managers are notified properly

4. **Performance:**
   - Cron every hour e suficient
   - Nu rula mai des de 30 minute

---

**Succes!** 🚀

Pentru întrebări sau probleme, verifică logs și troubleshooting guide mai sus.
