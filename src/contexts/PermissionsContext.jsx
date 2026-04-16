import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export const MODULES = [
  { key: 'equipment',   label: 'Echipamente',            href: '/equipment',            hasDelete: true  },
  { key: 'locations',   label: 'Locații',                href: '/locations',            hasDelete: true  },
  { key: 'work_orders', label: 'Reparații de efectuat',  href: '/work-orders',          hasDelete: true  },
  { key: 'schedules',   label: 'Mentenanță preventivă',  href: '/schedules',            hasDelete: true  },
  { key: 'checklists',  label: 'Liste de Verificare',    href: '/checklist-templates',  hasDelete: true  },
  { key: 'procedures',  label: 'Proceduri',              href: '/procedure-templates',  hasDelete: true  },
  { key: 'contracts',   label: 'Contracte',              href: '/contracte',            hasDelete: true  },
  { key: 'reports',     label: 'Rapoarte',               href: '/reports',              hasDelete: false },
  { key: 'vehicles',         label: 'Vehicule',               href: '/vehicles',         hasDelete: true  },
  { key: 'parts_inventory',  label: 'Inventar piese',         href: '/parts-inventory',  hasDelete: true  },
  { key: 'qr_scan',          label: 'Scanare QR',             href: '/scan',             hasDelete: false },
]

const PermissionsContext = createContext({})

export const usePermissions = () => useContext(PermissionsContext)

export const PermissionsProvider = ({ children }) => {
  const { user, profile } = useAuth()
  const [permissions, setPermissions] = useState({}) // { module: { can_view, can_edit, can_delete } }
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!user || !profile) { setLoading(false); return }
    if (isAdmin) { setLoading(false); return } // admin has full access always

    const load = async () => {
      const { data } = await supabase
        .from('user_permissions')
        .select('module, can_view, can_edit, can_delete')
        .eq('user_id', user.id)

      const map = {}
      if (data) {
        data.forEach(p => { map[p.module] = { can_view: p.can_view, can_edit: p.can_edit, can_delete: p.can_delete } })
      }
      setPermissions(map)
      setLoading(false)
    }
    load()
  }, [user, profile])

  const canView   = (module) => isAdmin || !!permissions[module]?.can_view
  const canEdit   = (module) => isAdmin || !!permissions[module]?.can_edit
  const canDelete = (module) => isAdmin || !!permissions[module]?.can_delete

  // Returns which nav modules this user can see
  const visibleModules = isAdmin
    ? MODULES
    : MODULES.filter(m => permissions[m.key]?.can_view)

  return (
    <PermissionsContext.Provider value={{ permissions, loading, canView, canEdit, canDelete, visibleModules, isAdmin }}>
      {children}
    </PermissionsContext.Provider>
  )
}
