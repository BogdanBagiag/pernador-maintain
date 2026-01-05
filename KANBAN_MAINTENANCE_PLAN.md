# Plan: Maintenance Schedules - Kanban Style (Trello)

## 🎯 Obiectiv

Transformă Maintenance Schedules într-un board Kanban ca Trello, în română.

## 📋 Structură Kanban

### Coloane:

1. **📅 Programate** (Scheduled)
   - Mentenanțe viitoare
   - Peste 3 zile de la now

2. **⚠️ Urgent** (Upcoming - Due Soon)
   - Mentenanțe în următoarele 3 zile
   - Badge roșu/portocaliu

3. **🔧 În Lucru** (In Progress)
   - Mentenanțe începute
   - Se mută aici când dai "Start"

4. **✅ Finalizate** (Completed)
   - Mentenanțe completate
   - Ultim 7 zile

## 🔄 Auto-Generare Recurentă

Când completezi o mentenanță recurentă:

```javascript
if (schedule.frequency !== 'one_time') {
  // Calculează next due date
  const nextDate = calculateNextDate(schedule.last_completed, schedule.frequency)
  
  // Resetează status
  await supabase
    .from('maintenance_schedules')
    .update({
      status: 'scheduled',
      last_completed: new Date(),
      next_due_date: nextDate
    })
    .eq('id', schedule.id)
}
```

## 🎨 Card Design (Trello Style)

```
┌──────────────────────────────┐
│ 🔧 Schimbare Filtru Ulei    │
│                              │
│ 📍 Mașină CNC #001           │
│ 👤 Ion Popescu               │
│ 📅 15 Ian 2026               │
│                              │
│ [Start] [Edit] [Șterge]     │
└──────────────────────────────┘
```

## 📱 Responsive

- Desktop: 4 coloane alături
- Tablet: 2x2 grid
- Mobile: Stack vertical cu tabs

## 🌐 Traduceri Complete

```
Maintenance Schedules → Programe Mentenanță
Scheduled → Programate
In Progress → În Lucru
Completed → Finalizate
Due Soon → Scadență Apropiată
Overdue → Întârziat
Weekly → Săptămânal
Monthly → Lunar
Quarterly → Trimestrial
Yearly → Anual
Start Maintenance → Începe Mentenanța
Mark Complete → Marchează Complet
```

## 🔧 Implementation Steps

1. Create KanbanColumn component
2. Group schedules by status
3. Add drag & drop (optional)
4. Auto-generate next occurrence
5. Translate all text to Romanian
6. Mobile responsive layout

