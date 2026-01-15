import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

interface UseLocalRecordingOptions {
  meetingTitle?: string;
  autoDownload?: boolean;
}

interface UseLocalRecordingReturn {
  isLocalRecording: boolean;
  localRecordingStartTime: Date | null;
  startLocalRecording: (callObject?: DailyCall) => Promise<boolean>;
  stopLocalRecording: () => Promise<Blob | null>;
  downloadRecording: (blob: Blob, filename?: string) => void;
  recordedBlob: Blob | null;
}

export function useLocalRecording({ meetingTitle, autoDownload = true }: UseLocalRecordingOptions = {}): UseLocalRecordingReturn {
  const [isLocalRecording, setIsLocalRecording] = useState(false);
  const [localRecordingStartTime, setLocalRecordingStartTime] = useState<Date | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meetingTitleRef = useRef<string | undefined>(meetingTitle);
  const callObjectRef = useRef<DailyCall | null>(null);
  const trackSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Keep meetingTitle ref updated
  meetingTitleRef.current = meetingTitle;

  const downloadRecording = useCallback((blob: Blob, filename?: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
    const safeName = meetingTitleRef.current?.replace(/[^a-zA-Z0-9]/g, '_') || 'reuniao';
    
    a.download = filename || `${safeName}_${date}_${time}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Gravação baixada com sucesso!');
  }, []);

  // Cleanup canvas and animation frame
  const cleanupCanvas = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach(track => track.stop());
      canvasStreamRef.current = null;
    }
    if (canvasRef.current) {
      canvasRef.current.remove();
      canvasRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      videoElementRef.current.srcObject = null;
      videoElementRef.current.remove();
      videoElementRef.current = null;
    }
  }, []);

  // Function to create a canvas-based capture that won't stop when switching tabs
  const createPersistentVideoCapture = useCallback(async (sourceStream: MediaStream): Promise<MediaStream> => {
    // Create a hidden canvas element
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d')!;
    
    // Create a hidden video element to play the source stream
    const video = document.createElement('video');
    video.srcObject = sourceStream;
    video.muted = true;
    video.playsInline = true;
    video.style.display = 'none';
    document.body.appendChild(video);
    videoElementRef.current = video;
    
    await video.play();

    // Continuously draw the video to the canvas
    let lastFrameTime = 0;
    const drawFrame = (timestamp: number) => {
      if (isStoppingRef.current) return;
      
      // Draw even if the video is paused or the track ended - draw last frame
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        // Draw a black frame with text if video is not available
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#666';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Gravação em andamento...', canvas.width / 2, canvas.height / 2);
      }
      
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };
    
    animationFrameRef.current = requestAnimationFrame(drawFrame);

    // Capture the canvas as a stream - this won't stop when switching tabs
    const canvasStream = canvas.captureStream(30);
    canvasStreamRef.current = canvasStream;
    
    return canvasStream;
  }, []);

  // Function to sync tracks from Daily.co call to the recording stream
  const syncTracksFromCall = useCallback(() => {
    if (!callObjectRef.current || !audioContextRef.current) return;
    
    const participants = callObjectRef.current.participants();
    const audioContext = audioContextRef.current;
    
    // Recreate audio mixing destination
    try {
      const destination = audioContext.createMediaStreamDestination();
      
      // Add all participant audio tracks
      Object.entries(participants).forEach(([sessionId, participant]) => {
        const audioTrack = participant.tracks?.audio?.track;
        if (audioTrack && audioTrack.readyState === 'live') {
          try {
            const audioSource = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
            audioSource.connect(destination);
          } catch (err) {
            // Track might already be connected, ignore
          }
        }
        
        // Also capture screen share audio if available
        const screenAudioTrack = participant.tracks?.screenAudio?.track;
        if (screenAudioTrack && screenAudioTrack.readyState === 'live') {
          try {
            const screenAudioSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));
            screenAudioSource.connect(destination);
          } catch (err) {
            // Track might already be connected, ignore
          }
        }
      });
    } catch (err) {
      console.warn('Error syncing audio tracks:', err);
    }
  }, []);

  const startLocalRecording = useCallback(async (callObject?: DailyCall): Promise<boolean> => {
    try {
      isStoppingRef.current = false;
      const tracks: MediaStreamTrack[] = [];
      
      // Store callObject reference for track syncing
      callObjectRef.current = callObject || null;
      
      // Create audio context to mix all audio sources
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      
      // If we have a Daily call object, capture directly from the meeting
      if (callObject) {
        const participants = callObject.participants();
        const localParticipant = participants.local;
        
        // Add local audio
        const localAudioTrack = localParticipant?.tracks?.audio?.track;
        if (localAudioTrack && localAudioTrack.readyState === 'live') {
          try {
            const localAudioSource = audioContext.createMediaStreamSource(new MediaStream([localAudioTrack]));
            localAudioSource.connect(destination);
          } catch (err) {
            console.warn('Could not add local audio to recording:', err);
          }
        }
        
        // Add remote participants' audio
        Object.entries(participants).forEach(([sessionId, participant]) => {
          if (sessionId !== 'local') {
            const audioTrack = participant.tracks?.audio?.track;
            if (audioTrack && audioTrack.readyState === 'live') {
              try {
                const remoteAudioSource = audioContext.createMediaStreamSource(
                  new MediaStream([audioTrack])
                );
                remoteAudioSource.connect(destination);
              } catch (err) {
                console.warn('Could not add remote audio to recording:', err);
              }
            }
            
            // Add screen share audio from remote participants
            const screenAudioTrack = participant.tracks?.screenAudio?.track;
            if (screenAudioTrack && screenAudioTrack.readyState === 'live') {
              try {
                const screenAudioSource = audioContext.createMediaStreamSource(
                  new MediaStream([screenAudioTrack])
                );
                screenAudioSource.connect(destination);
              } catch (err) {
                console.warn('Could not add remote screen audio to recording:', err);
              }
            }
          }
        });
      }

      // Capture display/screen - user selects what to capture
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 44100
          }
        });
      } catch (displayErr) {
        console.error('Could not capture display:', displayErr);
        toast.error('Não foi possível capturar a tela');
        audioContext.close();
        audioContextRef.current = null;
        return false;
      }

      // Add system audio from display capture if available
      displayStream.getAudioTracks().forEach(track => {
        try {
          const systemAudioSource = audioContext.createMediaStreamSource(new MediaStream([track]));
          systemAudioSource.connect(destination);
        } catch (err) {
          console.warn('Could not add system audio:', err);
        }
      });

      // Create persistent canvas-based capture that won't stop when switching tabs
      const persistentVideoStream = await createPersistentVideoCapture(displayStream);
      
      // Combine persistent video with mixed audio
      persistentVideoStream.getVideoTracks().forEach(track => tracks.push(track));
      destination.stream.getAudioTracks().forEach(track => tracks.push(track));

      const finalStream = new MediaStream(tracks);
      streamRef.current = finalStream;
      chunksRef.current = [];

      // Set up periodic track sync to keep audio updated
      trackSyncIntervalRef.current = setInterval(() => {
        if (!isStoppingRef.current) {
          syncTracksFromCall();
        }
      }, 2000);

      // Determine the best available codec
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      
      let mimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      if (!mimeType) {
        throw new Error('No supported video format found');
      }

      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 3000000 // 3 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('Recording chunk added, total chunks:', chunksRef.current.length);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        // Don't stop recording on errors - try to continue
        if (!isStoppingRef.current) {
          toast.warning('Erro durante a gravação, tentando continuar...');
        }
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, processing chunks...');
        
        // Clear track sync interval
        if (trackSyncIntervalRef.current) {
          clearInterval(trackSyncIntervalRef.current);
          trackSyncIntervalRef.current = null;
        }
        
        // Cleanup canvas capture
        cleanupCanvas();
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('Recording blob created, size:', blob.size);
        setRecordedBlob(blob);
        
        // Stop all tracks from the display stream
        displayStream.getTracks().forEach(track => track.stop());
        
        // Stop final stream tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        // Clear call object reference
        callObjectRef.current = null;
        
        // Auto download if enabled and recording was stopped manually
        if (autoDownload && blob.size > 0 && isStoppingRef.current) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          const date = new Date().toISOString().split('T')[0];
          const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
          const safeName = meetingTitleRef.current?.replace(/[^a-zA-Z0-9]/g, '_') || 'reuniao';
          
          a.download = `${safeName}_${date}_${time}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast.success('Gravação baixada com sucesso!');
        }
      };

      // Listen for the original display stream track ending
      // When user stops sharing, we keep recording the last frame via canvas
      const originalVideoTrack = displayStream.getVideoTracks()[0];
      if (originalVideoTrack) {
        originalVideoTrack.addEventListener('ended', () => {
          // Don't stop the recording! The canvas will continue drawing the last frame
          // or a placeholder message
          console.log('Display capture track ended, but recording continues via canvas');
          if (!isStoppingRef.current && mediaRecorderRef.current?.state === 'recording') {
            toast.info('Captura de tela interrompida. A gravação continua - volte para a aba da reunião para retomar a captura visual.');
          }
        });
      }

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      
      setIsLocalRecording(true);
      setLocalRecordingStartTime(new Date());
      toast.success('Gravação iniciada! Não pare a gravação ao trocar de aba - ela continuará automaticamente.');
      
      return true;
    } catch (error: any) {
      console.error('Error starting local recording:', error);
      cleanupCanvas();
      
      if (error.name === 'NotAllowedError') {
        toast.error('Permissão de captura negada');
      } else if (error.name === 'NotFoundError') {
        toast.error('Nenhuma fonte de captura encontrada');
      } else {
        toast.error('Erro ao iniciar gravação local');
      }
      
      return false;
    }
  }, [autoDownload, syncTracksFromCall, createPersistentVideoCapture, cleanupCanvas]);

  const stopLocalRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      console.log('Stopping local recording...');
      isStoppingRef.current = true;
      
      // Clear track sync interval
      if (trackSyncIntervalRef.current) {
        clearInterval(trackSyncIntervalRef.current);
        trackSyncIntervalRef.current = null;
      }
      
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        cleanupCanvas();
        setIsLocalRecording(false);
        setLocalRecordingStartTime(null);
        resolve(null);
        return;
      }

      const currentMimeType = mediaRecorderRef.current.mimeType || 'video/webm';
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: currentMimeType });
        console.log('Final recording blob size:', blob.size);
        setRecordedBlob(blob);
        setIsLocalRecording(false);
        setLocalRecordingStartTime(null);
        
        // Cleanup canvas
        cleanupCanvas();
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        // Clear call object reference
        callObjectRef.current = null;
        
        toast.success('Gravação local finalizada!');
        
        // Auto download if enabled
        if (autoDownload && blob.size > 0) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          const date = new Date().toISOString().split('T')[0];
          const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
          const safeName = meetingTitleRef.current?.replace(/[^a-zA-Z0-9]/g, '_') || 'reuniao';
          
          a.download = `${safeName}_${date}_${time}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          toast.success('Gravação baixada com sucesso!');
        }
        
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [autoDownload, cleanupCanvas]);

  // Cleanup on unmount - but don't stop recording!
  useEffect(() => {
    return () => {
      if (trackSyncIntervalRef.current) {
        clearInterval(trackSyncIntervalRef.current);
      }
      // Note: We intentionally don't stop the recording on unmount
      // The user might be navigating away temporarily
    };
  }, []);

  return {
    isLocalRecording,
    localRecordingStartTime,
    startLocalRecording,
    stopLocalRecording,
    downloadRecording,
    recordedBlob
  };
}
