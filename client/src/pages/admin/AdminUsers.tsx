import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, MoreVertical, Lock, Unlock, CheckCircle, AlertCircle,
  Plus, X
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  plan: 'free' | 'starter' | 'pro' | 'elite';
  token_balance: number;
  created_at: string;
  is_banned: boolean;
  verified: boolean;
}

const AdminUsers: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('all');
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      email: 'ahmed@example.com',
      full_name: 'Ahmed Al-Rashid',
      plan: 'pro',
      token_balance: 500,
      created_at: '2024-03-15',
      is_banned: false,
      verified: true,
    },
    {
      id: '2',
      email: 'fatima@example.com',
      full_name: 'Fatima Al-Zahrani',
      plan: 'starter',
      token_balance: 100,
      created_at: '2024-03-10',
      is_banned: false,
      verified: true,
    },
    {
      id: '3',
      email: 'mohammed@example.com',
      full_name: 'Mohammed Al-Otaibi',
      plan: 'free',
      token_balance: 0,
      created_at: '2024-03-08',
      is_banned: true,
      verified: false,
    },
    {
      id: '4',
      email: 'noor@example.com',
      full_name: 'Noor Al-Dosari',
      plan: 'elite',
      token_balance: 2000,
      created_at: '2024-03-05',
      is_banned: false,
      verified: true,
    },
    {
      id: '5',
      email: 'layla@example.com',
      full_name: 'Layla Al-Kharji',
      plan: 'starter',
      token_balance: 250,
      created_at: '2024-03-01',
      is_banned: false,
      verified: true,
    },
  ]);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenReason, setTokenReason] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const planColors = {
    free: 'bg-gray-500',
    starter: 'bg-blue-500',
    pro: 'bg-purple-500',
    elite: 'bg-amber-500',
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPlan = selectedPlan === 'all' || user.plan === selectedPlan;

    if (selectedPlan === 'banned') return user.is_banned && matchesSearch;
    if (selectedPlan === 'all') return matchesSearch && !user.is_banned;

    return matchesSearch && matchesPlan;
  });

  const handleAddTokens = () => {
    if (!selectedUser || !tokenAmount || !tokenReason) return;

    setUsers(
      users.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              token_balance: u.token_balance + parseInt(tokenAmount),
            }
          : u
      )
    );

    setShowTokenModal(false);
    setTokenAmount('');
    setTokenReason('');
    setSelectedUser(null);
  };

  const handleToggleBan = (user: User) => {
    setUsers(
      users.map((u) =>
        u.id === user.id ? { ...u, is_banned: !u.is_banned } : u
      )
    );
  };

  const handleToggleVerify = (user: User) => {
    setUsers(
      users.map((u) =>
        u.id === user.id ? { ...u, verified: !u.verified } : u
      )
    );
  };

  return (
    <AdminLayout pageTitle={t('admin.users')}>
      <div className="space-y-6">
        {/* Search and Filter */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
              <Input
                type="text"
                placeholder={t('admin.searchUsers')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {['all', 'free', 'starter', 'pro', 'elite', 'banned'].map(
                (plan) => (
                  <button
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedPlan === plan
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]'
                    }`}
                  >
                    {t(`admin.filter${plan.charAt(0).toUpperCase() + plan.slice(1)}`)}
                  </button>
                )
              )}
            </div>
          </div>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.name')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.email')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.plan')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.tokens')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.status')}
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredUsers.map((user) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-[var(--bg-surface)] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-[var(--text-primary)]">
                        {user.full_name}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-[var(--text-secondary)]">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                          planColors[user.plan]
                        }`}
                      >
                        {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {user.token_balance}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.verified && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-[var(--text-secondary)]">
                              {t('admin.verified')}
                            </span>
                          </div>
                        )}
                        {user.is_banned && (
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-red-500/20 text-red-600">
                            {t('admin.banned')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === user.id ? null : user.id
                            )
                          }
                          className="p-2 hover:bg-[var(--bg-surface)] rounded-lg"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>

                        {openMenuId === user.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute right-0 mt-2 w-48 bg-[var(--bg-base)] rounded-lg border border-[var(--border-subtle)] shadow-lg z-10"
                          >
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowTokenModal(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors text-left border-b border-[var(--border-subtle)]"
                            >
                              <Plus className="w-4 h-4" />
                              <span className="text-sm">
                                {t('admin.addTokens')}
                              </span>
                            </button>

                            <button
                              onClick={() => {
                                handleToggleBan(user);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors text-left border-b border-[var(--border-subtle)]"
                            >
                              {user.is_banned ? (
                                <>
                                  <Unlock className="w-4 h-4" />
                                  <span className="text-sm">
                                    {t('admin.unban')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-4 h-4" />
                                  <span className="text-sm">
                                    {t('admin.ban')}
                                  </span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                handleToggleVerify(user);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors text-left"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-sm">
                                {user.verified
                                  ? t('admin.unverify')
                                  : t('admin.verify')}
                              </span>
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {filteredUsers.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
              <p className="text-[var(--text-secondary)]">
                {t('admin.noUsersFound')}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Add Tokens Modal */}
      {showTokenModal && selectedUser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-[var(--bg-base)] rounded-lg p-6 max-w-md w-full mx-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {t('admin.addTokens')}
              </h3>
              <button
                onClick={() => {
                  setShowTokenModal(false);
                  setSelectedUser(null);
                }}
                className="p-1 hover:bg-[var(--bg-surface)] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {t('admin.addTokensDesc', { name: selectedUser.full_name })}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('admin.tokenAmount')}
                </label>
                <Input
                  type="number"
                  min="1"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  placeholder="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('admin.reason')}
                </label>
                <Input
                  type="text"
                  value={tokenReason}
                  onChange={(e) => setTokenReason(e.target.value)}
                  placeholder={t('admin.reasonPlaceholder')}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => {
                    setShowTokenModal(false);
                    setSelectedUser(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleAddTokens}
                  className="flex-1"
                >
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;