// Supabase Edge Function: send-whatsapp
// Deploy with: supabase functions deploy send-whatsapp
// File: supabase/functions/send-whatsapp/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { messageId, provider } = body;

    if (!messageId) {
      return new Response(JSON.stringify({ error: "messageId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch message record
    const { data: message, error: msgError } = await supabaseClient
      .from("whatsapp_messages")
      .select("*, guests(invitation_id)")
      .eq("id", messageId)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get WhatsApp settings for this user
    const { data: waSettings } = await supabaseClient
      .from("whatsapp_settings")
      .select("*")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!waSettings?.api_key) {
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Normalize phone number (Indonesian format)
    let phone = message.phone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "62" + phone.slice(1);
    if (!phone.startsWith("62")) phone = "62" + phone;

    let providerResult: { success: boolean; response: Record<string, unknown> } = { success: false, response: {} };

    // Send based on provider
    switch (waSettings.provider || provider) {
      case "fonnte": {
        const res = await fetch("https://api.fonnte.com/send", {
          method: "POST",
          headers: {
            "Authorization": waSettings.api_key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: phone,
            message: message.message,
          }),
        });
        const data = await res.json();
        providerResult = { success: data.status === true, response: data };
        break;
      }

      case "wablas": {
        const res = await fetch("https://solo.wablas.com/api/send-message", {
          method: "POST",
          headers: {
            "Authorization": waSettings.api_key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phone,
            message: message.message,
          }),
        });
        const data = await res.json();
        providerResult = { success: data.status === true, response: data };
        break;
      }

      case "whacenter": {
        const res = await fetch("https://app.whacenter.com/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: waSettings.sender_number,
            token: waSettings.api_key,
            number: phone,
            message: message.message,
          }),
        });
        const data = await res.json();
        providerResult = { success: data.status === "success", response: data };
        break;
      }

      default: {
        return new Response(JSON.stringify({ error: "Unsupported provider" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Update message record
    await supabaseClient
      .from("whatsapp_messages")
      .update({
        status: providerResult.success ? "sent" : "failed",
        sent_at: providerResult.success ? new Date().toISOString() : null,
        provider_response: providerResult.response,
        error_message: providerResult.success ? null : JSON.stringify(providerResult.response),
      })
      .eq("id", messageId);

    // If sent, mark guest as WA sent
    if (providerResult.success && message.guest_id) {
      await supabaseClient
        .from("guests")
        .update({ whatsapp_sent: true, whatsapp_sent_at: new Date().toISOString() })
        .eq("id", message.guest_id);
    }

    return new Response(
      JSON.stringify({ success: providerResult.success, data: providerResult.response }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("send-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
