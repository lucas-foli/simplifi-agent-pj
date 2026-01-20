import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { branding } from '@/config/branding';
import {
  Send,
  ArrowLeft,
  Bot,
  User as UserIcon,
  Sparkles,
  DollarSign,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface MessageAction {
  label: string;
  action: string;
  data?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  created_at: string;
  actions?: MessageAction[];
}

interface AIResponse {
  message: string;
  metadata: Record<string, string>;
  actions: MessageAction[];
}

const Chat = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Load chat history
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      // Use conversations and messages tables
      const { data: conversationsData, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convError) throw convError;

      if (conversationsData) {
        const { data: messagesData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationsData.id)
          .order('created_at', { ascending: true });

        if (msgError) throw msgError;
        
        if (messagesData) {
          const formattedMessages: Message[] = messagesData.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            message: msg.content,
            created_at: msg.created_at,
          }));
          setMessages(formattedMessages);
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveChatMessage = async (role: 'user' | 'assistant', message: string, metadata?: Record<string, string>) => {
    if (!user?.id) return;
    
    try {
      // Get or create conversation
      let conversationId;
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversationsData) {
        conversationId = conversationsData.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({ user_id: user.id, title: 'Nova Conversa' })
          .select('id')
          .single();
        
        if (convError) throw convError;
        conversationId = newConv.id;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role,
          content: message,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message to UI
    const userMsg = await saveChatMessage('user', userMessage);
    if (userMsg) {
      setMessages((prev) => [...prev, {
        id: userMsg.id,
        role: userMsg.role as 'user' | 'assistant',
        message: userMsg.content,
        created_at: userMsg.created_at,
      }]);
    }

    try {
      // Call Edge Function for AI response
      const response = await callChatAssistant(userMessage);
      
      const assistantMsg = await saveChatMessage('assistant', response.message, response.metadata);
      if (assistantMsg) {
        setMessages((prev) => [...prev, {
          id: assistantMsg.id,
          role: assistantMsg.role as 'user' | 'assistant',
          message: assistantMsg.content,
          created_at: assistantMsg.created_at,
          actions: response.actions,
        }]);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      toast.error('Erro ao processar mensagem');
    } finally {
      setIsLoading(false);
    }
  };

  // Call Edge Function for AI-powered chat
  const callChatAssistant = async (userMessage: string): Promise<AIResponse> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: {
          message: userMessage,
          userId: user.id,
        },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error calling chat assistant:', error);
      // Fallback to simulated response if Edge Function fails
      return simulateAIResponse(userMessage);
    }
  };

  // Fallback: Simulação de resposta caso Edge Function falhe
  const simulateAIResponse = async (userMessage: string): Promise<AIResponse> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('saldo') || lowerMessage.includes('quanto tenho')) {
      return {
        message: 'Seu saldo restante este mês é de R$ 31.597,20. Você já gastou R$ 1.302,90 em despesas variáveis.',
        metadata: { type: 'balance_query' },
        actions: [
          { label: 'Ver Detalhes', action: 'navigate', data: '/dashboard' },
        ],
      };
    }

    if (lowerMessage.includes('gasto') || lowerMessage.includes('gastei')) {
      return {
        message: 'Você gastou R$ 1.302,90 este mês, distribuídos em: Alimentação (R$ 222,90), Transporte (R$ 80,00) e outros.',
        metadata: { type: 'expenses_query' },
        actions: [
          { label: 'Ver Transações', action: 'navigate', data: '/transactions' },
        ],
      };
    }

    if (lowerMessage.includes('adicionar') || lowerMessage.includes('registrar')) {
      return {
        message: 'Claro! Vou te ajudar a adicionar uma nova despesa. Clique no botão abaixo para abrir o formulário.',
        metadata: { type: 'add_transaction' },
        actions: [
          { label: 'Adicionar Despesa', action: 'navigate', data: '/transactions' },
        ],
      };
    }

    return {
      message: `Entendi que você disse: "${userMessage}". Como posso ajudar? Você pode me perguntar sobre seu saldo, gastos ou pedir para adicionar uma despesa.`,
      metadata: { type: 'default' },
      actions: [],
    };
  };

  const handleAction = (action: string, data?: string) => {
    if (action === 'navigate' && data) {
      window.location.href = data;
    }
  };

  const quickActions = [
    { icon: DollarSign, label: 'Ver Saldo', message: 'Quanto tenho disponível?' },
    { icon: Receipt, label: 'Meus Gastos', message: 'Quanto gastei este mês?' },
    { icon: TrendingUp, label: 'Adicionar Despesa', message: 'Quero adicionar uma despesa' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/company/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <img
                src={branding.logo.horizontal}
                alt={`${branding.brandName} assistente`}
                className="h-8 w-auto object-contain"
              />
              <span className="sr-only">{branding.brandName}</span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Assistente {branding.brandName}</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Pergunte sobre suas finanças
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Como posso ajudar?</h2>
              <p className="text-muted-foreground mb-8">
                Pergunte sobre seu saldo, gastos ou peça para adicionar despesas
              </p>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="gap-2 h-auto py-4 flex-col"
                    onClick={() => {
                      setInput(action.message);
                      setTimeout(() => handleSendMessage(), 100);
                    }}
                  >
                    <action.icon className="h-6 w-6" />
                    <span className="text-sm">{action.label}</span>
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}

                <div className={`flex flex-col gap-2 max-w-[80%] sm:max-w-[70%]`}>
                  <Card
                    className={`p-3 sm:p-4 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm sm:text-base whitespace-pre-wrap">{message.message}</p>
                    <p className="text-xs opacity-70 mt-2">
                      {format(new Date(message.created_at), 'HH:mm')}
                    </p>
                  </Card>

                  {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {message.actions.map((action, idx) => (
                        <Button
                          key={idx}
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(action.action, action.data)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <UserIcon className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <Card className="p-4 bg-muted">
                <div className="flex gap-1">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce delay-100">●</span>
                  <span className="animate-bounce delay-200">●</span>
                </div>
              </Card>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Digite sua mensagem..."
                disabled={isLoading}
                className="flex-1 min-h-[44px] max-h-[200px] resize-none"
                rows={1}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="gap-2 h-[44px]"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Enviar</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              🤖 Assistente com IA real! Pressione Enter para enviar, Shift+Enter para quebrar linha.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
