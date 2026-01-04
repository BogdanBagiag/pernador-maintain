# 🚀 QUICK START GUIDE - Pernador Maintain

## ⚡ Setup în 10 Minute

### 1️⃣ Instalează Dependențele (2 min)

```bash
cd pernador-maintain
npm install
```

### 2️⃣ Creează Cont Supabase (3 min)

1. Mergi la https://supabase.com
2. Click "Start your project"
3. Sign up (Google/GitHub/Email)
4. Click "New Project"
5. Completează:
   - **Organization:** Alege sau creează una nouă
   - **Name:** `pernador-maintain`
   - **Database Password:** Alege o parolă sigură (salvează-o!)
   - **Region:** `Europe (eu-central-1)` sau cea mai apropiată
6. Click "Create new project"
7. **Așteaptă ~2 minute** până se creează proiectul

### 3️⃣ Setup Baza de Date (2 min)

1. În Supabase, click pe **SQL Editor** (iconița din sidebar)
2. Click "New Query"
3. Deschide fișierul `supabase-schema.sql` din proiect
4. **Copiază TOT** conținutul
5. **Lipește** în SQL Editor
6. Click **"Run"** (sau `Ctrl + Enter`)
7. Ar trebui să vezi: ✅ "Success. No rows returned"

### 4️⃣ Setup Storage pentru Poze (1 min)

1. Click pe **Storage** în sidebar
2. Click "Create a new bucket"
3. Name: `work-order-attachments`
4. **Bifează "Public bucket"** ✅
5. Click "Create bucket"

### 5️⃣ Configurare .env (2 min)

1. În Supabase, click pe **Settings** (iconița rotițe)
2. Click pe **API**
3. Găsești aici:
   - **Project URL:** `https://xxxxxx.supabase.co`
   - **anon public key:** Codul lung care începe cu `eyJ...`

4. În proiect, creează fișierul `.env`:

```bash
# Windows PowerShell
New-Item .env

# Mac/Linux
touch .env
```

5. Deschide `.env` și adaugă:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
```

⚠️ **Înlocuiește cu valorile tale reale!**

### 6️⃣ Pornește Aplicația! 🚀

```bash
npm run dev
```

Aplicația se va deschide automat la `http://localhost:3000`

---

## 👤 Creează Primul Utilizator

### Înregistrare

1. Click pe "Get Started" sau "Sign up"
2. Completează:
   - **Full Name:** Numele tău
   - **Email:** email@example.com
   - **Password:** minim 6 caractere
3. Click "Create account"
4. Vei fi logat automat!

### Fă-te Admin

Primul utilizator trebuie făcut admin manual:

1. Mergi la Supabase Dashboard
2. Click pe **Table Editor** (iconița tabel)
3. Selectează tabelul **profiles**
4. Găsește-ți user-ul (după email)
5. Click pe câmpul **role**
6. Schimbă din `requester` în **`admin`**
7. Salvează (Enter sau click în afara celulei)

Refresh aplicația - acum ești admin! ✨

---

## ✅ Verificare Instalare

Ar trebui să vezi:

- ✅ Dashboard cu 4 carduri (Total Equipment, Open Work Orders, etc.)
- ✅ Sidebar cu: Dashboard, Equipment, Work Orders, Schedules, Reports, Settings
- ✅ Numele tău și rol (Admin) în footer sidebar
- ✅ Buton "Sign Out"

---

## 🎯 Primul Test

### Adaugă un Echipament

1. Click **"Equipment"** în sidebar
2. Click **"Add Equipment"**
3. Completează:
   - **Name:** Generator Diesel
   - **Serial Number:** GEN-001
   - **Manufacturer:** Caterpillar
   - **Location:** Hală Producție
   - **Status:** Operational
4. Click **"Save"**

### Creează un Work Order

1. Click **"Work Orders"** în sidebar
2. Click **"Create Work Order"**
3. Completează:
   - **Title:** Verificare Nivel Ulei
   - **Description:** Control de rutină
   - **Equipment:** Generator Diesel
   - **Priority:** Medium
   - **Type:** Preventive
4. Click **"Create"**

---

## 🐛 Probleme Comune

### "Cannot read properties of undefined"
→ Verifică dacă ai rulat `supabase-schema.sql` corect

### "Invalid API key"
→ Verifică `.env` - trebuie să înceapă cu `VITE_`

### "Failed to fetch"
→ Verifică URL-ul Supabase în `.env`

### Schema errors
→ Șterge toate tabelele în Supabase și rulează din nou schema

---

## 📞 Ai Nevoie de Ajutor?

1. Verifică README.md pentru detalii complete
2. Verifică PROJECT_PLAN.md pentru arhitectură
3. Caută în documentația Supabase: https://supabase.com/docs

---

## 🎉 Gata! 

Aplicația ta de mentenanță este live! 

**Următorii Pași:**
- Adaugă echipamente
- Creează work orders
- Testează toate funcționalitățile
- Personalizează după nevoile tale

**Mult succes!** 🚀
