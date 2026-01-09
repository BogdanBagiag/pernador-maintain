# Fix: Status Count Cards în Work Orders

## 🐛 Problema

După adăugarea filtrului de tip (corrective/preventive/inspection), cardurile de status afișau count-uri incorecte:

**Exemplu:**
```
Filtru Type: "Doar Raportări" (corrective)

Carduri de status:
- All Orders: 6    ← GREȘIT (arată toate, inclusiv preventive)
- Completed: 5     ← GREȘIT (arată toate completed, inclusiv preventive)

Lista work orders:
- Doar 1 work order ← CORECT (doar corrective)
```

**Problema:** Cardurile se calculau pe TOATE work orders-urile, nu doar pe cele filtrate după type.

---

## ✅ Soluția

### **1. Calculare statusCounts pe Type Filter**

**ÎNAINTE:**
```javascript
// Se calculau pe TOATE work orders-urile
const statusCounts = workOrders?.reduce((acc, wo) => {
  acc[wo.status] = (acc[wo.status] || 0) + 1
  return acc
}, {}) || {}
```

**DUPĂ:**
```javascript
// Se calculează DOAR pe work orders-urile care match filtrul de type
const statusCounts = workOrders?.reduce((acc, wo) => {
  if (typeFilter === 'all' || wo.type === typeFilter) {
    acc[wo.status] = (acc[wo.status] || 0) + 1
  }
  return acc
}, {}) || {}
```

### **2. Calculare Total Count pe Type Filter**

**ÎNAINTE:**
```javascript
// Cardul "All Orders" arăta toate work orders-urile
<p className="text-2xl font-bold">{workOrders?.length || 0}</p>
```

**DUPĂ:**
```javascript
// Calculează totalul doar pentru work orders-urile care match filtrul
const totalCount = workOrders?.filter(wo => 
  typeFilter === 'all' || wo.type === typeFilter
).length || 0

// Cardul "All Orders" folosește totalCount
<p className="text-2xl font-bold">{totalCount}</p>
```

---

## 🎯 Rezultat

### **Scenario: Filtru "Doar Raportări" (corrective)**

**Înainte Fix:**
```
┌──────────────┬──────────────┬──────────────┐
│ All: 6       │ Open: 2      │ Completed: 5 │ ← Număra TOATE
└──────────────┴──────────────┴──────────────┘

Lista work orders: 1 work order (doar corrective) ← Inconsistent!
```

**După Fix:**
```
┌──────────────┬──────────────┬──────────────┐
│ All: 1       │ Open: 1      │ Completed: 0 │ ← Numără doar corrective
└──────────────┴──────────────┴──────────────┘

Lista work orders: 1 work order (doar corrective) ✅ Consistent!
```

### **Scenario: Filtru "Toate Tipurile"**

```
┌──────────────┬──────────────┬──────────────┐
│ All: 6       │ Open: 2      │ Completed: 5 │
└──────────────┴──────────────┴──────────────┘

Lista work orders: 6 work orders (toate tipurile) ✅
```

---

## 📊 Exemple Concrete

### **Exemplu 1: Database cu 6 Work Orders**

```
Database:
1. Raportare (corrective) - open
2. Mentenanță (preventive) - completed
3. Mentenanță (preventive) - completed
4. Raportare (corrective) - completed  
5. Mentenanță (preventive) - completed
6. Mentenanță (preventive) - completed
```

**Cu filtru "Doar Raportări":**
```
Carduri (după fix):
- All Orders: 2        ✅ (doar corrective)
- Open: 1              ✅ (corrective open)
- Completed: 1         ✅ (corrective completed)

Lista: 2 work orders   ✅
```

**Cu filtru "Toate Tipurile":**
```
Carduri (după fix):
- All Orders: 6        ✅ (toate)
- Open: 1              ✅ (1 open total)
- Completed: 5         ✅ (5 completed total)

Lista: 6 work orders   ✅
```

---

## 🔄 Comportament Dinamic

Când schimbi filtrul de type, cardurile se actualizează automat:

```
Type Filter: "Doar Raportări"
→ Carduri arată count-uri pentru corrective
→ Lista arată work orders corrective

Type Filter: "Doar Mentenanță Preventivă"
→ Carduri arată count-uri pentru preventive
→ Lista arată work orders preventive

Type Filter: "Toate Tipurile"
→ Carduri arată count-uri pentru toate
→ Lista arată toate work orders
```

---

## ✅ Testing

### **Test 1: Doar Raportări (corrective)**
```
1. Type Filter = "Doar Raportări"
2. Verifică cardurile:
   - All Orders = număr de corrective
   - Open = număr de corrective cu status open
   - Completed = număr de corrective cu status completed
3. Verifică lista = același număr ca "All Orders"
```

### **Test 2: Doar Mentenanță (preventive)**
```
1. Type Filter = "Doar Mentenanță Preventivă"
2. Verifică cardurile:
   - All Orders = număr de preventive
   - Open = număr de preventive cu status open
   - Completed = număr de preventive cu status completed
3. Verifică lista = același număr ca "All Orders"
```

### **Test 3: Toate Tipurile**
```
1. Type Filter = "Toate Tipurile"
2. Verifică cardurile:
   - All Orders = total work orders
   - Cardurile status = toate tipurile
3. Verifică lista = același număr ca "All Orders"
```

---

## 📦 Modificări în Cod

### **WorkOrderList.jsx**

```javascript
// Adăugat calculul totalCount
const totalCount = workOrders?.filter(wo => 
  typeFilter === 'all' || wo.type === typeFilter
).length || 0

// Modificat statusCounts să filtreze după type
const statusCounts = workOrders?.reduce((acc, wo) => {
  if (typeFilter === 'all' || wo.type === typeFilter) {
    acc[wo.status] = (acc[wo.status] || 0) + 1
  }
  return acc
}, {}) || {}

// Cardul "All Orders" folosește totalCount
<p className="text-2xl font-bold">{totalCount}</p>
```

---

## 🎯 Rezultat Final

✅ **Cardurile de status sunt sincronizate cu lista**  
✅ **Count-urile sunt corecte pentru fiecare filtru de type**  
✅ **Totalul "All Orders" reflectă numărul real din listă**  
✅ **Comportament consistent și intuitiv**  

**Fix-ul este complet și funcțional! 🎉**
