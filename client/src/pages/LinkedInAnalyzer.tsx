import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc } from '../lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, Zap, Copy, Save, RotateCcw, ChevronDown, ChevronUp,
  CheckCircle, Loader, History as HistoryIcon
} from 'lucide-react';

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
  const { profile, refreshProfile } = useAuth();
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedExperience, setExpandedExperience] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const TOKENS_REQUIRED = 5;  const hasEnoughTokens = (profile?.token_balance || 0) >= TOKENS_REQUIRED;

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

  const validateLinkedInUrl = (url: string): boolean => {
    const pattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w\-]+\/?$/;
    return pattern.test(url);
  };

  const handleAnalyze = async () => {
    if (!linkedInUrl.trim()) {
      setError(t('common.error') as string);
      return;
    }
    if (!validateLinkedInUrl(linkedInUrl)) {
      setError(t('linkedInAnalyzer.invalidUrl'));      return;
    }
    if (!hasEnoughTokens) {
      setError(t('linkedInAnalyzer.insufficientTokensDesc'));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      setLoadingStep('fetching');
      const response = await trpc.linkedin.analyze(linkedInUrl);
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
        experienceSuggestions: response.experienceSuggestions || []      };

      setAnalysis(analysisData);

      await refreshProfile();
      const updatedHistory = await trpc.linkedin.history();
      setHistory(updatedHistory as AnalysisHistoryItem[]);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(t('linkedInAnalyzer.analysisFailed'));
    } finally {
      setLoading(false);
      setLoadingStep(null);
    }
  };

  const handleLoadFromHistory = (item: AnalysisHistoryItem) => {
    setLinkedInUrl(item.profile_url);
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (    <DashboardLayout pageTitle={t('sidebar.linkedin')}>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6 max-w-4xl">
        {/* Previous Analyses Section */}
        {!historyLoading && history.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo flex items-center gap-2">
                  <HistoryIcon className="w-5 h-5" />
                  {t('linkedInAnalyzer.historyLabel')}
                </CardTitle>
                <p className="text-sm text-[var(--text-secondary)] mt-2">
                  {t('linkedInAnalyzer.historyDesc')}
                </p>
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
                            {item.profile_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              <CardTitle className="font-cairo">{t('sidebar.linkedin')}</CardTitle>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                {t('linkedInAnalyzer.description')}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">{t('linkedInAnalyzer.urlLabel')}</label>                <div className="relative">
                  <span className="absolute left-3 top-3 text-[var(--text-secondary)] text-sm">linkedin.com/in/</span>
                  <Input type="text" placeholder="your-profile" value={linkedInUrl} onChange={(e) => setLinkedInUrl(e.target.value)} disabled={loading} className="pl-32" />
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-surface)]">
                <Zap className="w-5 h-5 text-[var(--accent-secondary)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t('linkedInAnalyzer.cost', {count: TOKENS_REQUIRED})}</p>
                  <p className={`text-sm ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}>
                    {profile?.token_balance || 0} {t('linkedInAnalyzer.tokensAvailable')}
                  </p>
                </div>
              </div>

              {!hasEnoughTokens && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">{t('linkedInAnalyzer.insufficientTokens')}</p>
                    <p className="text-sm text-red-800">
                      You need {TOKENS_REQUIRED - (profile?.token_balance || 0)} more tokens. <a href="/app/tokens" className="underline font-medium">Buy tokens</a>
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />                  <p className="text-sm text-red-900">{error}</p>
                </div>
              )}

              <Button onClick={handleAnalyze} disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <><Loader className="w-4 h-4 animate-spin mr-2" /> Analyzing...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" /> Analyze LinkedIn Profile</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-3">
              {['fetching', 'analyzing', 'generating'].map((step, idx) => (
                <motion.div key={step} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.3 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-[var(--bg-surface)]">
                  {loadingStep === step ? (
                    <Loader className="w-5 h-5 text-[var(--accent-secondary)] animate-spin flex-shrink-0" />
                  ) : idx < ['fetching', 'analyzing', 'generating'].indexOf(loadingStep || 'generating') ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--border-subtle)] flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-[var(--text-primary)]">                    {step === 'fetching' && t('linkedInAnalyzer.stepFetching')}
                    {step === 'analyzing' && t('linkedInAnalyzer.stepAnalyzing')}
                    {step === 'generating' && t('linkedInAnalyzer.stepGenerating')}
                  </span>
                </motion.div>
              ))}
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
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">{t('linkedInAnalyzer.scoreLabel')}</p>
                    <div className={`text-6xl font-bold ${getScoreColor(analysis.score)} mb-2`}>{analysis.score}</div>
                    <div className="w-full bg-[var(--border-subtle)] rounded-full h-2 mb-4">
                      <div className={`h-2 rounded-full transition-all duration-500 ${
                        analysis.score >= 70 ? 'bg-green-600' : analysis.score >= 40 ? 'bg-yellow-600' : 'bg-red-600'
                      }`} style={{ width: `${analysis.score}%` }} />
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {analysis.score >= 70 && t('linkedInAnalyzer.scoreExcellent')}
                      {analysis.score >= 40 && analysis.score < 70 && t('linkedInAnalyzer.scoreGood')}
                      {analysis.score < 40 && t('linkedInAnalyzer.scoreNeeds')}
                    </p>                  </CardContent>
                </Card>
              </motion.div>

              {/* Headline Comparison */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.headlineLabel')}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">{t('linkedInAnalyzer.currentLabel')}</p>
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-[var(--text-primary)]">{analysis.headlineCurrent}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">{t('linkedInAnalyzer.suggestedLabel')}</p>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg relative">
                          <p className="text-sm text-[var(--text-primary)]">{analysis.headlineSuggestion}</p>
                          <button onClick={() => copyToClipboard(analysis.headlineSuggestion, 'headline')}
                            className="absolute top-2 right-2 p-2 hover:bg-green-100 rounded-lg transition-colors">
                            {copied === 'headline' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[var(--text-secondary)]" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              {/* Summary Section */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.summaryLabel')}</CardTitle></CardHeader>
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
                        <button onClick={() => copyToClipboard(analysis.summarySuggestion, 'summary')}
                          className="absolute top-2 right-2 p-2 hover:bg-green-100 rounded-lg transition-colors">
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
                  <CardContent>                    <div className="flex flex-wrap gap-2">
                      {analysis.keywords.map((keyword, idx) => (
                        <Badge key={idx} variant="secondary">{keyword}</Badge>
                      ))}
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
                        {analysis.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-green-900">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Weaknesses */}
              {analysis.weaknesses.length > 0 && (
                <motion.div variants={itemVariants}>                  <Card>
                    <CardHeader><CardTitle className="font-cairo">{t('linkedInAnalyzer.weaknessesLabel')}</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {analysis.weaknesses.map((weakness, idx) => (
                          <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-yellow-900">{weakness}</span>
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
                          <button onClick={() => setExpandedExperience(expandedExperience === idx ? null : idx)}
                            className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-surface)] transition-colors">
                            <span className="font-medium text-[var(--text-primary)]">{exp.role}</span>
                            {expandedExperience === idx ? (
                              <ChevronUp className="w-5 h-5 text-[var(--text-secondary)]" />
                            ) : (                              <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
                            )}
                          </button>
                          <AnimatePresence>
                            {expandedExperience === idx && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }} className="border-t bg-[var(--bg-surface)] p-4">
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

              {/* Action Buttons */}
              <motion.div variants={itemVariants} className="flex gap-4 flex-wrap">
                <Button onClick={() => { setAnalysis(null); setLinkedInUrl(''); }} variant="outline" className="flex-1 min-w-[120px]">
                  <RotateCcw className="w-4 h-4 mr-2" /> {t('linkedInAnalyzer.analyzeAgain')}
                </Button>
                <Button onClick={() => {}} className="flex-1 min-w-[120px]" disabled>
                  <Save className="w-4 h-4 mr-2" /> {t('linkedInAnalyzer.saveAnalysis')}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </DashboardLayout>  );
};

export default LinkedInAnalyzer;
