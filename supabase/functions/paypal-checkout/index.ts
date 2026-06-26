import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SANDBOX — после тестов меняем на https://api-m.paypal.com
const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";
const PRINTFUL_API = "https://api.printful.com";

async function getPayPalToken(): Promise<string> {
  const clientId     = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function createPrintfulOrder(variantId: number, shipping: any, paypalOrderId: string) {
  const res = await fetch(`${PRINTFUL_API}/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("PRINTFUL_API_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: paypalOrderId,
      shipping: "STANDARD",
      recipient: shipping,
      items: [{ sync_variant_id: variantId, quantity: 1 }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Printful error: ${JSON.stringify(data)}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, variantId, price, paypalOrderId, shipping } = body;

    // ── CREATE: фронт вызывает при инициализации PayPal кнопки ───────────────
    if (action === "create_order") {
      const token = await getPayPalToken();
      const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            custom_id: String(variantId),
            description: `Vice City Hub Merch — Variant #${variantId}`,
            amount: { currency_code: "USD", value: parseFloat(price).toFixed(2) },
          }],
          application_context: { shipping_preference: "GET_FROM_FILE" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      return new Response(JSON.stringify({ id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CAPTURE: вызывается после одобрения покупателем ──────────────────────
    if (action === "capture_order") {
      const token = await getPayPalToken();
      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const captureData = await captureRes.json();
      if (!captureRes.ok) throw new Error(JSON.stringify(captureData));

      // Извлекаем адрес из ответа PayPal
      const payer = captureData.payer;
      const addr  = captureData.purchase_units?.[0]?.shipping?.address || {};
      const shipTo = {
        name:         `${payer?.name?.given_name || ""} ${payer?.name?.surname || ""}`.trim(),
        email:        payer?.email_address || "",
        address1:     addr.address_line_1  || "",
        city:         addr.admin_area_2    || "",
        state_code:   addr.admin_area_1    || "",
        country_code: addr.country_code    || "US",
        zip:          addr.postal_code     || "",
      };

      // Создаём заказ в Printful
      const pVariantId = parseInt(captureData.purchase_units?.[0]?.custom_id || variantId);
      const printfulOrder = await createPrintfulOrder(pVariantId, shipTo, paypalOrderId);

      return new Response(JSON.stringify({
        success: true,
        printful_order_id: printfulOrder?.result?.id,
        paypal_capture_id: captureData.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("paypal-checkout error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
