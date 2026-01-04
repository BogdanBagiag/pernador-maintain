# Translation Guide

Pentru a traduce orice pagină, urmați pașii:

## 1. Import useLanguage hook
```jsx
import { useLanguage } from '../contexts/LanguageContext'
```

## 2. Folosește hook-ul în componentă
```jsx
const { t } = useLanguage()
```

## 3. Înlocuiește textele
```jsx
// Înainte:
<h1>Checklist Templates</h1>

// După:
<h1>{t('checklists.title')}</h1>
```

## Chei de traducere existente:

### Navigation
- nav.dashboard, nav.scanQR, nav.equipment, nav.locations
- nav.workOrders, nav.schedules, nav.checklists, nav.procedures
- nav.reports, nav.settings, nav.logout

### Common
- common.search, common.filter, common.add, common.edit
- common.delete, common.save, common.cancel, common.close
- common.back, common.next, common.previous, common.loading
- common.actions, common.view, common.create, common.update
- common.name, common.description, common.status, common.date

### Equipment
- equipment.title, equipment.subtitle, equipment.add, equipment.import
- equipment.inventoryNumber, equipment.name, equipment.brand
- equipment.model, equipment.serialNumber, equipment.location
- equipment.purchaseDate, equipment.status
- equipment.operational, equipment.maintenance, equipment.retired

### Work Orders
- workOrders.title, workOrders.subtitle, workOrders.new
- workOrders.all, workOrders.open, workOrders.inProgress
- workOrders.onHold, workOrders.completed, workOrders.cancelled
- workOrders.priority, workOrders.low, workOrders.medium
- workOrders.high, workOrders.critical

### Schedules
- schedules.title, schedules.subtitle, schedules.new
- schedules.all, schedules.active, schedules.overdue
- schedules.dueThisWeek, schedules.frequency
- schedules.daily, schedules.weekly, schedules.monthly
- schedules.quarterly, schedules.semiannually, schedules.annually
- schedules.nextDue, schedules.lastCompleted
- schedules.complete, schedules.pause, schedules.resume

### Checklists
- checklists.title, checklists.subtitle, checklists.new
- checklists.items, checklists.noTemplates

### Procedures
- procedures.title, procedures.subtitle, procedures.new
- procedures.steps, procedures.noProcedures

### Locations
- locations.title, locations.subtitle, locations.new
- locations.building, locations.floor, locations.room
- locations.address

Pentru traduceri noi, adaugă-le în `/src/contexts/LanguageContext.jsx`
