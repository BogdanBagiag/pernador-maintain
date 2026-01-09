# Equipment Periodic Inspections ✅

## 🎯 Funcționalitate Implementată

Sistem complet pentru gestionarea inspecțiilor periodice obligatorii pentru echipamente:
- **Configurare frecvență** inspecție (lunară, trimestrială, semestrială, anuală)
- **Tracking scadență** cu calcul automat următoare inspecție
- **Alerte vizuale** - valid/scadență apropiată/expirat
- **Istoric complet** inspecții (viitor)
- **Badge-uri** în listă pentru vizibilitate rapidă

---

## 📊 Database Schema

### **Câmpuri Noi în Tabel: equipment**

```sql
-- Flag dacă echipamentul necesită inspecții periodice
inspection_required BOOLEAN DEFAULT false

-- Frecvența inspecției în luni (12 = anual, 6 = semestrial, etc.)
inspection_frequency_months INTEGER

-- Data ultimei inspecții efectuate
last_inspection_date DATE
```

### **Tabel Nou: equipment_inspections** (pentru istoric)

```sql
CREATE TABLE equipment_inspections (
  id UUID PRIMARY KEY,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE NOT NULL,
  inspection_date DATE NOT NULL,
  inspector_name TEXT,
  inspector_id UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('passed', 'failed', 'conditional')),
  findings TEXT,
  next_inspection_date DATE,
  certificate_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Câmpuri equipment_inspections:**
- `inspection_date` - Când s-a făcut inspecția
- `inspector_name` - Nume inspector extern (opțional)
- `inspector_id` - Link la user intern dacă inspecția e făcută intern
- `status` - Rezultat: passed (promovat), failed (respins), conditional (cu observații)
- `findings` - Note inspector, probleme găsite
- `next_inspection_date` - Calculată automat (inspection_date + frequency_months)
- `certificate_url` - Link certificat inspecție (PDF)

---

## 🔧 Funcționalități Implementate

### **1. EquipmentForm - Configurare Inspecții**

**Secțiune nouă: "Inspecții Periodice"**

**Checkbox:**
```
☑️ Acest echipament necesită inspecții periodice
   Ex: Compresoare, cântare, echipamente cu certificare obligatorie
```

**Când checkbox = ☑️, apar câmpuri:**
1. **Frecvență Inspecție (luni)** - *obligatoriu*
   - Input numeric: 1, 3, 6, 12, 24, etc.
   - Helper text: "12 = anual, 6 = semestrial, 3 = trimestrial"

2. **Ultima Inspecție** - *opțional*
   - Date picker
   - Dacă e prima configurare → lasă gol

**Preview Box (dacă completate ambele):**
```
┌────────────────────────────────────────┐
│ 📋 Următoarea inspecție:              │
│    15 ianuarie 2027 (345 zile rămase) │
└────────────────────────────────────────┘
```

**Warning Box (dacă lipsește ultima inspecție):**
```
┌────────────────────────────────────────┐
│ ⚠️ Nu există înregistrare pentru      │
│    ultima inspecție. După salvare,     │
│    marchează prima inspecție în        │
│    pagina de detalii.                  │
└────────────────────────────────────────┘
```

---

### **2. EquipmentDetail - Afișare Status Inspecție**

**Card Info (după Garanție):**
```
┌─────────────────────────────────────┐
│ 📋 Inspecții Periodice              │
│                                     │
│ Frecvență: 12 luni                  │
│ Ultima inspecție: 15.01.2025        │
│                                     │
│ ✅ Scadență: 15 ianuarie 2026       │
│    (11 luni)                        │
└─────────────────────────────────────┘
```

**Statusuri Badge:**

| Status | Condiție | Culoare | Exemplu |
|--------|----------|---------|---------|
| **Valabil** | > 30 zile | 🟢 Verde | "Scadență: 15.06.2026 (5 luni)" |
| **Scadență apropiată** | ≤ 30 zile | 🟡 Galben | "Scadență: 15.02.2026 (25 zile)" |
| **Expirat** | < 0 zile | 🔴 Roșu | "Expirată! Scadență: 10.12.2025" |
| **Lipsă date** | Nu are last_inspection_date | ⚪ Gri | "Necesită prima inspecție" |

---

### **3. EquipmentList - Badge în Tabel**

**Coloana Status (3 badge-uri stivuite):**
```
┌──────────────────┐
│ ✅ operational   │ ← Status echipament
│ 🛡️ În garanție  │ ← Garanție
│ 📋 Inspecție OK  │ ← Inspecție
└──────────────────┘
```

**Badge-uri Inspecție:**
- **"Inspecție validă"** (verde) - mai mult de 30 zile
- **"Inspecție 25z"** (galben) - mai puțin de 30 zile
- **"Inspecție expirată!"** (roșu) - expirată
- **"Lipsă inspecție"** (gri) - nu are date

---

## 📋 Frecvențe Comune Inspecții

| Frecvență | Luni | Use Cases |
|-----------|------|-----------|
| **Lunară** | 1 | Echipamente critice siguranță |
| **Trimestrială** | 3 | Echipamente HVAC, sisteme presiune |
| **Semestrială** | 6 | Echipamente industriale |
| **Anuală** | 12 | Compresoare, cântare, liftă-re |
| **Bianual** | 24 | Echipamente certificare bianual |
| **Custom** | X | Orice altă frecvență |

---

## 🎯 Use Cases Reale

### **Use Case 1: Compresor Industrial**

**Configurare Inițială:**
```
Equipment: "Compresor Atlas Copco GA30"
☑️ Necesită inspecții periodice
Frecvență: 12 luni (anual)
Ultima inspecție: (gol - prima configurare)

→ Save
```

**Prima Inspecție (manual în viitor):**
```
Admin: Click "Marchează Inspecție" în Equipment Detail
Date: 15.01.2025
Inspector: "Service Atlas Copco"
Status: Passed
Certificate: Upload PDF

→ last_inspection_date = 15.01.2025
→ Următoarea scadență: 15.01.2026
```

**În Listă:**
```
Compresor Atlas Copco
├─ ✅ operational
├─ 🛡️ În garanție
└─ 📋 Inspecție validă (11 luni)
```

---

### **Use Case 2: Cântar Comercial**

**Configurare:**
```
Equipment: "Cântar Mettler Toledo"
☑️ Necesită inspecții periodice
Frecvență: 12 luni (verificare metrologică anuală)
Ultima inspecție: 20.03.2024

→ Următoarea: 20.03.2025
```

**La 25 zile înainte (23.02.2025):**
```
Badge în listă: ⚠️ "Inspecție 25z" (galben)
Badge în detail: ⚠️ "Scadență: 20 martie 2025 (25 zile)"
```

**După expirare (21.03.2025):**
```
Badge în listă: ❌ "Inspecție expirată!" (roșu)
Badge în detail: ❌ "Expirată! Scadență: 20 martie 2025"
```

**După efectuare inspecție nouă:**
```
Admin: Marchează inspecție la 25.03.2025
→ last_inspection_date = 25.03.2025
→ Următoarea scadență: 25.03.2026
→ Badge revine la verde: ✅ "Inspecție validă"
```

---

### **Use Case 3: Lift Pasageri (Semestrială)**

**Configurare:**
```
Equipment: "Lift Schindler 3300"
☑️ Necesită inspecții periodice
Frecvență: 6 luni (semestrial)
Ultima inspecție: 10.07.2025

→ Următoarea: 10.01.2026 (peste 9 zile)
```

**Status Badge:**
```
⚠️ "Inspecție 9z" (galben - < 30 zile)
```

---

## 🔄 Flow Complet

### **Flow 1: Configurare Echipament Nou cu Inspecții**

```
1. Admin: Create Equipment "Compresor"
2. Form: ☑️ Necesită inspecții periodice
3. Frecvență: 12 luni
4. Ultima inspecție: (gol)
5. Warning: "Necesită prima inspecție"
6. Save
   ↓
7. Equipment Detail:
   - Badge: ⚪ "Necesită prima inspecție"
   - Buton: "Marchează Prima Inspecție" (viitor)
   ↓
8. Admin: Marchează inspecție
   - Date: 15.01.2025
   - Upload certificat
   ↓
9. last_inspection_date = 15.01.2025
10. Următoarea scadență: 15.01.2026
11. Badge: ✅ "Inspecție validă (11 luni)"
```

---

### **Flow 2: Edit Echipament Existent - Adaugă Inspecții**

```
1. Equipment existent: "Cântar" (fără inspecții)
2. Admin: Edit
3. ☑️ Necesită inspecții periodice
4. Frecvență: 12 luni
5. Ultima inspecție: 01.12.2024
6. Preview: "Următoarea: 01.12.2025 (267 zile)"
7. Save
   ↓
8. Badge în listă: ✅ "Inspecție validă"
9. Badge în detail: ✅ "Scadență: 1 decembrie 2025 (9 luni)"
```

---

### **Flow 3: Notificare Scadență Apropiată**

```
Astăzi: 05.12.2025
Cântar: Scadență 01.01.2026 (27 zile)
   ↓
Badge: ⚠️ "Inspecție 27z" (galben)
   ↓
Admin: Vede în listă toate echipamentele galbene
   ↓
Planifică inspecții pentru următoarele 30 zile
```

---

## 🎨 Design & UI Details

### **Form - Secțiune Inspecții:**
```jsx
<div className="border-t pt-6">
  <h3>Inspecții Periodice</h3>
  
  {/* Checkbox */}
  <label>
    <input type="checkbox" name="inspection_required" />
    Acest echipament necesită inspecții periodice
  </label>
  
  {/* Visible doar dacă checkbox = true */}
  {formData.inspection_required && (
    <div className="ml-6 pl-4 border-l-2 border-primary-200">
      {/* Frecvență */}
      <input 
        type="number" 
        name="inspection_frequency_months"
        placeholder="12 (anual), 6 (semestrial)"
        required
      />
      
      {/* Ultima Inspecție */}
      <input 
        type="date" 
        name="last_inspection_date"
      />
      
      {/* Preview */}
      {lastInspection && frequency && (
        <div className="bg-blue-50">
          📋 Următoarea: {nextInspectionDate}
        </div>
      )}
    </div>
  )}
</div>
```

---

### **Detail - Card Inspecție:**
```jsx
{equipment.inspection_required && (
  <div>
    <label>📋 Inspecții Periodice</label>
    
    {!lastInspection ? (
      <div className="bg-gray-100">
        ⚪ Necesită prima inspecție
      </div>
    ) : (
      <>
        <p>Frecvență: {frequencyMonths} luni</p>
        <p>Ultima: {lastInspectionDate}</p>
        <div className={badgeColor}>
          {badgeText}
        </div>
      </>
    )}
  </div>
)}
```

---

### **List - Badge Stacked:**
```jsx
<div className="flex flex-col gap-1">
  {/* Equipment Status */}
  <span className="badge-green">operational</span>
  
  {/* Warranty Badge */}
  {warrantyInfo && (
    <span className="badge-blue">În garanție</span>
  )}
  
  {/* Inspection Badge */}
  {inspectionInfo && (
    <span className={inspectionBadgeColor}>
      {inspectionBadgeText}
    </span>
  )}
</div>
```

---

## 📦 Instalare & Deployment

### **Pasul 1: SQL Migration**
Rulează în Supabase Dashboard → SQL Editor:  
**add_equipment_inspections.sql** ⬆️

```sql
-- Adaugă câmpuri în equipment
ALTER TABLE equipment 
ADD COLUMN inspection_required BOOLEAN DEFAULT false,
ADD COLUMN inspection_frequency_months INTEGER,
ADD COLUMN last_inspection_date DATE;

-- Creează tabel istoric
CREATE TABLE equipment_inspections (...);

-- RLS + Policies + Index
```

### **Pasul 2: Deploy Cod**
```bash
# Copiază fișierele:
cp EquipmentForm.jsx src/pages/
cp EquipmentDetail.jsx src/pages/
cp EquipmentList.jsx src/pages/

# Commit:
git add src/pages/Equipment*.jsx
git commit -m "Add periodic inspections management for equipment"
git push

# Clear cache:
Ctrl + Shift + R
```

---

## ✅ Testing Checklist

### **Test 1: Config Echipament Nou cu Inspecții**
- [ ] Create equipment "Compresor Test"
- [ ] ☑️ Necesită inspecții periodice
- [ ] Frecvență: 12 luni
- [ ] Ultima inspecție: (gol)
- [ ] ✅ Warning: "Necesită prima inspecție"
- [ ] Save
- [ ] Badge în listă: ⚪ "Lipsă inspecție"

### **Test 2: Config cu Ultima Inspecție**
- [ ] Create equipment "Cântar Test"
- [ ] ☑️ Necesită inspecții
- [ ] Frecvență: 12
- [ ] Ultima: 01.01.2025
- [ ] ✅ Preview: "Următoarea: 01.01.2026 (X zile)"
- [ ] Save
- [ ] Badge: ✅ "Inspecție validă"

### **Test 3: Edit - Adaugă Inspecții la Existent**
- [ ] Equipment fără inspecții
- [ ] Edit → ☑️ Necesită inspecții
- [ ] Completează frecvență + ultima
- [ ] ✅ Badge apare în listă

### **Test 4: Edit - Dezactivează Inspecții**
- [ ] Equipment cu inspecții
- [ ] Edit → ☐ Debifează checkbox
- [ ] ✅ Câmpuri dispar
- [ ] Save
- [ ] ✅ Badge dispare din listă

### **Test 5: Calcul Scadență Corect**
- [ ] Frecvență: 12 luni
- [ ] Ultima: 15.01.2024
- [ ] ✅ Următoarea: 15.01.2025
- [ ] Frecvență: 6 luni
- [ ] Ultima: 01.07.2024
- [ ] ✅ Următoarea: 01.01.2025

### **Test 6: Badge Galben (< 30 zile)**
- [ ] Ultima inspecție: acum - 11 luni - 5 zile
- [ ] Frecvență: 12 luni
- [ ] ✅ Badge galben: "Inspecție 25z"

### **Test 7: Badge Roșu (Expirat)**
- [ ] Ultima inspecție: acum - 13 luni
- [ ] Frecvență: 12 luni
- [ ] ✅ Badge roșu: "Inspecție expirată!"

### **Test 8: Equipment fără Inspecții**
- [ ] inspection_required = false
- [ ] ✅ Badge NU apare în listă
- [ ] ✅ Card NU apare în detail

---

## 💡 Best Practices

### **Pentru Admini:**

**Configurare Inițială:**
1. Identifică echipamente cu inspecții obligatorii
2. Verifică frecvența în documentația echipamentului
3. Notează data ultimei inspecții (dacă există)
4. Configurează în sistem

**Frecvențe Recomandate:**
- **Compresoare:** 12 luni (anual)
- **Cântare comerciale:** 12 luni (verificare metrologică)
- **Lifturi:** 6 luni (semestrial)
- **Echipamente presiune:** 12-24 luni
- **Sisteme anti-incendiu:** 6-12 luni

**Monitorizare:**
1. **Weekly:** Verifică echipamente cu badge galben
2. **Monthly:** Planifică inspecții pentru următoarele 60 zile
3. **Quarterly:** Review frecvențe (poate fi schimbată legislația)

---

## 🚀 Îmbunătățiri Viitoare

### **1. Marchează Inspecție Completată (UI în EquipmentDetail)**
```jsx
<button onClick={openInspectionModal}>
  ✅ Marchează Inspecție Completată
</button>

<InspectionModal>
  <input type="date" name="inspection_date" />
  <input type="text" name="inspector_name" />
  <select name="status">
    <option>Passed</option>
    <option>Failed</option>
    <option>Conditional</option>
  </select>
  <textarea name="findings" />
  <FileUpload label="Certificat Inspecție" />
  <button>Salvează</button>
</InspectionModal>
```

**Flow:**
- Click buton → Modal
- Completează date inspecție
- Upload certificat (PDF)
- Save → Insert în `equipment_inspections`
- Update `last_inspection_date` în equipment
- Badge refresh automat

### **2. Istoric Inspecții**
```jsx
<InspectionHistory equipment_id={id}>
  {inspections.map(insp => (
    <InspectionCard>
      <p>Data: {insp.inspection_date}</p>
      <p>Inspector: {insp.inspector_name}</p>
      <p>Status: {insp.status}</p>
      <p>Note: {insp.findings}</p>
      <a href={insp.certificate_url}>Certificat</a>
    </InspectionCard>
  ))}
</InspectionHistory>
```

### **3. Dashboard Widget**
```jsx
<InspectionsDashboard>
  <Stat label="Expirate" value={15} color="red" />
  <Stat label="< 30 zile" value={8} color="yellow" />
  <Stat label="Valide" value={42} color="green" />
</InspectionsDashboard>
```

### **4. Email Notifications**
```sql
-- Trigger pentru notificări
-- Când scadență < 30 zile → Email admin
```

### **5. Export Raport Inspecții**
```
CSV/PDF: "Inspecții Scadente Q1 2026"
- Equipment Name
- Last Inspection
- Next Due
- Days Until
- Status
```

---

## 🎉 Rezultat Final

✅ **Checkbox** "Necesită inspecții periodice"  
✅ **Frecvență configurabilă** (1-999 luni)  
✅ **Calcul automat** următoare scadență  
✅ **Preview live** în form  
✅ **Badge în listă** - verde/galben/roșu/gri  
✅ **Card în detail** - info completă  
✅ **Alertă 30 zile** înainte de expirare  
✅ **Tabel istoric** ready (pentru viitor)  
✅ **Responsive** - mobil + desktop  
✅ **Opțional** - nu afectează echipamente existente  

**Acum poți gestiona inspecțiile periodice obligatorii pentru compresoare, cântare și alte echipamente! 🎉**
