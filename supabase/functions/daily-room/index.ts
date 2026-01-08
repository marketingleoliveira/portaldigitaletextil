import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    if (!DAILY_API_KEY) {
      throw new Error("DAILY_API_KEY not configured");
    }

    const { action, roomName, meetingCode } = await req.json();
    const dailyRoomName = roomName || meetingCode?.replace(/-/g, "");

    if (action === "create") {
      const response = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: dailyRoomName,
          privacy: "public",
          properties: {
            enable_chat: true,
            enable_screenshare: true,
            enable_recording: "cloud",
            start_video_off: false,
            start_audio_off: false,
            exp: Math.floor(Date.now() / 1000) + 3600 * 24,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.info === "already taken" || error.error === "invalid-request-error") {
          const getResponse = await fetch(
            `https://api.daily.co/v1/rooms/${dailyRoomName}`,
            { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
          );
          
          if (getResponse.ok) {
            const room = await getResponse.json();
            return new Response(JSON.stringify({ url: room.url, name: room.name }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        throw new Error(`Failed to create room: ${JSON.stringify(error)}`);
      }

      const room = await response.json();
      return new Response(JSON.stringify({ url: room.url, name: room.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const response = await fetch(
        `https://api.daily.co/v1/rooms/${dailyRoomName}`,
        { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
      );

      if (!response.ok) {
        const createResponse = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: dailyRoomName,
            privacy: "public",
            properties: {
              enable_chat: true,
              enable_screenshare: true,
              enable_recording: "cloud",
              start_video_off: false,
              start_audio_off: false,
              exp: Math.floor(Date.now() / 1000) + 3600 * 24,
            },
          }),
        });

        if (!createResponse.ok) {
          throw new Error("Failed to create room");
        }

        const room = await createResponse.json();
        return new Response(JSON.stringify({ url: room.url, name: room.name }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const room = await response.json();
      return new Response(JSON.stringify({ url: room.url, name: room.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const response = await fetch(
        `https://api.daily.co/v1/rooms/${dailyRoomName}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        }
      );

      return new Response(JSON.stringify({ success: response.ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recording actions
    if (action === "start-recording") {
      const response = await fetch(
        `https://api.daily.co/v1/rooms/${dailyRoomName}/recordings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            type: "cloud",
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to start recording: ${JSON.stringify(error)}`);
      }

      const recording = await response.json();
      return new Response(JSON.stringify({ success: true, recording }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stop-recording") {
      const response = await fetch(
        `https://api.daily.co/v1/rooms/${dailyRoomName}/recordings`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        }
      );

      return new Response(JSON.stringify({ success: response.ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-recordings") {
      const response = await fetch(
        `https://api.daily.co/v1/recordings?room_name=${dailyRoomName}`,
        { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
      );

      if (!response.ok) {
        throw new Error("Failed to get recordings");
      }

      const data = await response.json();
      return new Response(JSON.stringify({ recordings: data.data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-recording-link") {
      const { recordingId } = await req.json().catch(() => ({}));
      
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

      const data = await response.json();
      return new Response(JSON.stringify({ link: data.download_link }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
