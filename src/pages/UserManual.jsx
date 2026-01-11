import { useState } from 'react'
import { 
  BookOpen, 
  ChevronDown, 
  ChevronRight,
  User,
  Wrench,
  Shield,
  ClipboardList,
  Calendar,
  QrCode,
  MapPin,
  CheckSquare,
  FileText,
  Settings,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react'

export default function UserManual() {
  const [expandedSections, setExpandedSections] = useState({})
  const [activeRole, setActiveRole] = useState('all') // all, admin, technician, operator

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const roles = [
    { id: 'all', name: 'Toate Rolurile', icon: User },
    { id: 'admin', name: 'Administrator', icon: Shield },
    { id: 'technician', name: 'Tehnician', icon: Wrench },
    { id: 'operator', name: 'Operator', icon: User }
  ]

  const manualSections = [
    {
      id: 'getting-started',
      title: 'Primul Pas - Noțiuni de Bază',
      icon: BookOpen,
      roles: ['all'],
      content: [
        {
          title: 'Ce este Pernador Maintain?',
          text: `Pernador Maintain este un sistem complet de management al mentenanței industriale. 
          Permite gestionarea echipamentelor, crearea ordinelor de lucru, programarea mentenanței preventive 
          și raportarea detaliată a activităților.`
        },
        {
          title: 'Autentificare în Sistem',
          steps: [
            'Accesează aplicația prin browser (Chrome, Firefox, Edge)',
            'Introdu email-ul și parola primite de la administrator',
            'Click pe "Autentificare"',
            'Vei fi redirectat către Dashboard'
          ]
        },
        {
          title: 'Navigare în Aplicație',
          text: `Meniul principal se află în partea stângă și conține toate funcționalitățile disponibile. 
          Click pe orice opțiune pentru a accesa acea secțiune.`,
          tips: [
            'Pe mobil, apasă iconul ☰ din colț pentru a deschide meniul',
            'Dashboard-ul afișează o privire de ansamblu asupra sistemului',
            'Fiecare pagină are un buton "Adaugă" pentru crearea de înregistrări noi'
          ]
        }
      ]
    },
    {
      id: 'dashboard',
      title: 'Dashboard - Tablou de Bord',
      icon: BarChart3,
      roles: ['all'],
      content: [
        {
          title: 'Privire de Ansamblu',
          text: `Dashboard-ul afișează statistici în timp real despre:`,
          items: [
            'Ordine de Lucru active (deschise și finalizate)',
            'Programe de Mentenanță (următoarele 7 zile și întârziate)',
            'Total Echipamente și Locații',
            'Costuri și timpi medii de rezolvare'
          ]
        },
        {
          title: 'Carduri Interactive',
          text: `Click pe orice card pentru a vedea detalii:`,
          examples: [
            'Click "Finalizate" → Vezi lista completă de ordine finalizate',
            'Click "Întârziate" → Vezi programele de mentenanță restante',
            'Graficele afișează distribuția echipamentelor pe status și priorități'
          ]
        }
      ]
    },
    {
      id: 'scan-qr',
      title: 'Scanare Coduri QR',
      icon: QrCode,
      roles: ['technician', 'operator'],
      content: [
        {
          title: 'Ce sunt Codurile QR?',
          text: `Fiecare echipament poate avea un cod QR unic lipit pe el. 
          Scanând codul, accesezi instant informațiile despre acel echipament.`
        },
        {
          title: 'Cum Scanez un Cod QR?',
          steps: [
            'Click pe "Scanare QR" din meniu',
            'Permite accesul la cameră când browser-ul solicită',
            'Poziționează codul QR în fața camerei',
            'Sistemul va scana automat și va deschide pagina echipamentului',
            'Aici poți vedea istoricul, crea ordine de lucru sau raporta probleme'
          ],
          tips: [
            'Asigură-te că ai lumină suficientă',
            'Ține telefonul/camera stabil',
            'Codul QR trebuie să fie clar și neted (nu șifonat)'
          ]
        },
        {
          title: 'Raportare Probleme prin QR',
          steps: [
            'Scanează codul QR al echipamentului',
            'Click "Raportează Problemă"',
            'Completează descrierea problemei',
            'Adaugă o fotografie (opțional)',
            'Selectează prioritatea',
            'Trimite raportul'
          ]
        }
      ]
    },
    {
      id: 'equipment',
      title: 'Echipamente',
      icon: Wrench,
      roles: ['admin', 'technician'],
      content: [
        {
          title: 'Adăugare Echipament Nou',
          steps: [
            'Click "Echipamente" din meniu',
            'Click butonul "Adaugă Echipament"',
            'Completează informațiile:',
            '  - Nume (ex: Compresor Industrial #1)',
            '  - Număr Serial (de pe plăcuța echipamentului)',
            '  - Locație (selectează din listă)',
            '  - Producător și Model',
            '  - Data Achiziției',
            '  - Status (Operațional, Mentenanță, Defect, Retras)',
            'Click "Salvează"'
          ]
        },
        {
          title: 'Generare Cod QR',
          text: `După salvarea echipamentului:`,
          steps: [
            'Deschide pagina echipamentului',
            'Click "Generează Cod QR"',
            'Sistemul va crea un cod QR unic',
            'Click "Descarcă QR" pentru a salva imaginea',
            'Printează și lipește codul pe echipament'
          ]
        },
        {
          title: 'Urmărire Certificări',
          text: `Pentru echipamentele care necesită inspecții periodice:`,
          steps: [
            'În pagina echipamentului, secțiunea "Certificări"',
            'Adaugă tipul certificării (ISCIR, ANRE, etc.)',
            'Încarcă certificatul (PDF)',
            'Setează data expirării',
            'Sistemul va alerta automat când certificatul expiră'
          ]
        }
      ]
    },
    {
      id: 'locations',
      title: 'Locații',
      icon: MapPin,
      roles: ['admin'],
      content: [
        {
          title: 'Organizare pe Locații',
          text: `Locațiile ajută la organizarea echipamentelor geografic:`,
          examples: [
            'Clădire A → Etaj 2 → Hală Producție',
            'Depozit → Zona 3 → Raft 12',
            'Campus Pipera → Clădire B → Etaj 1 → Birou 105'
          ]
        },
        {
          title: 'Adăugare Locație',
          steps: [
            'Click "Locații" din meniu',
            'Click "Adaugă Locație"',
            'Completează:',
            '  - Nume Locație',
            '  - Clădire/Sediu',
            '  - Etaj',
            '  - Cameră/Zonă',
            '  - Descriere (opțional)',
            'Click "Salvează"'
          ]
        },
        {
          title: 'Vizualizare Echipamente pe Locație',
          text: `În pagina fiecărei locații vezi:`,
          items: [
            'Lista completă de echipamente din acea locație',
            'Status fiecărui echipament',
            'Link rapid către fiecare echipament',
            'Statistici: câte echipamente operaționale/defecte'
          ]
        }
      ]
    },
    {
      id: 'work-orders',
      title: 'Ordine de Lucru',
      icon: ClipboardList,
      roles: ['all'],
      content: [
        {
          title: 'Ce este un Ordin de Lucru?',
          text: `Un ordin de lucru reprezintă o sarcină de reparație sau mentenanță ce trebuie executată. 
          Poate fi creat manual sau generat automat din programele de mentenanță.`,
          types: [
            'Corectiv: Reparații când apare o problemă',
            'Preventiv: Mentenanță programată',
            'Inspecție: Verificări periodice'
          ]
        },
        {
          title: 'Creare Ordin de Lucru (Manual)',
          steps: [
            'Click "Ordine de Lucru" → "Adaugă Ordin"',
            'Completează:',
            '  - Titlu descriptiv (ex: "Reparație scurgere ulei pompă")',
            '  - Descriere detaliată a problemei',
            '  - Selectează echipamentul afectat',
            '  - Prioritate: Scăzută / Medie / Înaltă / Critică',
            '  - Asignează unui tehnician (opțional)',
            '  - Adaugă fotografie (opțional)',
            '  - Estimează orele necesare',
            'Click "Creează"'
          ]
        },
        {
          title: 'Status-uri Ordine de Lucru',
          items: [
            '🟠 Deschis - Nou creat, neîn ceput',
            '🔵 În Lucru - Tehnicianul lucrează la el',
            '⏸️ În Așteptare - Așteaptă piese/aprobare',
            '✅ Finalizat - Complet rezolvat',
            '❌ Anulat - Nu mai este necesar'
          ]
        },
        {
          title: 'Finalizare Ordin de Lucru',
          text: `Când tehnicianul termină lucrul:`,
          steps: [
            'Deschide ordinul de lucru',
            'Click "Marchează ca Finalizat"',
            'Completează formularul:',
            '  - Nume tehnician',
            '  - Piese înlocuite (listă)',
            '  - Cost piese (RON)',
            '  - Cost manoperă (RON)',
            '  - Ore lucrate efectiv',
            '  - Note finale (ce s-a făcut, recomandări)',
            'Click "Salvează"'
          ]
        },
        {
          title: 'Raport de Finalizare',
          text: `După finalizare, sistemul generează automat un raport complet cu:`,
          items: [
            'Timeline complet (data sesizării → durata → data finalizării)',
            'Comparație ore lucrate vs. estimate',
            'Breakdown costuri (piese + manoperă = total)',
            'Note tehnicianului',
            'Opțiune de printare pentru arhivare'
          ]
        }
      ]
    },
    {
      id: 'schedules',
      title: 'Programe Mentenanță Preventivă',
      icon: Calendar,
      roles: ['admin', 'technician'],
      content: [
        {
          title: 'De ce Mentenanță Preventivă?',
          text: `Mentenanța preventivă previne defecțiunile prin service regulat, programat. 
          În loc să aștepți să se strice echipamentul, îl întreții preventiv.`,
          benefits: [
            'Reduce costurile de reparații urgente',
            'Prelungește durata de viață a echipamentelor',
            'Previne oprirea neplanificată a producției',
            'Asigură conformitatea cu reglementările'
          ]
        },
        {
          title: 'Creare Program Mentenanță',
          steps: [
            'Click "Mentenanță" → "Adaugă Program"',
            'Selectează echipamentul',
            'Completează:',
            '  - Titlu (ex: "Service 1000h Compresor")',
            '  - Descriere detaliată',
            '  - Frecvență: Zilnic / Săptămânal / Lunar / Trimestrial / Anual / Ore funcționare',
            '  - Data următoarei mentenanțe',
            '  - Asignează tehnician',
            '  - Adaugă Checklist Template (opțional)',
            '  - Adaugă Procedură Template (opțional)',
            'Click "Salvează"'
          ]
        },
        {
          title: 'Tipuri de Frecvență',
          examples: [
            'Zilnic: Verificare presiune ulei (în fiecare zi)',
            'Săptămânal: Curățare filtru aer (în fiecare luni)',
            'Lunar: Schimb ulei (data 1 a lunii)',
            'Ore funcționare: Service complet la 1000h'
          ]
        },
        {
          title: 'Finalizare Mentenanță',
          steps: [
            'În lista de programe, click pe program',
            'Click "Finalizează Mentenanță"',
            'Wizard te ghidează prin:',
            '  1. Bifează elementele din Checklist (dacă există)',
            '  2. Parcurge pașii din Procedură (dacă există)',
            '  3. Adaugă note despre lucrările efectuate',
            '  4. Încarcă fotografii (opțional)',
            '  5. Confirmă finalizarea',
            'Sistemul calculează automat următoarea dată programată'
          ]
        },
        {
          title: 'Monitorizare Programe Întârziate',
          text: `Dashboard-ul și tab-ul "Întârziate" afișează programele care au trecut de data scadentă. 
          Este important să finalizezi aceste programe cât mai repede pentru a menține echipamentele în stare bună.`
        }
      ]
    },
    {
      id: 'templates',
      title: 'Template-uri (Checklist & Proceduri)',
      icon: CheckSquare,
      roles: ['admin'],
      content: [
        {
          title: 'Checklist Templates',
          text: `Checklist-urile sunt liste de verificare standard pentru mentenanță:`,
          examples: [
            'Checklist Service Compresor:',
            '  ☐ Verifică nivel ulei',
            '  ☐ Curăță filtru aer',
            '  ☐ Verifică presiune sistem',
            '  ☐ Testează valvă siguranță',
            '  ☐ Verifică curele transmisie'
          ]
        },
        {
          title: 'Creare Checklist Template',
          steps: [
            'Click "Checklist-uri" → "Adaugă Template"',
            'Nume Template (ex: "Service Standard Pompă")',
            'Descriere (opțional)',
            'Adaugă elemente:',
            '  - Click "Adaugă Element"',
            '  - Scrie taskul de verificat',
            '  - Repeat pentru fiecare element',
            'Click "Salvează"'
          ]
        },
        {
          title: 'Procedure Templates',
          text: `Procedurile sunt ghiduri pas-cu-pas pentru lucrări complexe:`,
          examples: [
            'Procedură Schimb Filtru:',
            '  1. Oprește echipamentul și deconectează de la rețea',
            '  2. Eliberează presiunea din sistem',
            '  3. Deschide capacul filtrului',
            '  4. Scoate filtrul vechi',
            '  5. Instalează filtrul nou',
            '  6. Închide capacul și strânge șuruburile',
            '  7. Reconectează și testează'
          ]
        },
        {
          title: 'Utilizare Template-uri',
          text: `Când creezi un Program de Mentenanță, poți atașa:`,
          items: [
            'Un Checklist Template - pentru verificări standard',
            'O Procedură Template - pentru pașii de urmat',
            'Tehnicianul va fi ghidat prin checklist și procedură la finalizare'
          ]
        }
      ]
    },
    {
      id: 'reports',
      title: 'Rapoarte',
      icon: BarChart3,
      roles: ['admin', 'technician'],
      content: [
        {
          title: 'Rapoarte de Finalizare',
          text: `Pagina Rapoarte afișează toate ordinele de lucru finalizate cu detalii complete.`,
          features: [
            'Carduri expandabile - click pentru a vedea detalii',
            'Filtrare avansată: dată, tehnician, echipament, cost',
            'Statistici live: total rapoarte, costuri, ore lucrate, medii',
            'Export/Print pentru arhivare'
          ]
        },
        {
          title: 'Utilizare Filtre',
          steps: [
            'Selectează perioada (astăzi, săptămâna, luna, custom)',
            'Filtrează după tehnician specific',
            'Filtrează după echipament',
            'Setează interval de costuri (min-max)',
            'Caută după cuvinte cheie în titlu',
            'Click "Resetează Filtre" pentru a șterge toate'
          ]
        },
        {
          title: 'Expandare/Colapsare Rapoarte',
          text: `Pentru vizualizare eficientă:`,
          items: [
            'Click pe un card pentru a-l expanda → vezi toate detaliile',
            'Click din nou pentru a-l închide',
            'Buton "Expandează Toate" → vezi toate simultan',
            'Buton "Colapsează Toate" → închide toate pentru scanare rapidă'
          ]
        },
        {
          title: 'Informații în Rapoarte',
          text: `Fiecare raport expandat afișează:`,
          sections: [
            'Timeline Rezolvare: data sesizării → durata → data finalizării',
            'Tracking Timp: ore lucrate vs. estimate, badge alertă dacă depășește',
            'Piese Înlocuite: listă completă',
            'Costuri: breakdown piese + manoperă + total',
            'Note Tehnician: observații și recomandări'
          ]
        }
      ]
    },
    {
      id: 'users',
      title: 'Gestionare Utilizatori',
      icon: Shield,
      roles: ['admin'],
      content: [
        {
          title: 'Roluri în Sistem',
          roles: [
            {
              name: 'Administrator',
              permissions: [
                'Acces complet la toate funcționalitățile',
                'Gestionare utilizatori (creare, editare, ștergere)',
                'Configurare sistem și setări',
                'Vezi toate rapoartele și statisticile',
                'Administrare echipamente, locații, template-uri'
              ]
            },
            {
              name: 'Tehnician',
              permissions: [
                'Vezi și gestionează ordine de lucru asignate',
                'Finalizează ordine de lucru cu rapoarte complete',
                'Vezi și finalizează programe de mentenanță',
                'Scanare coduri QR',
                'Adaugă/editează echipamente',
                'Vezi rapoarte'
              ]
            },
            {
              name: 'Operator',
              permissions: [
                'Scanare coduri QR',
                'Raportare probleme pentru echipamente',
                'Vezi echipamente și locații (read-only)',
                'Vizualizare dashboard'
              ]
            }
          ]
        },
        {
          title: 'Adăugare Utilizator Nou',
          steps: [
            'Click "Utilizatori" din meniu (doar admin)',
            'Click "Adaugă Utilizator"',
            'Completează:',
            '  - Nume Complet',
            '  - Email (va fi folosit pentru autentificare)',
            '  - Parolă temporară',
            '  - Rol (Administrator / Tehnician / Operator)',
            '  - Telefon (opțional)',
            'Click "Salvează"',
            'Trimite email-ul și parola utilizatorului',
            'Recomandă schimbarea parolei la prima autentificare'
          ]
        },
        {
          title: 'Monitorizare Activitate',
          text: `În pagina Utilizatori poți vedea:`,
          items: [
            'Ultima dată când s-au autentificat',
            'Câte ordine de lucru au finalizat',
            'Câte mentenanțe au completat',
            'Status activ/inactiv'
          ]
        }
      ]
    },
    {
      id: 'settings',
      title: 'Setări',
      icon: Settings,
      roles: ['all'],
      content: [
        {
          title: 'Setări Profil',
          text: `Fiecare utilizator își poate personaliza profilul:`,
          options: [
            'Schimbare parolă',
            'Actualizare nume',
            'Adăugare/schimbare număr telefon',
            'Preferințe notificări (viitor)'
          ]
        },
        {
          title: 'Setări Sistem (Admin)',
          text: `Administratorii pot configura:`,
          settings: [
            'Logo companie',
            'Nume companie',
            'Timezone',
            'Format dată',
            'Limba (Română/Engleză - viitor)'
          ]
        }
      ]
    },
    {
      id: 'best-practices',
      title: 'Bune Practici și Sfaturi',
      icon: AlertCircle,
      roles: ['all'],
      content: [
        {
          title: 'Pentru Operatori',
          tips: [
            '✓ Scanează codul QR înainte de a raporta o problemă - economisești timp',
            '✓ Descrie clar problema: ce nu funcționează, când a început, sunet/miros neobișnuit',
            '✓ Adaugă o fotografie - ajută tehnicianul să înțeleagă mai repede',
            '✓ Setează prioritatea corect: Critică doar dacă oprește producția',
            '✓ Verifică dacă problema nu e deja raportată înainte de a crea alt ordin'
          ]
        },
        {
          title: 'Pentru Tehnicieni',
          tips: [
            '✓ Verifică ordinele în fiecare dimineață - prioritizează după urgență',
            '✓ Marchează ordinul ca "În Lucru" când începi - managerul știe că lucrezi',
            '✓ Completează TOATE detaliile la finalizare - costurile ajută la bugetare',
            '✓ Adaugă recomandări în note - "Verifică peste 500h" sau "Înlocuiește la următorul service"',
            '✓ Estimează corect orele - te ajută să planifici mai bine',
            '✓ Raportează problemele găsite la mentenanță preventivă - previi defecțiuni'
          ]
        },
        {
          title: 'Pentru Administratori',
          tips: [
            '✓ Creează template-uri de checklist pentru fiecare tip de echipament',
            '✓ Programează mentenanță preventivă regulat - previi 80% din probleme',
            '✓ Revizuiește rapoartele lunar - identifică echipamente problematice',
            '✓ Monitorizează costurile - vezi unde cheltuiești cel mai mult',
            '✓ Instruiește utilizatorii - un sistem bine folosit e eficient',
            '✓ Printează coduri QR pentru toate echipamentele - facilitează raportarea',
            '✓ Verifică certificările expirate săptămânal - evită penalități'
          ]
        },
        {
          title: 'Securitate Date',
          important: [
            '⚠️ Nu împărtăși parola cu alții',
            '⚠️ Deconectează-te când pleci de la computer',
            '⚠️ Schimbă parola periodic (recomandat la 3 luni)',
            '⚠️ Nu descărca date sensibile pe dispozitive personale fără aprobare'
          ]
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Rezolvare Probleme Comune',
      icon: AlertCircle,
      roles: ['all'],
      content: [
        {
          title: 'Nu mă pot autentifica',
          solutions: [
            '1. Verifică că email-ul e corect scris (fără spații)',
            '2. Verifică CAPS LOCK (parolele sunt case-sensitive)',
            '3. Încearcă să resetezi parola',
            '4. Contactează administratorul dacă contul e blocat'
          ]
        },
        {
          title: 'Camera nu funcționează pentru QR',
          solutions: [
            '1. Verifică că ai permis accesul la cameră în browser',
            '2. Închide alte aplicații care folosesc camera',
            '3. Reîncarc ă pagina (F5)',
            '4. Încearcă alt browser (Chrome recomandat)',
            '5. Pe mobil, verifică permisiunile în Setări telefon'
          ]
        },
        {
          title: 'Imaginile nu se încarcă',
          solutions: [
            '1. Verifică conexiunea la internet',
            '2. Verifică că fișierul e mai mic de 5MB',
            '3. Formatul trebuie să fie JPG, PNG sau PDF',
            '4. Încearcă să compresezi imaginea înainte',
            '5. Reîncearcă după câteva minute'
          ]
        },
        {
          title: 'Nu văd un ordin de lucru/echipament',
          solutions: [
            '1. Verifică filtrele active - poate e filtrat',
            '2. Reîmprospătează pagina (F5)',
            '3. Verifică că ai permisiunile necesare pentru acel echipament',
            '4. Caută folosind bara de căutare',
            '5. Contactează administratorul dacă a fost șters accidental'
          ]
        },
        {
          title: 'Aplicația e lentă',
          solutions: [
            '1. Verifică conexiunea la internet',
            '2. Închide tab-urile nefolosite din browser',
            '3. Șterge cache-ul browser-ului (Ctrl+Shift+Delete)',
            '4. Reîncearcă peste câteva minute',
            '5. Raportează problema administratorului dacă persistă'
          ]
        }
      ]
    },
    {
      id: 'faq',
      title: 'Întrebări Frecvente (FAQ)',
      icon: Info,
      roles: ['all'],
      content: [
        {
          title: 'General',
          questions: [
            {
              q: 'Pot accesa aplicația de pe telefon?',
              a: 'Da! Aplicația e optimizată pentru mobil. Folosește orice browser modern (Chrome, Safari, Firefox).'
            },
            {
              q: 'Se salvează datele automat?',
              a: 'Nu, trebuie să apeși "Salvează" sau "Creează" pentru a salva modificările.'
            },
            {
              q: 'Pot șterge ceva din greșeală?',
              a: 'Majoritatea acțiunilor de ștergere cer confirmare. Totuși, fi atent - unele ștergeri sunt permanente.'
            },
            {
              q: 'Cum contactez suportul tehnic?',
              a: 'Contactează administratorul de sistem din compania ta pentru asistență.'
            }
          ]
        },
        {
          title: 'Echipamente',
          questions: [
            {
              q: 'Ce echipamente pot adăuga?',
              a: 'Orice tip de echipament industrial: compresoare, pompe, motoare, lifturi, vehicule, etc.'
            },
            {
              q: 'Pot adăuga mai multe coduri QR pentru același echipament?',
              a: 'Nu, fiecare echipament are un singur cod QR unic. Poți regenera codul dacă e necesar.'
            },
            {
              q: 'Ce fac dacă echipamentul e retras din uz?',
              a: 'Schimbă status-ul în "Retras". Echipamentul rămâne în sistem pentru istoric, dar nu mai apare în liste active.'
            }
          ]
        },
        {
          title: 'Ordine de Lucru',
          questions: [
            {
              q: 'Pot modifica un ordin după ce l-am creat?',
              a: 'Da, administratorii și tehnicienii asignați pot edita ordinele înainte de finalizare.'
            },
            {
              q: 'Ce înseamnă "În Așteptare"?',
              a: 'Ordinul e pus pe pauză, de obicei în așteptarea unor piese de schimb sau aprobări.'
            },
            {
              q: 'Pot reasigna un ordin altui tehnician?',
              a: 'Da, deschide ordinul și click "Reasignează" pentru a schimba tehnicianul.'
            }
          ]
        },
        {
          title: 'Mentenanță Preventivă',
          questions: [
            {
              q: 'Ce se întâmplă dacă scap un program?',
              a: 'Apare în lista "Întârziate". Finalizează-l cât mai repede și sistemul va recalcula următoarea dată.'
            },
            {
              q: 'Pot opri temporar un program?',
              a: 'Da, marchează-l ca "Inactiv". Poți reactiva când dorești.'
            },
            {
              q: 'Cum funcționează "Ore funcționare"?',
              a: 'Trebuie să introduci manual orele citite de pe contor. Sistemul te alertează când se apropie de limită.'
            }
          ]
        }
      ]
    }
  ]

  const filteredSections = manualSections.filter(section => 
    activeRole === 'all' || section.roles.includes('all') || section.roles.includes(activeRole)
  )

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-10 h-10 text-primary-600" />
          <h1 className="text-4xl font-bold text-gray-900">Manual de Utilizare</h1>
        </div>
        <p className="text-lg text-gray-600">
          Ghid complet pentru utilizarea sistemului Pernador Maintain
        </p>
      </div>

      {/* Role Filter */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtru după Rol</h2>
        <div className="flex flex-wrap gap-3">
          {roles.map((role) => {
            const Icon = role.icon
            return (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                  activeRole === role.id
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{role.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Manual Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => {
          const SectionIcon = section.icon
          const isExpanded = expandedSections[section.id]

          return (
            <div key={section.id} className="card">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <SectionIcon className="w-6 h-6 text-primary-600" />
                  <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-6 h-6 text-gray-400" />
                ) : (
                  <ChevronRight className="w-6 h-6 text-gray-400" />
                )}
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-6">
                  {section.content.map((item, idx) => (
                    <div key={idx} className="border-l-4 border-primary-200 pl-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {item.title}
                      </h3>

                      {/* Text */}
                      {item.text && (
                        <p className="text-gray-700 mb-3 whitespace-pre-line">{item.text}</p>
                      )}

                      {/* Steps */}
                      {item.steps && (
                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                          {item.steps.map((step, stepIdx) => (
                            <li key={stepIdx} className="ml-2">{step}</li>
                          ))}
                        </ol>
                      )}

                      {/* Items/Bullets */}
                      {item.items && (
                        <ul className="list-disc list-inside space-y-2 text-gray-700 mt-3">
                          {item.items.map((bullet, bulletIdx) => (
                            <li key={bulletIdx} className="ml-2">{bullet}</li>
                          ))}
                        </ul>
                      )}

                      {/* Tips */}
                      {item.tips && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                          <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <Info className="w-5 h-5" />
                            Sfaturi Utile:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-blue-800">
                            {item.tips.map((tip, tipIdx) => (
                              <li key={tipIdx} className="ml-2">{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Examples */}
                      {item.examples && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-3">
                          <p className="font-semibold text-green-900 mb-2">Exemple:</p>
                          <ul className="space-y-2 text-green-800">
                            {item.examples.map((example, exIdx) => (
                              <li key={exIdx} className="whitespace-pre-line">{example}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Types */}
                      {item.types && (
                        <ul className="space-y-2 text-gray-700 mt-3">
                          {item.types.map((type, typeIdx) => (
                            <li key={typeIdx} className="flex items-start gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{type}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Benefits */}
                      {item.benefits && (
                        <ul className="space-y-2 text-gray-700 mt-3">
                          {item.benefits.map((benefit, benIdx) => (
                            <li key={benIdx} className="flex items-start gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Sections */}
                      {item.sections && (
                        <ul className="list-disc list-inside space-y-2 text-gray-700 mt-3">
                          {item.sections.map((sec, secIdx) => (
                            <li key={secIdx} className="ml-2">{sec}</li>
                          ))}
                        </ul>
                      )}

                      {/* Features */}
                      {item.features && (
                        <ul className="list-disc list-inside space-y-2 text-gray-700 mt-3">
                          {item.features.map((feature, featIdx) => (
                            <li key={featIdx} className="ml-2">{feature}</li>
                          ))}
                        </ul>
                      )}

                      {/* Roles with permissions */}
                      {item.roles && (
                        <div className="space-y-4 mt-3">
                          {item.roles.map((role, roleIdx) => (
                            <div key={roleIdx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <h4 className="font-semibold text-gray-900 mb-2">{role.name}</h4>
                              <ul className="space-y-1 text-gray-700">
                                {role.permissions.map((perm, permIdx) => (
                                  <li key={permIdx} className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                                    <span className="text-sm">{perm}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Options/Settings */}
                      {item.options && (
                        <ul className="list-disc list-inside space-y-2 text-gray-700 mt-3">
                          {item.options.map((option, optIdx) => (
                            <li key={optIdx} className="ml-2">{option}</li>
                          ))}
                        </ul>
                      )}

                      {item.settings && (
                        <ul className="list-disc list-inside space-y-2 text-gray-700 mt-3">
                          {item.settings.map((setting, setIdx) => (
                            <li key={setIdx} className="ml-2">{setting}</li>
                          ))}
                        </ul>
                      )}

                      {/* Tips array (different from single tips) */}
                      {item.tips && Array.isArray(item.tips) && !item.tips[0]?.startsWith?.('✓') && (
                        <div className="space-y-2 mt-3">
                          {item.tips.map((tip, tipIdx) => (
                            <div key={tipIdx} className="flex items-start gap-2 text-gray-700">
                              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{tip}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Important warnings */}
                      {item.important && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-3">
                          <p className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Important:
                          </p>
                          <ul className="space-y-1 text-red-800">
                            {item.important.map((imp, impIdx) => (
                              <li key={impIdx}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Solutions */}
                      {item.solutions && (
                        <ol className="list-decimal list-inside space-y-2 text-gray-700 mt-3">
                          {item.solutions.map((solution, solIdx) => (
                            <li key={solIdx} className="ml-2">{solution}</li>
                          ))}
                        </ol>
                      )}

                      {/* FAQ Questions */}
                      {item.questions && (
                        <div className="space-y-4 mt-3">
                          {item.questions.map((qa, qaIdx) => (
                            <div key={qaIdx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <p className="font-semibold text-gray-900 mb-2">Î: {qa.q}</p>
                              <p className="text-gray-700">R: {qa.a}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer Help */}
      <div className="card mt-8 bg-primary-50 border-primary-200">
        <div className="flex items-start gap-4">
          <Info className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-primary-900 mb-2">Ai nevoie de ajutor suplimentar?</h3>
            <p className="text-primary-800">
              Dacă nu găsești răspunsul în acest manual, contactează administratorul de sistem 
              din compania ta pentru asistență personalizată.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
