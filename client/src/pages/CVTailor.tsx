import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, FileText, Download, Copy, Zap, X, CheckCircle, Loader, Save
} from 'lucide-react';

interface CVVersion {
  fieldName: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    description: string;
  }>;
}

interface ModalState {
  isOpen: boolean;
  selectedIndex: number | null;
}

const CAREER_FIELDS = [
  'Software Engineering',
  'Data Science',
  'Project Management',
  'Marketing',
  'Finance',
  'HR',
  'Design',
  'Consulting',
  'Healthcare',
  'Education',
  'Sales',
  'Operations'
];

const mockCVVersions: CVVersion[] = [
  {
    fieldName: "Software Engineering",
    headline: "Senior Full-Stack Developer | React & Node.js | SaaS Expert",
    summary: "Full-stack developer with 5+ years building scalable SaaS platforms. Expertise in React, Node.js, TypeScript, and cloud technologies. Proven track record delivering high-performance applications serving 10,000+ users.",
    skills: ["React", "Node.js", "TypeScript", "PostgreSQL", "AWS", "Docker", "Kubernetes", "GraphQL"],
    experience: [
      {
        title: "Senior Developer",
        company: "TechCo",
        description: "Led development of enterprise SaaS platform serving 10,000+ users. Improved system performance by 40% through architectural optimization. Mentored junior developers and established coding standards."
      }
    ]
  },
  {
    fieldName: "Data Science",
    headline: "Data Scientist | Machine Learning | Python | Analytics",
    summary: "Data scientist with 5+ years experience building machine learning models and data pipelines. Specialized in predictive analytics, statistical analysis, and data visualization. Delivered insights that drove 25% business growth.",
    skills: ["Python", "SQL", "Machine Learning", "TensorFlow", "Tableau", "Statistics", "Big Data", "AWS"],
    experience: [
      {
        title: "Data Scientist",
        company: "Analytics Inc",
        description: "Developed ML models that increased prediction accuracy by 35%. Built data pipelines processing 1M+ records daily. Presented insights to C-level executives driving strategic decisions."
      }
    ]
  },
  {
    fieldName: "Project Management",
    headline: "PMP Certified Project Manager | Agile & Scrum | Delivery Excellence",
    summary: "Results-driven project manager with 5+ years delivering complex projects on-time and on-budget. Expert in Agile/Scrum methodologies managing cross-functional teams. Track record of 100% on-time delivery across portfolio.",
    skills: ["Agile", "Scrum", "Jira", "Risk Management", "Stakeholder Management", "PMP", "Kanban", "Team Leadership"],
    experience: [
      {
        title: "Project Manager",
        company: "Digital Solutions",
        description: "Managed 15+ concurrent projects with combined budget of $5M. Implemented Agile framework reducing delivery time by 30%. Led 50+ person cross-functional teams across multiple departments."
      }
    ]
  }
];

const CVTailor: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [results, setResults] = useState<CVVersion[]>([]);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, selectedIndex: null });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const TOKENS_REQUIRED = 10;
  const hasEnoughTokens = (profile?.token_balance || 0) >= TOKENS_REQUIRED;
  const maxFieldsSelected = selectedFields.length === 3;  const toggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter(f => f !== field));
    } else if (selectedFields.length < 3) {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const handleGenerateCVs = async () => {
    if (selectedFields.length !== 3) {
      setError('Please select exactly 3 career fields');
      return;
    }

    if (!hasEnoughTokens) {
      setError(`Insufficient tokens. You need ${TOKENS_REQUIRED} tokens.`);
      return;
    }

    setError(null);
    setLoading(true);

    // Simulate generation steps
    for (let i = 0; i < 3; i++) {
      setLoadingStep(`Generating CV for ${selectedFields[i]}...`);
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // In production, call the API here
    // const res = await fetch('/api/trpc/cv.generate', { ... });
    // const data = await res.json();
    setResults(mockCVVersions);

    setLoading(false);
    setLoadingStep(null);
  };

  const downloadPDF = (version: CVVersion) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${version.fieldName} - CV</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          h1 { color: #1a73e8; margin-bottom: 5px; }
          h2 { color: #1a73e8; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #1a73e8; padding-bottom: 5px; }
          .field-badge { display: inline-block; background: #e8f0fe; color: #1a73e8; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 15px; }
          .summary { margin-bottom: 15px; line-height: 1.6; }
          .skills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; }
          .skill { background: #f0f0f0; padding: 6px 12px; border-radius: 4px; font-size: 14px; }
          .experience { margin-bottom: 15px; }
          .job-title { font-weight: bold; }
          .company { color: #666; font-style: italic; }
          .description { margin-top: 5px; line-height: 1.6; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="field-badge">${version.fieldName}</div>
        <h1>${version.headline}</h1>

        <h2>Professional Summary</h2>
        <div class="summary">${version.summary}</div>

        <h2>Skills</h2>
        <div class="skills">
          ${version.skills.map(skill => `<div class="skill">${skill}</div>`).join('')}
        </div>

        <h2>Experience</h2>
        <div class="experience">
          ${version.experience.map(exp => `
            <div style="margin-bottom: 15px;">
              <div class="job-title">${exp.title}</div>
              <div class="company">${exp.company}</div>
              <div class="description">${exp.description}</div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CV-${version.fieldName.replace(/\s+/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
  };  return (
    <DashboardLayout pageTitle={t('sidebar.cv')}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-5xl"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <div>
            <h1 className="text-3xl font-cairo font-bold text-[var(--text-primary)] mb-2">
              Tailor Your CV
            </h1>
            <p className="text-[var(--text-secondary)]">
              Generate tailored CVs for 3 different career fields to maximize your opportunities
            </p>
          </div>
        </motion.div>

        {/* Field Selection */}
        {results.length === 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="font-cairo">
                  Choose 3 Career Fields
                </CardTitle>
                <p className="text-sm text-[var(--text-secondary)] mt-2">
                  Select the career paths you want to tailor your CV for
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CAREER_FIELDS.map((field) => {
                    const isSelected = selectedFields.includes(field);
                    return (
                      <motion.button
                        key={field}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleField(field)}
                        disabled={!isSelected && maxFieldsSelected}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] bg-opacity-10'
                            : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                        } ${
                          !isSelected && maxFieldsSelected ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[var(--text-primary)]">
                            {field}
                          </span>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-[var(--accent-primary)]" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Token Info */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-surface)] mt-6">
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

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleGenerateCVs}
                    disabled={loading || selectedFields.length !== 3 || !hasEnoughTokens}
                    className="flex-1"
                    size="lg"
                  >
                    {loading ? (
                      <><Loader className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                    ) : (
                      <><FileText className="w-4 h-4 mr-2" /> Generate {selectedFields.length} CVs</>
                    )}
                  </Button>
                </div>

                {/* Progress Indicator */}
                <div className="text-sm text-[var(--text-secondary)] text-center">
                  Selected: {selectedFields.length} of 3
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}        {/* Loading State */}
        <AnimatePresence>
          {loading && loadingStep && (
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="space-y-3"
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Loader className="w-6 h-6 text-[var(--accent-secondary)] animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)]">
                        {loadingStep}
                      </p>
                      <div className="w-full bg-[var(--border-subtle)] rounded-full h-1 mt-2">
                        <motion.div
                          className="h-1 bg-[var(--accent-secondary)] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1 }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Grid */}
        <AnimatePresence>
          {results.length > 0 && !loading && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* CV Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {results.map((version, idx) => (
                  <motion.div
                    key={idx}
                    variants={itemVariants}
                  >
                    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <Badge className="w-fit mb-2" variant="outline">
                          {version.fieldName}
                        </Badge>
                        <CardTitle className="font-cairo text-base line-clamp-2">
                          {version.headline}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col space-y-4">
                        {/* Summary Preview */}
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                            Summary
                          </p>
                          <p className="text-sm text-[var(--text-primary)] line-clamp-3">
                            {version.summary}
                          </p>
                        </div>

                        {/* Skills Preview */}
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">
                            Top Skills
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {version.skills.slice(0, 3).map((skill, sidx) => (
                              <Badge key={sidx} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {version.skills.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{version.skills.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={() => setModal({ isOpen: true, selectedIndex: idx })}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            View Full
                          </Button>
                          <Button
                            onClick={() => downloadPDF(version)}
                            size="sm"
                            className="flex-1"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Save All Button */}
              <motion.div variants={itemVariants} className="flex gap-4">
                <Button
                  onClick={() => {
                    setResults([]);
                    setSelectedFields([]);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Generate New Set
                </Button>
                <Button
                  onClick={() => alert('Saving CVs...')}
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save All
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>      {/* CV Detail Modal */}
      <AnimatePresence>
        {modal.isOpen && modal.selectedIndex !== null && results[modal.selectedIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal({ isOpen: false, selectedIndex: null })}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-base)] rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto w-full"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-[var(--bg-base)] border-b border-[var(--border-subtle)] p-6 flex items-start justify-between">
                <div className="flex-1">
                  <Badge className="mb-2" variant="outline">
                    {results[modal.selectedIndex].fieldName}
                  </Badge>
                  <h2 className="text-2xl font-cairo font-bold text-[var(--text-primary)]">
                    {results[modal.selectedIndex].headline}
                  </h2>
                </div>
                <button
                  onClick={() => setModal({ isOpen: false, selectedIndex: null })}
                  className="p-2 hover:bg-[var(--bg-surface)] rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Summary */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase mb-3">
                    Professional Summary
                  </h3>
                  <div className="bg-[var(--bg-surface)] p-4 rounded-lg relative group">
                    <p className="text-[var(--text-primary)] leading-relaxed">
                      {results[modal.selectedIndex].summary}
                    </p>
                    <button
                      onClick={() => copyToClipboard(results[modal.selectedIndex].summary, 'summary')}
                      className="absolute top-2 right-2 p-2 hover:bg-[var(--bg-surface)] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copied === 'summary' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase mb-3">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {results[modal.selectedIndex].skills.map((skill, idx) => (
                      <Badge key={idx} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase mb-3">
                    Experience
                  </h3>
                  <div className="space-y-4">
                    {results[modal.selectedIndex].experience.map((exp, idx) => (
                      <div key={idx} className="bg-[var(--bg-surface)] p-4 rounded-lg">
                        <h4 className="font-semibold text-[var(--text-primary)]">
                          {exp.title}
                        </h4>
                        <p className="text-sm text-[var(--text-secondary)] mb-2">
                          {exp.company}
                        </p>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                          {exp.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-[var(--border-subtle)] pt-6 flex gap-3">
                  <Button
                    onClick={() => downloadPDF(results[modal.selectedIndex])}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button
                    onClick={() => alert('Saving...')}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Version
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default CVTailor;