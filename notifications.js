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
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: { userId, title, body, url, tag, workOrderId }
    })

    if (error) throw error
    return data
  } catch (err) {
    console.error('Send notification error:', err)
    return null // Don't throw - notifications are optional
  }
}

// Helper: notify when work order is assigned
export const notifyWorkOrderAssigned = async (workOrder, assignedUser) => {
  console.log('📨 notifyWorkOrderAssigned called:', {
    workOrderId: workOrder?.id,
    workOrderTitle: workOrder?.title,
    userId: assignedUser?.id,
    userName: assignedUser?.full_name
  })
  
  if (!assignedUser?.id) {
    console.log('❌ No assigned user ID')
    return
  }

  const title = workOrder.assigned_to 
    ? '🔧 Nou Work Order Asignat' 
    : '🔔 Work Order Nou (Neasignat)'

  console.log('📤 Sending notification:', title)

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
      console.log('🔔 Showing local notification via service worker')
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, {
        body: `${workOrder.title} - Prioritate: ${workOrder.priority}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: `/work-orders/${workOrder.id}` },
        tag: `wo-assigned-${workOrder.id}`,
        requireInteraction: true  // ← Stay visible!
      })
      console.log('✅ Local notification shown!')
    } catch (err) {
      console.error('❌ Local notification error:', err)
    }
  } else {
    console.log('❌ Service worker not available')
  }
}

// Helper: notify when work order status changes
export const notifyWorkOrderStatusChange = async (workOrder, newStatus, userId) => {
  if (!userId) return

  const statusLabels = {
    open: 'Deschis',
    in_progress: 'În Progres',
    on_hold: 'În Așteptare',
    completed: 'Finalizat',
    cancelled: 'Anulat'
  }

  return sendPushNotification({
    userId,
    title: '📋 Status Actualizat',
    body: `${workOrder.title} → ${statusLabels[newStatus]}`,
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
    title: '💬 Comentariu Nou',
    body: `${workOrder.title}: ${comment.substring(0, 50)}...`,
    url: `/work-orders/${workOrder.id}`,
    tag: `wo-comment-${workOrder.id}`,
    workOrderId: workOrder.id
  })
}
