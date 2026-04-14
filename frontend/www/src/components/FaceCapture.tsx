'use client';

import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { useAuth } from '@/context/AuthContext';

export default function FaceCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  const [progress, setProgress] = useState(0);
  const [isCaptured, setIsCaptured] = useState(false);
  const [status, setStatus] = useState("Menyiapkan AI...");
  const { authFetch } = useAuth();

  useEffect(() => {
    async function setup() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          outputFaceBlendshapes: true
        });

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 480, height: 480, facingMode: "user" } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            setStatus("Posisikan Wajah");
            predict();
          };
        }
      } catch (err) {
        setStatus("Kamera/AI Error");
      }
    }

    const predict = () => {
      // PERBAIKAN: Cek readyState (HAVE_ENOUGH_DATA = 4) untuk mencegah error detectForVideo
      if (videoRef.current && videoRef.current.readyState >= 2 && landmarkerRef.current && !isCaptured) {
        const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
        
        if (results.faceLandmarks.length > 0) {
          setStatus("Menganalisis... Diam");
          setProgress((prev) => {
            if (prev >= 100) return 100;
            return prev + 1.5;
          });
        } else {
          setStatus("Wajah tidak terdeteksi");
          setProgress(0);
        }
      }
      requestRef.current = requestAnimationFrame(predict);
    };

    setup();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isCaptured]);

  // Efek ketika progress 100%
  useEffect(() => {
    if (progress >= 100 && !isCaptured) {
      captureAndVerify();
    }
  }, [progress]);

  const captureAndVerify = async () => {
    setIsCaptured(true);
    setStatus("Mengirim ke Server...");

    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append('face_image', blob);

        try {
          // Endpoint ini bisa digunakan untuk LOGIN atau REGISTER
          const res = await authFetch('/api/auth/face-recognition', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (res.ok) setStatus(`Halo, ${data.user.username}!`);
          else setStatus("Wajah tidak dikenali");
        } catch (e) {
          setStatus("Gagal terhubung ke server");
        }
      }, 'image/jpeg', 0.95);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 bg-[color:var(--app-surface-strong)] p-8 rounded-3xl shadow-2xl border border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)]">
      <div className="relative w-64 h-64 border-4 border-[color:var(--app-info-border)] rounded-full overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.5)]">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
        
        {/* Overlay Progress Ring */}
        <svg className="absolute top-0 left-0 w-full h-full -rotate-90 pointer-events-none">
          <circle cx="128" cy="128" r="124" fill="transparent" stroke="white" strokeOpacity="0.1" strokeWidth="8" />
          <circle
            cx="128" cy="128" r="124"
            fill="transparent"
            stroke="var(--app-info)"
            strokeWidth="8"
            strokeDasharray={779}
            strokeDashoffset={779 - (779 * progress) / 100}
            className="transition-all duration-150 ease-linear"
          />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-[color:var(--app-info)] font-mono text-2xl font-bold">{Math.floor(progress)}%</p>
        <p className="text-[color:color-mix(in_srgb,_var(--app-text-inverse)_70%,_transparent)] text-sm tracking-widest uppercase">{status}</p>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}