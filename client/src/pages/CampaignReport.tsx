import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRoute } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mail, Eye, MessageSquare, AlertTriangle, Download, ExternalLink,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_replied: number;
  total_bounced?: number;
}

interface Recipient {
  id: string;
  email: string;
  full_name: string;
  company: string;
  job_title: string;
  status: 'sent' | 'opened' | 'replied' | 'bounced';
  sent_at?: string;
}

type FilterStatus = 'all' | 'sent' | 'opened' | 'replied' | 'bounced';

const mockRecipients: Recipient[] = [
  {
    id: '1',
    email: 'ahmed.r@techco.sa',
    full_name: 'Ahmed Al-Rashid',
    company: 'TechCo Saudi',
    job_title: 'HR Director',
    status: 'opened',
    sent_at: '2026-04-08',
  },
  {
    id: '2',
    email: 'sarah.h@innovate.sa',
    full_name: 'Sarah Hassan',
    company: 'Innovate Labs',
    job_title: 'Talent Acquisition Manager',
    status: 'replied',
    sent_at: '2026-04-08',
  },
  {
    id: '3',
    email: 'fahad@megacorp.sa',
    full_name: 'Fahad Al-Dosari',
    company: 'MegaCorp',
    job_title: 'Hiring Manager',
    status: 'sent',
    sent_at: '2026-04-08',
  },
  {
    id: '4',
    email: 'noura@startup.sa',
    full_name: 'Noura Al-Salem',
    company: 'Saudi Startup Hub',
    job_title: 'People Operations Lead',
    status: 'opened',
    sent_at: '2026-04-08',
  },
  {
    id: '5',
    email: 'khalid@enterprise.sa',
    full_name: 'Khalid Ibrahim',
    company: 'Enterprise Solutions',
    job_title: 'VP of Engineering',
    status: 'bounced',
    sent_at: '2026-04-08',
  },
  {
    id: '6',
    email: 'fatima@tech.sa',
    full_name: 'Fatima Al-Malki',
    company: 'Tech Pioneers',
    job_title: 'HR Manager',
    status: 'opened',
    sent_at: '2026-04-08',
  },
  {
    id: '7',
    email: 'omar@solutions.sa',
    full_name: 'Omar Al-Qadhi',
    company: 'Solutions Group',
    job_title: 'Recruitment Lead',
    status: 'sent',
    sent_at: '2026-04-08',
  },
  {
    id: '8',
    email: 'amina@ventures.sa',
    full_name: 'Amina Al-Sudairi',
    company: 'Ventures Inc',
    job_title: 'Talent Director',
    status: 'replied',
    sent_at: '2026-04-08',
  },
  {
    id: '9',
    email: 'hassan@corporate.sa',
    full_name: 'Hassan Al-Shehri',
    company: 'Corporate Hub',
    job_title: 'HR Lead',
    status: 'sent',
    sent_at: '2026-04-08',
  },
  {
    id: '10',
    email: 'leila@growth.sa',
    full_name: 'Leila Al-Harbi',
    company: 'Growth Labs',
    job_title: 'People Manager',
    status: 'opened',
    sent_at: '2026-04-08',
  },
];

const CampaignReport: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, params] = useRoute('/app/campaigns/:id');

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [filteredRecipients, setFilteredRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [exporting, setExporting] = useState(false);

  const campaignId = params?.id;

  useEffect(() => {
    if (user && campaignId) {
      fetchCampaign();
      fetchRecipients();
    }
  }, [user, campaignId]);

  useEffect(() => {
    filterRecipients(activeFilter, searchTerm);
  }, [recipients, activeFilter, searchTerm]);

  const fetchCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', user?.id)
        .single();

      if (!error && data) {
        setCampaign(data);
      }
    } catch (err) {
      console.error('Error fetching campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const { data, error } = await supabase
        .from('email_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false });

      if (!error && data) {
        setRecipients(data);
      } else {
        // Use mock data for demo
        setRecipients(mockRecipients);
      }
    } catch (err) {
      console.error('Error fetching recipients:', err);
      setRecipients(mockRecipients);
    }
  };

  const filterRecipients = (status: FilterStatus, search: string) => {
    let filtered = recipients;    if (status !== 'all') {
      filtered = filtered.filter(r => r.status === status);
    }

    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.full_name.toLowerCase().includes(lowerSearch) ||
          r.company.toLowerCase().includes(lowerSearch)
      );
    }

    setFilteredRecipients(filtered);
    setActiveFilter(status);
  };

  const exportToCSV = () => {
    setExporting(true);

    const headers = [
      t('campaigns.wizard.recipient'),
      t('common.email'),
      t('campaigns.wizard.company'),
      t('campaigns.wizard.jobTitle'),
      t('campaigns.report.allRecipients'),
      'Sent Date',
    ];

    const rows = filteredRecipients.map(r => [
      r.full_name,
      r.email,
      r.company,
      r.job_title,
      r.status,
      r.sent_at || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row =>
        row.map(cell => `"${cell}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign?.name || 'campaign'}-recipients.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    setExporting(false);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'sent':
        return 'secondary';
      case 'opened':
        return 'success';
      case 'replied':
        return 'default';
      case 'bounced':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Mail className="w-4 h-4" />;
      case 'opened':
        return <Eye className="w-4 h-4" />;
      case 'replied':
        return <MessageSquare className="w-4 h-4" />;
      case 'bounced':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <DashboardLayout pageTitle={t('campaigns.report.title')}>
        <div className="text-center py-12">
          <p className="text-[var(--text-secondary)]">{t('common.loading')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout pageTitle={t('campaigns.report.title')}>
        <div className="text-center py-12">
          <p className="text-[var(--text-secondary)]">{t('common.error')}</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalOpened = recipients.filter(r => r.status === 'opened').length;
  const totalReplied = recipients.filter(r => r.status === 'replied').length;
  const openRate = campaign.total_sent > 0 ? ((totalOpened / campaign.total_sent) * 100).toFixed(1) : 0;
  const replyRate = campaign.total_sent > 0 ? ((totalReplied / campaign.total_sent) * 100).toFixed(1) : 0;
  const bounceRate =
    campaign.total_sent > 0
      ? (((campaign.total_bounced || 0) / campaign.total_sent) * 100).toFixed(1)
      : 0;  return (
    <DashboardLayout pageTitle={campaign.name}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-cairo font-bold text-[var(--text-primary)]">
              {campaign.name}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <Badge>{t(`campaigns.status${campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}`)}</Badge>
              <p className="text-sm text-[var(--text-secondary)]">
                {t('campaigns.report.created')}: {new Date(campaign.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t('campaigns.report.totalSent'),
              value: campaign.total_sent,
              icon: Mail,
              color: 'text-blue-600',
            },
            {
              label: t('campaigns.report.totalOpened'),
              value: `${totalOpened} (${openRate}%)`,
              icon: Eye,
              color: 'text-green-600',
            },
            {
              label: t('campaigns.report.totalReplied'),
              value: `${totalReplied} (${replyRate}%)`,
              icon: MessageSquare,
              color: 'text-purple-600',
            },
            {
              label: t('campaigns.report.totalBounced'),
              value: `${campaign.total_bounced || 0} (${bounceRate}%)`,
              icon: AlertTriangle,
              color: 'text-red-600',
            },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] mb-1">
                        {stat.label}
                      </p>
                      <p className="text-3xl font-bold text-[var(--text-primary)]">
                        {stat.value}
                      </p>
                    </div>
                    <Icon className={`w-8 h-8 ${stat.color} opacity-50`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Chart */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="font-cairo">{t('campaigns.report.stats')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  label: t('campaigns.report.totalSent'),
                  value: campaign.total_sent,
                  total: campaign.total_recipients,
                  color: 'bg-blue-500',
                },
                {
                  label: t('campaigns.report.totalOpened'),
                  value: totalOpened,
                  total: campaign.total_sent,
                  color: 'bg-green-500',
                },
                {
                  label: t('campaigns.report.totalReplied'),
                  value: totalReplied,
                  total: campaign.total_sent,
                  color: 'bg-purple-500',
                },
                {
                  label: t('campaigns.report.totalBounced'),
                  value: campaign.total_bounced || 0,
                  total: campaign.total_sent,
                  color: 'bg-red-500',
                },
              ].map((stat, idx) => {
                const percentage = stat.total > 0 ? (stat.value / stat.total) * 100 : 0;
                return (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-medium text-[var(--text-primary)]">
                        {stat.label}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {stat.value} / {stat.total} ({percentage.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="w-full bg-[var(--bg-surface)] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${stat.color} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recipients Table */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-cairo">{t('campaigns.report.recipients')}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={exporting}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {exporting ? t('campaigns.report.exportingCSV') : t('campaigns.report.exportCSV')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 flex-wrap">
                  {['all', 'sent', 'opened', 'replied', 'bounced'].map(status => (
                    <button
                      key={status}
                      onClick={() => filterRecipients(status as FilterStatus, searchTerm)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        activeFilter === status
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      {t(`campaigns.report.filter${status.charAt(0).toUpperCase() + status.slice(1)}`)}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder={t('campaigns.report.search')}
                  value={searchTerm}
                  onChange={e => filterRecipients(activeFilter, e.target.value)}
                  className="px-4 py-2 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-base)] text-[var(--text-primary)]"
                />
              </div>

              {/* Recipients List */}
              {filteredRecipients.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[var(--text-secondary)]">
                    {t('campaigns.report.noRecipients')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)]">
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('campaigns.wizard.recipient')}
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('common.email')}
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('campaigns.wizard.company')}
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('campaigns.wizard.jobTitle')}
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('campaigns.status')}
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-[var(--text-secondary)]">
                          {t('campaigns.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecipients.map((r, idx) => (
                        <tr
                          key={r.id}
                          className={`border-b border-[var(--border-subtle)] ${
                            idx % 2 === 0 ? 'bg-[var(--bg-surface)]' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                            {r.full_name}
                          </td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">
                            {r.email}
                          </td>
                          <td className="py-3 px-4">{r.company}</td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">
                            {r.job_title}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusBadgeVariant(r.status)} className="flex items-center gap-1 w-fit">
                              {getStatusIcon(r.status)}
                              {t(`campaigns.status${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                                  `${r.full_name} ${r.company}`
                                )}`;
                                window.open(url, '_blank');
                              }}
                              className="flex items-center gap-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                              {t('campaigns.report.addLinkedIn')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
};

export default CampaignReport;