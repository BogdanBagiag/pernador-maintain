# Instalare Kanban Maintenance Schedules

## 🔧 Pas 1: Rulează Migrations în Supabase

### 1. Deschide Supabase Dashboard
```
→ Proiectul tău
→ SQL Editor
```

### 2. Rulează Migration 1 - Status Column
```sql
-- Copiază conținutul din: migration-add-status-column.sql
-- Paste în SQL Editor
-- Run
```

### 3. Rulează Migration 2 - Completion Fields
```sql
-- Copiază conținutul din: migration-add-completion-fields.sql
-- Paste în SQL Editor
-- Run
```

**✅ Database ready!**

---

## 📦 Pas 2: Înlocuiește Fișierul

```bash
# În proiectul local:
MaintenanceSchedules.jsx → /src/pages/

# Backup vechiul (opțional):
mv src/pages/MaintenanceSchedules.jsx src/pages/MaintenanceSchedules.old.jsx

# Copiază noul:
cp MaintenanceSchedules.jsx src/pages/
```

---

## 🚀 Pas 3: Deploy

```bash
git add src/pages/MaintenanceSchedules.jsx
git commit -m "Feature: Kanban maintenance schedules with auto-regeneration"
git push

# Wait 2 min → Live! ✅
```

---

## ✅ Verificare

1. Deschide aplicația
2. Mergi la "Programe Mentenanță"
3. Ar trebui să vezi 4 coloane:
   - 📅 Programate
   - ⚠️ Urgent
   - 🔧 În Lucru
   - ✅ Finalizate

4. Click "Începe" pe un card → Se mută în "În Lucru"
5. Click "Finalizează" → Modal cu note
6. După finalizare:
   - Card în "Finalizate" ✅
   - Card NOU în "Programate" (dacă recurent) ✅

---

## 🎯 Features:

✅ 4 coloane Kanban  
✅ Auto-generare recurentă  
✅ Note probleme/istoric  
✅ Tot în română  
✅ Responsive  
✅ Admin delete  

**Gata!** 🎉
