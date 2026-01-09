# Fix: Separare Work Orders - Raportări vs Mentenanță Preventivă

## 🐛 Problema Raportată

În pagina **Work Orders** apăreau TOATE work orders-urile, inclusiv:
- ✅ Work orders normale (raportări de probleme)
- ❌ Work orders din programul de mentenanță preventivă (nu ar trebui să apară aici)

Utilizatorul voia să vadă **doar raportările de probleme**, nu și task-urile programate din mentenanță.

---

## 📊 Tipuri de Work Orders

În baza de date, work orders au câmpul `type`:

| Type | Descriere | Când se creează |
|------|-----------|-----------------|
| **corrective** | Raportări probleme | Când cineva raportează o problemă |
| **preventive** | Mentenanță preventivă | Când se completează un task din programul de mentenanță |
| **inspection** | Inspecții | Inspecții programate |

**Problema:** Toate tipurile apăreau împreună în lista de Work Orders.

---

## ✅ Soluția Implementată

### **1. Filtru Nou pentru Tip**

Am adăugat un dropdown care permite selectarea tipului de work orders:

```javascript
const [typeFilter, setTypeFilter] = useState('corrective') // Default: doar raportări
```

**Opțiuni în dropdown:**
- 📝 **Doar Raportări** (corrective) - DEFAULT
- 🔧 **Doar Mentenanță Preventivă** (preventive)
- 🔍 **Doar Inspecții** (inspection)
- 📋 **Toate Tipurile** (all)

### **2. Filtrare în Query**

```javascript
const filteredWorkOrders = workOrders?.filter((wo) => {
  const matchesType = typeFilter === 'all' || wo.type === typeFilter
  return matchesSearch && matchesStatus && matchesPriority && matchesType
})
```

### **3. Badge-uri Colorate pentru Tipuri**

Fiecare tip de work order are culoare și iconița specifică:

| Tip | Culoare | Iconița | Label |
|-----|---------|---------|-------|
| corrective | 🔴 Roșu | ⚠️ AlertTriangle | **Raportare** |
| preventive | 🟢 Verde | 📅 Calendar | **Mentenanță** |
| inspection | 🔵 Albastru | 🔍 Search | **Inspecție** |

**Cod implementat:**
```javascript
const getTypeBadge = (type) => {
  switch (type) {
    case 'corrective':
      return 'badge-danger'  // Roșu
    case 'preventive':
      return 'badge-success' // Verde
    case 'inspection':
      return 'badge-info'    // Albastru
  }
}
```

### **4. UI Actualizat**

**Filtrul apare în grid-ul de filtre:**
```
┌─────────────────────────────────────────────────┐
│ [Search...] [Priority▼] [Tip▼ Doar Raportări]  │
└─────────────────────────────────────────────────┘
```

**Badge-urile în carduri:**
```
╔════════════════════════════════════════╗
║ [⚠️ Raportare] [🔴 High] [⏰ Open]    ║
║ Problema AC nu pornește               ║
╚════════════════════════════════════════╝
```

---

## 🎯 Comportament După Fix

### **Scenario 1: Pagina Work Orders (DEFAULT)**
```
User deschide /work-orders
↓
Filtru Type = "Doar Raportări" (corrective)
↓
Se afișează DOAR work orders create manual (raportări probleme)
↓
Work orders din mentenanță preventivă NU apar ✅
```

### **Scenario 2: Vezi Toate Tipurile**
```
User schimbă filtrul la "Toate Tipurile"
↓
Se afișează:
- Raportări (roșu)
- Mentenanță preventivă (verde)
- Inspecții (albastru)
```

### **Scenario 3: Vezi Doar Mentenanță**
```
User schimbă filtrul la "Doar Mentenanță Preventivă"
↓
Se afișează DOAR work orders create din programul de mentenanță
```

---

## 📦 Ce S-a Modificat

### **WorkOrderList.jsx**

#### **a) State nou pentru Type Filter**
```javascript
const [typeFilter, setTypeFilter] = useState('corrective') // Default
```

#### **b) Filtrare actualizată**
```javascript
const matchesType = typeFilter === 'all' || wo.type === typeFilter
```

#### **c) UI nou - Dropdown pentru Type**
```jsx
<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
  <option value="corrective">Doar Raportări</option>
  <option value="preventive">Doar Mentenanță Preventivă</option>
  <option value="inspection">Doar Inspecții</option>
  <option value="all">Toate Tipurile</option>
</select>
```

#### **d) Funcții noi pentru badge-uri**
```javascript
// Culori pentru fiecare tip
const getTypeBadge = (type) => { ... }

// Iconițe pentru fiecare tip
const getTypeIcon = (type) => { ... }

// Label-uri în română
const getTypeLabel = (type) => { ... }
```

#### **e) Badge actualizat în cardul work order**
```jsx
<span className={`badge ${getTypeBadge(wo.type)}`}>
  {getTypeIcon(wo.type)}
  <span>{getTypeLabel(wo.type)}</span>
</span>
```

---

## 🎨 UI Înainte/După

### **ÎNAINTE:**
```
Work Orders (20)
├── Raportare: AC stricat
├── Mentenanță: Verificare AC Unit 1  ❌ Nu ar trebui aici
├── Raportare: Scurgere apă
├── Mentenanță: Schimbare filtru AC 2 ❌ Nu ar trebui aici
└── Raportare: Ușă blocată
```

### **DUPĂ (Default - Doar Raportări):**
```
Work Orders (Doar Raportări) 🔴

Filtru: [Doar Raportări ▼] [All Priority ▼] [Search...]

├── 🔴 Raportare: AC stricat
├── 🔴 Raportare: Scurgere apă
└── 🔴 Raportare: Ușă blocată

✅ Mentenanța preventivă NU mai apare!
```

### **DUPĂ (Toate Tipurile):**
```
Work Orders (Toate) 📋

Filtru: [Toate Tipurile ▼] [All Priority ▼] [Search...]

├── 🔴 Raportare: AC stricat
├── 🟢 Mentenanță: Verificare AC Unit 1
├── 🔴 Raportare: Scurgere apă
├── 🟢 Mentenanță: Schimbare filtru AC 2
└── 🔴 Raportare: Ușă blocată
```

---

## 📊 Statistici & Carduri

Cardurile de status (Open, In Progress, etc.) acum afișează doar work orders-urile din tipul selectat:

**Cu filtru "Doar Raportări":**
```
┌─────────────┬─────────────┬─────────────┐
│ Open: 3     │ In Prog: 2  │ Completed: 5│
└─────────────┴─────────────┴─────────────┘
Doar raportări (corrective)
```

**Cu filtru "Toate Tipurile":**
```
┌─────────────┬─────────────┬─────────────┐
│ Open: 8     │ In Prog: 5  │ Completed: 15│
└─────────────┴─────────────┴─────────────┘
Toate tipurile (corrective + preventive + inspection)
```

---

## 🔄 Cum Funcționează în Practică

### **1. User Raportează Problemă**
```
ReportIssue page → Creează work order cu type='corrective'
↓
Work order apare în lista "Work Orders" (default view) ✅
```

### **2. Completare Task Mentenanță**
```
Maintenance Schedules → Completează task → Creează work order cu type='preventive'
↓
Work order NU apare în lista "Work Orders" (default view) ✅
↓
Dar apare dacă schimbi filtrul la "Mentenanță Preventivă" sau "Toate"
```

### **3. User Vrea să Vadă Tot**
```
Click dropdown Type → Select "Toate Tipurile"
↓
Se afișează toate work orders-urile, indiferent de tip ✅
```

---

## 📦 Instalare

```bash
# Copiază fișierul:
cp WorkOrderList.jsx src/pages/

# Commit & Push:
git add src/pages/WorkOrderList.jsx
git commit -m "Fix: Separate work orders by type - default show only corrective"
git push

# Clear cache:
Ctrl + Shift + R
```

---

## ✅ Testing Checklist

### **Test 1: Default View (Doar Raportări)**
- [ ] Deschide /work-orders
- [ ] Dropdown Type afișează "Doar Raportări"
- [ ] Se afișează DOAR work orders cu type='corrective'
- [ ] Work orders cu type='preventive' NU apar

### **Test 2: Schimbă la Mentenanță Preventivă**
- [ ] Click dropdown Type
- [ ] Select "Doar Mentenanță Preventivă"
- [ ] Se afișează DOAR work orders cu type='preventive'
- [ ] Work orders cu type='corrective' NU apar

### **Test 3: Vezi Toate**
- [ ] Click dropdown Type
- [ ] Select "Toate Tipurile"
- [ ] Se afișează TOATE work orders-urile
- [ ] Badge-urile sunt colorate corect:
  - Raportări = roșu
  - Mentenanță = verde
  - Inspecții = albastru

### **Test 4: Badge-uri Vizuale**
- [ ] Raportări au badge roșu cu ⚠️
- [ ] Mentenanță are badge verde cu 📅
- [ ] Inspecții au badge albastru cu 🔍

### **Test 5: Carduri Status**
- [ ] Cardurile (Open, In Progress, etc.) afișează count-uri corecte
- [ ] Count-urile se actualizează când schimbi filtrul Type

---

## 🎯 Rezultat Final

✅ **Default: Se afișează doar raportările de probleme**  
✅ **Mentenanța preventivă NU mai apare în lista principală**  
✅ **Badge-uri colorate pentru identificare vizuală rapidă**  
✅ **Filtru flexibil pentru a vedea orice tip de work orders**  
✅ **UI curat și intuitiv**  

**Problema rezolvată complet! 🎉**

---

## 💡 Note Suplimentare

### **De Ce Type='corrective' ca Default?**

Pagina "Work Orders" este în principal pentru raportări de probleme și tracking-ul lor. Mentenanța preventivă are propria pagină dedicată "Maintenance Schedules". Prin urmare, are sens ca default view-ul să arate doar work orders-urile corrective (raportări).

### **Unde Să Vezi Mentenanța Preventivă?**

1. **Pagina Maintenance Schedules** - Vezi programul și completează task-uri
2. **Work Orders cu filtru "Mentenanță Preventivă"** - Vezi istoricul completărilor
3. **Work Orders cu filtru "Toate"** - Vezi tot

### **Badge-urile Colorate Ajută La:**

- Identificare rapidă a tipului de work order
- Prioritizare vizuală (roșu = probleme urgente)
- Separare clară între tipuri în view-ul "Toate"
