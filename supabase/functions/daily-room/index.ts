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

    if (action === "create") {
      // Create a new Daily room
      const response = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: meetingCode.replace(/-/g, ""),
          privacy: "public",
          properties: {
            enable_chat: true,
            enable_screenshare: true,
            enable_recording: "cloud",
            start_video_off: false,
            start_audio_off: false,
            exp: Math.floor(Date.now() / 1000) + 3600 * 24, // Expires in 24 hours
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // If room already exists, try to get it
        if (error.info === "a]ready taken" || error.error === "invalid-request-error") {
          const getResponse = await fetch(
            `https://api.daily.co/v1/rooms/${meetingCode.replace(/-/g, "")}`,
            {
              headers: {
                Authorization: `Bearer ${DAILY_API_KEY}`,
              },
            }
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
      // Get room info
      const response = await fetch(
        `https://api.daily.co/v1/rooms/${roomName || meetingCode.replace(/-/g, "")}`,
        {
          headers: {
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        // Room doesn't exist, create it
        const createResponse = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: meetingCode.replace(/-/g, ""),
            privacy: "public",
            properties: {
              enable_chat: true,
              enable_screenshare: true,
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
        `https://api.daily.co/v1/rooms/${roomName || meetingCode.replace(/-/g, "")}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
        }
      );

      return new Response(JSON.stringify({ success: response.ok }), {
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
