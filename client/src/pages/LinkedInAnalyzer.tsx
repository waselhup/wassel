import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, Zap, Copy, Save, RotateCcw, ChevronDown, ChevronUp,
  CheckCircle, Loader
} from 'lucide-react';

interface AnalysisResult {
  score: number;
  headlineCurrent: string;
  headlineSuggestion: string;
  summaryCurrent: string;
  summarySuggestion: string;
  keywords: string[];
  experienceSuggestions: Array<{
    role: string;
    suggestion: string;
  }>;
}

interface AnalysisHistory {
  id: string;
  profileUrl: string;
  score: number;
  createdAt: string;
}const mockAnalysis: AnalysisResult = {
  score: 72,
  headlineCurrent: "Software Engineer",
  headlineSuggestion: "Senior Software Engineer | React & Node.js Expert | Building Scalable SaaS Solutions",
  summaryCurrent: "I am a software engineer with 5 years of experience.",
  summarySuggestion: "Experienced software engineer specializing in full-stack development with React, Node.js, and cloud technologies. Passionate about building user-centric SaaS products that solve real business problems. Currently seeking opportunities in Saudi Arabia's thriving tech ecosystem, with expertise in modern web architectures and AI integration.",
  keywords: ["React", "Node.js", "TypeScript", "SaaS", "Cloud", "AI", "Agile", "Saudi Arabia"],
  experienceSuggestions: [
    {
      role: "Software Engineer at TechCo",
      suggestion: "Add metrics: 'Improved API response time by 40%' instead of 'Worked on backend'"
    }
  ]
};

type LoadingStep = 'fetching' | 'analyzing' | 'generating' | null;

const LinkedInAnalyzer: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [expandedExperience, setExpandedExperience] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const TOKENS_REQUIRED = 5;
  const hasEnoughTokens = (profile?.token_balance || 0) >= TOKENS_REQUIRED;  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('linkedinAnalysisHistory');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
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
      setError('Please enter a valid LinkedIn URL (e.g., https://linkedin.com/in/your-profile)');
      return;
    }

    if (!hasEnoughTokens) {
      setError(`Insufficient tokens. You need ${TOKENS_REQUIRED} tokens.`);
      return;
    }

    setError(null);
    setLoading(true);

    // Simulate analysis steps
    setLoadingStep('fetching');
    await new Promise(resolve => setTimeout(resolve, 1500));

    setLoadingStep('analyzing');
    await new Promise(resolve => setTimeout(resolve, 1500));

    setLoadingStep('generating');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In production, call the API here
    // const res = await fetch('/api/trpc/linkedin.analyze', { ... });
    // const data = await res.json();
    setAnalysis(mockAnalysis);

    // Add to history
    const newEntry: AnalysisHistory = {
      id: Date.now().toString(),
      profileUrl: linkedInUrl,
      score: mockAnalysis.score,
      createdAt: new Date().toISOString()
    };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('linkedinAnalysisHistory', JSON.stringify(updatedHistory));

    setLoading(false);
    setLoadingStep(null);
  };  const getScoreColor = (score: number) => {
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
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <DashboardLayout pageTitle={t('sidebar.linkedin')}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-4xl"
      >
        {/* Input Section */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="font-cairo">
                {t('sidebar.linkedin')}
              </CardTitle>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Get AI-powered insights to optimize your LinkedIn profile
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  LinkedIn Profile URL
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-[var(--text-secondary)] text-sm">
                    linkedin.com/in/
                  </span>
                  <Input
                    type="text"
                    placeholder="your-profile"
                    value={linkedInUrl}
                    onChange={(e) => setLinkedInUrl(e.target.value)}
                    disabled={loading}
                    className="pl-32"
                  />
                </div>
              </div>              {/* Token info */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-surface)]">
                <Zap className="w-5 h-5 text-[var(--accent-secondary)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Cost: {TOKENS_REQUIRED} tokens
                  </p>
                  <p className={`text-sm ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}>
                    {profile?.token_balance || 0} tokens available
                  </p>
                </div>
              </div>

              {!hasEnoughTokens && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Insufficient tokens</p>
                    <p className="text-sm text-red-800">
                      You need {TOKENS_REQUIRED - (profile?.token_balance || 0)} more tokens. <a href="/app/tokens" className="underline font-medium">Buy tokens</a>
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              )}

              <Button
                onClick={handleAnalyze}
                disabled={loading || !hasEnoughTokens}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <><Loader className="w-4 h-4 animate-spin mr-2" /> Analyzing...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" /> Analyze LinkedIn Profile</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="space-y-3"
            >
              {['fetching', 'analyzing', 'generating'].map((step, idx) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.3 }}
                  className="flex items-center gap-3 p-4 rounded-lg bg-[var(--bg-surface)]"
                >
                  {loadingStep === step ? (
                    <Loader className="w-5 h-5 text-[var(--accent-secondary)] animate-spin flex-shrink-0" />
                  ) : idx < ['fetching', 'analyzing', 'generating'].indexOf(loadingStep || 'generating') ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--border-subtle)] flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {step === 'fetching' && 'Fetching LinkedIn profile...'}
                    {step === 'analyzing' && 'Analyzing with AI...'}
                    {step === 'generating' && 'Generating suggestions...'}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {analysis && !loading && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Score Card */}
              <motion.div variants={itemVariants}>
                <Card className={`border-2 ${getScoreBgColor(analysis.score)}`}>
                  <CardContent className="p-8 text-center">
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">
                      Your LinkedIn Score
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
                      {analysis.score >= 70 && "Excellent! Your profile is well-optimized."}
                      {analysis.score >= 40 && analysis.score < 70 && "Good! There's room for improvement."}
                      {analysis.score < 40 && "Let's improve your profile with these suggestions."}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>              {/* Headline Comparison */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-cairo">Headline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Current */}
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                          Current
                        </p>
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-[var(--text-primary)]">
                            {analysis.headlineCurrent}
                          </p>
                        </div>
                      </div>

                      {/* Suggested */}
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                          Suggested
                        </p>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg relative">
                          <p className="text-sm text-[var(--text-primary)]">
                            {analysis.headlineSuggestion}
                          </p>
                          <button
                            onClick={() => copyToClipboard(analysis.headlineSuggestion, 'headline')}
                            className="absolute top-2 right-2 p-2 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            {copied === 'headline' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                            )}
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
                  <CardHeader>
                    <CardTitle className="font-cairo">Professional Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                        Current
                      </p>
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-[var(--text-primary)] line-clamp-3">
                          {analysis.summaryCurrent}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                        Suggested
                      </p>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg relative">
                        <p className="text-sm text-[var(--text-primary)]">
                          {analysis.summarySuggestion}
                        </p>
                        <button
                          onClick={() => copyToClipboard(analysis.summarySuggestion, 'summary')}
                          className="absolute top-2 right-2 p-2 hover:bg-green-100 rounded-lg transition-colors"
                        >
                          {copied === 'summary' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>              {/* Keywords */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-cairo">Recommended Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.keywords.map((keyword, idx) => (
                        <Badge key={idx} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Experience Suggestions */}
              {analysis.experienceSuggestions.length > 0 && (
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-cairo">Experience Improvements</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {analysis.experienceSuggestions.map((exp, idx) => (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedExperience(expandedExperience === idx ? null : idx)}
                            className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-surface)] transition-colors"
                          >
                            <span className="font-medium text-[var(--text-primary)]">
                              {exp.role}
                            </span>
                            {expandedExperience === idx ? (
                              <ChevronUp className="w-5 h-5 text-[var(--text-secondary)]" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
                            )}
                          </button>
                          <AnimatePresence>
                            {expandedExperience === idx && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t bg-[var(--bg-surface)] p-4"
                              >
                                <p className="text-sm text-[var(--text-primary)]">
                                  {exp.suggestion}
                                </p>
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
                <Button
                  onClick={() => {
                    setAnalysis(null);
                    setLinkedInUrl('');
                  }}
                  variant="outline"
                  className="flex-1 min-w-[120px]"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Analyze Again
                </Button>
                <Button
                  onClick={() => alert('Feature coming soon!')}
                  className="flex-1 min-w-[120px]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Analysis
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>        {/* Analysis History */}
        {history.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo">Analysis History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                      onClick={() => setLinkedInUrl(item.profileUrl)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {item.profileUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`text-lg font-bold ${getScoreColor(item.score)}`}>
                        {item.score}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </DashboardLayout>
  );
};

export default LinkedInAnalyzer;