#!/bin/bash

echo "🗑️  Curățare fișiere nefolosite din pernador-maintain"
echo "================================================"

# Counter pentru fișiere șterse
deleted=0

# Funcție pentru ștergere sigură
safe_delete() {
    if [ -f "$1" ]; then
        rm "$1"
        echo "✅ Șters: $1"
        ((deleted++))
    else
        echo "⚠️  Nu există: $1"
    fi
}

echo ""
echo "📁 Ștergere fișiere backup din src/pages/..."
safe_delete "src/pages/ChecklistTemplates-TRANSLATED.jsx"
safe_delete "src/pages/EquipmentList-OLD.jsx"
safe_delete "src/pages/ReportIssue-backup.jsx"

echo ""
echo "📁 Ștergere fișiere debug din src/components/..."
safe_delete "src/components/QRScanner-mobile-debug.jsx"

echo ""
echo "📁 Ștergere fișiere temporare și debug din root..."
safe_delete ".env2.txt"
safe_delete "DEBUG_MANAGER_ROLE.md"
safe_delete "FINAL_FIX_INSTRUCTIONS.md"
safe_delete "FIX_EDGE_FUNCTION.md"
safe_delete "FIX_ERROR.md"
safe_delete "FIX_PROFILE_LOADING.md"
safe_delete "FIX_ROLE_UPDATE.md"
safe_delete "FIX_SCAN_ROUTE_PUBLIC.md"
safe_delete "GHID_REZOLVARE_LOCATII_PUBLICE.md"
safe_delete "PASUL_4_SI_6.md"
safe_delete "PUSH_NOTIFICATIONS_SETUP.md"
safe_delete "QRScanner-debug.jsx"
safe_delete "Lipsa concedii.txt"
safe_delete "fix-public-location-reports.sql"
safe_delete "fix-trigger-with-anon-key.sql"
safe_delete "push-subscriptions-schema.sql"
safe_delete "verify-work-orders-structure.sql"

echo ""
echo "================================================"
echo "✅ Total fișiere șterse: $deleted"
echo ""
echo "Următorii pași:"
echo "1. git add ."
echo "2. git commit -m \"Cleanup: Remove backup, debug, and temporary files\""
echo "3. git push origin main"
