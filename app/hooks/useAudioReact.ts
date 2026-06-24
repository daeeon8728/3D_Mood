import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useStore';

export function useAudioReact() {
  const audioReact = useAppStore((s) => s.audioReact);
  
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!audioReact) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
      return;
    }

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;
        
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        ctxRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (err) {
        console.error("Audio access denied or not supported:", err);
        useAppStore.getState().setAudioReact(false);
      }
    };

    initAudio();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close();
      }
    };
  }, [audioReact]);

  const getAudioData = () => {
    if (!analyserRef.current || !dataArrayRef.current) {
      return { bass: 0, mid: 0, treble: 0 };
    }
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);
    const data = dataArrayRef.current;
    
    let bass = 0, mid = 0, treble = 0;
    const third = Math.floor(data.length / 3);
    
    for (let i = 0; i < third; i++) bass += data[i];
    for (let i = third; i < third * 2; i++) mid += data[i];
    for (let i = third * 2; i < data.length; i++) treble += data[i];
    
    return {
      bass: (bass / third) / 255,
      mid: (mid / third) / 255,
      treble: (treble / (data.length - third * 2)) / 255,
    };
  };

  return { getAudioData };
}
