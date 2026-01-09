# Equipment Attachments - Documente Atașate ✅

## 🎯 Funcționalitate Implementată

Sistem complet pentru atașarea și gestionarea documentelor la echipamente:
- **Upload fișiere** cu limită de 2MB per fișier
- **Tipuri documente** predefinite (Factură, Garanție, Manual, Certificat, Altele)
- **Download** și **delete** fișiere
- **Istoric complet** cu cine a încărcat și când
- **Validare** size și tip fișier

---

## 📊 Database Schema

### **Tabel Nou: equipment_attachments**

```sql
CREATE TABLE equipment_attachments (
  id UUID PRIMARY KEY,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT, -- MIME type
  file_size INTEGER, -- bytes
  document_type TEXT CHECK (document_type IN ('invoice', 'warranty', 'manual', 'certificate', 'other')),
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Câmpuri:**
- `equipment_id` - Link la echipament (CASCADE delete)
- `file_url` - URL public Supabase Storage
- `file_name` - Nume original fișier
- `file_type` - MIME type (application/pdf, image/jpeg, etc.)
- `file_size` - Size în bytes (max 2097152 = 2MB)
- `document_type` - Tip: invoice, warranty, manual, certificate, other
- `uploaded_by` - Cine a încărcat
- `created_at` - Când a fost încărcat

**RLS Policies:**
- ✅ **SELECT:** Toată lumea poate vedea attachments
- ✅ **INSERT:** Doar authenticated users
- ✅ **DELETE:** Doar uploader-ul sau admin

---

## 🗂️ Tipuri Documente

| Tip | Label Română | Use Case |
|-----|-------------|----------|
| **invoice** | Factură | Factură achiziție echipament |
| **warranty** | Garanție | Document garanție de la furnizor |
| **manual** | Manual | Manual utilizare/instalare |
| **certificate** | Certificat | Certificat calibrare, conformitate |
| **other** | Altele | Alte documente (scheme, planuri, etc.) |

---

## 🔧 Funcționalități UI

### **1. Upload Form**

**Locație:** EquipmentDetail → secțiunea "Documente Atașate"

**Câmpuri:**
```
┌─────────────────────────────────────────┐
│ 📤 Încarcă Document Nou                 │
├─────────────────────────────────────────┤
│ Tip Document:        Fișier (max 2MB):  │
│ [Factură ▼]         [Alege fișier...]   │
└─────────────────────────────────────────┘
```

**Validare:**
- ✅ Max 2MB (2,097,152 bytes)
- ✅ Tipuri permise: PDF, DOC, DOCX, JPG, JPEG, PNG, GIF, XLS, XLSX
- ⚠️ Mesaj eroare dacă fișier prea mare

**Flow:**
1. Selectează tip document (dropdown)
2. Alege fișier (file input)
3. Preview fișier selectat (nume + size)
4. Click "Încarcă Fișier"
5. Upload → Supabase Storage + DB insert
6. Success → Lista refresh automat

---

### **2. Lista Documente**

**Card pentru fiecare document:**
```
┌──────────────────────────────────────────────┐
│ 📄 factura_echipament_2024.pdf              │
│    [Factură] 1.2 MB  09.01.2026  de Admin  │
│                              [⬇️] [🗑️]       │
└──────────────────────────────────────────────┘
```

**Informații afișate:**
- 📄 Nume fișier (truncat dacă e prea lung)
- 🏷️ Badge tip document (culoare albastră)
- 📊 Size fișier (formatat KB/MB)
- 📅 Data upload
- 👤 Cine a încărcat (numele)
- ⬇️ Buton download
- 🗑️ Buton delete (doar pentru uploader sau admin)

---

### **3. Empty State**

**Când nu există documente:**
```
┌───────────────────────────────────┐
│           📄                      │
│   Nu există documente atașate    │
│   Folosește formularul de mai    │
│   sus pentru a încărca documente │
└───────────────────────────────────┘
```

---

## 💾 Storage Structure

**Supabase Storage Bucket:** `maintenance-files`

**Path Structure:**
```
maintenance-files/
  └── equipment-attachments/
      └── {equipment_id}/
          ├── 1704801234-abc123.pdf
          ├── 1704801567-def456.jpg
          └── 1704802890-ghi789.docx
```

**Naming Convention:**
```
{timestamp}-{random}.{extension}

Exemplu: 1704801234-abc123.pdf
- 1704801234 = Unix timestamp
- abc123 = Random string (6 chars)
- .pdf = Extension original
```

---

## 🔄 Flow Complet Upload

### **Frontend Flow:**
```javascript
1. User selectează tip: "Factură"
2. User alege fișier: "factura_2024.pdf" (1.2MB)
   ↓
3. Validare size:
   - 1.2MB < 2MB ✅
   ↓
4. Preview: "factura_2024.pdf (1.2 MB)"
   ↓
5. User click "Încarcă Fișier"
   ↓
6. Upload la Supabase Storage:
   - Path: equipment-attachments/{id}/1704801234-abc123.pdf
   - Get public URL
   ↓
7. Insert în DB:
   {
     equipment_id: "uuid",
     file_url: "https://...",
     file_name: "factura_2024.pdf",
     file_type: "application/pdf",
     file_size: 1258291,
     document_type: "invoice",
     uploaded_by: "user_uuid"
   }
   ↓
8. Query invalidate → Lista refresh
   ↓
9. Success! Document apare în listă
```

---

### **Backend Flow:**

**Upload Mutation:**
```javascript
uploadMutation.mutate({
  file: selectedFile,
  documentType: 'invoice'
})
```

**Pasii:**
1. **Upload Storage:**
   ```javascript
   const filePath = `equipment-attachments/${id}/${fileName}`
   await supabase.storage
     .from('maintenance-files')
     .upload(filePath, file)
   ```

2. **Get Public URL:**
   ```javascript
   const { publicUrl } = supabase.storage
     .from('maintenance-files')
     .getPublicUrl(filePath)
   ```

3. **Insert DB:**
   ```javascript
   await supabase
     .from('equipment_attachments')
     .insert({
       equipment_id: id,
       file_url: publicUrl,
       file_name: file.name,
       file_type: file.type,
       file_size: file.size,
       document_type: documentType,
       uploaded_by: profile.id
     })
   ```

---

## 🗑️ Flow Delete

**Frontend:**
```javascript
1. User click 🗑️ pe document
   ↓
2. Confirm: "Ștergi factura_2024.pdf?"
   ↓
3. Delete mutation:
   - Delete din Storage
   - Delete din DB
   ↓
4. Query invalidate → Listă refresh
   ↓
5. Document dispare din listă
```

**Backend:**
```javascript
deleteAttachmentMutation.mutate({
  attachmentId: attachment.id,
  fileUrl: attachment.file_url
})

// Extract path din URL
const filePath = urlParts[1].split('?')[0]

// Delete Storage
await supabase.storage
  .from('maintenance-files')
  .remove([filePath])

// Delete DB
await supabase
  .from('equipment_attachments')
  .delete()
  .eq('id', attachmentId)
```

---

## 📋 Use Cases Reale

### **Use Case 1: Upload Factură Achiziție**
```
Admin cumpără laptop nou:
1. Creează echipament: "Dell Latitude 5420"
2. Deschide Equipment Detail
3. Secțiunea "Documente Atașate"
4. Tip: "Factură"
5. Upload: "factura_dell_2024.pdf"
6. ✅ Salvat! Acum poate fi accesat oricând
```

### **Use Case 2: Upload Certificat Garanție**
```
Tehnicianul primește certificat garanție:
1. Deschide echipament
2. Tip: "Garanție"
3. Upload: "garantie_3ani.pdf"
4. ✅ Când echipamentul se defectează → 
      găsește rapid garanția pentru RMA
```

### **Use Case 3: Upload Manual Utilizare**
```
Echipament complex cu manual:
1. Typ: "Manual"
2. Upload: "manual_instalare_ro.pdf"
3. ✅ Tehnicienii pot consulta oricând
```

### **Use Case 4: Multiple Documente**
```
Echipament complet documentat:
- Factură (invoice)
- Garanție (warranty)
- Manual RO (manual)
- Manual EN (manual)
- Certificat calibrare (certificate)
- Schemă instalare (other)

Total: 6 documente, toate accesibile
```

---

## 🎨 Design & UI Details

### **Badge Tipuri Documente:**
```css
/* Toate badge-urile sunt albastru */
bg-blue-100 text-blue-800

/* Exemple: */
[Factură]   [Garanție]   [Manual]   [Certificat]   [Altele]
```

### **File Input Styling:**
```css
/* Custom file input */
file:bg-primary-50 
file:text-primary-700
hover:file:bg-primary-100

/* Tipuri acceptate: */
accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
```

### **Preview Selected File:**
```jsx
{selectedFile && (
  <div className="border rounded-lg p-3">
    📄 {selectedFile.name}
    1.2 MB
    [❌]  // Click to remove
  </div>
)}
```

---

## 📦 Instalare & Deployment

### **Pasul 1: SQL Migration**
```bash
# În Supabase Dashboard → SQL Editor
# Rulează fișierul create_equipment_attachments.sql
```

**SQL:**
```sql
CREATE TABLE equipment_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  document_type TEXT DEFAULT 'other' CHECK (document_type IN ('invoice', 'warranty', 'manual', 'certificate', 'other')),
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS + Policies + Index (vezi fișierul SQL complet)
```

### **Pasul 2: Verifică Storage Bucket**
```bash
# În Supabase Dashboard → Storage
# Bucket: "maintenance-files"
# Policies: Public read, Authenticated write
```

**Dacă bucket nu există:**
```sql
-- Creează bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-files', 'maintenance-files', true);

-- Policy pentru upload
CREATE POLICY "Authenticated can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'maintenance-files' AND auth.role() = 'authenticated');
```

### **Pasul 3: Deploy Cod**
```bash
# Copiază fișierul actualizat:
cp EquipmentDetail.jsx src/pages/

# Commit:
git add src/pages/EquipmentDetail.jsx
git commit -m "Add equipment attachments (invoices, warranties, manuals)"
git push

# Clear cache:
Ctrl + Shift + R
```

---

## ✅ Testing Checklist

### **Test 1: Upload Factură PDF**
- [ ] Deschide equipment detail
- [ ] Selectează tip: "Factură"
- [ ] Alege fișier PDF < 2MB
- [ ] ✅ Preview apare cu nume și size
- [ ] Click "Încarcă Fișier"
- [ ] ✅ Upload success
- [ ] ✅ Document apare în listă cu badge "Factură"
- [ ] ✅ Poate fi downloadat

### **Test 2: Upload Imagine (JPG/PNG)**
- [ ] Selectează tip: "Altele"
- [ ] Alege imagine < 2MB
- [ ] ✅ Upload success
- [ ] ✅ Imagine poate fi deschisă

### **Test 3: Validare 2MB Limit**
- [ ] Alege fișier > 2MB (ex: 3MB)
- [ ] ❌ Eroare: "Fișierul este prea mare. Maxim 2MB."
- [ ] ✅ Nu se uploadează

### **Test 4: Multiple Uploads**
- [ ] Upload factură
- [ ] Upload garanție
- [ ] Upload manual
- [ ] ✅ Toate 3 apar în listă
- [ ] ✅ Badge-uri diferite (Factură, Garanție, Manual)
- [ ] ✅ Sortate descrescător după data upload

### **Test 5: Download Document**
- [ ] Click buton ⬇️ Download
- [ ] ✅ Fișier descărcat
- [ ] ✅ Nume păstrat original

### **Test 6: Delete Document**
- [ ] User care a încărcat → buton 🗑️ vizibil
- [ ] Click delete
- [ ] Confirm: "Ștergi {filename}?"
- [ ] ✅ Document șters din listă
- [ ] ✅ Fișier șters din Storage

### **Test 7: Permissions Delete**
- [ ] User A uploadează document
- [ ] User B (non-admin) deschide equipment
- [ ] ❌ Buton 🗑️ NU apare pentru User B
- [ ] Admin deschide equipment
- [ ] ✅ Buton 🗑️ APARE pentru admin

### **Test 8: Empty State**
- [ ] Echipament fără documente
- [ ] ✅ Message: "Nu există documente atașate"
- [ ] ✅ Icon folder gol
- [ ] ✅ Hint pentru upload

### **Test 9: Formatare File Size**
- [ ] Upload 500 KB → afișat "500 KB"
- [ ] Upload 1.5 MB → afișat "1.5 MB"
- [ ] Upload 100 bytes → afișat "100 B"

### **Test 10: Info Uploader**
- [ ] Document uploadat de "John Doe"
- [ ] ✅ Afișat "de John Doe" în listă
- [ ] ✅ Data corectă (ex: 09.01.2026)

---

## 💡 Best Practices

### **Pentru Admini:**
1. **Organizează documente logic:**
   - Factură → tip "Factură"
   - Garanție → tip "Garanție"
   - Manual → tip "Manual"

2. **Nume fișiere clare:**
   - ✅ "factura_dell_laptop_2024.pdf"
   - ❌ "document.pdf"

3. **Upload tot ce e relevant:**
   - Factură achiziție
   - Certificat garanție
   - Manual utilizare
   - Scheme tehnice
   - Certificat calibrare (dacă e cazul)

4. **Review periodic:**
   - Verifică documente expirate
   - Șterge documente învechite
   - Actualizează manuale la versiuni noi

---

### **Limite și Considerații:**

**File Size:**
- ✅ Max: 2MB per fișier
- ⚠️ Dacă ai nevoie de fișiere mai mari → comprimă sau split

**Tipuri Acceptate:**
- ✅ PDF (recomandat pentru facturi/garanții)
- ✅ DOC/DOCX (documente Word)
- ✅ JPG/PNG (poze factură/certificat)
- ✅ XLS/XLSX (spreadsheets)
- ❌ Executabile (.exe, .bat, etc.)

**Storage:**
- Supabase gratuit: 1GB storage
- Monitoring folosire în Dashboard
- Cleanup periodic documente vechi

---

## 🚀 Îmbunătățiri Viitoare (Optional)

### **1. Preview Inline pentru PDF/Imagini:**
```jsx
{attachment.file_type.includes('pdf') && (
  <button onClick={() => setPreviewModal(attachment.file_url)}>
    👁️ Preview
  </button>
)}
```

### **2. Drag & Drop Upload:**
```jsx
<div
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  className="border-dashed border-2"
>
  Drag & drop fișiere aici
</div>
```

### **3. Bulk Upload:**
```jsx
<input
  type="file"
  multiple
  onChange={handleMultipleFiles}
/>
```

### **4. Versioning Documente:**
```sql
ALTER TABLE equipment_attachments
ADD COLUMN version INTEGER DEFAULT 1;

-- Păstrează versiuni vechi ale aceluiași document
```

### **5. OCR pentru Facturi:**
```javascript
// Extract date achiziție și preț din factură
const extractInvoiceData = async (fileUrl) => {
  // Use OCR API
  return { purchaseDate, amount, supplier }
}
```

---

## 🎉 Rezultat Final

✅ **Upload fișiere** cu limită 2MB  
✅ **5 tipuri documente** predefinite (Factură, Garanție, Manual, etc.)  
✅ **Validare automată** size și tip  
✅ **Lista documentelor** cu info complete  
✅ **Download** cu un click  
✅ **Delete** cu permissions (uploader sau admin)  
✅ **Istoric complet** - cine, când, ce  
✅ **Storage organizat** în Supabase  
✅ **RLS policies** pentru security  
✅ **Empty state** prietenos  
✅ **Responsive design** - mobil + desktop  

**Acum fiecare echipament poate avea toate documentele importante atașate și ușor accesibile! 🎉**
