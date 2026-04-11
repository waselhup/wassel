const fs = require('fs');
const path = require('path');

// Update LinkedInAnalyzer.tsx - add campaign button + PDF download button
const filePath = path.join(__dirname, 'client', 'src', 'pages', 'LinkedInAnalyzer.tsx');
let content = fs.readFileSync(filePath, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

// 1. Add imports for new icons and useLocation
content = content.replace(
  "import {\n  AlertCircle, Zap, Copy, RotateCcw, ChevronDown, ChevronUp,\n  CheckCircle, Loader, History as HistoryIcon, UserCheck, BookOpen\n} from 'lucide-react';",
  "import {\n  AlertCircle, Zap, Copy, RotateCcw, ChevronDown, ChevronUp,\n  CheckCircle, Loader, History as HistoryIcon, UserCheck, BookOpen,\n  FileDown, Megaphone\n} from 'lucide-react';\nimport { useLocation } from 'wouter';"
);

// 2. Add scoreBreakdown, actionPlan, industryTips to AnalysisResult interface
content = content.replace(
  `  experienceSuggestions: Array<{
    role: string;
    suggestion: string;
  }>;
}`,
  `  experienceSuggestions: Array<{
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
}`
);

// 3. Add useLocation hook
content = content.replace(
  "const { t } = useTranslation();",
  "const { t } = useTranslation();\n  const [, navigate] = useLocation();"
);

// 4. Add new fields to analysisData mapping
content = content.replace(
  `        experienceSuggestions: response.experienceSuggestions || []
      };`,
  `        experienceSuggestions: response.experienceSuggestions || [],
        scoreBreakdown: response.scoreBreakdown,
        actionPlan: response.actionPlan || [],
        industryTips: response.industryTips || '',
      };`
);

// 5. Add handleDownloadPDF and handleCreateCampaign functions before containerVariants
const newFunctions = `
  const handleDownloadPDF = () => {
    window.print();
  };

  const handleCreateCampaign = () => {
    // Navigate to campaign page - the profile data can be used there
    navigate('/campaigns/new');
  };

`;

content = content.replace(
  "  const containerVariants = {",
  newFunctions + "  const containerVariants = {"
);

// 6. Replace the Action Buttons section with enhanced version including new buttons
const oldActionButtons = `              {/* Action Buttons */}
              <motion.div variants={itemVariants} className="flex gap-4 flex-wrap">
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
              </motion.div>`;

const newActionButtons = `              {/* Score Breakdown */}
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
              </motion.div>`;

content = content.replace(oldActionButtons, newActionButtons);

fs.writeFileSync(filePath, '\xEF\xBB\xBF' + content, 'utf8');
console.log('Updated LinkedInAnalyzer.tsx with new buttons + score breakdown + action plan');
