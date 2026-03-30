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
    // 1. Cream clientul admin cu service_role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Citim body-ul — userToken e JWT-ul adminului trimis din frontend
    const { userToken, email, password, full_name, role } = await req.json()

    if (!userToken) {
      return new Response(JSON.stringify({ error: 'Token lipsa' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Decodam JWT-ul pentru a obtine user ID (base64url → base64)
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

    // 4. Verificam ca utilizatorul e admin in baza de date
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (adminProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: `Acces interzis (rol: ${adminProfile?.role ?? 'necunoscut'})` }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Validam datele noului utilizator

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email si parola sunt obligatorii' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Cream utilizatorul in auth (confirmat automat, activ imediat)
    let newUserId: string
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || '',
        role: role || 'technician',
        invited_by: adminUserId,
      },
    })

    if (createError) {
      // Daca emailul exista deja in auth, cautam userul si ii reparam profilul
      const alreadyExists =
        createError.message.toLowerCase().includes('already') ||
        createError.message.toLowerCase().includes('registered') ||
        createError.message.toLowerCase().includes('exists')

      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Gasim userul existent dupa email
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) {
        return new Response(JSON.stringify({ error: `Nu am putut gasi userul existent: ${listError.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const existingAuthUser = users?.find(u => u.email === email)
      if (!existingAuthUser) {
        return new Response(JSON.stringify({ error: 'Emailul exista deja dar nu am putut gasi contul' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Actualizam parola si metadatele
      await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || '', role: role || 'technician' },
      })

      newUserId = existingAuthUser.id
    } else {
      if (!newUser?.user?.id) {
        return new Response(JSON.stringify({ error: 'Utilizatorul a fost creat dar ID-ul lipseste' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      newUserId = newUser.user.id
    }

    // 7. Cream/actualizam profilul (verificam daca exista deja din trigger DB)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', newUserId)
      .maybeSingle()

    const profileData = {
      email,
      full_name: full_name || '',
      role: role || 'technician',
      is_approved: true,
      is_active: true,
    }

    const { error: profileError } = existingProfile
      ? await supabaseAdmin.from('profiles').update(profileData).eq('id', newUserId)
      : await supabaseAdmin.from('profiles').insert({ id: newUserId, ...profileData })

    if (profileError) {
      console.error('Profile error:', profileError.message)
      return new Response(JSON.stringify({
        error: `Cont creat dar profilul a esuat: ${profileError.message}`,
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Unexpected error:', err.message)
    return new Response(
      JSON.stringify({ error: `Eroare neasteptata: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
