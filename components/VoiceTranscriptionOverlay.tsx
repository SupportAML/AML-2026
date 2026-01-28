
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MicIcon, MicOffIcon, Loader2Icon } from 'lucide-react';

interface VoiceTranscriptionOverlayProps {
    onTranscription: (text: string) => void;
    isActive: boolean;
    onClear?: () => void;
}

/**
 * A professional voice transcription component using Web Speech API.
 * Includes a premium mic animation and live feedback.
 */
export const VoiceTranscriptionOverlay: React.FC<VoiceTranscriptionOverlayProps> = ({
    onTranscription,
    isActive,
    onClear
}) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const onTranscriptionRef = useRef(onTranscription);
    const isStartingRef = useRef(false);

    // Keep the callback ref up to date
    useEffect(() => {
        onTranscriptionRef.current = onTranscription;
    }, [onTranscription]);

    // Initialize speech recognition
    useEffect(() => {
        if (!isActive) {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) { }
                recognitionRef.current = null;
            }
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Speech recognition not supported in this browser.");
            return;
        }

        // Prevent multiple instances
        if (recognitionRef.current && isListening) return;

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
            isStartingRef.current = false;
        };

        recognition.onresult = (event: any) => {
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                fullTranscript += event.results[i][0].transcript;
            }
            if (fullTranscript) {
                onTranscriptionRef.current(fullTranscript);
            }
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'aborted') {
                isStartingRef.current = false;
                return;
            }

            console.error("Speech recognition error:", event.error);
            if (event.error === 'not-allowed') {
                setError("Microphone access denied.");
            } else if (event.error !== 'no-speech') {
                setError(`Error: ${event.error}`);
            }
            setIsListening(false);
            isStartingRef.current = false;
        };

        recognition.onend = () => {
            setIsListening(false);
            isStartingRef.current = false;

            // Auto-restart if still active
            if (isActive && recognitionRef.current) {
                setTimeout(() => {
                    if (isActive && recognitionRef.current && !isStartingRef.current) {
                        try {
                            isStartingRef.current = true;
                            recognitionRef.current.start();
                        } catch (e) {
                            isStartingRef.current = false;
                        }
                    }
                }, 300);
            }
        };

        try {
            if (!isStartingRef.current) {
                isStartingRef.current = true;
                recognition.start();
            }
        } catch (e) {
            isStartingRef.current = false;
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) { }
                recognitionRef.current = null;
            }
            isStartingRef.current = false;
        };
    }, [isActive]);

    if (!isActive) return null;

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in zoom-in duration-300">
            <div className="relative mb-3">
                {/* Pulse Animations */}
                {isListening && (
                    <>
                        <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20" />
                        <div className="absolute inset-0 bg-indigo-500 rounded-full animate-pulse opacity-40 scale-125" />
                    </>
                )}

                <div className={`relative z-10 w-12 h-12 flex items-center justify-center rounded-full shadow-lg transition-all duration-500 ${isListening ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                    {isListening ? (
                        <div className="flex items-end gap-0.5 h-4">
                            <div className="w-1 bg-white rounded-full animate-voice-bar-1 h-3" />
                            <div className="w-1 bg-white rounded-full animate-voice-bar-2 h-4" />
                            <div className="w-1 bg-white rounded-full animate-voice-bar-3 h-2" />
                            <div className="w-1 bg-white rounded-full animate-voice-bar-2 h-4" />
                            <div className="w-1 bg-white rounded-full animate-voice-bar-1 h-3" />
                        </div>
                    ) : (
                        <MicOffIcon className="w-6 h-6" />
                    )}
                </div>
            </div>

            <div className="text-center">
                <p className={`text-xs font-bold uppercase tracking-widest ${isListening ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {isListening ? 'Listening...' : 'Mic Active'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Speak clearly into your microphone</p>
                {error && <p className="text-[10px] text-red-500 mt-1 font-bold">{error}</p>}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes voice-bar-1 {
          0%, 100% { height: 8px; }
          50% { height: 14px; }
        }
        @keyframes voice-bar-2 {
          0%, 100% { height: 12px; }
          50% { height: 18px; }
        }
        @keyframes voice-bar-3 {
          0%, 100% { height: 6px; }
          50% { height: 12px; }
        }
        .animate-voice-bar-1 { animation: voice-bar-1 0.8s ease-in-out infinite; }
        .animate-voice-bar-2 { animation: voice-bar-2 0.8s ease-in-out infinite 0.1s; }
        .animate-voice-bar-3 { animation: voice-bar-3 0.8s ease-in-out infinite 0.2s; }
      `}} />
        </div>
    );
};
