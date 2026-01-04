# Fix: Profile Not Loading (Users Menu Missing)

## Problema
- În Supabase profile are `role = 'admin'` ✓
- Dar în aplicație afișează doar `User` 
- Meniul "Users" nu apare

## Cauza
Profile-ul nu se încarcă din database → RLS policies blochează query-ul

## Soluție

### Pas 1: Rulează Migration
```sql
-- În Supabase SQL Editor:
-- Execută fișierul: migration-fix-profile-rls.sql
```

Această migrație:
- ✅ Șterge policies vechi care pot bloca
- ✅ Creează policy: "Users can view own profile"
- ✅ Creează policy: "Admins can view all profiles"
- ✅ Setează `is_active = true` pentru toți

### Pas 2: Verifică în Console
După refresh (F5), deschide Console (F12) și caută:

```
Loading profile for user ID: xxx-yyy-zzz
Profile loaded successfully: {id: "...", email: "...", role: "admin", ...}
Layout - Profile Role: admin
Layout - Is Admin?: true
```

### Pas 3: Dacă Apare Eroare

**Eroare tipică:**
```
Profile load error: {code: "42501", message: "...row-level security..."}
```

**Fix:**
```sql
-- Verifică dacă RLS e activat
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

-- Dacă vezi rowsecurity = true, bine!
-- Dacă policies nu există încă:

-- Asigură-te că ai aceste policies:
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());
```

### Pas 4: Clear Cache și Relogin
```javascript
// În browser console:
localStorage.clear()
```

Apoi:
1. Reîncarcă pagina
2. Login din nou
3. Verifică console logs

## Verificare Rapidă

### Test Manual în Supabase
```sql
-- Înlocuiește YOUR_USER_ID cu ID-ul tău de user
SELECT * FROM profiles WHERE id = 'YOUR_USER_ID';
```

Ar trebui să returneze:
```
id: xxx-yyy-zzz
email: your-email@example.com
role: admin
is_active: true
```

### Test RLS Policies
```sql
-- Vezi toate policies active:
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

Ar trebui să vezi:
- "Users can view own profile"
- "Admins can view all profiles"
- "Users can update own profile"
- "Admins can update all profiles"

## După Fix

Când funcționează corect, în console vei vedea:

```
Loading profile for user ID: abc-123-def-456
Profile loaded successfully: {
  id: "abc-123-def-456",
  email: "bogdanbagiag@gmail.com",
  full_name: "Bogdan",
  role: "admin",
  is_active: true,
  created_at: "...",
  updated_at: "..."
}
Layout - Profile Role: admin
Layout - Is Admin?: true
```

Și în sidebar va apărea:
```
Bogdan Bagiag
Admin  ← Aici ar trebui să apară "Admin", nu "User"
```

Și vei vedea meniul **"Users"** în navigare!

## Dacă Tot Nu Merge

### Debug Mode - Forțează Afișarea
În `Layout.jsx`, linia 86, schimbă temporar:

```javascript
// Din:
.filter(item => !item.adminOnly || profile?.role === 'admin')

// În:
.filter(item => true)  // SHOW ALL - doar pentru debug!
```

Apoi mergi la `/users` manual în browser:
```
http://localhost:5173/users
```

Dacă pagina se încarcă → problema e doar la filtrare
Dacă apare eroare → problema e mai adâncă

## Contact/Debug

Trimite-mi screenshot cu:
1. Console logs (după refresh)
2. Supabase → Table Editor → profiles (rândul tău)
3. Supabase → Authentication → Policies → profiles
