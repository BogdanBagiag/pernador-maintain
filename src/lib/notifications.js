import { supabase } from './supabase'

export const sendPushNotification = async ({
  userId,
  title,
  body,
  url,
  tag,
  workOrderId
}) => {
  try {
    // Send push notification via Edge Function
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { userId, title, body, url, tag, workOrderId }
    })

    // Log notification to database (even if sending failed)
    const logStatus = error ? 'failed' : 'sent'
    const errorMessage = error ? error.message : null

    await supabase
      .from('push_notifications_log')
      .insert({
        user_id: userId,
        work_order_id: workOrderId,
        title,
        body,
        url,
        tag,
        status: logStatus,
        error_message: errorMessage,
        notification_type: 'push'
      })
      .then(({ error: logError }) => {
        if (logError) {
          console.error('Failed to log notification:', logError)
        }
      })

    if (error) throw error
    return data
  } catch (err) {
    console.error('Send notification error:', err)
    return null // Don't throw - notifications are optional
  }
}

// ── Module-based helpers ───────────────────────────────────────

/**
 * Returnează toți userii care au permisiunea can_view pe un modul dat.
 * Adminii (role='admin') au mereu acces.
 */
export const getUsersWithModuleAccess = async (moduleKey) => {
  try {
    // Useri cu permisiune explicită
    const { data: permUsers } = await supabase
      .from('user_permissions')
      .select('user_id')
      .eq('module', moduleKey)
      .eq('can_view', true)

    // Useri admin
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    const ids = new Set([
      ...(permUsers || []).map((r) => r.user_id),
      ...(admins || []).map((r) => r.id),
    ])

    return Array.from(ids)
  } catch (err) {
    console.error('getUsersWithModuleAccess error:', err)
    return []
  }
}

/**
 * Trimite notificare push tuturor userilor cu acces la un modul.
 */
export const notifyModuleUsers = async ({ moduleKey, title, body, url, tag }) => {
  const userIds = await getUsersWithModuleAccess(moduleKey)
  await Promise.all(
    userIds.map((uid) =>
      sendPushNotification({ userId: uid, title, body, url, tag })
    )
  )
}

// Helpers per eveniment ──────────────────────────────────────────

export const notifyNouaComanda = (comanda) =>
  notifyModuleUsers({
    moduleKey: 'comenzi',
    title: '🛒 Comandă Nouă',
    body: comanda?.observatii
      ? `Comandă nouă: ${comanda.observatii.substring(0, 80)}`
      : 'O nouă comandă a fost primită',
    url: '/comenzi',
    tag: `comanda-${comanda?.id || Date.now()}`,
  })

export const notifyNouaReclamatie = (rec) =>
  notifyModuleUsers({
    moduleKey: 'reclamatii',
    title: '⚠️ Reclamație Nouă',
    body: rec?.descriere
      ? `Reclamație nouă: ${rec.descriere.substring(0, 80)}`
      : 'O nouă reclamație a fost înregistrată',
    url: '/reclamatii',
    tag: `reclamatie-${rec?.id || Date.now()}`,
  })

export const notifyNouRetur = () =>
  notifyModuleUsers({
    moduleKey: 'retururi',
    title: '↩️ Retur Nou',
    body: 'Un nou retur a fost înregistrat',
    url: '/retururi',
    tag: `retur-${Date.now()}`,
  })

// Helper: notify when work order is assigned
export const notifyWorkOrderAssigned = async (workOrder, assignedUser) => {
  if (!assignedUser?.id) {
    return
  }

  const title = workOrder.assigned_to 
    ? 'ðŸ”§ Nou Work Order Asignat' 
    : 'ðŸ”” Work Order Nou (Neasignat)'


  // Send to backend (which will try to send push)
  await sendPushNotification({
    userId: assignedUser.id,
    title,
    body: `${workOrder.title} - Prioritate: ${workOrder.priority}`,
    url: `/work-orders/${workOrder.id}`,
    tag: `wo-assigned-${workOrder.id}`,
    workOrderId: workOrder.id
  })

  // Also show local notification immediately
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        body: `${workOrder.title} - Prioritate: ${workOrder.priority}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: `/work-orders/${workOrder.id}` },
        tag: `wo-assigned-${workOrder.id}`,
        requireInteraction: true  // â† Stay visible!
      })
    } catch (err) {
      console.error('Local notification error:', err)
    }
  }
}

// Helper: notify when work order status changes
export const notifyWorkOrderStatusChange = async (workOrder, newStatus, userId) => {
  if (!userId) return

  const statusLabels = {
    open: 'Deschis',
    in_progress: 'ÃŽn Progres',
    on_hold: 'ÃŽn AÈ™teptare',
    completed: 'Finalizat',
    cancelled: 'Anulat'
  }

  return sendPushNotification({
    userId,
    title: 'ðŸ“‹ Status Actualizat',
    body: `${workOrder.title} â†’ ${statusLabels[newStatus]}`,
    url: `/work-orders/${workOrder.id}`,
    tag: `wo-status-${workOrder.id}`,
    workOrderId: workOrder.id
  })
}

// Helper: notify when comment is added
export const notifyWorkOrderComment = async (workOrder, comment, userToNotify) => {
  if (!userToNotify?.id) return

  return sendPushNotification({
    userId: userToNotify.id,
    title: 'ðŸ’¬ Comentariu Nou',
    body: `${workOrder.title}: ${comment.substring(0, 50)}...`,
    url: `/work-orders/${workOrder.id}`,
    tag: `wo-comment-${workOrder.id}`,
    workOrderId: workOrder.id
  })
}
