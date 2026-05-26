'use client';

import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { buildAiChatPayload } from '@/lib/aiChat';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTED_QUESTIONS = [
  'Lajukan ini buat apa aja sih?',
  'Gimana cara cari supplier terpercaya di sini?',
  'Kalau mau cari distributor atau bahan baku, mulainya dari mana?',
  'Bisa sewa alat usaha juga di sini?',
  'Apa bedanya Lajukan sama marketplace supplier lain?',
];

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendSuggested = (question: string) => {
    setInput(question);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const payload = buildAiChatPayload(userMessage, messages);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({})) as { response?: string };
      const assistantContent = res.ok
        ? (data.response ?? 'Maaf, tidak ada jawaban.')
        : (data.response ?? 'Maaf, ada error. Coba lagi ya.');
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Koneksi atau layanan AI lagi bermasalah. Coba lagi sebentar ya.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-lg hover:bg-[color:var(--app-accent)] flex items-center justify-center transition-all hover:scale-110"
          aria-label="Open AI Assistant"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-md">
          <div className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] shadow-2xl flex flex-col h-[32rem]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[color:var(--app-accent)] animate-pulse" />
                <h3 className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Asisten Lajukan
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:var(--app-surface-strong)] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] py-6">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-[color:var(--app-accent)]" />
                  <p className="font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">Hai, aku asisten Lajukan.</p>
                  <p className="mt-1">Tanya supplier, jasa, rental, freelancer, atau cara pakai.</p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => sendSuggested(q)}
                        className="text-left px-3 py-2 rounded-xl bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] hover:bg-[color:var(--app-accent-soft)] dark:hover:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_40%,_transparent)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] text-xs border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                        : 'bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] rounded-2xl px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[color:var(--app-surface)] animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-[color:var(--app-surface)] animate-bounce delay-100" />
                      <div className="w-2 h-2 rounded-full bg-[color:var(--app-surface)] animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Tanya apa aja tentang Lajukan..."
                  disabled={loading}
                  className="flex-1 h-10 rounded-xl border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] px-4 text-sm disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[color:var(--app-accent)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
