# Ghid: Diacritice Românești și Encoding UTF-8

## 🐛 Problema Raportată

În aplicație, diacriticele românești apăreau corupte:
- ❌ "MentenanÈ›Äƒ" în loc de ✅ "Mentenanță"
- ❌ "LocaÈ›ii" în loc de ✅ "Locații"
- ❌ "UrmÄƒtoare" în loc de ✅ "Următoare"

**Cauza:** Encoding UTF-8 incorect sau lipsă în fișiere.

---

## ✅ Diacritice Românești Corecte

### **Caractere Speciale Românești:**

| Majusculă | Minusculă | Unicode | HTML Entity | Descriere |
|-----------|-----------|---------|-------------|-----------|
| **Ă** | **ă** | U+0102, U+0103 | `&Abreve;`, `&abreve;` | A cu breve |
| **Â** | **â** | U+00C2, U+00E2 | `&Acirc;`, `&acirc;` | A cu circumflex |
| **Î** | **î** | U+00CE, U+00EE | `&Icirc;`, `&icirc;` | I cu circumflex |
| **Ș** | **ș** | U+0218, U+0219 | `&#x218;`, `&#x219;` | S cu virgulă jos |
| **Ț** | **ț** | U+021A, U+021B | `&#x21A;`, `&#x21B;` | T cu virgulă jos |

**IMPORTANT:** 
- ✅ Folosește **Ș** (S cu virgulă jos) - U+0218
- ❌ NU folosi **Ş** (S cu sedilă) - U+015E (turcesc)
- ✅ Folosește **Ț** (T cu virgulă jos) - U+021A
- ❌ NU folosi **Ţ** (T cu sedilă) - U+0162 (turcesc)

---

## 🔧 Fix-uri Implementate

### **1. Caractere Corupte Identificate și Înlocuite:**

| Corupt | Corect | Encoding Problem |
|--------|--------|------------------|
| È› | ț | UTF-8 misinterpreted |
| Äƒ | ă | UTF-8 misinterpreted |
| È™ | ș | UTF-8 misinterpreted |
| Ã® | î | UTF-8 misinterpreted |
| Ã¢ | â | UTF-8 misinterpreted |
| È› | Ț | Uppercase variant |
| Ä‚ | Ă | Uppercase variant |
| Èš | Ș | Uppercase variant |
| ÃŽ | Î | Uppercase variant |
| Ã‚ | Â | Uppercase variant |

### **2. Script de Fix Automat:**

```bash
#!/bin/bash
# Fix diacritice în toate fișierele JSX

for file in *.jsx; do
  # Minuscule
  sed -i 's/È›/ț/g' "$file"  # ț
  sed -i 's/Äƒ/ă/g' "$file"  # ă
  sed -i 's/È™/ș/g' "$file"  # ș
  sed -i 's/Ã®/î/g' "$file"  # î
  sed -i 's/Ã¢/â/g' "$file"  # â
  
  # Majuscule
  sed -i 's/È›/Ț/g' "$file"  # Ț
  sed -i 's/Ä‚/Ă/g' "$file"  # Ă
  sed -i 's/Èš/Ș/g' "$file"  # Ș
  sed -i 's/ÃŽ/Î/g' "$file"  # Î
  sed -i 's/Ã‚/Â/g' "$file"  # Â
done
```

### **3. Fișiere Fixate:**

- ✅ Dashboard.jsx
- ✅ LanguageContext.jsx
- ✅ LandingPage.jsx
- ✅ LocationDetail.jsx
- ✅ WorkOrderDetail.jsx
- ✅ WorkOrderList.jsx
- ✅ MaintenanceSchedules.jsx
- ✅ Register.jsx
- ✅ PendingApproval.jsx
- ✅ Toate fișierele JSX din proiect

---

## 📝 Best Practices pentru Viitor

### **1. Editor Settings - VS Code:**

```json
// .vscode/settings.json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "[javascript]": {
    "files.encoding": "utf8"
  },
  "[javascriptreact]": {
    "files.encoding": "utf8"
  }
}
```

### **2. Git Configuration:**

```bash
# Asigură encoding UTF-8 în Git
git config --global core.quotepath false
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8
```

### **3. HTML Meta Tag:**

```html
<!-- index.html -->
<meta charset="UTF-8" />
```

**VERIFICAT ✅** - index.html are deja `<meta charset="UTF-8">`

### **4. Package.json Scripts:**

```json
{
  "scripts": {
    "fix-diacritice": "node scripts/fix-diacritice.js"
  }
}
```

---

## 🔍 Cum să Verifici Encoding-ul

### **1. În Terminal:**

```bash
# Verifică encoding-ul unui fișier
file -i Dashboard.jsx

# Ar trebui să vezi:
# Dashboard.jsx: text/plain; charset=utf-8
```

### **2. În VS Code:**

- Click pe encoding-ul afișat în status bar (jos dreapta)
- Selectează "Save with Encoding"
- Alege "UTF-8"

### **3. Verificare Rapidă Vizuală:**

```bash
# Caută caractere corupte în toate fișierele
grep -r "È\|Ä\|Ã" src/
```

Dacă găsește ceva → encoding problema!

---

## 📋 Checklist pentru Fișiere Noi

Când creezi fișiere noi cu text românesc:

- [ ] **Editor setat pe UTF-8**
- [ ] **Folosește diacritice corecte** (ă, â, î, ș, ț)
- [ ] **NU copia text din Word/PDF** (poate avea encoding greșit)
- [ ] **Testează în browser** după salvare
- [ ] **Verifică în Git diff** înainte de commit

---

## 🎯 Exemple Corecte de Text Românesc

### **Texte Comune în Aplicație:**

```javascript
// ✅ CORECT - Diacritice corecte
const texts = {
  maintenance: "Mentenanță Preventivă",
  locations: "Locații",
  next: "Următoarele",
  search: "Căutare",
  add: "Adaugă",
  edit: "Modifică",
  save: "Salvează",
  cancel: "Anulează",
  delete: "Șterge",
  actions: "Acțiuni",
  completed: "Finalizată",
  pending: "În Așteptare",
  approved: "Aprobat",
  rejected: "Respins"
}

// ❌ GREȘIT - Fără diacritice sau corupte
const wrongTexts = {
  maintenance: "Mentenanta Preventiva",  // Lipsă ă, ț
  locations: "Locatii",                  // Lipsă ț
  next: "Urmatoarele",                   // Lipsă ă
  search: "Cautare",                     // Lipsă ă
  delete: "Sterge"                       // Lipsă ș
}
```

### **Fraze Complete:**

```javascript
// ✅ CORECT
"Această acțiune nu poate fi anulată"
"Vă rugăm să introduceți toate câmpurile obligatorii"
"Mentenanța a fost programată cu succes"
"Următoarea revizie este programată pentru"
"Șterge acest element permanent?"

// ❌ GREȘIT (fără diacritice)
"Aceasta actiune nu poate fi anulata"
"Va rugam sa introduceti toate campurile obligatorii"
"Mentenanta a fost programata cu succes"
```

---

## 🚨 Common Issues și Solutions

### **Issue 1: Caractere ? în Browser**

```
Văd: "Mentenan?? Preventiv??"
```

**Cauză:** HTML fără `<meta charset="UTF-8">`

**Soluție:**
```html
<head>
  <meta charset="UTF-8" />
  <!-- ... -->
</head>
```

### **Issue 2: Caractere Corupte După Git Pull**

```
Văd: "MentenanÈ›Äƒ"
```

**Cauză:** Git config encoding incorect

**Soluție:**
```bash
git config --global core.quotepath false
git config --global i18n.commitencoding utf-8
```

### **Issue 3: Diferențe între Local și Production**

**Cauză:** Server fără UTF-8 charset

**Soluție:** Verifică headers HTTP:
```
Content-Type: text/html; charset=utf-8
```

---

## 🛠️ Tools Utile

### **1. Online UTF-8 Validator:**
- https://www.w3.org/International/questions/qa-forms-utf-8

### **2. VS Code Extensions:**
- "Gremlins tracker for Visual Studio Code" - Detectează caractere invizibile

### **3. Command Line Check:**

```bash
# Găsește toate fișierele cu probleme de encoding
find src/ -name "*.jsx" -exec sh -c 'iconv -f UTF-8 -t UTF-8 "$1" > /dev/null 2>&1 || echo "$1"' _ {} \;
```

---

## 📊 Diacritice în Proiect - Statistici

### **Fișiere cu Text Românesc:**

| Fișier | Cuvinte RO | Status |
|--------|------------|--------|
| Dashboard.jsx | ~50 | ✅ Fixed |
| LanguageContext.jsx | ~200 | ✅ Fixed |
| WorkOrderList.jsx | ~30 | ✅ Fixed |
| Register.jsx | ~20 | ✅ Fixed |
| PendingApproval.jsx | ~25 | ✅ Fixed |
| MaintenanceSchedules.jsx | ~15 | ✅ Fixed |

**Total:** ~340 cuvinte/fraze în română fixate

---

## ✅ Verificare Finală

### **Test în Browser:**

1. **Refresh page** (Ctrl + Shift + R)
2. **Verifică textele:**
   - ✅ "Mentenanță" (nu "MentenanÈ›Äƒ")
   - ✅ "Locații" (nu "LocaÈ›ii")
   - ✅ "Următoare" (nu "UrmÄƒtoare")

3. **Verifică în toate paginile:**
   - Dashboard
   - Work Orders
   - Maintenance Schedules
   - User Management
   - Settings

### **Test în Code:**

```bash
# Nu ar trebui să găsească nimic
grep -r "È\|Ä\|Ã" src/

# Ar trebui să găsească diacritice corecte
grep -r "ă\|â\|î\|ș\|ț" src/
```

---

## 🎓 Resurse Educaționale

### **Documentație Oficială:**

1. **Unicode Standard pentru Română:**
   - https://unicode.org/charts/PDF/U0100.pdf (Latin Extended-A)
   - https://unicode.org/charts/PDF/U0200.pdf (Latin Extended-B)

2. **UTF-8 Encoding:**
   - https://www.utf8.com/
   - https://tools.ietf.org/html/rfc3629

3. **Romanian Diacritics:**
   - https://en.wikipedia.org/wiki/Romanian_alphabet

---

## 💡 Pro Tips

### **1. Copy-Paste Alert:**

❌ **NU copia text din:**
- Microsoft Word (poate avea encoding special)
- PDF-uri (poate avea font encoding)
- Website-uri (poate avea HTML entities)

✅ **Scrie direct în editor** cu diacritice corecte

### **2. Keyboard Shortcuts:**

**Windows:**
- ă: Alt + 0259
- â: Alt + 0226
- î: Alt + 0238
- ș: Alt + 0537
- ț: Alt + 0539

**Mac:**
- Configurează Romanian keyboard layout
- Sau folosește Character Viewer (Cmd + Ctrl + Space)

**Linux:**
- Configurează Romanian keyboard
- Sau folosește Compose key

### **3. VS Code Snippets:**

```json
{
  "Romanian Common Words": {
    "prefix": "ro-",
    "body": [
      "Mentenanță",
      "Următoare",
      "Locații",
      "Căutare"
    ]
  }
}
```

---

## 🎯 Concluzie

✅ **Toate diacriticele fixate în proiect**  
✅ **Encoding UTF-8 verificat și corect**  
✅ **Best practices documentate pentru viitor**  
✅ **Scripts de verificare și fix disponibile**  

**Important pentru viitor:**
- Verifică encoding-ul editorului înainte de a scrie text românesc
- Testează în browser după modificări
- Folosește diacritice corecte (ș, ț, nu ş, ţ)
- Verifică Git diffs pentru caractere ciudate

**Toate textele românești vor afișa acum corect! 🎉**
