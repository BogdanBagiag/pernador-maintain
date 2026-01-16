import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔔 Starting work order reminder check...')

    // Fetch reminder settings from database
    const { data: reminderSettings, error: settingsError } = await supabase
      .from('reminder_settings')
      .select('*')

    if (settingsError) {
      console.error('Error fetching reminder settings:', settingsError)
      throw settingsError
    }

    // Convert to lookup object
    const settings = {}
    reminderSettings.forEach(s => {
      settings[s.priority] = {
        firstReminder: parseFloat(s.first_reminder_hours),
        escalateManager: parseFloat(s.escalate_manager_hours),
        escalateAdmin: s.escalate_admin_hours ? parseFloat(s.escalate_admin_hours) : null
      }
    })

    console.log('⚙️ Using reminder settings:', settings)

    // Get all unresolved work orders
    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select(`
        id,
        title,
        priority,
        status,
        created_at,
        assigned_to,
        equipment:equipment(name),
        location:locations(name)
      `)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: true })

    if (woError) {
      console.error('Error fetching work orders:', woError)
      throw woError
    }

    console.log(`📊 Found ${workOrders?.length || 0} unresolved work orders`)

    const remindersToSend = []

    for (const wo of workOrders || []) {
      const age = Date.now() - new Date(wo.created_at).getTime()
      const ageHours = age / (1000 * 60 * 60)
      
      console.log(`⏰ Checking WO ${wo.id} (${wo.priority}): ${ageHours.toFixed(1)}h old`)

      const config = settings[wo.priority]
      if (!config) {
        console.log(`⚠️ No settings found for priority: ${wo.priority}`)
        continue
      }

      let shouldSendReminder = false
      let reminderLevel = 'initial'
      let targetUsers = []

      // Get existing reminders for this work order
      const { data: existingReminders } = await supabase
        .from('work_order_reminders')
        .select('reminder_level, sent_to')
        .eq('work_order_id', wo.id)

      const sentLevels = new Set(existingReminders?.map(r => r.reminder_level) || [])

      // Check escalation to admin
      if (config.escalateAdmin && ageHours >= config.escalateAdmin && !sentLevels.has('escalation_admin')) {
        reminderLevel = 'escalation_admin'
        shouldSendReminder = true
        const { data: admins } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'admin')
          .eq('is_active', true)
        targetUsers = admins || []
      }
      // Check escalation to manager
      else if (config.escalateManager && ageHours >= config.escalateManager && !sentLevels.has('escalation_manager')) {
        reminderLevel = 'escalation_manager'
        shouldSendReminder = true
        const { data: managers } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'manager')
          .eq('is_active', true)
        targetUsers = managers || []
      }
      // Check first reminder
      else if (config.firstReminder && ageHours >= config.firstReminder && !sentLevels.has('first_reminder')) {
        reminderLevel = 'first_reminder'
        shouldSendReminder = true
        if (wo.assigned_to) {
          const { data: assigned } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', wo.assigned_to)
            .single()
          targetUsers = assigned ? [assigned] : []
        } else {
          const { data: techs } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'technician')
            .eq('is_active', true)
          targetUsers = techs || []
        }
      }

      if (shouldSendReminder && targetUsers.length > 0) {
        console.log(`✅ Sending ${reminderLevel} for WO ${wo.id} to ${targetUsers.length} user(s)`)
        
        const itemName = wo.equipment?.name || wo.location?.name || 'Unknown'
        
        // Prepare notification title and body based on reminder level
        let title = '🔔 Reminder: Work Order Nerezonvat'
        let body = `${wo.title} - ${itemName}`
        
        if (reminderLevel === 'escalation_admin') {
          title = '🚨 ESCALARE ADMIN: Work Order Critic'
          body = `URGENT: ${wo.title} - ${itemName} (${ageHours.toFixed(0)}h nerezonvat)`
        } else if (reminderLevel === 'escalation_manager') {
          title = '⚠️ ESCALARE MANAGER: Work Order Întârziat'
          body = `Atenție: ${wo.title} - ${itemName} (${ageHours.toFixed(0)}h nerezonvat)`
        } else if (reminderLevel === 'first_reminder') {
          title = '⏰ Reminder: Work Order în Așteptare'
          body = `${wo.title} - ${itemName} (${ageHours.toFixed(0)}h în așteptare)`
        }

        for (const user of targetUsers) {
          remindersToSend.push({
            work_order_id: wo.id,
            reminder_level: reminderLevel,
            sent_to: user.id,
            userId: user.id,
            title,
            body,
            url: `/work-orders/${wo.id}`,
            tag: `wo-reminder-${wo.id}-${reminderLevel}`,
            workOrderId: wo.id
          })
        }
      }
    }

    console.log(`📤 Sending ${remindersToSend.length} total reminders`)

    // Send all reminders
    let successCount = 0
    let failCount = 0

    for (const reminder of remindersToSend) {
      try {
        // Send push notification
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: reminder.userId,
            title: reminder.title,
            body: reminder.body,
            url: reminder.url,
            tag: reminder.tag,
            workOrderId: reminder.workOrderId
          }
        })

        if (pushError) {
          console.error(`Failed to send push notification to user ${reminder.userId}:`, pushError)
          failCount++
        } else {
          // Record the reminder in the database
          const { error: dbError } = await supabase
            .from('work_order_reminders')
            .insert({
              work_order_id: reminder.work_order_id,
              reminder_level: reminder.reminder_level,
              sent_to: reminder.sent_to
            })

          if (dbError) {
            console.error('Failed to record reminder:', dbError)
          }
          
          successCount++
        }
      } catch (err) {
        console.error('Error sending reminder:', err)
        failCount++
      }
    }

    console.log(`✅ Reminders sent: ${successCount} success, ${failCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${workOrders?.length || 0} work orders, sent ${successCount} reminders`,
        stats: {
          workOrdersChecked: workOrders?.length || 0,
          remindersSent: successCount,
          remindersFailed: failCount
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in work order reminders function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
