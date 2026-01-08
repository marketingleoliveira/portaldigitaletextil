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
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!DAILY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, meetingId, meetingTitle, meetingDate } = await req.json();
    console.log("Sync recordings action:", action);

    if (action === "sync-all") {
      // Fetch all recordings from Daily.co
      const response = await fetch("https://api.daily.co/v1/recordings", {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch recordings from Daily.co");
      }

      const data = await response.json();
      const recordings = data.data || [];
      console.log(`Found ${recordings.length} recordings in Daily.co`);

      // Get existing recording IDs from database
      const { data: existingRecordings } = await supabase
        .from("meeting_recordings")
        .select("recording_id");
      
      const existingIds = new Set(existingRecordings?.map(r => r.recording_id) || []);

      // Find new recordings
      const newRecordings = recordings.filter((r: any) => !existingIds.has(r.id));
      console.log(`${newRecordings.length} new recordings to sync`);

      let syncedCount = 0;

      for (const recording of newRecordings) {
        // Try to find the meeting by room name
        const roomName = recording.room_name;
        
        // Get meeting details from the meetings table
        const { data: meeting } = await supabase
          .from("meetings")
          .select("id, title, created_at")
          .or(`meeting_code.ilike.%${roomName}%`)
          .single();

        // Get access link for the recording
        const linkResponse = await fetch(
          `https://api.daily.co/v1/recordings/${recording.id}/access-link`,
          { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
        );

        let downloadUrl = null;
        if (linkResponse.ok) {
          const linkData = await linkResponse.json();
          downloadUrl = linkData.download_link;
        }

        // Insert the recording
        const { error } = await supabase.from("meeting_recordings").insert({
          meeting_id: meeting?.id || null,
          meeting_title: meeting?.title || `Gravação ${recording.room_name}`,
          meeting_date: meeting?.created_at || recording.start_ts,
          recording_id: recording.id,
          download_url: downloadUrl,
          duration_seconds: recording.duration || null,
        });

        if (!error) {
          syncedCount++;
        } else {
          console.error("Error inserting recording:", error);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          synced: syncedCount,
          total: recordings.length 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sync-meeting") {
      // Sync recordings for a specific meeting after it ends
      if (!meetingId || !meetingTitle) {
        throw new Error("Meeting ID and title required");
      }

      // Get the meeting room name
      const { data: meeting } = await supabase
        .from("meetings")
        .select("meeting_code")
        .eq("id", meetingId)
        .single();

      if (!meeting) {
        throw new Error("Meeting not found");
      }

      const roomName = meeting.meeting_code.replace(/-/g, "");

      // Fetch recordings for this room
      const response = await fetch(
        `https://api.daily.co/v1/recordings?room_name=${roomName}`,
        { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
      );

      if (!response.ok) {
        console.error("Failed to fetch recordings");
        return new Response(
          JSON.stringify({ success: false, synced: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const recordings = data.data || [];
      console.log(`Found ${recordings.length} recordings for meeting ${meetingId}`);

      // Get existing recording IDs
      const { data: existingRecordings } = await supabase
        .from("meeting_recordings")
        .select("recording_id")
        .eq("meeting_id", meetingId);
      
      const existingIds = new Set(existingRecordings?.map(r => r.recording_id) || []);

      let syncedCount = 0;

      for (const recording of recordings) {
        if (existingIds.has(recording.id)) continue;

        // Get access link
        const linkResponse = await fetch(
          `https://api.daily.co/v1/recordings/${recording.id}/access-link`,
          { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
        );

        let downloadUrl = null;
        if (linkResponse.ok) {
          const linkData = await linkResponse.json();
          downloadUrl = linkData.download_link;
        }

        const { error } = await supabase.from("meeting_recordings").insert({
          meeting_id: meetingId,
          meeting_title: meetingTitle,
          meeting_date: meetingDate || new Date().toISOString(),
          recording_id: recording.id,
          download_url: downloadUrl,
          duration_seconds: recording.duration || null,
        });

        if (!error) {
          syncedCount++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, synced: syncedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh-link") {
      // Refresh the download link for a specific recording
      const { recordingId } = await req.json();
      
      if (!recordingId) {
        throw new Error("Recording ID required");
      }

      const response = await fetch(
        `https://api.daily.co/v1/recordings/${recordingId}/access-link`,
        { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
      );

      if (!response.ok) {
        throw new Error("Failed to get recording link");
      }

      const linkData = await response.json();
      
      // Update the URL in database
      await supabase
        .from("meeting_recordings")
        .update({ download_url: linkData.download_link })
        .eq("recording_id", recordingId);

      return new Response(
        JSON.stringify({ success: true, link: linkData.download_link }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
