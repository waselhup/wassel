import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Eye, MessageSquare, AlertTriangle } from 'lucide-react';

interface Campaign {
  id: string;
  user_id: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_replied: number;
}

type FilterStatus = 'all' | 'draft' | 'running' | 'completed' | 'paused';

const CampaignList: React.FC = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    filterCampaigns(activeFilter);
  }, [campaigns, activeFilter]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCampaigns(data);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterCampaigns = (status: FilterStatus) => {
    if (status === 'all') {
      setFilteredCampaigns(campaigns);
    } else {
      setFilteredCampaigns(campaigns.filter(c => c.status === status));
    }
    setActiveFilter(status);
  };  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'running':
        return 'success';
      case 'completed':
        return 'default';
      case 'paused':
        return 'warning';
      default:
        return 'default';
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

  const filters: { label: string; value: FilterStatus }[] = [
    { label: t('campaigns.filterAll'), value: 'all' },
    { label: t('campaigns.filterDraft'), value: 'draft' },
    { label: t('campaigns.filterRunning'), value: 'running' },
    { label: t('campaigns.filterCompleted'), value: 'completed' },
    { label: t('campaigns.filterPaused'), value: 'paused' },
  ];

  return (
    <DashboardLayout pageTitle={t('campaigns.title')}>
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
              {t('campaigns.title')}
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">
              {t('campaigns.subtitle')}
            </p>
          </div>
          <Button
            onClick={() => navigate('/app/campaigns/new')}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('campaigns.newCampaign')}
          </Button>
        </motion.div>

        {/* Filters */}
        <motion.div variants={itemVariants} className="flex gap-2 flex-wrap">
          {filters.map(filter => (
            <button
              key={filter.value}
              onClick={() => filterCampaigns(filter.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeFilter === filter.value
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        {loading ? (
          <motion.div variants={itemVariants} className="text-center py-12">
            <p className="text-[var(--text-secondary)]">{t('common.loading')}</p>
          </motion.div>
        ) : filteredCampaigns.length === 0 ? (
          <motion.div variants={itemVariants}>
            <Card className="text-center py-12">
              <Mail className="w-16 h-16 text-[var(--text-secondary)] opacity-50 mx-auto mb-4" />
              <h3 className="text-lg font-cairo font-semibold text-[var(--text-primary)] mb-2">
                {t('campaigns.noCampaigns')}
              </h3>
              <p className="text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                {t('campaigns.noCampaignsDesc')}
              </p>
              <Button onClick={() => navigate('/app/campaigns/new')}>
                {t('campaigns.newCampaign')}
              </Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants} className="grid gap-4">
            {filteredCampaigns.map((campaign, idx) => (
              <Card
                key={campaign.id}
                className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
              >
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
                    {/* Campaign Info */}
                    <div className="lg:col-span-2">
                      <h3 className="font-cairo font-semibold text-[var(--text-primary)] text-lg mb-2">
                        {campaign.name}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                      <div className="mt-2">
                        <Badge variant={getStatusBadgeVariant(campaign.status)}>
                          {t(`campaigns.status${campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}`)}
                        </Badge>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-[var(--accent-primary)]">
                          {campaign.total_recipients}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {t('campaigns.recipients')}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-[var(--accent-primary)]">
                          {campaign.total_sent}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {t('campaigns.sent')}
                        </p>
                      </div>
                    </div>

                    {/* More Stats */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-lg font-bold text-[var(--text-primary)]">
                            {campaign.total_opened}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {t('campaigns.opened')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-lg font-bold text-[var(--text-primary)]">
                            {campaign.total_replied}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {t('campaigns.replied')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/campaigns/${campaign.id}`);
                        }}
                      >
                        {t('campaigns.view')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </motion.div>
    </DashboardLayout>
  );
};

export default CampaignList;