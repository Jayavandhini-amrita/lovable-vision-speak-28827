/**
 * VQA Controls component
 * Handles question input, voice controls, and conversation history
 */

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export interface ConversationItem {
  id: string;
  question: string;
  answer: string;
  timestamp: Date;
}

interface VQAControlsProps {
  onAskQuestion: (question: string) => Promise<void>;
  onStartListening: () => Promise<string>;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  conversation: ConversationItem[];
  muteTTS: boolean;
  onToggleMute: () => void;
}

export const VQAControls = ({
  onAskQuestion,
  onStartListening,
  isListening,
  isProcessing,
  isSpeaking,
  conversation,
  muteTTS,
  onToggleMute,
}: VQAControlsProps) => {
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    if (isProcessing) {
      return;
    }

    try {
      await onAskQuestion(question.trim());
      setQuestion('');
    } catch (error) {
      console.error('Question submission error:', error);
    }
  };

  const handleVoiceInput = async () => {
    if (isListening) {
      return;
    }

    try {
      const transcribedText = await onStartListening();
      setQuestion(transcribedText);
      inputRef.current?.focus();
      toast.success('Voice input captured');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Voice input failed';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-bold mb-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Ask About The Scene
        </h2>
        <p className="text-sm text-muted-foreground">
          Use voice or text to ask questions about what you see
        </p>
      </div>

      {/* Conversation History */}
      <ScrollArea className="flex-1 p-4">
        <div ref={scrollRef} className="space-y-4">
          {conversation.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No questions yet</p>
              <p className="text-xs mt-1">Ask your first question about the scene!</p>
            </div>
          ) : (
            conversation.map((item) => (
              <div key={item.id} className="space-y-2">
                {/* Question */}
                <div className="flex justify-end">
                  <div className="glass-panel px-4 py-2 max-w-[85%]">
                    <p className="text-sm font-medium text-foreground">{item.question}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Answer */}
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-xl max-w-[85%] bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                    <p className="text-sm text-foreground leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="glass-panel px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing scene...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Ask a question about the scene..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isProcessing || isListening}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            <Button
              type="button"
              size="icon"
              variant={isListening ? 'default' : 'outline'}
              onClick={handleVoiceInput}
              disabled={isProcessing}
              className={isListening ? 'pulse-ring' : ''}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>

            <Button
              type="submit"
              size="icon"
              disabled={!question.trim() || isProcessing}
              className="ai-button primary"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Status and Controls */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {isListening && (
                <span className="status-indicator recording">
                  <Mic className="w-3 h-3" />
                  Listening...
                </span>
              )}
              {isSpeaking && (
                <span className="status-indicator processing">
                  <Volume2 className="w-3 h-3" />
                  Speaking...
                </span>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onToggleMute}
              className="h-7 text-xs"
            >
              {muteTTS ? (
                <>
                  <VolumeX className="w-3 h-3 mr-1" />
                  TTS Muted
                </>
              ) : (
                <>
                  <Volume2 className="w-3 h-3 mr-1" />
                  TTS On
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press <kbd className="px-1 py-0.5 rounded bg-muted">Enter</kbd> to send • Use{' '}
          <Mic className="w-3 h-3 inline" /> for voice input
        </p>
      </div>
    </div>
  );
};
