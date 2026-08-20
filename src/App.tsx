import { useState, useEffect } from 'react';
import { User } from './types';
import { LoginScreen } from './components/LoginScreen';
import { ChatLayout } from './components/ChatLayout';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Recupera sessão ativa no sessionStorage ao abrir o app
  useEffect(() => {
    const savedUser = sessionStorage.getItem('chat_session_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Falha ao processar sessão salva:', e);
        sessionStorage.removeItem('chat_session_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('chat_session_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('chat_session_user');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-500 text-sm gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        Carregando...
      </div>
    );
  }

  return (
    <>
      {currentUser ? (
        <ChatLayout currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

export default App;
