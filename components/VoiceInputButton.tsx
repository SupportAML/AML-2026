import React, { useState, useEffect, useRef } from 'react';
import { MicIcon, MicOffIcon, Loader2Icon } from 'lucide-react';

interface VoiceInputButtonProps {
    onTranscription: (text: string) => void;
    isActive: boolean;
    onToggle: () => void;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    mode?: 'append' | 'continuous'; // 'append' = only final results, 'continuous' = all results
}

/**
 * A compact voice input button with live transcription feedback.
 * Can be embedded in toolbars or input areas.
 */
export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
    onTranscription,
    isActive,
    onToggle,
    className = '',
    size = 'md',
    mode = 'continuous' // Default to continuous for backward compatibility
}) => {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const onTranscriptionRef = useRef(onTranscription);
    const isStartingRef = useRef(false);

    // Keep the callback ref up to date
    useEffect(() => {
        onTranscriptionRef.current = onTranscription;
    }, [onTranscription]);

    // Initialize speech recognition when active
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
            if (mode === 'append') {
                // For append mode (Facts & Notes), only send finalized results
                // This prevents duplicate text from being added
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        const finalTranscript = event.results[i][0].transcript;
                        if (finalTranscript.trim()) {
                            onTranscriptionRef.current(finalTranscript);
                        }
                    }
                }
            } else {
                // For continuous mode (Legal Writer), send full transcript including interim results
                let fullTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    fullTranscript += event.results[i][0].transcript;
                }
                if (fullTranscript) {
                    onTranscriptionRef.current(fullTranscript);
                }
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

    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12'
    };

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    };

    return (
        <div className="relative inline-flex items-center">
            <button
                onClick={onToggle}
                title={isActive ? "Stop voice input" : "Start voice input"}
                className={`${sizeClasses[size]} rounded-xl flex items-center justify-center transition-all shadow-md hover:shadow-lg active:scale-95 ${isActive
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                    } ${className}`}
            >
                {isListening ? (
                    <div className="flex items-end gap-0.5 h-4">
                        <div className="w-0.5 bg-white rounded-full animate-voice-bar-1 h-2" />
                        <div className="w-0.5 bg-white rounded-full animate-voice-bar-2 h-3" />
                        <div className="w-0.5 bg-white rounded-full animate-voice-bar-3 h-1.5" />
                        <div className="w-0.5 bg-white rounded-full animate-voice-bar-2 h-3" />
                        <div className="w-0.5 bg-white rounded-full animate-voice-bar-1 h-2" />
                    </div>
                ) : isActive ? (
                    <MicIcon className={iconSizes[size]} />
                ) : (
                    <MicOffIcon className={iconSizes[size]} />
                )}
            </button>

            {/* Active Indicator */}
            {isActive && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white" />
            )}

            {/* Error Tooltip */}
            {error && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1">
                    {error}
                </div>
            )}

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
        `
            }} />
        </div>
    );
};
