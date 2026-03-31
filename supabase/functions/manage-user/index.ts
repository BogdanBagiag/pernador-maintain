import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userToken, action, targetUserId, newRole, permissions, newPassword } = await req.json()

    // Verificam identity adminului din JWT
    if (!userToken) {
      return new Response(JSON.stringify({ error: 'Token lipsa' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let adminUserId: string
    try {
      const base64 = userToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(base64))
      adminUserId = payload.sub
      if (!adminUserId) throw new Error('sub missing')
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Token invalid' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificam ca e admin
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', adminUserId).single()

    if (adminProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acces interzis' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!targetUserId || !action) {
      return new Response(JSON.stringify({ error: 'targetUserId si action sunt obligatorii' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Nu permite sa te stergi/modifici pe tine insuti
    if (targetUserId === adminUserId && action !== 'update_role') {
      return new Response(JSON.stringify({ error: 'Nu poti efectua aceasta operatiune pe propriul cont' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'delete':
        updateData = { is_active: false }
        break
      case 'reactivate':
        updateData = { is_active: true }
        break
      case 'approve':
        updateData = { is_approved: true, is_active: true }
        break
      case 'reject':
        updateData = { is_active: false }
        break
      case 'update_role':
        if (!newRole) {
          return new Response(JSON.stringify({ error: 'newRole este obligatoriu pentru update_role' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        updateData = { role: newRole }
        break
      case 'reset_password': {
        if (!newPassword || newPassword.length < 6) {
          return new Response(JSON.stringify({ error: 'Parola trebuie sa aiba cel putin 6 caractere' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: newPassword })
        if (pwError) {
          return new Response(JSON.stringify({ error: pwError.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      case 'save_permissions': {
        if (!permissions || !Array.isArray(permissions)) {
          return new Response(JSON.stringify({ error: 'permissions array este obligatoriu' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const { error: upsertError } = await supabaseAdmin
          .from('user_permissions')
          .upsert(permissions, { onConflict: 'user_id,module' })
        if (upsertError) {
          return new Response(JSON.stringify({ error: upsertError.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      default:
        return new Response(JSON.stringify({ error: `Actiune necunoscuta: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', targetUserId)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Eroare neasteptata: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
