import React, { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface ClientSwitcherProps {
  selectedClientId: string | null;
  onClientChange: (clientId: string | null) => void;
}

export default function ClientSwitcher({ selectedClientId, onClientChange }: ClientSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Fetch all clients
  const { data: clients = [] } = trpc.campaigns.getClients.useQuery();

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleSelectClient = (clientId: string | null) => {
    onClientChange(clientId);
    setIsOpen(false);
  };

  const handleAddClient = () => {
    if (newClientName.trim()) {
      // For now, we'll just create a new client ID locally
      // In a real app, this would call a backend mutation
      const newClientId = `client-${Date.now()}`;
      onClientChange(newClientId);
      setNewClientName('');
      setShowNewClient(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" dir="rtl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-gray-300 rounded-lg hover:bg-[var(--bg-base)] transition-colors"
      >
        <span className="text-sm font-medium text-gray-900">
          {selectedClient?.name || 'اختر عميل'}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-600 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-[var(--bg-card)] border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2 max-h-64 overflow-y-auto">
            {/* All Clients Option */}
            <button
              onClick={() => handleSelectClient(null)}
              className={`w-full text-right px-3 py-2 rounded-lg transition-colors ${
                selectedClientId === null
                  ? 'bg-[rgba(139,92,246,0.08)] text-[#8B5CF6]'
                  : 'hover:bg-[var(--bg-base)] text-gray-900'
              }`}
            >
              جميع العملاء
            </button>

            {/* Client List */}
            {clients.length > 0 && (
              <>
                <div className="border-t border-gray-200 my-2" />
                {clients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client.id)}
                    className={`w-full text-right px-3 py-2 rounded-lg transition-colors ${
                      selectedClientId === client.id
                        ? 'bg-[rgba(139,92,246,0.08)] text-[#8B5CF6]'
                        : 'hover:bg-[var(--bg-base)] text-gray-900'
                    }`}
                  >
                    <div className="font-medium">{client.name}</div>
                    <div className="text-xs text-gray-500">#{client.id.slice(0, 8)}</div>
                  </button>
                ))}
              </>
            )}

            {/* Add New Client */}
            <div className="border-t border-gray-200 my-2" />
            {!showNewClient ? (
              <button
                onClick={() => setShowNewClient(true)}
                className="w-full text-right px-3 py-2 rounded-lg hover:bg-[var(--bg-base)] text-gray-900 flex items-center justify-end gap-2"
              >
                <span className="text-sm">إضافة عميل جديد</span>
                <Plus size={16} />
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <input
                  type="text"
                  placeholder="اسم العميل"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddClient();
                    if (e.key === 'Escape') setShowNewClient(false);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  autoFocus
                  dir="rtl"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowNewClient(false)}
                    className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleAddClient}
                    className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    إضافة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
