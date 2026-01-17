import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { DailyCall } from '@daily-co/daily-js';

interface UseLocalRecordingOptions {
  meetingTitle?: string;
  autoDownload?: boolean;
  meetingId?: string;
}

interface UseLocalRecordingReturn {
  isLocalRecording: boolean;
  localRecordingStartTime: Date | null;
  startLocalRecording: (callObject?: DailyCall) => Promise<boolean>;
  stopLocalRecording: () => Promise<Blob | null>;
  downloadRecording: (blob: Blob, filename?: string) => void;
  recordedBlob: Blob | null;
}

// Global recording state that persists across component remounts
interface GlobalRecordingState {
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
  chunks: Blob[];
  startTime: Date | null;
  isRecording: boolean;
  meetingTitle: string;
  meetingId: string | null;
  audioContext: AudioContext | null;
  callObject: DailyCall | null;
  trackSyncInterval: NodeJS.Timeout | null;
}

const globalRecordingState: GlobalRecordingState = {
  mediaRecorder: null,
  stream: null,
  chunks: [],
  startTime: null,
  isRecording: false,
  meetingTitle: '',
  meetingId: null,
  audioContext: null,
  callObject: null,
  trackSyncInterval: null,
};

export function useLocalRecording({ meetingTitle, autoDownload = true, meetingId }: UseLocalRecordingOptions = {}): UseLocalRecordingReturn {
  const [isLocalRecording, setIsLocalRecording] = useState(globalRecordingState.isRecording);
  const [localRecordingStartTime, setLocalRecordingStartTime] = useState<Date | null>(globalRecordingState.startTime);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  
  const isStoppingRef = useRef<boolean>(false);
  const meetingTitleRef = useRef<string | undefined>(meetingTitle);
  const meetingIdRef = useRef<string | undefined>(meetingId);

  // Keep refs updated
  meetingTitleRef.current = meetingTitle;
  meetingIdRef.current = meetingId;

  // Sync local state with global state on mount
  useEffect(() => {
    setIsLocalRecording(globalRecordingState.isRecording);
    setLocalRecordingStartTime(globalRecordingState.startTime);
  }, []);

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

  // Function to create audio stream from Daily.co participants
  const createAudioStreamFromCall = useCallback((callObject: DailyCall, audioContext: AudioContext): MediaStreamAudioDestinationNode => {
    const destination = audioContext.createMediaStreamDestination();
    const participants = callObject.participants();
    
    Object.entries(participants).forEach(([sessionId, participant]) => {
      // Add audio track
      const audioTrack = participant.tracks?.audio?.track;
      if (audioTrack && audioTrack.readyState === 'live') {
        try {
          const audioSource = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
          audioSource.connect(destination);
        } catch (err) {
          console.warn('Could not add audio track:', err);
        }
      }
      
      // Add screen share audio if available
      const screenAudioTrack = participant.tracks?.screenAudio?.track;
      if (screenAudioTrack && screenAudioTrack.readyState === 'live') {
        try {
          const screenAudioSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));
          screenAudioSource.connect(destination);
        } catch (err) {
          console.warn('Could not add screen audio track:', err);
        }
      }
    });
    
    return destination;
  }, []);

  const startLocalRecording = useCallback(async (callObject?: DailyCall): Promise<boolean> => {
    // If already recording globally, just sync state
    if (globalRecordingState.isRecording) {
      setIsLocalRecording(true);
      setLocalRecordingStartTime(globalRecordingState.startTime);
      toast.info('Gravação já está em andamento');
      return true;
    }

    try {
      isStoppingRef.current = false;
      const tracks: MediaStreamTrack[] = [];
      
      // Store callObject reference globally
      globalRecordingState.callObject = callObject || null;
      globalRecordingState.meetingTitle = meetingTitleRef.current || 'Reunião';
      globalRecordingState.meetingId = meetingIdRef.current || null;
      
      // Create audio context to mix all audio sources
      const audioContext = new AudioContext();
      globalRecordingState.audioContext = audioContext;
      
      let audioDestination: MediaStreamAudioDestinationNode;
      
      // If we have a Daily call object, capture audio from the meeting
      if (callObject) {
        audioDestination = createAudioStreamFromCall(callObject, audioContext);
        
        // Set up periodic audio track sync to capture new participants
        globalRecordingState.trackSyncInterval = setInterval(() => {
          if (!isStoppingRef.current && globalRecordingState.callObject) {
            // Reconnect audio tracks periodically to capture new participants
            const participants = globalRecordingState.callObject.participants();
            Object.entries(participants).forEach(([sessionId, participant]) => {
              const audioTrack = participant.tracks?.audio?.track;
              if (audioTrack && audioTrack.readyState === 'live') {
                try {
                  const audioSource = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
                  audioSource.connect(audioDestination);
                } catch (err) {
                  // Track might already be connected, ignore
                }
              }
            });
          }
        }, 3000);
      } else {
        audioDestination = audioContext.createMediaStreamDestination();
      }

      // Capture display/screen - this is required for video
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
        globalRecordingState.audioContext = null;
        return false;
      }

      // Add system audio from display capture if available
      displayStream.getAudioTracks().forEach(track => {
        try {
          const systemAudioSource = audioContext.createMediaStreamSource(new MediaStream([track]));
          systemAudioSource.connect(audioDestination);
        } catch (err) {
          console.warn('Could not add system audio:', err);
        }
      });

      // Get video track from display
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        tracks.push(videoTrack);
        
        // CRITICAL: When video track ends (user clicks stop sharing or switches tabs),
        // we DON'T stop the recording - just continue with audio only
        videoTrack.addEventListener('ended', () => {
          console.log('Video track ended, but recording continues with audio');
          if (!isStoppingRef.current && globalRecordingState.isRecording) {
            toast.info('Captura de vídeo interrompida. Gravação de áudio continua. Clique em Parar Gravação para finalizar.');
          }
        });
      }

      // Add mixed audio to tracks
      audioDestination.stream.getAudioTracks().forEach(track => tracks.push(track));

      const finalStream = new MediaStream(tracks);
      globalRecordingState.stream = finalStream;
      globalRecordingState.chunks = [];

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
          globalRecordingState.chunks.push(event.data);
          console.log('Recording chunk added, total chunks:', globalRecordingState.chunks.length);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        // Don't stop recording on errors - try to continue
        if (!isStoppingRef.current) {
          toast.warning('Erro durante a gravação, tentando continuar...');
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, processing chunks...');
        
        // Clear track sync interval
        if (globalRecordingState.trackSyncInterval) {
          clearInterval(globalRecordingState.trackSyncInterval);
          globalRecordingState.trackSyncInterval = null;
        }
        
        const recordingChunks = [...globalRecordingState.chunks];
        const blob = new Blob(recordingChunks, { type: mimeType });
        console.log('Recording blob created, size:', blob.size);
        setRecordedBlob(blob);
        
        // Stop all tracks
        displayStream.getTracks().forEach(track => track.stop());
        if (globalRecordingState.stream) {
          globalRecordingState.stream.getTracks().forEach(track => track.stop());
        }
        
        // Close audio context
        if (globalRecordingState.audioContext) {
          globalRecordingState.audioContext.close();
          globalRecordingState.audioContext = null;
        }
        
        // Reset global state
        const savedTitle = globalRecordingState.meetingTitle;
        const savedMeetingId = globalRecordingState.meetingId;
        const savedStartTime = globalRecordingState.startTime;
        
        globalRecordingState.mediaRecorder = null;
        globalRecordingState.stream = null;
        globalRecordingState.chunks = [];
        globalRecordingState.startTime = null;
        globalRecordingState.isRecording = false;
        globalRecordingState.callObject = null;
        
        // Download locally when stopped manually
        if (isStoppingRef.current && blob.size > 0 && autoDownload) {
          downloadRecording(blob);
        }
      };

      globalRecordingState.mediaRecorder = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      
      const startTime = new Date();
      globalRecordingState.startTime = startTime;
      globalRecordingState.isRecording = true;
      
      setIsLocalRecording(true);
      setLocalRecordingStartTime(startTime);
      toast.success('Gravação iniciada! A gravação continuará mesmo ao trocar de aba.');
      
      return true;
    } catch (error: any) {
      console.error('Error starting local recording:', error);
      
      // Clear track sync interval on error
      if (globalRecordingState.trackSyncInterval) {
        clearInterval(globalRecordingState.trackSyncInterval);
        globalRecordingState.trackSyncInterval = null;
      }
      
      if (error.name === 'NotAllowedError') {
        toast.error('Permissão de captura negada');
      } else if (error.name === 'NotFoundError') {
        toast.error('Nenhuma fonte de captura encontrada');
      } else {
        toast.error('Erro ao iniciar gravação local');
      }
      
      return false;
    }
  }, [autoDownload, createAudioStreamFromCall, downloadRecording]);

  const stopLocalRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      console.log('Stopping local recording...');
      isStoppingRef.current = true;
      
      // Clear track sync interval
      if (globalRecordingState.trackSyncInterval) {
        clearInterval(globalRecordingState.trackSyncInterval);
        globalRecordingState.trackSyncInterval = null;
      }
      
      if (!globalRecordingState.mediaRecorder || globalRecordingState.mediaRecorder.state === 'inactive') {
        globalRecordingState.isRecording = false;
        globalRecordingState.startTime = null;
        setIsLocalRecording(false);
        setLocalRecordingStartTime(null);
        resolve(null);
        return;
      }

      const currentMimeType = globalRecordingState.mediaRecorder.mimeType || 'video/webm';
      
      globalRecordingState.mediaRecorder.onstop = async () => {
        const blob = new Blob(globalRecordingState.chunks, { type: currentMimeType });
        console.log('Final recording blob size:', blob.size);
        setRecordedBlob(blob);
        setIsLocalRecording(false);
        setLocalRecordingStartTime(null);
        
        // Stop all tracks
        if (globalRecordingState.stream) {
          globalRecordingState.stream.getTracks().forEach(track => track.stop());
        }
        
        // Close audio context
        if (globalRecordingState.audioContext) {
          globalRecordingState.audioContext.close();
          globalRecordingState.audioContext = null;
        }
        
        // Save to cloud
        const savedTitle = globalRecordingState.meetingTitle;
        const savedMeetingId = globalRecordingState.meetingId;
        const savedStartTime = globalRecordingState.startTime;
        
        // Reset global state
        globalRecordingState.mediaRecorder = null;
        globalRecordingState.stream = null;
        globalRecordingState.chunks = [];
        globalRecordingState.startTime = null;
        globalRecordingState.isRecording = false;
        globalRecordingState.callObject = null;
        
        toast.success('Gravação local finalizada!');
        
        // Download locally
        if (blob.size > 0 && autoDownload) {
          downloadRecording(blob);
        }
        
        resolve(blob);
      };

      globalRecordingState.mediaRecorder.stop();
    });
  }, [autoDownload, downloadRecording]);

  // Cleanup on unmount - but don't stop recording!
  useEffect(() => {
    return () => {
      // Note: We intentionally don't stop the recording on unmount
      // The global state will persist and the recording will continue
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
