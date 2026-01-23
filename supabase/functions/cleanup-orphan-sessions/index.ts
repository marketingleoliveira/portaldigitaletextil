import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find orphan sessions (no session_end) older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: orphanSessions, error: fetchError } = await supabase
      .from("user_activity_sessions")
      .select("id, session_start, duration_seconds")
      .is("session_end", null)
      .lt("session_start", oneHourAgo);

    if (fetchError) {
      console.error("Error fetching orphan sessions:", fetchError);
      throw fetchError;
    }

    if (!orphanSessions || orphanSessions.length === 0) {
      console.log("No orphan sessions found");
      return new Response(
        JSON.stringify({ message: "No orphan sessions to clean up", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${orphanSessions.length} orphan sessions to close`);

    // Close each orphan session
    let closedCount = 0;
    for (const session of orphanSessions) {
      const sessionStart = new Date(session.session_start);
      const durationSeconds = session.duration_seconds || 1;
      const sessionEnd = new Date(sessionStart.getTime() + durationSeconds * 1000);

      const { error: updateError } = await supabase
        .from("user_activity_sessions")
        .update({
          session_end: sessionEnd.toISOString(),
          duration_seconds: durationSeconds > 0 ? durationSeconds : 1,
        })
        .eq("id", session.id);

      if (updateError) {
        console.error(`Error closing session ${session.id}:`, updateError);
      } else {
        closedCount++;
      }
    }

    console.log(`Successfully closed ${closedCount} orphan sessions`);

    return new Response(
      JSON.stringify({
        message: `Closed ${closedCount} orphan sessions`,
        count: closedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in cleanup-orphan-sessions:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
