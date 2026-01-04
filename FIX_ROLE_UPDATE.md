# Fix: Cannot Update User Role (403 & 400 Errors)

## Problema
Când încerci să schimbi role-ul unui user în "Manager":
- Error 403: Admin API forbidden
- Error 400: Bad Request la PATCH profiles

## Cauza
1. Reset password încearcă să folosească `admin.updateUserById` (necesită Service Role Key)
2. Update role are probleme cu RLS policies

## Soluție

### 1. Rulează SQL pentru Policy Fix:

```sql
-- Fix RLS pentru update role
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins update any profile" ON profiles;

-- Policy simplu pentru update
CREATE POLICY "Allow authenticated updates"
ON profiles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

### 2. Verifică UPDATE în Supabase:

Testează manual:
```sql
-- Test update role
UPDATE profiles 
SET role = 'manager' 
WHERE email = 'TEST_USER@example.com';
```

Dacă merge manual dar nu din app → problema e la RLS.

### 3. Pentru Reset Password:

Reset password nu va funcționa fără Service Role Key.

**Opțiuni:**
A) Folosește Supabase Dashboard pentru reset password
B) Configurează Service Role Key (nu recomandat în frontend)
C) Creează backend function (cel mai sigur)

**Pentru acum, cea mai simplă soluție:**

În Supabase Dashboard:
1. Authentication → Users
2. Click pe user
3. Reset Password
4. User primește email cu link

