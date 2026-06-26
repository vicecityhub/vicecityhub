import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const printfulToken = Deno.env.get('PRINTFUL_API_TOKEN');

    if (!printfulToken) {
      return new Response(JSON.stringify({ error: "Токен не найден в Supabase Secrets" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Жестко привязываем ID твоего магазина VCH
    const storeId = 18377240;

    // Запрашиваем товары конкретно из магазина VCH
    const productsResponse = await fetch(`https://api.printful.com/store/products?store_id=${storeId}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${printfulToken}`,
        'Content-Type': 'application/json'
      }
    });

    const productsData = await productsResponse.json();

    return new Response(JSON.stringify(productsData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})