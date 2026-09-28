import { useState, useEffect, useRef, useCallback } from 'react';

// SpeechRecognition interfaces for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface UseVoiceRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string) => void;
}

export type MicPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const {
    lang = 'bn-BD',
    continuous = false,
    interimResults = true,
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<MicPermissionStatus>('prompt');

  const recognitionRef = useRef<any>(null);
  const isStartedRef = useRef(false);
  const isStartingRef = useRef(false);
  const restartTimeoutRef = useRef<any>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Check initial permission status if Permissions API is supported
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as any })
        .then((status) => {
          setPermissionStatus(status.state as MicPermissionStatus);
          status.onchange = () => {
            setPermissionStatus(status.state as MicPermissionStatus);
          };
        })
        .catch(() => {});
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermissionStatus('unsupported');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop all tracks to release hardware for SpeechRecognition
      stream.getTracks().forEach((track) => track.stop());
      setPermissionStatus('granted');
      setErrorMessage(null);
      return true;
    } catch (err: any) {
      console.warn('Microphone permission request error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        const permMsg =
          'মাইক্রোফোনের অনুমতি দেওয়া হয়নি (Permission Denied)। অনুগ্রহ করে ব্রাউজার অ্যাড্রেসবারে সাইট সেটিংসে গিয়ে মাইক্রোফোন পারমিশন "Allow" করুন।';
        setPermissionStatus('denied');
        setErrorMessage(permMsg);
        onErrorRef.current?.(permMsg);
      } else {
        const genericMsg = 'মাইক্রোফোন চালু করতে সমস্যা হয়েছে। ডিভাইসের মাইক্রোফোন চেক করুন।';
        setErrorMessage(genericMsg);
        onErrorRef.current?.(genericMsg);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      recognition.onstart = () => {
        isStartedRef.current = true;
        isStartingRef.current = false;
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
          onResultRef.current?.(interim, false);
        }

        if (final) {
          setTranscript(final);
          setInterimTranscript('');
          onResultRef.current?.(final, true);
        }
      };

      recognition.onerror = (event: any) => {
        // 'aborted' is expected when stopping or aborting programmatically
        if (event.error === 'aborted') {
          isStartedRef.current = false;
          isStartingRef.current = false;
          setIsListening(false);
          return;
        }

        isStartedRef.current = false;
        isStartingRef.current = false;
        setIsListening(false);

        let errorMsg = 'ভয়েস ইনপুটে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          errorMsg = 'মাইক্রোফোনের অনুমতি দেওয়া হয়নি। অনুগ্রহ করে ব্রাউজার সেটিংসে গিয়ে অনুমতি দিন।';
        } else if (event.error === 'no-speech') {
          errorMsg = 'কোনো কথা শোনা যায়নি। আবার বলুন।';
        } else if (event.error === 'network') {
          errorMsg = 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। অফলাইনে থাকলে ব্রাউজারের অন-ডিভাইস ভয়েস মডেল সক্রিয় থাকতে হবে।';
        } else if (event.error === 'audio-capture') {
          errorMsg = 'মাইক্রোফোন পাওয়া যায়নি। আপনার ডিভাইসের মাইক্রোফোন চেক করুন।';
        } else if (event.error === 'language-not-supported') {
          errorMsg = 'নির্বাচিত ভাষাটি ব্রাউজারে সমর্থিত নয়।';
        }

        setErrorMessage(errorMsg);
        onErrorRef.current?.(errorMsg);
      };

      recognition.onend = () => {
        isStartedRef.current = false;
        isStartingRef.current = false;
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e: any) {
      console.error('Failed to initialize speech recognition:', e);
      setIsSupported(false);
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      isStartedRef.current = false;
      isStartingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [lang, continuous, interimResults]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) {
      setErrorMessage('আপনার ব্রাউজারে স্পিচ রিকগনিশন সাপোর্ট নেই। গুগল ক্রোম বা এজ ব্যবহার করুন।');
      return;
    }

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // If already active or in process of starting, avoid duplicate start calls
    if (isStartedRef.current || isStartingRef.current) {
      setIsListening(true);
      return;
    }

    // Explicitly prompt the user for microphone permission if not yet granted
    if (permissionStatus !== 'granted' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
    }

    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);

    try {
      isStartingRef.current = true;
      recognitionRef.current.start();
    } catch (e: any) {
      isStartingRef.current = false;
      const errorMsg = String(e?.message || e || '');
      if (e?.name === 'InvalidStateError' || errorMsg.includes('already started')) {
        // Recognition is already active
        isStartedRef.current = true;
        setIsListening(true);
      } else {
        console.warn('Speech recognition start failed:', e);
      }
    }
  }, [permissionStatus, requestPermission]);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    isStartingRef.current = false;
    isStartedRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    errorMessage,
    permissionStatus,
    requestPermission,
    startListening,
    stopListening,
    resetTranscript,
  };
}
