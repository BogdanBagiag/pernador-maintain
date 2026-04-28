import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Configurare per modul.
 * FĂRĂ filtru server-side — filtrăm client-side pentru maxim compatibilitate
 * (filtrul server-side Supabase Realtime necesită REPLICA IDENTITY FULL pe tabel).
 */
const MODULE_NOTIF_CONFIG = [
  {
    table: 'com_comenzi',
    module: 'comenzi',
    // Notificăm doar dacă comanda e nouă (status 'noi')
    clientFilter: (rec) => rec.status === 'noi',
    title: '🛒 Comandă Nouă',
    getBody: (rec) => `O nouă comandă a fost primită${rec.observatii ? ': ' + rec.observatii.substring(0, 60) : ''}`,
    url: '/comenzi',
    badgeKeys: [['badge_comenzi']],
  },
  {
    table: 'reclamatii',
    module: 'reclamatii',
    title: '⚠️ Reclamație Nouă',
    getBody: (rec) => `Reclamație nouă înregistrată${rec.descriere ? ': ' + rec.descriere.substring(0, 60) : ''}`,
    url: '/reclamatii',
    badgeKeys: [['badge_reclamatii']],
  },
  {
    table: 'retururi',
    module: 'retururi',
    title: '↩️ Retur Nou',
    getBody: () => 'Un nou retur a fost înregistrat',
    url: '/retururi',
    badgeKeys: [['badge_retururi']],
  },
  {
    table: 'work_orders',
    module: 'work_orders',
    clientFilter: (rec) => rec.status === 'open',
    title: '🔧 Work Order Nou',
    getBody: (rec) => rec.title || 'Un nou work order a fost creat',
    url: '/work-orders',
    badgeKeys: [['badge_work_orders']],
  },
]

async function showBrowserNotif(title, body, url, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
      tag,
      requireInteraction: false,
    })
  } catch (err) {
    console.error('[Notif] showNotification error:', err)
  }
}

export function useRealtimeNotifications() {
  const { user } = useAuth()
  // Extragem isAdmin și permissions direct (valori primitive/obiecte stabile)
  // pentru a evita canView (funcție nouă la fiecare render) în dependency array
  const { isAdmin, permissions, loading: permLoading } = usePermissions()
  const queryClient = useQueryClient()
  const seenIds = useRef(new Set())
  // Ref pentru permissions ca să fie accesibil în closure fără a reporni efectul
  const permRef = useRef({ isAdmin, permissions })
  permRef.current = { isAdmin, permissions }

  useEffect(() => {
    if (!user || permLoading) return

    const canViewModule = (moduleKey) => {
      const { isAdmin: adm, permissions: perms } = permRef.current
      return adm || !!perms[moduleKey]?.can_view
    }

    const channels = []

    for (const cfg of MODULE_NOTIF_CONFIG) {
      if (!canViewModule(cfg.module)) continue

      const ch = supabase
        .channel(`notif_${cfg.table}_${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: cfg.table },
          (payload) => {
            const rec = payload.new || {}
            const id = rec.id

            // Filtru client-side (ex. doar comenzi cu status='noi')
            if (cfg.clientFilter && !cfg.clientFilter(rec)) return

            // Evită notificări duplicate la reconectare
            const key = `${cfg.table}:${id}`
            if (id && seenIds.current.has(key)) return
            if (id) seenIds.current.add(key)

            console.log(`[Notif] Eveniment nou pe ${cfg.table}:`, rec)

            // Invalidează badge-urile din sidebar
            for (const bKey of cfg.badgeKeys) {
              queryClient.invalidateQueries({ queryKey: bKey })
            }

            // Notificare browser
            showBrowserNotif(
              cfg.title,
              cfg.getBody(rec),
              cfg.url,
              `${cfg.table}-${id || Date.now()}`
            )
          }
        )
        .subscribe((status) => {
          console.log(`[Notif] Canal ${cfg.table} status:`, status)
        })

      channels.push(ch)
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, permLoading])
  // ^ Folosim user.id (string stabil) în loc de user (obiect nou la fiecare render)
  //   și permLoading. Permissions sunt citite via ref la momentul evenimentului.
}
