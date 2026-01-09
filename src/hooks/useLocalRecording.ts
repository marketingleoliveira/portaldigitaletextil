import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseLocalRecordingOptions {
  meetingTitle?: string;
}

interface UseLocalRecordingReturn {
  isLocalRecording: boolean;
  localRecordingStartTime: Date | null;
  startLocalRecording: (stream?: MediaStream) => Promise<boolean>;
  stopLocalRecording: () => Promise<Blob | null>;
  downloadRecording: (blob: Blob, filename?: string) => void;
  recordedBlob: Blob | null;
}

export function useLocalRecording({ meetingTitle }: UseLocalRecordingOptions = {}): UseLocalRecordingReturn {
  const [isLocalRecording, setIsLocalRecording] = useState(false);
  const [localRecordingStartTime, setLocalRecordingStartTime] = useState<Date | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startLocalRecording = useCallback(async (existingStream?: MediaStream): Promise<boolean> => {
    try {
      let stream: MediaStream;
      
      if (existingStream) {
        stream = existingStream;
      } else {
        // Capture screen and audio
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'browser',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });

        // Try to get microphone audio
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            }
          });
          
          // Combine video from screen with audio from microphone
          const audioTracks = audioStream.getAudioTracks();
          const displayAudioTracks = displayStream.getAudioTracks();
          
          // Create audio context to mix both audio sources
          const audioContext = new AudioContext();
          const destination = audioContext.createMediaStreamDestination();
          
          if (displayAudioTracks.length > 0) {
            const displaySource = audioContext.createMediaStreamSource(new MediaStream(displayAudioTracks));
            displaySource.connect(destination);
          }
          
          if (audioTracks.length > 0) {
            const micSource = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
            micSource.connect(destination);
          }
          
          // Create combined stream with display video and mixed audio
          stream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
          ]);
          
        } catch (micError) {
          console.log('Microphone not available, recording screen audio only');
          stream = displayStream;
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
      };

      // Handle when user stops screen sharing via browser UI
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          toast.info('Compartilhamento de tela encerrado, parando gravação...');
          stopLocalRecording();
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
        toast.error('Permissão de captura de tela negada');
      } else if (error.name === 'NotFoundError') {
        toast.error('Nenhuma fonte de captura encontrada');
      } else {
        toast.error('Erro ao iniciar gravação local');
      }
      
      return false;
    }
  }, []);

  const stopLocalRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setIsLocalRecording(false);
        setLocalRecordingStartTime(null);
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setIsLocalRecording(false);
        setLocalRecordingStartTime(null);
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        toast.success('Gravação local finalizada!');
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const downloadRecording = useCallback((blob: Blob, filename?: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
    const safeName = meetingTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'reuniao';
    
    a.download = filename || `${safeName}_${date}_${time}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Gravação baixada com sucesso!');
  }, [meetingTitle]);

  return {
    isLocalRecording,
    localRecordingStartTime,
    startLocalRecording,
    stopLocalRecording,
    downloadRecording,
    recordedBlob
  };
}