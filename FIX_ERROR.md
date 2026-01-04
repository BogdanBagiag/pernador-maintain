# Fix: React Import Error

## Problema
```
Uncaught SyntaxError: The requested module '/node_modules/react/index.js' 
does not provide an export named 'default'
```

## Soluție

### Windows (PowerShell):
```powershell
# 1. Șterge node_modules și lock files
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json -ErrorAction SilentlyContinue

# 2. Reinstalează dependențele
npm install

# 3. Pornește app
npm run dev
```

### Alternative (dacă problema persistă):

#### Opțiunea 1 - Clear cache:
```powershell
npm cache clean --force
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
npm run dev
```

#### Opțiunea 2 - Folosește yarn:
```powershell
npm install -g yarn
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json -ErrorAction SilentlyContinue
yarn install
yarn dev
```

## De ce apare?
- Cache corupt
- Instalare incompletă
- Conflict între versiuni

## După fix
Aplicația ar trebui să pornească normal pe http://localhost:5173
