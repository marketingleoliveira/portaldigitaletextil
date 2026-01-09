import { useState, useRef, useCallback } from 'react';
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

  const startLocalRecording = useCallback(async (callObject?: DailyCall): Promise<boolean> => {
    try {
      let stream: MediaStream;
      const tracks: MediaStreamTrack[] = [];
      
      // If we have a Daily call object, capture directly from the meeting
      if (callObject) {
        const participants = callObject.participants();
        
        // Get local participant tracks
        const localParticipant = participants.local;
        if (localParticipant) {
          // Get local video track
          const localVideoTrack = localParticipant.tracks?.video?.track;
          if (localVideoTrack) {
            tracks.push(localVideoTrack);
          }
          
          // Get local screen share track if sharing
          const localScreenTrack = localParticipant.tracks?.screenVideo?.track;
          if (localScreenTrack) {
            tracks.push(localScreenTrack);
          }
        }
        
        // Create audio context to mix all audio sources
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();
        
        // Add local audio
        const localAudioTrack = localParticipant?.tracks?.audio?.track;
        if (localAudioTrack) {
          try {
            const localAudioSource = audioContext.createMediaStreamSource(new MediaStream([localAudioTrack]));
            localAudioSource.connect(destination);
          } catch (err) {
            console.warn('Could not add local audio to recording:', err);
          }
        }
        
        // Add remote participants' audio
        Object.entries(participants).forEach(([sessionId, participant]) => {
          if (sessionId !== 'local' && participant.tracks?.audio?.track) {
            try {
              const remoteAudioSource = audioContext.createMediaStreamSource(
                new MediaStream([participant.tracks.audio.track])
              );
              remoteAudioSource.connect(destination);
            } catch (err) {
              console.warn('Could not add remote audio to recording:', err);
            }
          }
        });
        
        // Add mixed audio to tracks
        destination.stream.getAudioTracks().forEach(track => tracks.push(track));
        
        // If no video tracks from meeting, capture the viewport
        if (!tracks.some(t => t.kind === 'video')) {
          // Fallback: capture the current tab/window without user selection
          try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                displaySurface: 'browser',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
              },
              audio: false,
              // @ts-ignore - preferCurrentTab is a Chrome-specific option
              preferCurrentTab: true
            });
            displayStream.getVideoTracks().forEach(track => tracks.push(track));
          } catch (displayErr) {
            console.error('Could not capture display:', displayErr);
            toast.error('Não foi possível capturar a tela da reunião');
            return false;
          }
        }
        
        stream = new MediaStream(tracks);
      } else {
        // Fallback: capture the current tab automatically
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'browser',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            },
            audio: true,
            // @ts-ignore - preferCurrentTab is a Chrome-specific option
            preferCurrentTab: true
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
        toast.error('Erro durante a gravação');
        setIsLocalRecording(false);
      };

      mediaRecorder.onstop = () => {
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
      };

      // Handle when user stops screen sharing via browser UI
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          toast.info('Gravação encerrada');
          mediaRecorderRef.current.stop();
          setIsLocalRecording(false);
          setLocalRecordingStartTime(null);
        }
      });

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      
      setIsLocalRecording(true);
      setLocalRecordingStartTime(new Date());
      toast.success('Gravação local iniciada!');
      
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
  }, [autoDownload]);

  const stopLocalRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
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

  return {
    isLocalRecording,
    localRecordingStartTime,
    startLocalRecording,
    stopLocalRecording,
    downloadRecording,
    recordedBlob
  };
}
