import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, AlertCircle } from 'lucide-react';

interface Campaign {
  id: string;
  userName: string;
  userEmail: string;
  campaignName: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  recipients: number;
  sent: number;
  opened: number;
  replied: number;
  createdAt: string;
}

const AdminCampaigns: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [campaigns, _setCampaigns] = useState<Campaign[]>([
    {
      id: '1',
      userName: 'Ahmed Al-Rashid',
      userEmail: 'ahmed@example.com',
      campaignName: 'Senior Engineers at TechCo',
      status: 'completed',
      recipients: 50,
      sent: 50,
      opened: 25,
      replied: 8,
      createdAt: '2024-03-15',
    },
    {
      id: '2',
      userName: 'Fatima Al-Zahrani',
      userEmail: 'fatima@example.com',
      campaignName: 'Product Managers - Finance Sector',
      status: 'running',
      recipients: 75,
      sent: 75,
      opened: 32,
      replied: 5,
      createdAt: '2024-03-10',
    },
    {
      id: '3',
      userName: 'Mohammed Al-Otaibi',
      userEmail: 'mohammed@example.com',
      campaignName: 'Data Scientists at AI Startups',
      status: 'draft',
      recipients: 100,
      sent: 0,
      opened: 0,
      replied: 0,
      createdAt: '2024-03-08',
    },
    {
      id: '4',
      userName: 'Noor Al-Dosari',
      userEmail: 'noor@example.com',
      campaignName: 'Sales Directors - Enterprise',
      status: 'completed',
      recipients: 60,
      sent: 60,
      opened: 42,
      replied: 12,
      createdAt: '2024-03-05',
    },
  ]);

  const statusColors = {
    draft: 'bg-gray-500',
    running: 'bg-blue-500',
    completed: 'bg-green-500',
    paused: 'bg-amber-500',
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateMetrics = (campaign: Campaign) => {
    const openRate = campaign.sent > 0 ? ((campaign.opened / campaign.sent) * 100).toFixed(1) : '0';
    const replyRate = campaign.sent > 0 ? ((campaign.replied / campaign.sent) * 100).toFixed(1) : '0';

    return { openRate, replyRate };
  };

  return (
    <AdminLayout pageTitle={t('admin.campaigns')}>
      <div className="space-y-6">
        {/* Search */}
        <Card className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
            <Input
              type="text"
              placeholder={t('admin.searchCampaigns')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Campaigns Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.campaignName')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.user')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.status')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.recipients')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.metrics')}
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-secondary)]">
                    {t('admin.date')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredCampaigns.map((campaign) => {
                  const { openRate, replyRate } = calculateMetrics(campaign);

                  return (
                    <motion.tr
                      key={campaign.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-[var(--text-primary)]">
                          {campaign.campaignName}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {campaign.userName}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {campaign.userEmail}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                            statusColors[campaign.status]
                          }`}
                        >
                          {campaign.status.charAt(0).toUpperCase() +
                            campaign.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-[var(--text-primary)]">
                            {campaign.sent} / {campaign.recipients}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {(
                              (campaign.sent / campaign.recipients) *
                              100
                            ).toFixed(0)}
                            %
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-[var(--text-primary)]">
                            {campaign.opened} {t('admin.opened')} •{' '}
                            {campaign.replied} {t('admin.replied')}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {openRate}% / {replyRate}%
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[var(--text-secondary)]">
                          {campaign.createdAt}
                        </p>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {filteredCampaigns.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
              <p className="text-[var(--text-secondary)]">
                {t('admin.noCampaignsFound')}
              </p>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCampaigns;