import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== 'string') {
      return new Response(JSON.stringify({ error: 'imageUrl is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are a strict image moderator for a school messaging app used by minors. Flag any image that contains nudity, sexual content, graphic violence, gore, hate symbols, illegal drugs, weapons used threateningly, or explicit/profane text overlays. Memes and casual photos are fine.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this image and classify it.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'classify_image',
              description: 'Return moderation verdict for the image.',
              parameters: {
                type: 'object',
                properties: {
                  safe: { type: 'boolean', description: 'true if image is appropriate for minors' },
                  category: {
                    type: 'string',
                    enum: ['safe', 'nudity', 'violence', 'hate', 'drugs', 'weapons', 'profanity', 'other'],
                  },
                  reason: { type: 'string', description: 'Short explanation if not safe' },
                },
                required: ['safe', 'category', 'reason'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'classify_image' } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('AI gateway error', response.status, text);
      if (response.status === 429 || response.status === 402) {
        // Fail open on quota issues so chats don't break
        return new Response(JSON.stringify({ safe: true, category: 'safe', reason: 'moderation unavailable' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ safe: true, category: 'safe', reason: 'moderation error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;

    if (!args) {
      return new Response(JSON.stringify({ safe: true, category: 'safe', reason: 'no verdict' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('moderate-image error', e);
    return new Response(JSON.stringify({ safe: true, category: 'safe', reason: 'exception' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
