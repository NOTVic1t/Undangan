// Supabase Edge Function: payment-webhook
// Deploy with: supabase functions deploy payment-webhook
// File: supabase/functions/payment-webhook/index.ts
// Configure webhook URLs in Midtrans/Xendit dashboards:
//   https://YOUR_PROJECT.supabase.co/functions/v1/payment-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "midtrans";
    const body = await req.json();

    console.log(`Payment webhook from ${provider}:`, JSON.stringify(body));

    if (provider === "midtrans") {
      return await handleMidtrans(body, supabase);
    } else if (provider === "xendit") {
      return await handleXendit(body, req, supabase);
    } else if (provider === "tripay") {
      return await handleTripay(body, req, supabase);
    }

    return new Response(JSON.stringify({ error: "Unknown provider" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Payment webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function handleMidtrans(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { order_id, transaction_status, gross_amount, payment_type, signature_key } = body as {
    order_id: string;
    transaction_status: string;
    gross_amount: string;
    payment_type: string;
    signature_key: string;
    transaction_id?: string;
  };

  // Verify signature
  const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY") ?? "";
  const transactionId = (body as { transaction_id?: string }).transaction_id ?? "";
  const statusCode = (body as { status_code?: string }).status_code ?? "";
  const expectedSig = createHmac("sha512", serverKey)
    .update(`${order_id}${statusCode}${gross_amount}${serverKey}`)
    .digest("hex");

  if (expectedSig !== signature_key) {
    console.warn("Invalid Midtrans signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const statusMap: Record<string, string> = {
    capture: "paid",
    settlement: "paid",
    pending: "pending",
    deny: "failed",
    expire: "expired",
    cancel: "failed",
    refund: "refunded",
  };

  const paymentStatus = statusMap[transaction_status] ?? "pending";

  const updateData: Record<string, unknown> = {
    status: paymentStatus,
    payment_method: payment_type,
    provider_transaction_id: transactionId,
    provider_response: body,
    updated_at: new Date().toISOString(),
  };

  if (paymentStatus === "paid") {
    updateData.paid_at = new Date().toISOString();
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .update(updateData)
    .eq("provider_order_id", order_id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update payment:", error);
    return new Response(JSON.stringify({ error: "DB update failed" }), { status: 500 });
  }

  // If paid, activate invitation
  if (paymentStatus === "paid" && payment?.invitation_id) {
    await supabase
      .from("invitations")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", payment.invitation_id)
      .eq("status", "draft");

    // Send notification
    await supabase.from("notifications").insert({
      user_id: payment.customer_id,
      invitation_id: payment.invitation_id,
      type: "payment",
      title: "Pembayaran Berhasil!",
      message: `Undangan Anda telah aktif. Paket ${payment.package_name} berhasil diproses.`,
      data: { payment_id: payment.id, amount: payment.amount },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
}

async function handleXendit(body: Record<string, unknown>, req: Request, supabase: ReturnType<typeof createClient>) {
  // Verify Xendit webhook token
  const xenditToken = Deno.env.get("XENDIT_WEBHOOK_TOKEN") ?? "";
  const headerToken = req.headers.get("x-callback-token") ?? "";

  if (xenditToken && headerToken !== xenditToken) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }

  const { external_id, status, paid_amount, payment_method } = body as {
    external_id: string;
    status: string;
    paid_amount: number;
    payment_method: string;
  };

  const statusMap: Record<string, string> = {
    PAID: "paid",
    SETTLED: "paid",
    EXPIRED: "expired",
    FAILED: "failed",
  };

  const paymentStatus = statusMap[status] ?? "pending";
  const updateData: Record<string, unknown> = {
    status: paymentStatus,
    payment_method: payment_method,
    provider_response: body,
    updated_at: new Date().toISOString(),
  };

  if (paymentStatus === "paid") {
    updateData.paid_at = new Date().toISOString();
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .update(updateData)
    .eq("provider_order_id", external_id)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: "DB update failed" }), { status: 500 });
  }

  if (paymentStatus === "paid" && payment?.invitation_id) {
    await supabase
      .from("invitations")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", payment.invitation_id)
      .eq("status", "draft");

    await supabase.from("notifications").insert({
      user_id: payment.customer_id,
      type: "payment",
      title: "Pembayaran Berhasil!",
      message: `Paket ${payment.package_name} berhasil diaktifkan.`,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
}

async function handleTripay(body: Record<string, unknown>, req: Request, supabase: ReturnType<typeof createClient>) {
  // Verify Tripay signature
  const tripayKey = Deno.env.get("TRIPAY_PRIVATE_KEY") ?? "";
  const signature = req.headers.get("x-callback-signature") ?? "";
  const expectedSig = createHmac("sha256", tripayKey)
    .update(JSON.stringify(body))
    .digest("hex");

  if (signature && expectedSig !== signature) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const { merchant_ref, status, total_amount, payment_method } = body as {
    merchant_ref: string;
    status: string;
    total_amount: number;
    payment_method: string;
  };

  const statusMap: Record<string, string> = {
    PAID: "paid",
    EXPIRED: "expired",
    FAILED: "failed",
    REFUND: "refunded",
  };

  const paymentStatus = statusMap[status] ?? "pending";
  const updateData: Record<string, unknown> = {
    status: paymentStatus,
    payment_method: payment_method,
    provider_response: body,
    updated_at: new Date().toISOString(),
  };
  if (paymentStatus === "paid") updateData.paid_at = new Date().toISOString();

  const { data: payment } = await supabase
    .from("payments")
    .update(updateData)
    .eq("provider_order_id", merchant_ref)
    .select()
    .single();

  if (paymentStatus === "paid" && payment?.invitation_id) {
    await supabase
      .from("invitations")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", payment.invitation_id)
      .eq("status", "draft");
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
}
