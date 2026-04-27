import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Save, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Point {
  x: number;
  y: number;
}

interface Measurement {
  pd: number;
  seg: number;
}

interface MeasurementToolProps {
  onSave: (m: Measurement) => void;
  onClose: () => void;
}

const CREDIT_CARD_WIDTH_MM = 85.60;

export function MeasurementTool({ onSave, onClose }: MeasurementToolProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [step, setStep] = useState(0); // 0: Init, 1: Reading, 2: Calibrating/Measuring
  const [points, setPoints] = useState<Record<string, Point>>({});
  const [state, setState] = useState<number>(0); // 1: CardLeft, 2: CardRight, 3: PupilR, 4: PupilL, 5: Seg
  const [pixelsPerMM, setPixelsPerMM] = useState(0);
  const [results, setResults] = useState<Measurement>({ pd: 0, seg: 0 });

  const steps = [
    "Step 1: Click LEFT edge of the credit card",
    "Step 2: Click RIGHT edge of the credit card",
    "Step 3: Click center of RIGHT pupil",
    "Step 4: Click center of LEFT pupil",
    "Step 5: Click BOTTOM of lens (Seg Height)",
    "Measurements Complete!"
  ];

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setStep(1);
    } catch (err) {
      alert("Camera error: " + err);
    }
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    stopCamera();
    setStep(2);
    setState(1);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (state === 0 || state > 5) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const newPoints = { ...points };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw point
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    if (state === 1) {
      newPoints.cardLeft = { x, y };
      setState(2);
    } else if (state === 2) {
      newPoints.cardRight = { x, y };
      const pixDist = Math.hypot(x - newPoints.cardLeft.x, y - newPoints.cardLeft.y);
      setPixelsPerMM(pixDist / CREDIT_CARD_WIDTH_MM);
      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(newPoints.cardLeft.x, newPoints.cardLeft.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      setState(3);
    } else if (state === 3) {
      newPoints.pupilR = { x, y };
      setState(4);
    } else if (state === 4) {
      newPoints.pupilL = { x, y };
      const pdPx = Math.hypot(x - newPoints.pupilR.x, y - newPoints.pupilR.y);
      const pd = pdPx / pixelsPerMM;
      setResults(prev => ({ ...prev, pd }));
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(newPoints.pupilR.x, newPoints.pupilR.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      setState(5);
    } else if (state === 5) {
      newPoints.seg = { x, y };
      const segPx = Math.abs(y - newPoints.pupilR.y);
      const seg = segPx / pixelsPerMM;
      setResults(prev => ({ ...prev, seg }));
      ctx.strokeStyle = 'orange';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(newPoints.pupilR.x, newPoints.pupilR.y);
      ctx.lineTo(newPoints.pupilR.x, y);
      ctx.stroke();
      setState(6);
    }
    setPoints(newPoints);
  };

  const reset = () => {
    setPoints({});
    setResults({ pd: 0, seg: 0 });
    setPixelsPerMM(0);
    setStep(1);
    startCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stream]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-sm flex flex-col items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-4xl p-6 relative shadow-2xl border border-black transition-all">
        <button onClick={onClose} className="absolute top-4 right-4 text-black hover:text-red-500 transition-colors">
          <X className="w-6 h-6" />
        </button>
        
        <h2 className="text-xl font-black text-black mb-6 flex items-center gap-2 uppercase italic">
          <Camera className="w-6 h-6" />
          Camera Measurement Tool
        </h2>

        {step === 0 && (
          <div className="text-center py-12">
            <p className="text-black font-bold uppercase mb-6 leading-relaxed">
              Place a standard credit card on the patient's forehead.<br/>
              Ensure the camera is level with the patient's eyes.
            </p>
            <button 
              onClick={startCamera}
              className="bg-black text-white px-8 py-3 rounded-lg font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-colors border border-black"
            >
              Initialize Camera
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="relative group">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full rounded-lg bg-black border border-black shadow-inner"
              style={{ transform: 'none' }} 
            />
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <button 
                onClick={capture}
                className="bg-black text-white px-10 py-4 rounded-full font-black uppercase tracking-widest shadow-xl hover:opacity-90 transition-all flex items-center gap-2 border border-black"
              >
                <Camera className="w-5 h-5" />
                Capture Frame
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white border border-black rounded-lg p-3 text-center">
              <h3 className="text-black font-black uppercase flex items-center justify-center gap-2 transition-colors">
                <MousePointer2 className="w-4 h-4" />
                {steps[state - 1]}
              </h3>
            </div>

            <div className="relative overflow-auto max-h-[60vh] border border-black rounded-lg bg-white">
              <canvas 
                ref={canvasRef} 
                onClick={handleCanvasClick}
                className="mx-auto cursor-crosshair max-w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-black rounded-lg p-4 text-center">
                <label className="block text-xs font-black text-black uppercase mb-1">Pupil Distance</label>
                <span className="text-2xl font-black text-black uppercase">{results.pd > 0 ? results.pd.toFixed(1) : '--'} <small className="text-sm font-normal text-black">mm</small></span>
              </div>
              <div className="bg-white border border-black rounded-lg p-4 text-center">
                <label className="block text-xs font-black text-black uppercase mb-1">Seg Height</label>
                <span className="text-2xl font-black text-black uppercase">{results.seg > 0 ? results.seg.toFixed(1) : '--'} <small className="text-sm font-normal text-black">mm</small></span>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-black">
              <button 
                onClick={reset}
                className="flex-1 border border-black text-black px-6 py-3 rounded-lg font-black uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Reset Tool
              </button>
              <button 
                onClick={() => state > 5 && onSave(results)}
                disabled={state <= 5}
                className="flex-[2] bg-black text-white px-6 py-3 rounded-lg font-black uppercase tracking-widest shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 border border-black"
              >
                <Save className="w-5 h-5" />
                Apply Measurements
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
