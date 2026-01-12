import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

export const translations = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.scanQR': 'Scan QR',
    'nav.equipment': 'Equipment',
    'nav.locations': 'Locations',
    'nav.workOrders': 'Work Orders',
    'nav.schedules': 'Schedules',
    'nav.checklists': 'Checklists',
    'nav.procedures': 'Procedures',
    'nav.reports': 'Reports',
    'nav.manual': 'User Manual',
    'nav.users': 'Users',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    
    // Common
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.loading': 'Loading...',
    'common.actions': 'Actions',
    'common.view': 'View',
    'common.create': 'Create',
    'common.update': 'Update',
    'common.name': 'Name',
    'common.description': 'Description',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.total': 'Total',
    'common.all': 'All',
    'common.created': 'Created',
    'common.noResults': 'No results found',
    
    // Equipment
    'equipment.title': 'Equipment',
    'equipment.subtitle': 'total equipment',
    'equipment.add': 'Add Equipment',
    'equipment.import': 'Import Excel',
    'equipment.inventoryNumber': 'Nr. Inventar',
    'equipment.name': 'Name',
    'equipment.brand': 'Brand',
    'equipment.model': 'Model',
    'equipment.serialNumber': 'Serial Number',
    'equipment.location': 'Location',
    'equipment.purchaseDate': 'Purchase Date',
    'equipment.status': 'Status',
    'equipment.operational': 'Operational',
    'equipment.maintenance': 'Maintenance',
    'equipment.retired': 'Retired',
    'equipment.details': 'Details',
    'equipment.noEquipment': 'No equipment found',
    'equipment.searchPlaceholder': 'Search equipment by name, serial number, or model...',
    
    // Work Orders
    'workOrders.title': 'Work Orders',
    'workOrders.subtitle': 'Manage maintenance requests and tasks',
    'workOrders.new': 'New Work Order',
    'workOrders.all': 'All Orders',
    'workOrders.open': 'Open',
    'workOrders.inProgress': 'In Progress',
    'workOrders.onHold': 'On Hold',
    'workOrders.completed': 'Completed',
    'workOrders.cancelled': 'Cancelled',
    'workOrders.priority': 'Priority',
    'workOrders.low': 'Low',
    'workOrders.medium': 'Medium',
    'workOrders.high': 'High',
    'workOrders.critical': 'Critical',
    'workOrders.searchPlaceholder': 'Search work orders...',
    'workOrders.allPriority': 'All Priority',
    
    // Maintenance Schedules
    'schedules.title': 'Maintenance Schedules',
    'schedules.subtitle': 'Manage preventive maintenance schedules',
    'schedules.new': 'New Schedule',
    'schedules.all': 'All Schedules',
    'schedules.active': 'Active',
    'schedules.overdue': 'Overdue',
    'schedules.dueThisWeek': 'Due This Week',
    'schedules.frequency': 'Frequency',
    'schedules.daily': 'Daily',
    'schedules.weekly': 'Weekly',
    'schedules.monthly': 'Monthly',
    'schedules.quarterly': 'Quarterly',
    'schedules.semiannually': 'Semi-annually',
    'schedules.annually': 'Annually',
    'schedules.nextDue': 'Next Due',
    'schedules.lastCompleted': 'Last completed',
    'schedules.complete': 'Complete',
    'schedules.pause': 'Pause',
    'schedules.resume': 'Resume',
    'schedules.showCompleted': 'Show Completed Only',
    'schedules.additionalFilters': 'Additional Filters:',
    
    // Checklists
    'checklists.title': 'Checklist Templates',
    'checklists.subtitle': 'Create and manage reusable checklist templates',
    'checklists.new': 'New Template',
    'checklists.items': 'checklist items',
    'checklists.noTemplates': 'No templates yet',
    'checklists.createFirst': 'Create your first checklist template to use in maintenance schedules',
    'checklists.templateName': 'Template Name',
    'checklists.addItem': 'Add Item',
    
    // Procedures
    'procedures.title': 'Procedure Templates',
    'procedures.subtitle': 'Create and manage step-by-step procedures with images',
    'procedures.new': 'New Template',
    'procedures.steps': 'steps',
    'procedures.noProcedures': 'No templates yet',
    'procedures.createFirst': 'Create your first procedure template with step-by-step instructions',
    'procedures.addStep': 'Add Step',
    'procedures.hasImage': 'Has image',
    
    // Locations
    'locations.title': 'Locations',
    'locations.subtitle': 'Manage facility locations',
    'locations.new': 'New Location',
    'locations.building': 'Building',
    'locations.floor': 'Floor',
    'locations.room': 'Room',
    'locations.address': 'Address',
    'locations.noLocations': 'No locations found',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.overview': 'System Overview',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.upcomingMaintenance': 'Upcoming Maintenance',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.profile': 'Profile',
    'settings.notifications': 'Notifications',
    'settings.selectLanguage': 'Select Language',
    'settings.english': 'English',
    'settings.romanian': 'Romanian',
  },
  
  ro: {
    // Navigation
    'nav.dashboard': 'Panou',
    'nav.scanQR': 'Scanare QR',
    'nav.equipment': 'Echipamente',
    'nav.locations': 'Locații',
    'nav.workOrders': 'Ordine de Lucru',
    'nav.schedules': 'Programări',
    'nav.checklists': 'Liste de Verificare',
    'nav.procedures': 'Proceduri',
    'nav.reports': 'Rapoarte',
    'nav.manual': 'Manual de Utilizare',
    'nav.users': 'Utilizatori',
    'nav.settings': 'Setări',
    'nav.logout': 'Deconectare',
    
    // Common
    'common.search': 'Căutare',
    'common.filter': 'Filtrare',
    'common.add': 'Adaugă',
    'common.edit': 'Modifică',
    'common.delete': 'Șterge',
    'common.save': 'Salvează',
    'common.cancel': 'Anulează',
    'common.close': 'Închide',
    'common.back': 'Înapoi',
    'common.next': 'Următorul',
    'common.previous': 'Anterior',
    'common.loading': 'Se încarcă...',
    'common.actions': 'Acțiuni',
    'common.view': 'Vizualizare',
    'common.create': 'Creează',
    'common.update': 'Actualizează',
    'common.name': 'Nume',
    'common.description': 'Descriere',
    'common.status': 'Status',
    'common.date': 'Dată',
    'common.total': 'Total',
    'common.all': 'Toate',
    'common.created': 'Creat',
    'common.noResults': 'Nu s-au găsit rezultate',
    
    // Equipment
    'equipment.title': 'Echipamente',
    'equipment.subtitle': 'echipamente totale',
    'equipment.add': 'Adaugă Echipament',
    'equipment.import': 'Importă Excel',
    'equipment.inventoryNumber': 'Nr. Inventar',
    'equipment.name': 'Nume',
    'equipment.brand': 'Marcă',
    'equipment.model': 'Model',
    'equipment.serialNumber': 'Număr Serie',
    'equipment.location': 'Locație',
    'equipment.purchaseDate': 'Data Achiziției',
    'equipment.status': 'Status',
    'equipment.operational': 'Operațional',
    'equipment.maintenance': 'Întreținere',
    'equipment.retired': 'Retras',
    'equipment.details': 'Detalii',
    'equipment.noEquipment': 'Nu s-au găsit echipamente',
    'equipment.searchPlaceholder': 'Căutare echipamente după nume, număr serie sau model...',
    
    // Work Orders
    'workOrders.title': 'Ordine de Lucru',
    'workOrders.subtitle': 'Gestionează cererile și sarcinile de întreținere',
    'workOrders.new': 'Ordin de Lucru Nou',
    'workOrders.all': 'Toate Ordinele',
    'workOrders.open': 'Deschise',
    'workOrders.inProgress': 'În Progres',
    'workOrders.onHold': 'În Așteptare',
    'workOrders.completed': 'Finalizate',
    'workOrders.cancelled': 'Anulate',
    'workOrders.priority': 'Prioritate',
    'workOrders.low': 'Scăzută',
    'workOrders.medium': 'Medie',
    'workOrders.high': 'Mare',
    'workOrders.critical': 'Critică',
    'workOrders.searchPlaceholder': 'Căutare ordine de lucru...',
    'workOrders.allPriority': 'Toate Prioritățile',
    
    // Maintenance Schedules
    'schedules.title': 'Programări Întreținere',
    'schedules.subtitle': 'Gestionează programările de întreținere preventivă',
    'schedules.new': 'Programare Nouă',
    'schedules.all': 'Toate Programările',
    'schedules.active': 'Active',
    'schedules.overdue': 'Întârziate',
    'schedules.dueThisWeek': 'Săptămâna Aceasta',
    'schedules.frequency': 'Frecvență',
    'schedules.daily': 'Zilnic',
    'schedules.weekly': 'Săptămânal',
    'schedules.monthly': 'Lunar',
    'schedules.quarterly': 'Trimestrial',
    'schedules.semiannually': 'Semestrial',
    'schedules.annually': 'Anual',
    'schedules.nextDue': 'Următoarea Scadență',
    'schedules.lastCompleted': 'Ultima finalizare',
    'schedules.complete': 'Finalizează',
    'schedules.pause': 'Pauză',
    'schedules.resume': 'Reia',
    'schedules.showCompleted': 'Arată Doar Finalizate',
    'schedules.additionalFilters': 'Filtre Adiționale:',
    
    // Checklists
    'checklists.title': 'Șabloane Liste de Verificare',
    'checklists.subtitle': 'Creează și gestionează șabloane de liste reutilizabile',
    'checklists.new': 'Șablon Nou',
    'checklists.items': 'elemente de verificat',
    'checklists.noTemplates': 'Încă nu există șabloane',
    'checklists.createFirst': 'Creează primul tău șablon de listă pentru a-l folosi în programările de întreținere',
    'checklists.templateName': 'Nume Șablon',
    'checklists.addItem': 'Adaugă Element',
    
    // Procedures
    'procedures.title': 'Șabloane Proceduri',
    'procedures.subtitle': 'Creează și gestionează proceduri pas cu pas cu imagini',
    'procedures.new': 'Șablon Nou',
    'procedures.steps': 'pași',
    'procedures.noProcedures': 'Încă nu există șabloane',
    'procedures.createFirst': 'Creează primul tău șablon de procedură cu instrucțiuni pas cu pas',
    'procedures.addStep': 'Adaugă Pas',
    'procedures.hasImage': 'Are imagine',
    
    // Locations
    'locations.title': 'Locații',
    'locations.subtitle': 'Gestionează locațiile facilității',
    'locations.new': 'Locație Nouă',
    'locations.building': 'Clădire',
    'locations.floor': 'Etaj',
    'locations.room': 'Cameră',
    'locations.address': 'Adresă',
    'locations.noLocations': 'Nu s-au găsit locații',
    
    // Dashboard
    'dashboard.title': 'Panou de Control',
    'dashboard.welcome': 'Bine ai revenit',
    'dashboard.overview': 'Prezentare Generală',
    'dashboard.recentActivity': 'Activitate Recentă',
    'dashboard.upcomingMaintenance': 'Întreținere Viitoare',
    
    // Settings
    'settings.title': 'Setări',
    'settings.language': 'Limbă',
    'settings.profile': 'Profil',
    'settings.notifications': 'Notificări',
    'settings.selectLanguage': 'Selectează Limba',
    'settings.english': 'Engleză',
    'settings.romanian': 'Română',
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language')
    return saved || 'en'
  })

  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  const t = (key) => {
    return translations[language][key] || key
  }

  const value = {
    language,
    setLanguage,
    t
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
