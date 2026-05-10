'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function VoiceAssistant() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const currentTranscriptRef = useRef('');
  const recordingRef = useRef(false); // sync ref to avoid stale closure

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + ' ';
      }
      currentTranscriptRef.current = text;
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error('Mikrofon izni verilmedi veya desteklenmiyor.');
        recordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // Her durduğunda mevcut metni finale ekle
      if (currentTranscriptRef.current.trim()) {
        finalTranscriptRef.current += ' ' + currentTranscriptRef.current.trim();
        currentTranscriptRef.current = '';
      }
      
      // Eğeer kullanıcı hala basılı tutuyorsa (Android/iOS kendi kendine durdurabilir)
      if (recordingRef.current) {
        try { recognition.start(); } catch (_) {}
      }
    };

    recognitionRef.current = recognition;
  }, []);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'tr-TR';
      window.speechSynthesis.speak(utt);
    }
  };

  const startRecording = () => {
    if (isProcessing) return;
    if (!recognitionRef.current) {
      toast.error('Tarayıcınız mikrofon özelliğini desteklemiyor (Chrome/Edge kullanın).');
      return;
    }
    finalTranscriptRef.current = '';
    currentTranscriptRef.current = '';
    recordingRef.current = true;
    setIsRecording(true);
    try {
      recognitionRef.current.start();
    } catch (_) {
      // already started — ignore
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setIsRecording(false);

    try {
      recognitionRef.current?.stop();
    } catch (_) {}

    // small delay to allow onresult to fire
    await new Promise(r => setTimeout(r, 400));

    // Kombinlenmiş metni al
    const fullText = (finalTranscriptRef.current + ' ' + currentTranscriptRef.current).replace(/\s+/g, ' ').trim();
    
    if (!fullText) {
      toast.warning('Ses algılanamadı, tekrar deneyin.');
      return;
    }

    // Show what was heard
    toast.info(`🎙️ Duyulan: "${fullText}"`, { duration: 4000 });

    setIsProcessing(true);
    try {
      const res = await fetch('/api/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: fullText }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Bir hata oluştu');

      toast.success(data.message || 'İşlem başarılı');
      speak(data.message || 'İşlem başarıyla tamamlandı');

      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      const msg = err.message || 'Bir hata oluştu';
      toast.error(`❌ ${msg} — Duyulan: "${fullText}"`);
      speak('İşlem sırasında bir hata oluştu');
    } finally {
      setIsProcessing(false);
      finalTranscriptRef.current = '';
      currentTranscriptRef.current = '';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
      {/* Status tooltip */}
      {isRecording && (
        <div className="bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-full animate-pulse">
          🎙️ Dinleniyor...
        </div>
      )}

      {/* Cancel button — visible when recording or processing */}
      {(isRecording || isProcessing) && (
        <button
          onClick={() => {
            recordingRef.current = false;
            setIsRecording(false);
            setIsProcessing(false);
            try { recognitionRef.current?.stop(); } catch (_) {}
            finalTranscriptRef.current = '';
            currentTranscriptRef.current = '';
          }}
          className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center shadow-md transition-colors"
          aria-label="İptal"
        >
          ✕
        </button>
      )}

      <button
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
        disabled={isProcessing}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 select-none touch-none ${
          isRecording
            ? 'bg-red-500 scale-110 ring-4 ring-red-400/40'
            : isProcessing
            ? 'bg-muted cursor-not-allowed'
            : 'bg-primary hover:scale-105 active:scale-95'
        }`}
        aria-label="Sesli komut ver — basılı tut"
      >
        {isProcessing ? (
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        ) : (
          <Mic className={`w-7 h-7 text-white ${isRecording ? 'animate-pulse' : ''}`} />
        )}
      </button>

      <p className="text-[10px] text-muted-foreground">
        {isProcessing ? 'İşleniyor...' : 'Basılı tut'}
      </p>
    </div>
  );
}
