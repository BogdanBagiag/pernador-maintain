# Debug: Cannot Set Manager Role

## Problema
Poți seta Admin și Technician, dar nu Manager.

## Posibile Cauze

### 1. Database Constraint
Verifică în Supabase:
```sql
-- Vezi constraint-ul pe coloana role
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public';

-- Vezi constraint-urile pe profiles
\d profiles
```

Dacă vezi ceva de genul:
```sql
CHECK (role IN ('admin', 'technician'))
```

**Lipsește 'manager'!**

### 2. Fix Database Constraint

```sql
-- Șterge constraint-ul vechi
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Adaugă constraint nou cu toate 3 rolurile
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'technician'));
```

### 3. Verifică în Browser Console

Când încerci să setezi Manager, deschide Console (F12) și vezi:
- Ce request se face?
- Ce error exact returnează?
- E 400? 422? Altceva?

### 4. Test Manual

În Supabase SQL Editor:
```sql
-- Încearcă manual să setezi manager
UPDATE profiles 
SET role = 'manager' 
WHERE email = 'test@example.com';
```

Dacă asta dă eroare → problema e la constraint.

### 5. Verifică Migration-urile

Caută în toate migration-urile tale după:
- `CHECK (role`
- `profiles_role_check`
- Orice constraint care limitează valorile role

## Soluție Completă

Rulează asta în Supabase SQL Editor:

```sql
-- 1. Șterge orice constraint vechi
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Creează constraint nou corect
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'manager', 'technician'));

-- 3. Verifică că merge
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass;

-- 4. Test update
UPDATE profiles 
SET role = 'manager' 
WHERE email = 'YOUR_TEST_EMAIL@example.com';

-- 5. Rollback test (dacă nu vrei să păstrezi)
-- UPDATE profiles SET role = 'technician' WHERE email = 'YOUR_TEST_EMAIL@example.com';
```

## Verificare Finală

După rularea SQL-ului:
1. Refresh app
2. Edit user → selectează Manager
3. Ar trebui să funcționeze!

## Alternative Debug

Dacă tot nu merge, adaugă console.log în UserManagement.jsx:

```javascript
const handleRoleChange = (userId, newRole) => {
  console.log('Changing role to:', newRole)
  console.log('User ID:', userId)
  updateRoleMutation.mutate({ userId, newRole })
}
```

Apoi vezi în console exact ce valoare trimite.
