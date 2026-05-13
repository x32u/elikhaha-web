import { forwardRef, useEffect, useImperativeHandle } from 'react';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onReady?: () => void;
  onError?: (message: string) => void;
  enabled?: boolean;
  facingMode?: 'user' | 'environment';
}

export interface CameraFeedHandle {
  video: HTMLVideoElement | null;
}

export const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(
  ({ videoRef, onReady, onError, enabled = true, facingMode = 'environment' }, ref) => {
    useImperativeHandle(ref, () => ({
      video: videoRef.current,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !enabled) return;

      const startCamera = async () => {
        try {
          let stream: MediaStream;

          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch (primaryError) {
            console.warn('Preferred camera constraints failed, retrying with default camera:', primaryError);
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }

          video.srcObject = stream;
          video.onloadedmetadata = async () => {
            try {
              await video.play();
              onReady?.();
            } catch (playError) {
              console.error('Failed to start camera video playback:', playError);
            }
          };
        } catch (error) {
          console.error('Failed to access camera:', error);
          onError?.(error instanceof Error ? error.message : 'Failed to access camera.');
        }
      };

      startCamera();

      return () => {
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
      };
    }, [videoRef, enabled, facingMode, onReady, onError]);

    return (
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
        }}
        playsInline
        muted
        autoPlay
      />
    );
  }
);

CameraFeed.displayName = 'CameraFeed';
