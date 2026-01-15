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

  // Function to sync tracks from Daily.co call to the recording stream
  const syncTracksFromCall = useCallback(() => {
    if (!callObjectRef.current || !streamRef.current || !audioContextRef.current) return;
    
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
      let stream: MediaStream;
      const tracks: MediaStreamTrack[] = [];
      
      // Store callObject reference for track syncing
      callObjectRef.current = callObject || null;
      
      // If we have a Daily call object, capture directly from the meeting
      if (callObject) {
        const participants = callObject.participants();
        
        // Get local participant tracks
        const localParticipant = participants.local;
        if (localParticipant) {
          // Get local video track
          const localVideoTrack = localParticipant.tracks?.video?.track;
          if (localVideoTrack && localVideoTrack.readyState === 'live') {
            tracks.push(localVideoTrack.clone()); // Clone to prevent track from being stopped
          }
          
          // Get local screen share track if sharing
          const localScreenTrack = localParticipant.tracks?.screenVideo?.track;
          if (localScreenTrack && localScreenTrack.readyState === 'live') {
            tracks.push(localScreenTrack.clone());
          }
        }
        
        // Create audio context to mix all audio sources
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();
        
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
        
        // Add mixed audio to tracks
        destination.stream.getAudioTracks().forEach(track => tracks.push(track));
        
        // If no video tracks from meeting, capture the viewport using monitor mode (more stable)
        if (!tracks.some(t => t.kind === 'video')) {
          try {
            // Use monitor displaySurface for more stability - doesn't stop when switching tabs
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                displaySurface: 'monitor', // Use monitor instead of browser for stability
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
              },
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                sampleRate: 44100
              }
            });
            
            // Add video tracks (cloned for stability)
            displayStream.getVideoTracks().forEach(track => {
              tracks.push(track);
            });
            
            // Add system audio if available
            displayStream.getAudioTracks().forEach(track => {
              try {
                const systemAudioSource = audioContext.createMediaStreamSource(new MediaStream([track]));
                systemAudioSource.connect(destination);
              } catch (err) {
                console.warn('Could not add system audio:', err);
              }
            });
          } catch (displayErr) {
            console.error('Could not capture display:', displayErr);
            toast.error('Não foi possível capturar a tela da reunião');
            return false;
          }
        }
        
        stream = new MediaStream(tracks);
        
        // Set up periodic track sync to keep recording alive
        trackSyncIntervalRef.current = setInterval(() => {
          if (!isStoppingRef.current) {
            syncTracksFromCall();
          }
        }, 2000);
        
      } else {
        // Fallback: capture the current screen (monitor mode for stability)
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'monitor', // Use monitor for stability
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            },
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 44100
            }
          });
          
          stream = displayStream;
        } catch (displayErr) {
          console.error('Could not capture display:', displayErr);
          toast.error('Não foi possível iniciar a gravação');
          return false;
        }
      }

      streamRef.current = stream;
      chunksRef.current = [];

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

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3000000 // 3 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
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
        // Clear track sync interval
        if (trackSyncIntervalRef.current) {
          clearInterval(trackSyncIntervalRef.current);
          trackSyncIntervalRef.current = null;
        }
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        
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

      // IMPORTANT: We intentionally DO NOT add an 'ended' event listener to the video track
      // This prevents the recording from stopping when switching tabs or when the display
      // capture ends unexpectedly. The recording will only stop when manually called.
      
      // However, we do want to warn the user if the track ends unexpectedly
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          // Only show warning, don't stop recording
          if (!isStoppingRef.current && mediaRecorderRef.current?.state === 'recording') {
            toast.warning('A captura de vídeo foi interrompida, mas a gravação continua. Áudio ainda está sendo gravado.');
          }
        });
      }

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      
      setIsLocalRecording(true);
      setLocalRecordingStartTime(new Date());
      toast.success('Gravação local iniciada! A gravação continuará mesmo ao trocar de aba.');
      
      return true;
    } catch (error: any) {
      console.error('Error starting local recording:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Permissão de captura negada');
      } else if (error.name === 'NotFoundError') {
        toast.error('Nenhuma fonte de captura encontrada');
      } else {
        toast.error('Erro ao iniciar gravação local');
      }
      
      return false;
    }
  }, [autoDownload, syncTracksFromCall]);

  const stopLocalRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      isStoppingRef.current = true;
      
      // Clear track sync interval
      if (trackSyncIntervalRef.current) {
        clearInterval(trackSyncIntervalRef.current);
        trackSyncIntervalRef.current = null;
      }
      
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setIsLocalRecording(false);
        setLocalRecordingStartTime(null);
        resolve(null);
        return;
      }

      const currentMimeType = mediaRecorderRef.current.mimeType || 'video/webm';
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: currentMimeType });
        setRecordedBlob(blob);
        setIsLocalRecording(false);
        setLocalRecordingStartTime(null);
        
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
  }, [autoDownload]);

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
