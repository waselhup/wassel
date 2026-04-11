ï»¿import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, Zap, Copy, RotateCcw, ChevronDown, ChevronUp,
  CheckCircle, Loader, History as HistoryIcon, UserCheck, BookOpen,
  FileDown, Megaphone
} from 'lucide-react';
import { useLocation } from 'wouter';

interface AnalysisResult {
  score: number;
  headlineCurrent: string;
  headlineSuggestion: string;
  summaryCurrent: string;
  summarySuggestion: string;
  keywords: string[];
  strengths: string[];
  weaknesses: string[];
  experienceSuggestions: Array<{
    role: string;
    suggestion: string;
  }>;
  scoreBreakdown?: {
    photo: number;
    headline: number;
    summary: number;
    experience: number;
    skills: number;
    education: number;
    connections: number;
    keywords: number;
  };
  actionPlan?: string[];
  industryTips?: string;
}

interface AnalysisHistoryItem {
  id: string;
  profile_url: string;
  score: number;
  created_at: string;
  headline_current: string;
  headline_suggestion: string;
  summary_current: string;
  summary_suggestion: string;
  keywords_suggestions: string[];
  experience_suggestions: Array<{ role: string; suggestion: string }>;
}

type LoadingStep = 'fetching' | 'analyzing' | 'generating' | null;

const LinkedInAnalyzer: React.FC = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { user, profile, refreshProfile } = useAuth();
  const [linkedInInput, setLinkedInInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [_loadingStep, setLoadingStep] = useState<LoadingStep>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedExperience, setExpandedExperience] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [savedToKb, setSavedToKb] = useState(false);

  const TOKENS_REQUIRED = 5;

  // Fetch fresh token balance from Supabase
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', user.id)
          .single();
        if (data) setTokenBalance(data.token_balance ?? 0);
      } catch (err) {
        console.error('[LinkedInAnalyzer] Failed to fetch balance:', err);
      }
    };
    fetchBalance();
  }, [user?.id]);

  // Sync from profile
  useEffect(() => {
    if (profile && tokenBalance === null) {
      setTokenBalance(profile.token_balance ?? 0);
    }
  }, [profile]);

  const displayTokens = tokenBalance !== null ? tokenBalance : 0;
  const hasEnoughTokens = displayTokens >= TOKENS_REQUIRED;

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        const historyData = await trpc.linkedin.history();
        setHistory(historyData as AnalysisHistoryItem[]);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, []);

  // Normalize any LinkedIn input to a full URL
  const normalizeLinkedInUrl = (input: string): string => {
    let url = input.trim();
    if (url.startsWith('/')) url = url.slice(1);
    if (!url.startsWith('http')) url = 'https://' + url;
    url = url.replace(/\/$/, '');
    return url;
  };

  // Validate input - accepts username, partial URL, or full URL
  const validateLinkedInUrl = (input: string): boolean => {
    const trimmed = input.trim();
    if (!trimmed) return false;
    // If it looks like a plain username (no dots, no slashes)
    if (/^[\w-]{2,}$/.test(trimmed)) return true;
    // Otherwise normalize and check
    const normalized = normalizeLinkedInUrl(trimmed);
    return /linkedin\.com\/in\/[\w-]+/i.test(normalized);
  };

  // Auto-fill user's own LinkedIn URL
  const fillMyProfile = () => {
    const url = profile?.linkedin_url;
    if (url) {
      const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
      setLinkedInInput(match ? match[1] : url);
    }
  };

  const handleAnalyze = async () => {
    if (!linkedInInput.trim()) {
      setError(t('linkedInAnalyzer.invalidUrl'));
      return;
    }

    if (!validateLinkedInUrl(linkedInInput)) {
      setError(t('linkedInAnalyzer.invalidUrl'));
      return;
    }

    if (!hasEnoughTokens) {
      setError(t('linkedInAnalyzer.insufficientTokensDesc'));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      setLoadingStep('fetching');
      // If plain username, prepend full LinkedIn URL; otherwise normalize
      const fullUrl = /^[\w-]+$/.test(linkedInInput.trim())
        ? `https://linkedin.com/in/${linkedInInput.trim()}`
        : normalizeLinkedInUrl(linkedInInput);
      const response = await trpc.linkedin.analyze(fullUrl);
      setLoadingStep('analyzing');
      setLoadingStep('generating');

      const analysisData: AnalysisResult = {
        score: response.score,
        headlineCurrent: response.headlineCurrent,
        headlineSuggestion: response.headlineSuggestion,
        summaryCurrent: response.summaryCurrent,
        summarySuggestion: response.summarySuggestion,
        keywords: response.keywords,
        strengths: response.strengths || [],
        weaknesses: response.weaknesses || [],
        experienceSuggestions: response.experienceSuggestions || [],
        scoreBreakdown: response.scoreBreakdown,
        actionPlan: response.actionPlan || [],
        industryTips: response.industryTips || '',
      };

      setAnalysis(analysisData);

      // Refresh token balance
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', user.id)
          .single();
        if (data) setTokenBalance(data.token_balance ?? 0);
      }
      await refreshProfile();
      const updatedHistory = await trpc.linkedin.history();
      setHistory(updatedHistory as AnalysisHistoryItem[]);
    } catch (err: any) {
      console.error('Analysis error:', err);
      const message = err?.message || err?.data?.message || t('linkedInAnalyzer.analysisFailed');
      setError(message);
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  };

  const handleLoadFromHistory = (item: AnalysisHistoryItem) => {
    const match = item.profile_url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    setLinkedInInput(match ? match[1] : item.profile_url);
    setAnalysis({
      score: item.score,
      headlineCurrent: item.headline_current || '',
      headlineSuggestion: item.headline_suggestion || '',
      summaryCurrent: item.summary_current || '',
      summarySuggestion: item.summary_suggestion || '',
      keywords: item.keywords_suggestions || [],
      strengths: [],
      weaknesses: [],
      experienceSuggestions: item.experience_suggestions || [],
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-green-50 border-green-200';
    if (score >= 40) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveToKnowledgeBase = async () => {
    if (!analysis) return;
    try {
      await trpc.knowledge.save({
        type: 'linkedin_analysis',
        title: `LinkedIn Analysis: ${linkedInInput} (Score: ${analysis.score})`,
        content: analysis,
        tags: analysis.keywords.slice(0, 5),
      });
      setSavedToKb(true);
    } catch (err) {
      console.error('Failed to save to KB:', err);
    }
  };


  const handleDownloadPDF = () => {
    window.print();
  };

  const handleCreateCampaign = () => {
    // Navigate to campaign page - the profile data can be used there
    navigate('/campaigns/new');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <DashboardLayout pageTitle={t('linkedInAnalyzer.title')}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-4xl"
      >

        {/* Previous Analyses */}
        {!historyLoading && history.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo flex items-center gap-2">
                  <HistoryIcon className="w-5 h-5" />
                  {t('linkedInAnalyzer.historyLabel')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {history.map((item) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => handleLoadFromHistory(item)}
                      className="p-4 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors border border-[var(--border-subtle)] text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {item.profile_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className={`text-lg font-bold whitespace-nowrap ${getScoreColor(item.score)}`}>
                          {item.score}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Input Section */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="font-cairo">{t('linkedInAnalyzer.title')}</CardTitle>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                {t('linkedInAnalyzer.description')}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {t('linkedInAnalyzer.urlLabel')}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-3 text-[var(--text-secondary)] text-sm">
                      linkedin.com/in/
                    </span>
                    <Input
                      type="text"
                      placeholder="your-profile"
                      value={linkedInInput}
                      onChange={(e) => setLinkedInInput(e.target.value)}
                      disabled={loading}
                      className="pl-32"
                    />
                  </div>
                  {profile?.linkedin_url && (
                    <Button
                      variant="outline"
                      onClick={fillMyProfile}
                      disabled={loading}
                      className="flex items-center gap-2 whitespace-nowrap"
                    >
                      <UserCheck className="w-4 h-4" />
                      {t('linkedInAnalyzer.analyzeMyProfile')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Token info */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-surface)]">
                <Zap className="w-5 h-5 text-[var(--accent-secondary)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {t('linkedInAnalyzer.cost')}
                  </p>
                  <p className={`text-sm ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}>
                    {displayTokens} {t('linkedInAnalyzer.tokensAvailable')}
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              )}

              {/* BIG ANALYZE BUTTON */}
              <Button
                onClick={handleAnalyze}
                disabled={loading || !hasEnoughTokens}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                size="lg"
              >
                {loading ? (
                  <><Loader className="w-5 h-5 animate-spin me-2" /> {t('linkedInAnalyzer.analyzing')}</>
                ) : (
                  <><Zap className="w-5 h-5 me-2" /> {t('linkedInAnalyzer.analyze')}</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-3">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Loader className="w-6 h-6 text-[var(--accent-secondary)] animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)]">
                        {t('linkedInAnalyzer.analyzing')}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">
                        {t('linkedInAnalyzer.stepFetching')}
                      </p>
                      <div className="w-full bg-[var(--border-subtle)] rounded-full h-1 mt-2">
                        <motion.div
                          className="h-1 bg-[var(--accent-secondary)] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 60, ease: 'linear' }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {analysis && !loading && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
              {/* Score Card */}
              <motion.div variants={itemVariants}>
                <Card className={`border-2 ${getScoreBgColor(analysis.score)}`}>
                  <CardContent className="p-8 text-center">
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">
                      {t('linkedInAnalyzer.scoreLabel')}
                    </p>
                    <div className={`text-6xl font-bold ${getScoreColor(analysis.score)} mb-2`}>
                      {analysis.score}
                    </div>
                    <div className="w-full bg-[var(--border-subtle)] rounded-full h-2 mb-4">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          analysis.score >= 70 ? 'bg-green-600' : analysis.score >= 40 ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${analysis.score}%` }}
                      />
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {analysis.score >= 70 && t('linkedInAnalyzer.scoreExcellent')}
                      {analysis.score >= 40 && analysis.score < 70 && t('linkedInAnalyzer.scoreGood')}
                      {analysis.score < 40 && t('linkedInAnalyzer.scoreNeeds')}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Headline Comparison */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-cairo">{t('linkedInAnalyzer.headlineLabel')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                          {t('linkedInAnalyzer.currentLabel')}
                        </p>
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-[var(--text-primary)]">{analysis.headlineCurrent}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                          {t('linkedInAnalyzer.suggestedLabel')}
                        </p>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg relative">
                          <p className="text-sm text-[var(--text-primary)]">{analysis.headlineSuggestion}</p>
                          <button
                            onClick={() => copyToClipboard(analysis.headlineSuggestion, 'headline')}
                            className="absolute top-2 right-2 p-2 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            {copied === 'headline' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[var(--text-secondary)]" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Summary */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-cairo">{t('linkedInAnalyzer.summaryLabel')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">{t('linkedInAnalyzer.currentLabel')}</p>
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-[var(--text-primary)] line-clamp-3">{analysis.summaryCurrent}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">{t('linkedInAnalyzer.suggestedLabel')}</p>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg relative">
                        <p className="text-sm text-[var(--text-primary)]">{analysis.summarySuggestion}</p>
                        <button onClick={() => copyToClipboard(analysis.summarySuggestion, 'summary')} className="absolute top-2 right-2 p-2 hover:bg-green-100 rounded-lg transition-colors">
                          {copied === 'summary' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[var(--text-secondary)]" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Keywords */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.keywordsLabel')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.keywords.map((keyword, idx) => (<Badge key={idx} variant="secondary">{keyword}</Badge>))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Strengths */}
              {analysis.strengths.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.strengthsLabel')}</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-green-900">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Weaknesses */}
              {analysis.weaknesses.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.weaknessesLabel')}</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-yellow-900">{w}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Experience Suggestions */}
              {analysis.experienceSuggestions.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.experienceLabel')}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {analysis.experienceSuggestions.map((exp, idx) => (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedExperience(expandedExperience === idx ? null : idx)}
                            className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-surface)] transition-colors"
                          >
                            <span className="font-medium text-[var(--text-primary)]">{exp.role}</span>
                            {expandedExperience === idx ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                          <AnimatePresence>
                            {expandedExperience === idx && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t bg-[var(--bg-surface)] p-4">
                                <p className="text-sm text-[var(--text-primary)]">{exp.suggestion}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Score Breakdown */}
              {analysis.scoreBreakdown && (
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.scoreBreakdownLabel', 'Score Breakdown')}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(analysis.scoreBreakdown).map(([key, val]) => (
                          <div key={key} className="text-center p-3 rounded-lg bg-[var(--bg-surface)]">
                            <div className="text-lg font-bold text-[var(--accent-secondary)]">{val as number}</div>
                            <div className="text-xs text-[var(--text-secondary)] capitalize">{t('linkedInAnalyzer.breakdown.' + key, key)}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Action Plan */}
              {analysis.actionPlan && analysis.actionPlan.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.actionPlanLabel', 'Action Plan')}</CardTitle></CardHeader>
                    <CardContent>
                      <ol className="space-y-2">
                        {analysis.actionPlan.map((action, i) => (
                          <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-sm text-blue-900">{action}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Industry Tips */}
              {analysis.industryTips && (
                <motion.div variants={itemVariants}>
                  <Card className="border-[var(--accent-secondary)] border-2">
                    <CardContent className="p-6">
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">{analysis.industryTips}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Action Buttons */}
              <motion.div variants={itemVariants} className="flex gap-3 flex-wrap print:hidden">
                <Button
                  onClick={handleCreateCampaign}
                  className="flex-1 min-w-[140px] bg-[#ff6b35] hover:bg-[#e55a2b] text-white"
                >
                  <Megaphone className="w-4 h-4 me-2" />
                  {t('linkedInAnalyzer.createCampaign', 'Create Campaign')}
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  variant="outline"
                  className="flex-1 min-w-[140px]"
                >
                  <FileDown className="w-4 h-4 me-2" />
                  {t('linkedInAnalyzer.downloadPDF', 'Download PDF')}
                </Button>
                <Button
                  onClick={saveToKnowledgeBase}
                  disabled={savedToKb}
                  className="flex-1 min-w-[120px] bg-[#1e3a5f] hover:bg-[#2c5282] text-white"
                >
                  <BookOpen className="w-4 h-4 me-2" />
                  {savedToKb ? t('kb.saved') : t('kb.saveToKb')}
                </Button>
                <Button onClick={() => { setAnalysis(null); setLinkedInInput(''); setSavedToKb(false); }} variant="outline" className="flex-1 min-w-[120px]">
                  <RotateCcw className="w-4 h-4 me-2" />
                  {t('linkedInAnalyzer.analyzeAgain')}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </DashboardLayout>
  );
};

export default LinkedInAnalyzer;

