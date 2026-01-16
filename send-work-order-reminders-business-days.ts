// Supabase Edge Function: send-work-order-reminders-business-days
// Checks for work orders needing reminders based on BUSINESS DAYS
// Runs daily but only sends notifications on business days at scheduled time

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WorkOrderNeedingReminder {
  id: string
  title: string
  priority: string
  status: string
  assigned_to: string | null
  created_by: string
  created_at: string
  business_days_since_creation: number
  next_reminder_level: 'first' | 'manager' | 'admin'
  next_reminder_day: number
  reminder_count: number
}

interface Recipient {
  user_id: string
  email: string
  full_name: string
  role: string
}

interface ReminderSchedule {
  notification_time: string // "08:00"
  work_days: string // "1,2,3,4,5"
  timezone: string // "Europe/Bucharest"
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting business day reminder check...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get reminder schedule settings
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('reminder_schedule')
      .select('setting_key, setting_value')

    if (scheduleError) {
      console.error('❌ Error fetching schedule:', scheduleError)
      throw scheduleError
    }

    const schedule: ReminderSchedule = {
      notification_time: '08:00',
      work_days: '1,2,3,4,5',
      timezone: 'Europe/Bucharest'
    }

    scheduleData?.forEach(item => {
      if (item.setting_key === 'notification_time') schedule.notification_time = item.setting_value
      if (item.setting_key === 'work_days') schedule.work_days = item.setting_value
      if (item.setting_key === 'timezone') schedule.timezone = item.setting_value
    })

    console.log('📅 Schedule settings:', schedule)

    // Check if today is a business day
    const { data: isBusinessDay, error: businessDayError } = await supabase
      .rpc('is_business_day')

    if (businessDayError || !isBusinessDay) {
      console.log('⏸️ Not a business day - skipping')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Not a business day', 
          sent: 0,
          isBusinessDay: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if current time matches notification time (with 1 hour tolerance)
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const [notificationHour, notificationMinute] = schedule.notification_time.split(':').map(Number)

    // Only run if we're within the notification hour (e.g., 08:00-08:59)
    if (currentHour !== notificationHour) {
      console.log(`⏰ Not notification time yet. Current: ${currentHour}:${currentMinute}, Target: ${notificationHour}:${notificationMinute}`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Not notification time', 
          sent: 0,
          currentTime: `${currentHour}:${currentMinute}`,
          targetTime: schedule.notification_time
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Business day confirmed, notification time matches')

    // Get work orders that need reminders
    const { data: workOrders, error: woError } = await supabase
      .from('work_orders_needing_reminders')
      .select('*')

    if (woError) {
      console.error('❌ Error fetching work orders:', woError)
      throw woError
    }

    if (!workOrders || workOrders.length === 0) {
      console.log('✅ No work orders need reminders at this time')
      return new Response(
        JSON.stringify({ success: true, message: 'No reminders needed', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${workOrders.length} work orders needing reminders`)

    const results = []
    let totalNotificationsSent = 0

    // Process each work order
    for (const wo of workOrders as WorkOrderNeedingReminder[]) {
      try {
        console.log(`Processing WO ${wo.id.slice(0, 8)}: ${wo.title} [${wo.priority}] - Day ${wo.business_days_since_creation}, Level: ${wo.next_reminder_level}`)

        // Get recipients for this reminder level
        const { data: recipients, error: recipientsError } = await supabase
          .rpc('get_reminder_recipients', {
            p_work_order_id: wo.id,
            p_reminder_level: wo.next_reminder_level
          })

        if (recipientsError) {
          console.error(`❌ Error getting recipients for WO ${wo.id}:`, recipientsError)
          continue
        }

        if (!recipients || recipients.length === 0) {
          console.log(`⚠️ No recipients found for WO ${wo.id}`)
          continue
        }

        const typedRecipients = recipients as Recipient[]
        console.log(`👥 Found ${typedRecipients.length} recipients`)

        // Prepare notification message
        const priorityEmoji: Record<string, string> = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢'
        }

        const levelPrefix: Record<string, string> = {
          first: `⏰ Reminder - Ziua ${wo.business_days_since_creation}`,
          manager: `⚠️ ESCALARE MANAGER - Ziua ${wo.business_days_since_creation}`,
          admin: `🚨 ESCALARE ADMIN - Ziua ${wo.business_days_since_creation}`
        }

        const title = `${levelPrefix[wo.next_reminder_level]}: WO #${wo.id.slice(0, 8)}`
        const body = `${priorityEmoji[wo.priority] || '📋'} ${wo.title}\n` +
                     `Prioritate: ${wo.priority.toUpperCase()}\n` +
                     `Status: ${wo.status}\n` +
                     `Deschis de ${wo.business_days_since_creation} zile de lucru`

        // Send notifications to each recipient
        for (const recipient of typedRecipients) {
          try {
            // Get user's notification subscriptions
            const { data: subscriptions } = await supabase
              .from('notification_subscriptions')
              .select('subscription')
              .eq('user_id', recipient.user_id)

            if (!subscriptions || subscriptions.length === 0) {
              console.log(`⚠️ No subscriptions for user ${recipient.full_name}`)
              continue
            }

            // Send push notification to each subscription
            for (const sub of subscriptions) {
              try {
                const response = await fetch('https://fcm.googleapis.com/fcm/send', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`
                  },
                  body: JSON.stringify({
                    to: sub.subscription.endpoint.split('/').pop(),
                    notification: {
                      title,
                      body,
                      icon: '/icon192.png',
                      badge: '/icon192.png',
                      data: {
                        url: `/work-orders/${wo.id}`,
                        workOrderId: wo.id,
                        businessDay: wo.business_days_since_creation
                      }
                    }
                  })
                })

                if (response.ok) {
                  totalNotificationsSent++
                  console.log(`✅ Notification sent to ${recipient.full_name}`)
                } else {
                  console.log(`⚠️ Failed to send to ${recipient.full_name}`)
                }
              } catch (pushError) {
                console.error(`❌ Push error for ${recipient.full_name}:`, pushError)
              }
            }
          } catch (userError) {
            console.error(`❌ Error processing user ${recipient.user_id}:`, userError)
          }
        }

        // Record the reminder in the database
        const { error: insertError } = await supabase
          .from('work_order_reminders')
          .insert({
            work_order_id: wo.id,
            reminder_level: wo.next_reminder_level,
            business_day: wo.business_days_since_creation,
            sent_to: typedRecipients.map(r => r.user_id)
          })

        if (insertError) {
          console.error(`❌ Error recording reminder for WO ${wo.id}:`, insertError)
        } else {
          console.log(`✅ Recorded reminder for WO ${wo.id} - Day ${wo.business_days_since_creation}`)
        }

        results.push({
          workOrderId: wo.id,
          level: wo.next_reminder_level,
          businessDay: wo.business_days_since_creation,
          recipients: typedRecipients.length,
          success: true
        })

      } catch (woError) {
        console.error(`❌ Error processing work order ${wo.id}:`, woError)
        results.push({
          workOrderId: wo.id,
          error: woError.message,
          success: false
        })
      }
    }

    console.log(`✅ Reminder check complete. Sent ${totalNotificationsSent} notifications for ${results.length} work orders`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} work orders`,
        sent: totalNotificationsSent,
        isBusinessDay: true,
        notificationTime: schedule.notification_time,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Fatal error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
