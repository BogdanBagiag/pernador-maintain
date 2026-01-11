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
    'nav.manual': 'Manual Utilizare',
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
    'equipment.import': 'ImportÄƒ Excel',
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
    'equipment.searchPlaceholder': 'Căutare echipamente după nume, numÄƒr serie sau model...',
    
    // Work Orders
    'workOrders.title': 'Ordine de Lucru',
    'workOrders.subtitle': 'Gestionează cererile și sarcinile de Ã®ntreÈ›inere',
    'workOrders.new': 'Ordin de Lucru Nou',
    'workOrders.all': 'Toate Ordinele',
    'workOrders.open': 'Deschise',
    'workOrders.inProgress': 'ÃŽn Progres',
    'workOrders.onHold': 'ÃŽn AÈ™teptare',
    'workOrders.completed': 'Finalizate',
    'workOrders.cancelled': 'Anulate',
    'workOrders.priority': 'Prioritate',
    'workOrders.low': 'ScÄƒzutÄƒ',
    'workOrders.medium': 'Medie',
    'workOrders.high': 'Mare',
    'workOrders.critical': 'CriticÄƒ',
    'workOrders.searchPlaceholder': 'Căutare ordine de lucru...',
    'workOrders.allPriority': 'Toate PrioritÄƒÈ›ile',
    
    // Maintenance Schedules
    'schedules.title': 'ProgramÄƒri Întreținere',
    'schedules.subtitle': 'Gestionează programÄƒrile de Ã®ntreÈ›inere preventivÄƒ',
    'schedules.new': 'Programare NouÄƒ',
    'schedules.all': 'Toate ProgramÄƒrile',
    'schedules.active': 'Active',
    'schedules.overdue': 'ÃŽntÃ¢rziate',
    'schedules.dueThisWeek': 'SÄƒptÄƒmÃ¢na Aceasta',
    'schedules.frequency': 'FrecvenÈ›Äƒ',
    'schedules.daily': 'Zilnic',
    'schedules.weekly': 'SÄƒptÄƒmÃ¢nal',
    'schedules.monthly': 'Lunar',
    'schedules.quarterly': 'Trimestrial',
    'schedules.semiannually': 'Semestrial',
    'schedules.annually': 'Anual',
    'schedules.nextDue': 'UrmÄƒtoarea ScadenÈ›Äƒ',
    'schedules.lastCompleted': 'Ultima finalizare',
    'schedules.complete': 'FinalizeazÄƒ',
    'schedules.pause': 'PauzÄƒ',
    'schedules.resume': 'Reia',
    'schedules.showCompleted': 'AratÄƒ Doar Finalizate',
    'schedules.additionalFilters': 'Filtre AdiÈ›ionale:',
    
    // Checklists
    'checklists.title': 'È˜abloane Liste de Verificare',
    'checklists.subtitle': 'Creează și gestioneazÄƒ È™abloane de liste reutilizabile',
    'checklists.new': 'È˜ablon Nou',
    'checklists.items': 'elemente de verificat',
    'checklists.noTemplates': 'ÃŽncÄƒ nu existÄƒ È™abloane',
    'checklists.createFirst': 'Creează primul tÄƒu È™ablon de listÄƒ pentru a-l folosi Ã®n programÄƒrile de Ã®ntreÈ›inere',
    'checklists.templateName': 'Nume È˜ablon',
    'checklists.addItem': 'Adaugă Element',
    
    // Procedures
    'procedures.title': 'È˜abloane Proceduri',
    'procedures.subtitle': 'Creează și gestioneazÄƒ proceduri pas cu pas cu imagini',
    'procedures.new': 'È˜ablon Nou',
    'procedures.steps': 'pași',
    'procedures.noProcedures': 'ÃŽncÄƒ nu existÄƒ È™abloane',
    'procedures.createFirst': 'Creează primul tÄƒu È™ablon de procedurÄƒ cu instrucÈ›iuni pas cu pas',
    'procedures.addStep': 'Adaugă Pas',
    'procedures.hasImage': 'Are imagine',
    
    // Locations
    'locations.title': 'LocaÈ›ii',
    'locations.subtitle': 'Gestionează locaÈ›iile facilitÄƒÈ›ii',
    'locations.new': 'Locație NouÄƒ',
    'locations.building': 'ClÄƒdire',
    'locations.floor': 'Etaj',
    'locations.room': 'CamerÄƒ',
    'locations.address': 'AdresÄƒ',
    'locations.noLocations': 'Nu s-au găsit locaÈ›ii',
    
    // Dashboard
    'dashboard.title': 'Panou de Control',
    'dashboard.welcome': 'Bine ai revenit',
    'dashboard.overview': 'Prezentare GeneralÄƒ',
    'dashboard.recentActivity': 'Activitate RecentÄƒ',
    'dashboard.upcomingMaintenance': 'Întreținere Viitoare',
    
    // Settings
    'settings.title': 'SetÄƒri',
    'settings.language': 'LimbÄƒ',
    'settings.profile': 'Profil',
    'settings.notifications': 'NotificÄƒri',
    'settings.selectLanguage': 'SelecteazÄƒ Limba',
    'settings.english': 'EnglezÄƒ',
    'settings.romanian': 'RomÃ¢nÄƒ',
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
