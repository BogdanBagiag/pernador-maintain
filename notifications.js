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
  if (!assignedUser?.id) return

  return sendPushNotification({
    userId: assignedUser.id,
    title: '🔧 Nou Work Order Asignat',
    body: `${workOrder.title} - Prioritate: ${workOrder.priority}`,
    url: `/work-orders/${workOrder.id}`,
    tag: `wo-assigned-${workOrder.id}`,
    workOrderId: workOrder.id
  })
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
