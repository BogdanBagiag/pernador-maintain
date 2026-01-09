# Equipment Warranty Management ✅

## 🎯 Funcționalitate Implementată

Sistem complet de management garanție pentru echipamente cu:
- **Câmp opțional** pentru perioada de garanție (în luni)
- **Calcul automat** a datei de expirare (data achiziție + luni garanție)
- **Indicator vizual** pentru status garanție (validă / expiră în curând / expirată)
- **Afișare** în listă, detalii, și formular

---

## 📊 Database Schema

### **Tabel: equipment**

**Câmp nou adăugat:**
```sql
warranty_months INTEGER NULL
```

**Descriere:**
- **Type:** INTEGER (număr întreg)
- **Nullable:** Da (opțional)
- **Valori:** Număr de luni (ex: 12, 24, 36, 60)
- **Exemple:** 
  - 12 = 1 an
  - 24 = 2 ani
  - 36 = 3 ani
  - 60 = 5 ani

### **Migration SQL:**
```sql
-- Adaugă coloana warranty_months
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS warranty_months INTEGER;

-- Comentariu pentru documentație
COMMENT ON COLUMN equipment.warranty_months IS 
'Warranty period in months (e.g., 12 for 1 year, 24 for 2 years)';
```

---

## 🔧 Funcționalități Implementate

### **1. EquipmentForm - Introducere Garanție**

**Câmpuri:**
- **Data Achiziție** (opțional)
- **Garanție (luni)** (opțional)

**Calcul Automat:**
```javascript
// Dacă AMBELE câmpuri sunt completate:
const purchaseDate = new Date(formData.purchase_date)
const warrantyMonths = parseInt(formData.warranty_months)
const expiryDate = new Date(purchaseDate)
expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths)

// Afișare: "Garanția expiră: 15 ianuarie 2027 (345 zile rămase)"
```

**Preview Box:**
- ✅ Culoare **albastră** dacă garanția este validă
- ⚠️ Culoare **roșie** dacă garanția este expirată
- 📅 Afișează data exactă de expirare
- ⏱️ Afișează zile rămase (dacă e validă)

**UI:**
```
┌────────────────────────────────────────┐
│ Data Achiziție      Garanție (luni)   │
│ [2024-01-15]        [24]              │
│                                        │
│ ℹ️ Număr de luni (ex: 12 luni = 1 an) │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 🛡️ Garanția expiră:                   │
│    15 ianuarie 2026 (345 zile rămase) │
└────────────────────────────────────────┘
```

---

### **2. EquipmentDetail - Afișare Garanție**

**Card Informații:**
```
┌─────────────────────────────────────┐
│ 🛡️ Garanție                         │
│                                     │
│ 24 luni                             │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✅ Valabilă până la             │ │
│ │    15 ianuarie 2026 (11 luni)   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Statusuri Vizuale:**

| Status | Condiție | Culoare | Icon | Exemplu |
|--------|----------|---------|------|---------|
| **Validă** | > 90 zile | 🟢 Verde | 🛡️ Shield | "Valabilă până la 15.01.2027 (11 luni)" |
| **Expiră în curând** | ≤ 90 zile | 🟡 Galben | ⚠️ Alert | "Expiră la 20.03.2026 (45 zile)" |
| **Expirată** | < 0 zile | 🔴 Roșu | ⚠️ Alert | "Expirată la 10.11.2025" |

**Badge CSS:**
```css
/* Validă (verde) */
bg-green-100 text-green-800

/* Expiră (galben) */  
bg-yellow-100 text-yellow-800

/* Expirată (roșu) */
bg-red-100 text-red-800
```

---

### **3. EquipmentList - Badge Garanție în Tabel**

**Coloana Status:**
```
┌──────────────────┐
│ Status           │
├──────────────────┤
│ ✅ operational   │ ← Status echipament
│ 🛡️ În garanție  │ ← Badge garanție
├──────────────────┤
│ ⚠️ maintenance   │
│ ⚠️ Garanție 45z  │ ← Expiră în 45 zile
├──────────────────┤
│ ❌ broken        │
│ ❌ Garanție exp. │ ← Expirată
└──────────────────┘
```

**Badge-uri:**
- **În garanție** (albastru) - mai mult de 90 zile
- **Garanție XXz** (galben) - mai puțin de 90 zile (arată zile rămase)
- **Garanție expirată** (roșu) - expirată

**Logica Afișare:**
```javascript
const getWarrantyInfo = (equipment) => {
  // NU afișează badge dacă lipsesc date
  if (!equipment.warranty_months || !equipment.purchase_date) {
    return null
  }

  // Calculează starea
  const purchaseDate = new Date(equipment.purchase_date)
  const expiryDate = new Date(purchaseDate)
  expiryDate.setMonth(expiryDate.getMonth() + equipment.warranty_months)
  
  const isExpired = expiryDate < new Date()
  const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24))
  
  return {
    status: isExpired ? 'expired' : daysLeft <= 90 ? 'expiring' : 'valid'
  }
}
```

---

## 📋 Exemplu Flow Complet

### **Scenario 1: Echipament Nou cu Garanție**

```
1. Admin deschide: /equipment/new

2. Completează:
   - Name: "Laptop Dell Latitude 5420"
   - Data Achiziție: 15.01.2024
   - Garanție: 24 luni

3. Preview automat:
   "🛡️ Garanția expiră: 15 ianuarie 2026 (345 zile rămase)"

4. Submit → Save

5. În listă:
   ✅ operational
   🛡️ În garanție

6. În detalii:
   🛡️ Garanție
   24 luni
   ✅ Valabilă până la 15 ianuarie 2026 (11 luni)
```

---

### **Scenario 2: Garanție Expiră în Curând**

```
Echipament: "Imprimantă HP LaserJet"
Data Achiziție: 01.11.2024
Garanție: 12 luni
Data expirare: 01.11.2025
Astăzi: 09.01.2026

Status: EXPIRATĂ (cu 69 zile în urmă)

În listă:
   ⚠️ maintenance
   ❌ Garanție expirată

În detalii:
   🛡️ Garanție
   12 luni
   ❌ Expirată la 1 noiembrie 2025
```

---

### **Scenario 3: Garanție 90 Zile**

```
Echipament: "Server Dell PowerEdge"
Data Achiziție: 15.10.2025
Garanție: 12 luni
Data expirare: 15.10.2026
Astăzi: 09.01.2026

Zile rămase: 279 zile

Status: VALIDĂ (> 90 zile)

În listă:
   ✅ operational
   🛡️ În garanție

În detalii:
   🛡️ Garanție
   12 luni
   ✅ Valabilă până la 15 octombrie 2026 (9 luni)
```

---

### **Scenario 4: Garanție 45 Zile**

```
Echipament: "Monitor Samsung"
Data Achiziție: 24.11.2024
Garanție: 12 luni
Data expirare: 24.11.2025
Astăzi: 09.01.2026

Zile rămase: 45 zile (< 90)

Status: EXPIRĂ ÎN CURÂND

În listă:
   ✅ operational
   ⚠️ Garanție 45z

În detalii:
   🛡️ Garanție
   12 luni
   ⚠️ Expiră la 24 noiembrie 2025 (45 zile)
```

---

## 🎨 Design & UI

### **Form Input (EquipmentForm):**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Data Achiziție */}
  <div>
    <label>Data Achiziție</label>
    <input type="date" name="purchase_date" />
  </div>

  {/* Garanție */}
  <div>
    <label>Garanție (luni)</label>
    <input 
      type="number" 
      name="warranty_months"
      min="0"
      step="1"
      placeholder="ex: 12, 24, 36"
    />
    <p className="text-xs text-gray-500">
      Număr de luni (ex: 12 luni = 1 an)
    </p>
  </div>
</div>

{/* Preview Box - doar dacă AMBELE sunt completate */}
{formData.purchase_date && formData.warranty_months && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <p className="text-sm text-blue-800">
      🛡️ Garanția expiră: 15 ianuarie 2027 (345 zile rămase)
    </p>
  </div>
)}
```

---

### **Detail View (EquipmentDetail):**
```jsx
{equipment.warranty_months && equipment.purchase_date && (
  <div>
    <label>🛡️ Garanție</label>
    
    <p>24 luni</p>
    
    {/* Badge dinamic */}
    <div className="bg-green-100 text-green-800 rounded-full px-3 py-1">
      ✅ Valabilă până la 15 ianuarie 2027 (11 luni)
    </div>
  </div>
)}
```

---

### **List View (EquipmentList):**
```jsx
<td>
  <div className="flex flex-col gap-1">
    {/* Status echipament */}
    <span className="bg-green-100 text-green-800">
      operational
    </span>
    
    {/* Badge garanție */}
    {warrantyInfo && (
      <span className="bg-blue-100 text-blue-800">
        În garanție
      </span>
    )}
  </div>
</td>
```

---

## 📦 Instalare & Deployment

### **1. Rulează Migration SQL:**
```bash
# Conectează-te la Supabase Dashboard
# SQL Editor → Run:

ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS warranty_months INTEGER;

COMMENT ON COLUMN equipment.warranty_months IS 
'Warranty period in months (e.g., 12 for 1 year, 24 for 2 years)';
```

### **2. Deploy Cod:**
```bash
# Copiază fișierele:
cp EquipmentForm.jsx src/pages/
cp EquipmentDetail.jsx src/pages/
cp EquipmentList.jsx src/pages/

# Commit:
git add src/pages/Equipment*.jsx
git commit -m "Add warranty management for equipment"
git push

# Clear cache:
Ctrl + Shift + R
```

---

## ✅ Testing Checklist

### **Test 1: Echipament Nou cu Garanție**
- [ ] Deschide /equipment/new
- [ ] Completează Data Achiziție: 15.01.2024
- [ ] Completează Garanție: 24 luni
- [ ] ✅ Preview box apare: "Garanția expiră: 15 ianuarie 2026 (X zile)"
- [ ] Submit → Save
- [ ] Badge "În garanție" apare în listă
- [ ] Detalii echipament: badge verde "Valabilă până la..."

### **Test 2: Echipament Fără Garanție**
- [ ] Creează echipament fără warranty_months
- [ ] ✅ Badge garanție NU apare în listă
- [ ] ✅ Card garanție NU apare în detalii
- [ ] Layout normal

### **Test 3: Edit Echipament Existent**
- [ ] Edit echipament vechi (fără warranty)
- [ ] Adaugă Data Achiziție + Garanție
- [ ] ✅ Preview apare
- [ ] Save
- [ ] Badge apare în listă

### **Test 4: Garanție Expirată**
- [ ] Echipament cu data achiziție veche (2023)
- [ ] Garanție: 12 luni
- [ ] ✅ Badge roșu "Garanție expirată" în listă
- [ ] ✅ Badge roșu "Expirată la..." în detalii

### **Test 5: Garanție Expiră în Curând**
- [ ] Echipament cu data achiziție = acum - 10 luni
- [ ] Garanție: 12 luni
- [ ] ✅ Badge galben "Garanție XXz" în listă (< 90 zile)
- [ ] ✅ Badge galben "Expiră la... (XX zile)" în detalii

### **Test 6: Calcul Corect Date**
- [ ] Data Achiziție: 31.01.2024
- [ ] Garanție: 12 luni
- [ ] ✅ Expirare: 31.01.2025 (sau 28.02.2025 pentru luni fără 31 zile)
- [ ] Data Achiziție: 15.01.2024
- [ ] Garanție: 24 luni
- [ ] ✅ Expirare: 15.01.2026

---

## 💡 Best Practices

### **Pentru Admini:**
1. **Completează întotdeauna Data Achiziție** pentru echipamente noi
2. **Verifică garanția** cu documentele furnizorului
3. **Review periodic** echipamente cu garanție aproape expirată
4. **Filtrează** în listă după garanție pentru planificare

### **Perioade Comune Garanție:**
- **12 luni** = 1 an (standard majoritatea echipamentelor)
- **24 luni** = 2 ani (electronice, calculatoare)
- **36 luni** = 3 ani (servere, echipamente profesionale)
- **60 luni** = 5 ani (echipamente industriale)

### **Gestionare Garanții:**
- **90 zile înainte** de expirare: Verifică starea echipamentului
- **30 zile înainte**: Contactează furnizorul pentru extensie (dacă e nevoie)
- **La expirare**: Decide: (a) Extensie garanție, (b) Asigurare mentenanță, (c) Buget reparații

---

## 🎯 Use Cases Reale

### **Use Case 1: Planificare Buget**
```
Manager: "Care echipamente ies din garanție anul acesta?"

Filtrează: warranty_months IS NOT NULL
Sortează: după data expirare
Vizualizează: badge-uri galbene și roșii

Rezultat: 15 echipamente expiră în Q1 2026
→ Planifică buget reparații sau extensii
```

### **Use Case 2: Defecțiune Echipament**
```
Tehnician: "Laptop-ul X s-a defectat"

Verifică: Equipment Detail
Garanție: ✅ Valabilă până la 15.06.2026 (5 luni)

Acțiune: Contactează furnizor pentru RMA
→ Economie: €500 cost reparație
```

### **Use Case 3: Audit Echipamente**
```
CFO: "Câte echipamente avem în garanție?"

Query echipamente:
- În garanție: 45 (albastru)
- Expiră în curând: 12 (galben)  
- Expirate: 8 (roșu)
- Fără garanție: 35 (fără badge)

Total: 100 echipamente
```

---

## 🚀 Îmbunătățiri Viitoare (Optional)

### **1. Notificări Automate:**
```javascript
// Trigger SQL: 30 zile înainte de expirare
CREATE OR REPLACE FUNCTION notify_warranty_expiring()
RETURNS trigger AS $$
BEGIN
  -- Send email când garanție < 30 zile
END;
$$ LANGUAGE plpgsql;
```

### **2. Dashboard Widget:**
```jsx
<WarrantyDashboard>
  <Stat label="În garanție" value={45} color="green" />
  <Stat label="Expiră în 90 zile" value={12} color="yellow" />
  <Stat label="Expirate" value={8} color="red" />
</WarrantyDashboard>
```

### **3. Export Raport:**
```
CSV Export: "Garanții Q1 2026"
- Equipment Name
- Purchase Date
- Warranty Months
- Expiry Date
- Days Left
- Status
```

### **4. Filtru Garanție în Listă:**
```jsx
<Filter>
  <Option value="in_warranty">În garanție</Option>
  <Option value="expiring_soon">Expiră în 90 zile</Option>
  <Option value="expired">Expirate</Option>
</Filter>
```

---

## 🎉 Rezultat Final

✅ **Câmp warranty_months** adăugat la equipment  
✅ **Calcul automat** data expirare în form  
✅ **Preview box** cu info garanție (live)  
✅ **Badge în listă** - status garanție vizibil  
✅ **Card în detalii** - info completă garanție  
✅ **Indicator vizual** - verde/galben/roșu  
✅ **Responsive design** - toate device-urile  
✅ **Opțional** - nu afectează echipamentele existente  

**Acum poți gestiona garanțiile echipamentelor cu calcul automat și alerte vizuale! 🎉**
