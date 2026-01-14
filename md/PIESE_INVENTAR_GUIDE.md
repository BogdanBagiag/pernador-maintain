# ✅ Piese din Inventar în EquipmentDetail - Setup Guide

## 📋 Ce Am Adăugat:

### **1. Query pentru Compatible Parts**
```javascript
// Fetch compatible parts from inventory
const { data: compatibleParts } = useQuery({
  queryKey: ['equipment-compatible-parts', id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('inventory_parts')
      .select('*')
      .eq('is_active', true)
    
    if (error) throw error
    
    // Filter parts that have this equipment in compatible_equipment array
    return data?.filter(part => 
      part.compatible_equipment && 
      part.compatible_equipment.includes(id)
    ) || []
  },
})
```

**Ce Face:**
- Preia toate piesele active din `inventory_parts`
- Filtrează doar piesele care au echipamentul curent în câmpul `compatible_equipment`
- Returnează array de piese compatibile

---

### **2. Secțiune UI "Piese din Inventar"**

**Poziție:** După secțiunea "Recent Work Orders", înainte de sidebar-ul QR Code

**Caracteristici:**
- ✅ **Se afișează DOAR dacă există piese compatibile** (`compatibleParts.length > 0`)
- ✅ **Responsive design** - se adaptează pe mobile/tablet/desktop
- ✅ **Link către inventar** - "Vezi Inventar" → `/parts-inventory`
- ✅ **Indicator stoc scăzut** - badge galben când `quantity_in_stock <= min_quantity`
- ✅ **Informații complete:**
  - Nume piesă
  - Part number (cod piesă)
  - Stoc curent + unitate de măsură
  - Preț unitar

**Preview UI:**
```
╔══════════════════════════════════════════════════╗
║ 📦 Piese din Inventar          Vezi Inventar >   ║
╠══════════════════════════════════════════════════╣
║ Filtru Ulei Motor 15W40                          ║
║ P/N: FO-15W40-001                                ║
║ Stoc: 15 buc    12.50 RON/buc                    ║
╠══════════════════════════════════════════════════╣
║ Garnituri Cap Motor                [Stoc Scăzut] ║
║ P/N: GAS-001                                      ║
║ Stoc: 2 set     45.00 RON/set                    ║
╚══════════════════════════════════════════════════╝
```

---

## 🚀 Cum Funcționează:

### **1. Adăugare Piese Compatibile (în Parts Inventory)**

Când creezi/editezi o piesă în inventar:

```javascript
// În PartForm sau EditPart
compatible_equipment: [
  'equipment-id-1',
  'equipment-id-2',
  'equipment-id-3'
]
```

**Exemplu:**
- Ai un compresor cu ID: `abc123`
- Creezi o piesă "Filtru Aer" și selectezi compresorul ca echipament compatibil
- Piesa va avea: `compatible_equipment: ['abc123']`

---

### **2. Vizualizare pe Equipment Detail**

Când accesezi pagina echipamentului (`/equipment/abc123`):

**Dacă există piese compatibile:**
```javascript
compatibleParts = [
  {
    id: 'part-1',
    name: 'Filtru Aer',
    part_number: 'FA-001',
    quantity_in_stock: 10,
    min_quantity: 5,
    unit_of_measure: 'buc',
    unit_price: 25.00
  }
]
```

→ Se afișează secțiunea "Piese din Inventar" ✅

**Dacă NU există piese compatibile:**
```javascript
compatibleParts = []
```

→ Secțiunea NU se afișează (nu ocupă spațiu) ❌

---

## 📊 Exemple de Utilizare:

### **Exemplu 1: Compresor Industrial**

**Echipament:**
- Nume: Compresor Atlas Copco GA15
- ID: `comp-001`

**Piese Compatibile în Inventar:**
1. Filtru Ulei → `compatible_equipment: ['comp-001']`
2. Filtru Aer → `compatible_equipment: ['comp-001']`
3. Separator Ulei → `compatible_equipment: ['comp-001']`

**Rezultat:** Pe pagina compresorului vor apărea cele 3 piese! ✅

---

### **Exemplu 2: Cântar Electronic**

**Echipament:**
- Nume: Cântar Precisie 500kg
- ID: `scale-001`

**Piese Compatibile în Inventar:**
- (NICIUNA încă)

**Rezultat:** Secțiunea "Piese din Inventar" NU apare pe pagină. ❌

---

## 🎯 Beneficii:

1. **Vizibilitate Rapidă:**
   - Tehnicienii văd IMEDIAT ce piese sunt disponibile pentru echipament
   - Nu mai trebuie să caute în inventar

2. **Alertă Stoc Scăzut:**
   - Badge galben când stocul e sub minimul stabilit
   - Previne situații când lipsesc piese pentru intervenții

3. **Informații Complete:**
   - Part number pentru identificare precisă
   - Preț unitar pentru estimări costuri
   - Stoc actual pentru planificare

4. **Link Direct:**
   - "Vezi Inventar" → acces rapid la pagina de inventar
   - Pentru comenzi noi sau detalii suplimentare

---

## 🔧 Troubleshooting:

### **Problema: Nu apar piese deși le-am adăugat**

**Check 1: Verifică compatible_equipment în DB**
```sql
SELECT id, name, compatible_equipment 
FROM inventory_parts 
WHERE 'EQUIPMENT_ID' = ANY(compatible_equipment);
```

**Check 2: Verifică is_active**
```sql
SELECT id, name, is_active 
FROM inventory_parts 
WHERE id = 'PART_ID';
-- is_active trebuie să fie TRUE
```

**Check 3: Cache React Query**
```javascript
// În console browser:
queryClient.invalidateQueries(['equipment-compatible-parts'])
```

---

### **Problema: Badge "Stoc Scăzut" nu apare corect**

**Verifică min_quantity:**
```sql
SELECT 
  name,
  quantity_in_stock,
  min_quantity,
  (quantity_in_stock <= min_quantity) as should_show_badge
FROM inventory_parts
WHERE id = 'PART_ID';
```

Badge-ul apare când: `quantity_in_stock <= min_quantity`

---

## ✅ Checklist Final:

- [ ] Fișier `EquipmentDetail-Updated.jsx` înlocuit în `src/pages/`
- [ ] Import icon `Package` verificat
- [ ] Query `compatibleParts` adăugat
- [ ] Secțiune UI "Piese din Inventar" adăugată
- [ ] Aplicația restarted (npm run dev)
- [ ] Test: creat piesă compatibilă cu echipament
- [ ] Test: verificat că apare pe pagina echipamentului
- [ ] Test: verificat badge "Stoc Scăzut"
- [ ] Test: verificat responsive design (mobile/desktop)

---

## 📱 Responsive Design:

Secțiunea se adaptează perfect pe toate device-urile:

**Mobile (< 640px):**
- Font sizes mai mici
- Badge-uri compacte
- Informații stivuite vertical

**Tablet (640px - 1024px):**
- Font sizes medii
- Layout semi-compact

**Desktop (> 1024px):**
- Font sizes normale
- Layout complet extins
- Toate informațiile vizibile simultan

---

**Succes!** 🚀

Dacă ai întrebări sau probleme, verifică troubleshooting guide mai sus.
