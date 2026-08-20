import React, { useEffect, useState, useRef } from 'react';
import { User, Message, Conversation } from '../types';
import { ChatWebSocketClient, getMessagesHistory } from '../services/api';
import { UserSearch } from './UserSearch';
import { Send, UserPlus, LogOut, MessageSquare, AlertTriangle } from 'lucide-react';

interface ChatLayoutProps {
  currentUser: User;
  onLogout: () => void;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ currentUser, onLogout }) => {
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: 'Global', name: 'Global (Público)', type: 'global', unreadCount: 0 }
  ]);
  const [activeConversation, setActiveConversation] = useState<Conversation>(conversations[0]);
  
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  
  const [inputText, setInputText] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  
  // WebSocket States
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const wsClientRef = useRef<ChatWebSocketClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Carrega histórico HTTP inicial
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getMessagesHistory();
        
        // Corrige bugs de mensagens antigas mal formatadas (com campos nulos, etc.)
        const validHistory = history.filter(m => m && m.msg && m.username);
        setAllMessages(validHistory);

        // Deduz conversas privadas existentes no histórico
        const privateUsers = new Set<string>();
        validHistory.forEach(msg => {
          if (msg.chat === 'private') {
            if (msg.username !== currentUser.username) {
              privateUsers.add(msg.username);
            }
            if (msg.username_receive && msg.username_receive !== currentUser.username) {
              privateUsers.add(msg.username_receive);
            }
          }
        });

        // Adiciona à lista de conversas
        const derivedConversations: Conversation[] = [
          { id: 'Global', name: 'Global (Público)', type: 'global', unreadCount: 0 }
        ];
        privateUsers.forEach(username => {
          derivedConversations.push({
            id: username,
            name: username,
            type: 'private',
            unreadCount: 0
          });
        });
        
        setConversations(derivedConversations);
      } catch (err) {
        console.error('Falha ao carregar histórico de mensagens:', err);
      }
    };

    fetchHistory();
  }, [currentUser.username]);

  const activeConversationRef = useRef<Conversation>(activeConversation);
  
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // 2. Efeito para lidar com mudança de sala no WebSocket e atualizar histórico
  useEffect(() => {
    const fetchHistoryUpdate = async () => {
      try {
        const history = await getMessagesHistory();
        const validHistory = history.filter(m => m && m.msg && m.username);
        setAllMessages(validHistory);
      } catch (err) {
        console.error('Erro ao atualizar histórico de mensagens:', err);
      }
    };

    fetchHistoryUpdate();

    if (wsClientRef.current && connectionStatus === 'connected') {
      wsClientRef.current.disconnectRoom();
      
      if (activeConversation.type === 'global') {
        wsClientRef.current.connectRoom('Global');
      } else {
        wsClientRef.current.connectRoom('private');
      }
      
      // Limpa não lidas ao selecionar a conversa
      setConversations(prev =>
        prev.map(c => c.id === activeConversation.id ? { ...c, unreadCount: 0 } : c)
      );
    }
  }, [activeConversation.id, connectionStatus]);

  // 3. Inicializa Conexão WebSocket
  useEffect(() => {
    const handleIncomingMessage = (msg: Message) => {
      if (!msg || !msg.msg || !msg.username) return;

      // Adiciona mensagem ao pool geral
      setAllMessages(prev => [...prev, msg]);

      // Determina a qual conversa a mensagem pertence
      let conversationId = 'Global';
      if (msg.chat === 'private') {
        // Se for privada, a conversa é com o remetente ou destinatário
        conversationId = msg.username === currentUser.username
          ? (msg.username_receive || '')
          : msg.username;
      }

      // Cria a conversa privada dinamicamente na lista se ela não existir
      setConversations(prev => {
        const exists = prev.some(c => c.id === conversationId);
        if (!exists && conversationId) {
          return [
            ...prev,
            {
              id: conversationId,
              name: conversationId,
              type: 'private',
              unreadCount: conversationId === activeConversationRef.current.id ? 0 : 1,
              lastMessage: msg.msg
            }
          ];
        }

        // Se já existe, atualiza as informações e contador de não lidas se não for a conversa ativa
        return prev.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              unreadCount: c.id === activeConversationRef.current.id ? 0 : c.unreadCount + 1,
              lastMessage: msg.msg
            };
          }
          return c;
        });
      });
    };

    const handleStatusChange = (status: 'connecting' | 'connected' | 'disconnected', error?: string) => {
      setConnectionStatus(status);
      setConnectionError(error || null);
      
      // Ao reconectar, garante que entra na sala certa
      if (status === 'connected' && wsClientRef.current) {
        if (activeConversationRef.current.type === 'global') {
          wsClientRef.current.connectRoom('Global');
        } else {
          wsClientRef.current.connectRoom('private');
        }
      }
    };

    const client = new ChatWebSocketClient(
      currentUser.username,
      handleIncomingMessage,
      handleStatusChange
    );
    wsClientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
    };
  }, [currentUser.username]);

  // 4. Filtra e exibe mensagens da conversa ativa
  useEffect(() => {
    if (activeConversation.type === 'global') {
      setVisibleMessages(allMessages.filter(m => m.chat === 'Global' || !m.chat));
    } else {
      // Filtra mensagens privadas entre currentUser e o activeConversation.id
      setVisibleMessages(
        allMessages.filter(
          m =>
            m.chat === 'private' &&
            ((m.username === currentUser.username && m.username_receive === activeConversation.id) ||
              (m.username === activeConversation.id && m.username_receive === currentUser.username))
        )
      );
    }
  }, [allMessages, activeConversation, currentUser.username]);

  // 5. Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages]);

  // 6. Enviar mensagem
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !wsClientRef.current) return;

    const messageText = inputText.trim();
    
    if (activeConversation.type === 'global') {
      // Envia via WS
      wsClientRef.current.sendMessage(messageText);
      
      // Adiciona localmente caso o backend não devolva para si próprio no broadcast (mas no global ele devolve se os sockets forem diferentes. Porém, para garantir UX imediata, podemos deixar o WS tratar ou adicionar localmente. No global do backend, ele não envia de volta para o próprio socket_id. Então precisamos adicionar manualmente ao estado local!)
      const localMsg: Message = {
        msg: messageText,
        username: currentUser.username,
        chat: 'Global',
        date: Date.now() / 1000
      };
      setAllMessages(prev => [...prev, localMsg]);
    } else {
      // Envia mensagem privada via WS
      wsClientRef.current.sendMessage(messageText, activeConversation.id);
      
      // Adiciona localmente (mensagens privadas nunca são devolvidas pelo pubsub para o remetente devido ao filtro username_receive == self.username)
      const localMsg: Message = {
        msg: messageText,
        username: currentUser.username,
        chat: 'private',
        username_receive: activeConversation.id,
        date: Date.now() / 1000
      };
      setAllMessages(prev => [...prev, localMsg]);
    }

    // Atualiza última mensagem na barra lateral
    setConversations(prev =>
      prev.map(c => c.id === activeConversation.id ? { ...c, lastMessage: messageText } : c)
    );

    setInputText('');
  };

  // 7. Selecionar usuário na busca para iniciar chat privado
  const handleSelectUserFromSearch = (user: User) => {
    setShowSearchModal(false);
    
    // Verifica se a conversa já existe
    const exists = conversations.find(c => c.id === user.username);
    if (exists) {
      setActiveConversation(exists);
    } else {
      const newConv: Conversation = {
        id: user.username,
        name: user.username,
        type: 'private',
        unreadCount: 0
      };
      setConversations(prev => [...prev, newConv]);
      setActiveConversation(newConv);
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800">
      {/* Barra de Status da Conexão */}
      {connectionStatus !== 'connected' && (
        <div className={`p-2 flex items-center justify-center gap-2 text-sm text-white font-medium transition-all duration-300 ${
          connectionStatus === 'connecting' ? 'bg-amber-500' : 'bg-red-500'
        }`}>
          <AlertTriangle size={16} className="animate-pulse" />
          {connectionStatus === 'connecting' 
            ? 'Conectando ao servidor em tempo real...' 
            : `Desconectado: ${connectionError || 'Tentando reconectar em instantes...'}`
          }
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white h-full">
          {/* User Info Header */}
          <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-indigo-700 flex items-center justify-center font-bold text-lg uppercase shadow-sm">
                {currentUser.username.slice(0, 2)}
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold truncate">{currentUser.username}</div>
                <div className="text-xs text-indigo-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Online
                </div>
              </div>
            </div>
            
            <button 
              onClick={onLogout}
              title="Sair"
              className="p-1.5 hover:bg-indigo-700 rounded-full transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>

          {/* New Chat Area / Actions */}
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={() => setShowSearchModal(true)}
              className="w-full py-2 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus size={16} />
              Nova Conversa Privada
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-xs font-semibold text-gray-400 px-3 py-1 uppercase">Conversas</div>
            {conversations.map(conv => {
              const isActive = conv.id === activeConversation.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv)}
                  className={`w-full p-3 flex items-center gap-3 rounded-lg text-left transition-all ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-900 border-l-4 border-indigo-600 shadow-sm' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold uppercase ${
                    conv.type === 'global' ? 'bg-indigo-500' : 'bg-gray-400'
                  }`}>
                    {conv.type === 'global' ? '🌍' : conv.name.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-sm truncate block">{conv.name}</span>
                    </div>
                    {conv.lastMessage && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{conv.lastMessage}</p>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Window Container */}
        <div className="flex-1 flex flex-col bg-gray-50 h-full relative">
          {/* Chat Window Header */}
          <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{activeConversation.name}</h2>
              <p className="text-xs text-gray-500">
                {activeConversation.type === 'global' 
                  ? 'Chat aberto com todos os usuários do sistema' 
                  : `Conversa privada com ${activeConversation.name}`
                }
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                activeConversation.type === 'global' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
              }`}>
                {activeConversation.type === 'global' ? 'Público' : 'Privado'}
              </span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {visibleMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <MessageSquare size={48} className="stroke-[1.5]" />
                <p className="text-sm">Nenhuma mensagem nesta conversa.</p>
                <p className="text-xs">Envie uma mensagem abaixo para iniciar!</p>
              </div>
            ) : (
              visibleMessages.map((msg, idx) => {
                const isMe = msg.username === currentUser.username;
                return (
                  <div 
                    key={msg._id || idx} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-lg px-4 py-2.5 shadow-sm text-sm relative group ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                    }`}>
                      {/* Nome do Remetente em Chats Públicos */}
                      {!isMe && activeConversation.type === 'global' && (
                        <div className="text-[11px] font-bold text-indigo-600 mb-0.5">
                          {msg.username}
                        </div>
                      )}
                      
                      <p className="break-words leading-relaxed">{msg.msg}</p>
                      
                      <div className={`text-[10px] text-right mt-1 font-light ${
                        isMe ? 'text-indigo-200' : 'text-gray-400'
                      }`}>
                        {formatTime(msg.date)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <div className="p-4 bg-white border-t border-gray-200 shadow-inner">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Digite sua mensagem no chat ${activeConversation.name}...`}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm text-gray-800"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-md"
              >
                <Send size={16} />
                Enviar
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* User Search Modal */}
      {showSearchModal && (
        <UserSearch
          currentUser={currentUser}
          onSelectUser={handleSelectUserFromSearch}
          onClose={() => setShowSearchModal(false)}
        />
      )}
    </div>
  );
};
