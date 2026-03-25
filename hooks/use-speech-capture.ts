"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal?: boolean;
    0?: { transcript?: string };
    length?: number;
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type UseSpeechCaptureOptions = {
  lang?: string;
  maxDurationMs?: number;
  onTranscript?: (text: string) => void | Promise<void>;
};

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useSpeechCapture({ lang = 'pt-BR', maxDurationMs = 120000, onTranscript }: UseSpeechCaptureOptions = {}) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const transcriptRef = useRef('');
  const shouldEmitRef = useRef(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const clearTimer = useCallback(() => {
    if (stopTimerRef.current != null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    shouldEmitRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    recognitionRef.current = null;
    transcriptRef.current = '';
    shouldEmitRef.current = false;
    setIsRecording(false);
    setIsProcessing(false);
    setError(null);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
      recognitionRef.current?.stop();
    };
  }, [clearTimer]);

  const start = useCallback(() => {
    const Constructor = getSpeechRecognitionConstructor();

    if (!Constructor) {
      setError('Seu navegador nao suporta gravacao por voz.');
      return;
    }

    if (isRecording || isProcessing) {
      return;
    }

    const recognition = new Constructor() as SpeechRecognitionInstance;
    shouldEmitRef.current = false;
    transcriptRef.current = '';
    setError(null);
    setIsRecording(true);
    setIsProcessing(false);

    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join('')
        .trim();

      transcriptRef.current = transcript;
    };

    recognition.onerror = (event) => {
      clearTimer();
      recognitionRef.current = null;
      setIsRecording(false);
      setIsProcessing(false);
      setError(event.error ? `Nao foi possivel gravar por voz: ${event.error}` : 'Nao foi possivel gravar por voz.');
    };

    recognition.onend = async () => {
      clearTimer();
      recognitionRef.current = null;
      setIsRecording(false);

      const transcript = transcriptRef.current.trim();
      if (!shouldEmitRef.current || !transcript) {
        setIsProcessing(false);
        shouldEmitRef.current = false;
        return;
      }

      setIsProcessing(true);

      try {
        await onTranscript?.(transcript);
      } finally {
        setIsProcessing(false);
        shouldEmitRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();

    stopTimerRef.current = window.setTimeout(() => {
      shouldEmitRef.current = true;
      recognition.stop();
    }, maxDurationMs);
  }, [clearTimer, isProcessing, isRecording, lang, maxDurationMs, onTranscript]);

  return {
    error,
    isProcessing,
    isRecording,
    isSupported,
    reset,
    start,
    stop
  };
}
