import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with anon key to verify user
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Use getClaims to validate the JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Claims error:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized - No user ID" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is dev using service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleError || roleData?.role !== "dev") {
      return new Response(JSON.stringify({ error: "Forbidden - Dev only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all active meetings
    const { data: activeMeetings, error: fetchError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_code")
      .is("ended_at", null)
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    // Delete all Daily rooms
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");
    if (dailyApiKey && activeMeetings) {
      const deletePromises = activeMeetings.map(async (meeting) => {
        try {
          await fetch(`https://api.daily.co/v1/rooms/${meeting.meeting_code}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${dailyApiKey}`,
              "Content-Type": "application/json",
            },
          });
        } catch (err) {
          console.error(`Error deleting room ${meeting.meeting_code}:`, err);
        }
      });
      await Promise.all(deletePromises);
    }

    // Update all meetings using service role (bypasses RLS)
    const { error: updateError } = await supabaseAdmin
      .from("meetings")
      .update({ ended_at: new Date().toISOString(), is_active: false })
      .is("ended_at", null);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, count: activeMeetings?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
