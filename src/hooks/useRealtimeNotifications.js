import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Configurare per modul: tabel, filtru, titlu și badge invalidation key.
 */
const MODULE_NOTIF_CONFIG = [
  {
    table: 'com_comenzi',
    module: 'comenzi',
    filter: 'status=eq.noi',
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
    filter: 'status=eq.open',
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
  const { canView, loading: permLoading } = usePermissions()
  const queryClient = useQueryClient()
  // Track last seen IDs to avoid double-notifying on reconnect
  const seenIds = useRef(new Set())

  useEffect(() => {
    if (!user || permLoading) return

    const channels = []

    for (const cfg of MODULE_NOTIF_CONFIG) {
      if (!canView(cfg.module)) continue

      const channelOpts = {
        event: 'INSERT',
        schema: 'public',
        table: cfg.table,
        ...(cfg.filter ? { filter: cfg.filter } : {}),
      }

      const ch = supabase
        .channel(`notif_${cfg.table}_${user.id}`)
        .on('postgres_changes', channelOpts, (payload) => {
          const rec = payload.new || {}
          const id = rec.id

          // Evită notificări duplicate la reconectare
          if (id && seenIds.current.has(`${cfg.table}:${id}`)) return
          if (id) seenIds.current.add(`${cfg.table}:${id}`)

          // Invalidează badge-urile
          for (const key of cfg.badgeKeys) {
            queryClient.invalidateQueries({ queryKey: key })
          }

          // Afișează notificare browser
          const body = cfg.getBody(rec)
          showBrowserNotif(cfg.title, body, cfg.url, `${cfg.table}-${id || Date.now()}`)
        })
        .subscribe()

      channels.push(ch)
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [user, permLoading, canView, queryClient])
}
