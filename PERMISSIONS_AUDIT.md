# Permissions Audit & Fix

## Problema Găsită
✅ Managers și Technicians pot șterge Checklist Templates și Procedure Templates

## Verifică Toate Permisiunile

### 1. Equipment
- View: ✅ Toți
- Create/Edit: ⚠️ Managers + Admins (verifică!)
- Delete: ⚠️ Admins ONLY (verifică!)

### 2. Work Orders
- View: ✅ Toți
- Create: ✅ Toți
- Edit: ✅ Assigned user + Creator + Managers/Admins
- Delete: ⚠️ Managers + Admins (verifică!)

### 3. Maintenance Schedules
- View: ✅ Toți
- Create/Edit: ⚠️ Managers + Admins (verifică!)
- Delete: ⚠️ Admins ONLY (verifică!)
- Complete: ✅ Toți (technicians pot completa task-uri)

### 4. Templates (Checklists/Procedures)
- View: ✅ Toți
- Create/Edit: ⚠️ Managers + Admins (FIX cu migration!)
- Delete: ⚠️ Admins ONLY (FIX cu migration!)

### 5. Locations
- View: ✅ Toți
- Create/Edit: ⚠️ Managers + Admins (verifică!)
- Delete: ⚠️ Admins ONLY (verifică!)

## Verificare Manuală în Supabase

```sql
-- Vezi TOATE policies pe TOATE tabelele
SELECT 
  schemaname,
  tablename, 
  policyname, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Filtrează pentru DELETE policies
SELECT 
  tablename, 
  policyname, 
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND cmd = 'DELETE'
ORDER BY tablename;
```

## Permission Matrix Corectă

| Feature | View | Create | Edit | Delete | Complete |
|---------|------|--------|------|--------|----------|
| Equipment | All | M+A | M+A | **A** | - |
| Work Orders | All | All | Self+M+A | M+A | - |
| Schedules | All | M+A | M+A | **A** | All |
| Templates | All | M+A | M+A | **A** | - |
| Locations | All | M+A | M+A | **A** | - |
| Users | **A** | **A** | **A** | **A** | - |

**Legend:**
- All = Toți authenticated users
- M+A = Managers + Admins
- A = Admins ONLY
- Self = Assigned user sau creator

## Quick Fix SQL

După ce rulezi `migration-fix-templates-permissions.sql`, verifică și celelalte:

```sql
-- Check Equipment DELETE
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'equipment' AND cmd = 'DELETE';

-- Check Locations DELETE
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'locations' AND cmd = 'DELETE';

-- Check Schedules DELETE
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'maintenance_schedules' AND cmd = 'DELETE';
```

Dacă vezi policies care permit tuturor să șteargă, trebuie fixate!

## Test ca Technician

Login ca technician și încearcă:
1. ❌ Să ștergi un checklist template → ar trebui să fie blocat
2. ❌ Să ștergi o locație → ar trebui să fie blocat
3. ❌ Să ștergi equipment → ar trebui să fie blocat
4. ✅ Să completezi un task → ar trebui să meargă
5. ✅ Să vezi tot → ar trebui să meargă

## Test ca Manager

Login ca manager și încearcă:
1. ✅ Să creezi checklist → ar trebui să meargă
2. ✅ Să editezi procedure → ar trebui să meargă
3. ❌ Să ștergi template → ar trebui să fie blocat
4. ✅ Să ștergi work order → ar trebui să meargă
5. ✅ Să editezi equipment → ar trebui să meargă

## Test ca Admin

Login ca admin:
1. ✅ Totul ar trebui să meargă, inclusiv delete pe templates
