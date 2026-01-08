import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP from headers (set by Supabase/CDN)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('cf-connecting-ip') 
      || req.headers.get('x-real-ip')
      || 'unknown';

    console.log('Client IP detected:', clientIP);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const { action } = await req.json();

    if (action === 'register') {
      // Register/update user's presence with their IP
      const { data: existing } = await supabase
        .from('user_presence')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing presence
        const { error: updateError } = await supabase
          .from('user_presence')
          .update({
            ip_address: clientIP,
            last_seen: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
      } else {
        // Insert new presence
        const { error: insertError } = await supabase
          .from('user_presence')
          .insert({
            user_id: user.id,
            ip_address: clientIP,
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
      }

      console.log('Presence registered for user:', user.id, 'IP:', clientIP);

      return new Response(
        JSON.stringify({ success: true, ip: clientIP }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'find') {
      // First, get user's current IP from presence
      const { data: userPresence } = await supabase
        .from('user_presence')
        .select('ip_address')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userPresence) {
        return new Response(
          JSON.stringify({ users: [], message: 'Register presence first' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find other users with same IP (same network)
      // Only show users active in last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data: nearbyPresence, error: findError } = await supabase
        .from('user_presence')
        .select('user_id')
        .eq('ip_address', userPresence.ip_address)
        .neq('user_id', user.id)
        .gte('last_seen', fiveMinutesAgo);

      if (findError) {
        console.error('Find error:', findError);
        throw findError;
      }

      console.log('Found nearby users:', nearbyPresence?.length || 0);

      if (!nearbyPresence || nearbyPresence.length === 0) {
        return new Response(
          JSON.stringify({ users: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user profiles for nearby users
      const nearbyUserIds = nearbyPresence.map(p => p.user_id);
      
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, connection_code')
        .in('id', nearbyUserIds);

      if (profileError) {
        console.error('Profile error:', profileError);
        throw profileError;
      }

      // Filter out already connected users
      const { data: existingConnections } = await supabase
        .from('connections')
        .select('user1_id, user2_id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const connectedUserIds = new Set(
        (existingConnections || []).flatMap(conn => [conn.user1_id, conn.user2_id])
      );

      const filteredProfiles = (profiles || []).filter(
        p => !connectedUserIds.has(p.id)
      );

      console.log('Returning', filteredProfiles.length, 'nearby users');

      return new Response(
        JSON.stringify({ users: filteredProfiles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Edge function error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
