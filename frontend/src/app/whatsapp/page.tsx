'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Check,
  CheckCheck,
  Clock,
  Copy,
  FileText,
  HelpCircle,
  MessageSquare,
  Package,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { onlyDigits } from '@/lib/format';

interface ChatBubble {
  id: string;
  sender: 'USER' | 'BOT';
  text: string;
  timestamp: string;
  rentalId?: string;
}

const QUICK_CATEGORIES = [
  {
    category: 'Dúvidas & Preços',
    icon: '💬',
    chips: [
      { label: '💰 Quanto custa o martelete?', text: 'Quanto custa a diária do martelete?' },
      { label: '🚚 Frete e Entrega', text: 'Como funciona o frete e entrega da Mantovani?' },
      { label: '💳 Formas de pagamento', text: 'Quais são as formas de pagamento aceitas?' },
      { label: '⚖️ Sapo vs Placa Vibratória', text: 'Qual a diferença entre a placa vibratória e o compactador sapo?' },
      { label: '📦 Entrega imediata hoje', text: 'Quais equipamentos estão disponíveis para entrega imediata?' },
    ],
  },
  {
    category: 'Locação em 1 Mensagem',
    icon: '⚡',
    chips: [
      {
        label: '🚀 2 Compactadores por 3 dias',
        text: 'Quero alugar 2 compactadores a partir de amanhã por 3 dias para a Av Paulista 1000, CEP 01310-100',
      },
      {
        label: '🔨 Martelete 10kg por 5 dias',
        text: 'Quero alugar um martelete 10kg por 5 dias',
      },
      {
        label: '✨ Bambolê de Concreto 2 dias',
        text: 'Preciso de uma alisadora de concreto bambolê por 2 dias',
      },
      {
        label: '🧱 Betoneira 400L por 7 dias',
        text: 'Preciso de uma betoneira 400L por 7 dias para São Paulo',
      },
    ],
  },
  {
    category: 'Passo a Passo Guiado',
    icon: '🔢',
    chips: [
      { label: '1️⃣ Iniciar ("Preciso alugar")', text: 'Preciso alugar' },
      { label: '2️⃣ Escolher item #1', text: '1' },
      { label: '3️⃣ Período ("3 dias")', text: '3 dias' },
      {
        label: '4️⃣ Endereço da Obra',
        text: 'Av. Paulista, 1000, Bela Vista, São Paulo - SP, CEP 01310-100',
      },
    ],
  },
];

/** Converts WhatsApp *bold* syntax into React elements safely */
function renderWhatsappFormatting(text: string) {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={lineIdx} className="block min-h-[1.2em]">
        {parts.map((part, partIdx) => {
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
              <strong key={partIdx} className="font-bold text-yellow-300">
                {part.slice(1, -1)}
              </strong>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </span>
    );
  });
}

function nowTimeStr(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function WhatsappSimulatorPage() {
  const [phone, setPhone] = useState('+55 11 98765-4321');
  const [inputText, setInputText] = useState('');
  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState(0);
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: 'welcome',
      sender: 'BOT',
      text: '👋 Olá! Bem-vindo ao atendimento oficial da *Mantovani* no WhatsApp!\n\nSou seu assistente virtual inteligente e posso ajudar você a cotar, tirar dúvidas técnicas ou fechar uma locação em segundos:\n\n• ❓ *Perguntas e Preços:* "Quanto custa o martelete?" ou "Como funciona a entrega?"\n• ⚡ *Locação expressa:* "Quero 2 compactadores por 3 dias para a Av Paulista 1000"\n• 📋 *Ou use o menu passo a passo guiado!*\n\nEscolha um atalho abaixo ou digite sua mensagem para começar:',
      timestamp: nowTimeStr(),
    },
  ]);

  const [lastRentalId, setLastRentalId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [simulatingPix, setSimulatingPix] = useState(false);
  const [paymentConfirmedIds, setPaymentConfirmedIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const knownOutboxCountRef = useRef<number>(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const syncSession = useCallback(
    async (phoneValue: string, appendNewOutbox = false) => {
      const digits = onlyDigits(phoneValue);
      if (digits.length < 8) return;
      try {
        const data = await api.getWhatsappSession(digits);
        const ctxRentalId =
          typeof data.session.contextData?.lastRentalId === 'string'
            ? data.session.contextData.lastRentalId
            : null;
        if (ctxRentalId) {
          setLastRentalId(ctxRentalId);
        }

        if (appendNewOutbox && data.outbox.length > knownOutboxCountRef.current) {
          const newItems = data.outbox.slice(knownOutboxCountRef.current);
          setMessages((prev) => [
            ...prev,
            ...newItems.map((item, idx) => ({
              id: `outbox-${Date.now()}-${idx}`,
              sender: 'BOT' as const,
              text: item.text,
              timestamp: new Date(item.sentAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })),
          ]);
        }
        knownOutboxCountRef.current = data.outbox.length;
      } catch {
        // ignore background sync error
      }
    },
    [],
  );

  useEffect(() => {
    void syncSession(phone, false);
  }, [phone, syncSession]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? inputText).trim();
    if (!content || sending) return;

    const userMsg: ChatBubble = {
      id: `user-${Date.now()}`,
      sender: 'USER',
      text: content,
      timestamp: nowTimeStr(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setSending(true);
    setError(null);

    try {
      const res = await api.sendWhatsappBotMessage({
        phone: onlyDigits(phone),
        text: content,
        pushName: 'Cliente Obra Rent',
      });

      if (res.replies && res.replies.length > 0) {
        const botBubbles: ChatBubble[] = res.replies.map((r, i) => {
          if (r.rentalId) {
            setLastRentalId(r.rentalId);
          }
          return {
            id: `bot-${Date.now()}-${i}`,
            sender: 'BOT',
            text: r.replyText,
            timestamp: nowTimeStr(),
            rentalId: r.rentalId,
          };
        });
        setMessages((prev) => [...prev, ...botBubbles]);
      }

      await syncSession(phone, false);
    } catch (err) {
      setError(errorMessage(err, 'Falha ao enviar mensagem para o atendimento WhatsApp.'));
    } finally {
      setSending(false);
    }
  };

  const handleSimulatePixApproval = async (rentalId: string) => {
    setSimulatingPix(true);
    setError(null);
    try {
      await api.simulatePayment(rentalId);
      setPaymentConfirmedIds((prev) => ({ ...prev, [rentalId]: true }));
      // Fetch session outbox so the automated WhatsApp confirmation arrives in chat
      await syncSession(phone, true);
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível confirmar o pagamento Pix no momento.'));
    } finally {
      setSimulatingPix(false);
    }
  };

  const handleResetSession = async () => {
    setSending(true);
    setError(null);
    try {
      await api.resetWhatsappSession(onlyDigits(phone));
      setLastRentalId(null);
      setMessages([
        {
          id: `reset-${Date.now()}`,
          sender: 'BOT',
          text: '🔄 *Conversa reiniciada.*\n\nOlá! Como posso ajudar você hoje? Você pode tirar dúvidas sobre equipamentos, diárias e prazos ou solicitar uma locação imediata.',
          timestamp: nowTimeStr(),
        },
      ]);
      await syncSession(phone, false);
    } catch (err) {
      setError(errorMessage(err, 'Erro ao reiniciar conversa no WhatsApp.'));
    } finally {
      setSending(false);
    }
  };

  const handleCopyPix = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedPixId(id);
      setTimeout(() => setCopiedPixId(null), 2500);
    }
  };

  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="mx-auto max-w-content space-y-4 sm:space-y-6 px-3.5 pb-28 pt-4 sm:px-6 sm:pb-16 sm:pt-8">
        {/* Page Title Banner - Mobile Optimized */}
        <div className="flex flex-col gap-3 rounded-2xl border border-yellow-400/25 bg-slate-900/65 p-4 text-white backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-yellow-400">
              <MessageSquare aria-hidden className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-wider">
                Atendimento Digital Oficial
              </span>
            </div>
            <h1 className="bg-gradient-to-r from-white via-yellow-300 to-amber-400 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-3xl">
              Locação Rápida via WhatsApp
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Pergunte preços, tire dúvidas ou alugue máquinas direto pelo chat com frete incluso e Pix na hora.
            </p>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => void handleResetSession()}
            loading={sending}
            className="self-start sm:self-auto shrink-0 border-white/15 hover:border-yellow-400/40 text-xs sm:text-sm h-9 sm:h-10"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-400" />
            Nova Conversa
          </Button>
        </div>

        {error ? (
          <Alert tone="danger" title="Aviso no atendimento">
            {error}
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* LEFT: WhatsApp Web Chat Experience */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-yellow-400/30 bg-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            {/* WhatsApp Contact Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-yellow-400/20 bg-slate-900/90 px-4 py-3 text-white backdrop-blur-xl sm:px-5">
              <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-yellow-400/50 bg-gradient-to-br from-yellow-400 to-amber-500 font-bold text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.35)]">
                  <Bot aria-hidden className="h-6 w-6" />
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">Obra Rent · Atendimento Inteligente</h2>
                    <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-300">
                      Oficial
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Online agora · Responde em segundos
                  </p>
                </div>
              </div>

              {/* User simulated phone toggle */}
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs">
                <Phone aria-hidden className="h-3.5 w-3.5 text-yellow-400" />
                {isEditingPhone ? (
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => setIsEditingPhone(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingPhone(false)}
                    autoFocus
                    className="w-32 bg-transparent font-mono text-xs text-yellow-300 outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(true)}
                    className="font-mono text-xs text-slate-300 hover:text-yellow-300 transition-colors"
                    title="Clique para alterar seu número no teste"
                  >
                    {phone}
                  </button>
                )}
              </div>
            </div>

            {/* Chat Messages Area */}
            <div
              ref={chatScrollRef}
              className="h-[480px] space-y-3.5 overflow-y-auto bg-[#070b12] p-4 sm:p-5"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 15% 15%, rgba(250, 204, 21, 0.05) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(245, 158, 11, 0.05) 0%, transparent 40%)',
              }}
            >
              {/* Day divider */}
              <div className="flex justify-center my-1">
                <span className="rounded-md border border-white/5 bg-slate-900/70 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 backdrop-blur-md">
                  Hoje
                </span>
              </div>

              {messages.map((msg) => {
                const isUser = msg.sender === 'USER';
                return (
                  <div
                    key={msg.id}
                    className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed backdrop-blur-md sm:max-w-[78%]',
                        isUser
                          ? 'rounded-tr-none border border-yellow-400/40 bg-yellow-500/20 text-yellow-100 shadow-[0_0_24px_-4px_rgba(250,204,21,0.25)]'
                          : 'rounded-tl-none border border-white/10 bg-slate-900/90 text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
                      )}
                    >
                      <div className="break-words text-sm">{renderWhatsappFormatting(msg.text)}</div>

                      <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[11px] text-slate-400">
                        <span>{msg.timestamp}</span>
                        {isUser ? <CheckCheck aria-hidden className="h-3.5 w-3.5 text-yellow-400" /> : null}
                      </div>
                    </div>

                    {/* Interactive Order Action Banner when a rental was created */}
                    {msg.rentalId ? (
                      <div className="mt-2.5 w-full max-w-[88%] rounded-2xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/15 via-slate-900/90 to-amber-500/10 p-4 backdrop-blur-xl shadow-[0_0_28px_-6px_rgba(250,204,21,0.3)] sm:max-w-[78%]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-300">
                            <Sparkles aria-hidden className="h-4 w-4 text-yellow-400" />
                            Pedido Gerado com Sucesso!
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyPix(msg.rentalId!, msg.rentalId!)}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-0.5 text-[10px] font-mono text-slate-300 hover:text-yellow-300 hover:border-yellow-400/30 transition-colors"
                            >
                              {copiedPixId === msg.rentalId ? (
                                <>
                                  <Check aria-hidden className="h-3 w-3 text-emerald-400" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy aria-hidden className="h-3 w-3 text-slate-400" />
                                  <span>ID</span>
                                </>
                              )}
                            </button>
                            <Badge tone={paymentConfirmedIds[msg.rentalId] ? 'success' : 'warning'}>
                              {paymentConfirmedIds[msg.rentalId] ? 'Pix Confirmado' : 'Aguardando Pagamento Pix'}
                            </Badge>
                          </div>
                        </div>

                        <p className="mt-2 text-xs text-slate-200 leading-relaxed">
                          Seu pedido foi registrado e os equipamentos reservados no estoque. Você pode simular o pagamento Pix para receber a confirmação automática no chat:
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            size="md"
                            loading={simulatingPix}
                            disabled={Boolean(paymentConfirmedIds[msg.rentalId])}
                            onClick={() => void handleSimulatePixApproval(msg.rentalId!)}
                            className="h-9 min-h-9 px-3.5 text-xs font-semibold shadow-[0_0_15px_rgba(250,204,21,0.3)]"
                          >
                            <Zap aria-hidden className="h-3.5 w-3.5" />
                            {paymentConfirmedIds[msg.rentalId]
                              ? 'Pix Confirmado!'
                              : 'Simular Pagamento Pix'}
                          </Button>

                          <Link
                            href={`/pedidos/${encodeURIComponent(msg.rentalId)}/contrato`}
                            className={buttonClasses({
                              variant: 'dark',
                              size: 'md',
                              className: 'h-9 min-h-9 px-3 text-xs border border-white/15 hover:border-yellow-400/40',
                            })}
                          >
                            <FileText aria-hidden className="h-3.5 w-3.5 text-yellow-400" />
                            Ver Contrato
                          </Link>

                          <Link
                            href={`/pedidos/${encodeURIComponent(msg.rentalId)}`}
                            className={buttonClasses({
                              variant: 'secondary',
                              size: 'md',
                              className: 'h-9 min-h-9 px-3 text-xs',
                            })}
                          >
                            <Package aria-hidden className="h-3.5 w-3.5" />
                            Acompanhar Pedido
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Quick Prompt Chips */}
            <div className="border-t border-white/10 bg-slate-900/80 px-4 py-3">
              <div className="mb-2.5 flex items-center justify-between gap-2 overflow-x-auto">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
                  Atalhos Rápidos:
                </span>
                <div className="flex gap-1">
                  {QUICK_CATEGORIES.map((cat, idx) => (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setSelectedCategoryIdx(idx)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
                        selectedCategoryIdx === idx
                          ? 'border border-yellow-400/50 bg-yellow-400/20 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.25)]'
                          : 'border border-white/5 bg-slate-950/60 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
                      )}
                    >
                      <span className="mr-1">{cat.icon}</span>
                      {cat.category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_CATEGORIES[selectedCategoryIdx]?.chips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    disabled={sending}
                    onClick={() => void handleSendMessage(chip.text)}
                    className="rounded-full border border-yellow-400/30 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-yellow-300 transition-all hover:border-amber-400/60 hover:bg-yellow-400/15 hover:text-yellow-200 disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-2 border-t border-white/10 bg-slate-950 p-3 sm:p-4"
            >
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Digite sua dúvida ou pedido (ex: 'Quero martelete por 3 dias')..."
                disabled={sending}
                className="bg-slate-900/90 text-white placeholder:text-slate-500 border-white/15 focus:border-yellow-400"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={sending}
                disabled={!inputText.trim()}
                className="shrink-0 font-semibold shadow-[0_0_16px_rgba(250,204,21,0.3)]"
              >
                <Send aria-hidden className="h-4 w-4" />
                <span className="hidden sm:inline">Enviar</span>
              </Button>
            </form>
          </div>

          {/* RIGHT: User-Friendly Information & Benefits Panel */}
          <div className="space-y-4 sm:space-y-5">
            {/* Last Created Order Card (if available) */}
            {lastRentalId ? (
              <Card className="border-yellow-400/40 bg-gradient-to-br from-yellow-500/15 via-slate-900/90 to-amber-500/10 backdrop-blur-xl shadow-[0_0_24px_-6px_rgba(250,204,21,0.25)]">
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-white text-sm sm:text-base">
                      <Package aria-hidden className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400" />
                      Último Pedido Gerado
                    </span>
                  }
                  action={
                    <Badge tone={paymentConfirmedIds[lastRentalId] ? 'success' : 'warning'}>
                      {paymentConfirmedIds[lastRentalId] ? 'Pix Confirmado' : 'Aguardando Pagamento'}
                    </Badge>
                  }
                />
                <CardBody className="space-y-3 text-xs">
                  <p className="font-mono text-slate-300 break-all text-[11px] bg-slate-950/70 p-2 rounded-lg border border-white/5">
                    {lastRentalId}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      href={`/pedidos/${encodeURIComponent(lastRentalId)}/contrato`}
                      className={buttonClasses({
                        variant: 'primary',
                        size: 'md',
                        className: 'h-8 min-h-8 px-3 text-xs font-semibold',
                      })}
                    >
                      <FileText aria-hidden className="h-3.5 w-3.5" />
                      Ver Contrato
                    </Link>
                    <Link
                      href={`/pedidos/${encodeURIComponent(lastRentalId)}`}
                      className={buttonClasses({
                        variant: 'secondary',
                        size: 'md',
                        className: 'h-8 min-h-8 px-3 text-xs',
                      })}
                    >
                      Acompanhar
                    </Link>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {/* Mobile collapsible guide */}
            <div className="lg:hidden">
              <details className="group rounded-2xl border border-yellow-400/25 bg-slate-900/60 p-4 backdrop-blur-xl">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-xs text-yellow-300">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-yellow-400" />
                    Como Funciona & Dicas do Atendimento
                  </span>
                  <span className="text-slate-400 text-xs transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="mt-4 space-y-3 pt-3 border-t border-white/10 text-xs text-slate-300">
                  <p>• <strong>1. Peça pelo chat:</strong> Envie o que precisa em linguagem comum (ex: &quot;Quero martelete por 3 dias&quot;).</p>
                  <p>• <strong>2. Frete Incluso:</strong> A entrega e recolhimento no canteiro estão inclusos sem taxas extras.</p>
                  <p>• <strong>3. Pix e Contrato:</strong> Pague pelo Pix Copia e Cola e o contrato é emitido automaticamente.</p>
                </div>
              </details>
            </div>

            {/* Desktop cards */}
            <div className="hidden lg:block space-y-5">
              {/* Como Funciona Card */}
              <Card className="border-yellow-400/25 bg-slate-900/60 backdrop-blur-xl">
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-white">
                      <Sparkles aria-hidden className="h-5 w-5 text-yellow-400" />
                      Como Funciona o Atendimento
                    </span>
                  }
                  description="Simples, direto e sem burocracia para sua obra"
                />
                <CardBody className="space-y-3.5 text-xs text-slate-300">
                  <div className="flex gap-3 rounded-xl border border-white/5 bg-slate-950/60 p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-400/15 text-yellow-400 font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-white">Envie sua dúvida ou pedido</p>
                      <p className="mt-0.5 text-slate-400">
                        Fale em linguagem natural: peça preços, prazos ou informe equipamento e datas.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 rounded-xl border border-white/5 bg-slate-950/60 p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-400/15 text-yellow-400 font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-white">Cotação & Estoque Imediatos</p>
                      <p className="mt-0.5 text-slate-400">
                        O bot consulta o estoque em tempo real e calcula o valor das diárias com frete grátis incluso.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 rounded-xl border border-white/5 bg-slate-950/60 p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-400/15 text-yellow-400 font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-white">Pix Copia e Cola & Contrato</p>
                      <p className="mt-0.5 text-slate-400">
                        Receba o código Pix no chat. Pagou, o contrato digital é emitido e o equipamento reservado.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Dicas de Uso Card */}
              <Card className="border-yellow-400/20 bg-slate-900/60 backdrop-blur-xl">
                <CardHeader
                  title={
                    <span className="flex items-center gap-2 text-white">
                      <HelpCircle aria-hidden className="h-5 w-5 text-amber-400" />
                      Dicas de Uso do Assistente
                    </span>
                  }
                  description="Aproveite o máximo da inteligência artificial"
                />
                <CardBody className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <Zap aria-hidden className="h-4 w-4 shrink-0 text-yellow-400 mt-0.5" />
                    <p>
                      <strong className="text-white">Alugue em 1 frase:</strong> Envie o equipamento, quantidade, dias e endereço de uma vez só!
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Truck aria-hidden className="h-4 w-4 shrink-0 text-yellow-400 mt-0.5" />
                    <p>
                      <strong className="text-white">Frete Incluso:</strong> Entregamos e recolhemos no canteiro da obra sem custos adicionais de frete nas diárias.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-yellow-400 mt-0.5" />
                    <p>
                      <strong className="text-white">Equipamentos Revisados:</strong> Todos os itens saem com laudo, checklist e termo de entrega.
                    </p>
                  </div>
                </CardBody>
              </Card>

              {/* Atendimento Card */}
              <div className="rounded-2xl border border-yellow-400/25 bg-gradient-to-br from-yellow-500/10 to-amber-500/5 p-4 text-xs text-slate-300 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-1.5">
                  <Clock aria-hidden className="h-4 w-4" />
                  <span>Atendimento 24 horas por dia</span>
                </div>
                <p className="text-slate-400">
                  Nosso bot atende a qualquer hora, inclusive fins de semana e feriados, garantindo que sua obra nunca pare por falta de ferramentas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
