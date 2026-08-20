import React, { useEffect, useState } from 'react';
import { getUsers } from '../services/api';
import { User } from '../types';
import { Search, X, MessageSquare } from 'lucide-react';

interface UserSearchProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

export const UserSearch: React.FC<UserSearchProps> = ({ currentUser, onSelectUser, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await getUsers();
        // Filtra para remover o próprio usuário atual
        const filtered = allUsers.filter(u => u.username !== currentUser.username);
        setUsers(filtered);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        setError('Não foi possível carregar a lista de usuários.');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [currentUser]);

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-semibold text-gray-800">Iniciar Conversa Privada</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome de usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Carregando usuários...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500 text-sm">{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {searchTerm ? 'Nenhum usuário encontrado.' : 'Nenhum outro usuário cadastrado no momento.'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map(user => (
                <button
                  key={user.id || user._id || user.username}
                  onClick={() => onSelectUser(user)}
                  className="w-full p-3 flex items-center justify-between rounded-lg hover:bg-indigo-50 text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase">
                      {user.username.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{user.username}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${user.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {user.online ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </div>
                  <MessageSquare size={18} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
