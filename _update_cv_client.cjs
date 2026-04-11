const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'pages', 'CVTailor.tsx');
let content = fs.readFileSync(filePath, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

// 1. Add Upload icon import
content = content.replace(
  'import { FileText, Download, Sparkles, Loader2, CheckCircle2, Briefcase, Target, Palette } from "lucide-react";',
  'import { FileText, Download, Sparkles, Loader2, CheckCircle2, Briefcase, Target, Palette, Upload } from "lucide-react";'
);

// 2. Add ref import
content = content.replace(
  'import { useState } from "react";',
  'import { useState, useRef } from "react";'
);

// 3. Add uploading state and file ref after the form state
content = content.replace(
  '  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));',
  `  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setError(null);
    try {
      // Read file as base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1] || result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await trpc.cv.parseUpload(base64, file.name);
      
      // Auto-fill form with extracted data
      setForm(prev => ({
        ...prev,
        name: result.name || prev.name,
        email: result.email || prev.email,
        phone: result.phone || prev.phone,
        currentRole: result.currentRole || prev.currentRole,
        experience: result.experience || prev.experience,
        skills: result.skills || prev.skills,
        education: result.education || prev.education,
        achievements: result.achievements || prev.achievements,
        languages: result.languages || prev.languages,
      }));
    } catch (e: any) {
      setError(e?.message || t("cv.uploadError", "Failed to upload file"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }`
);

// 4. Add file upload section after the title/subtitle
const uploadSection = `
        {/* File Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-6"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-[#1a1a2e] flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                {t("cv.uploadCV", "Upload My CV")}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{t("cv.acceptedFormats", "Accepted: PDF, DOCX, TXT")}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.doc"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {uploading ? t("cv.uploading", "Uploading...") : t("cv.uploadCV", "Upload My CV")}
            </button>
          </div>
        </motion.div>
`;

// Insert after subtitle paragraph
content = content.replace(
  '          <p className="text-gray-500 mt-2">{t("cv.subtitle"',
  '          <p className="text-gray-500 mt-2">{t("cv.subtitle"'
);

// Find the right spot - after the title section, before the form section
content = content.replace(
  '        <motion.div\n          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}\n          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-8"',
  uploadSection + '\n        <motion.div\n          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}\n          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-8"'
);

// 5. Add PDF download via print to the existing download button
content = content.replace(
  `              <button className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-2 transition">
                <Download className="w-5 h-5" /> PDF
              </button>`,
  `              <button onClick={() => window.print()} className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-2 transition">
                <Download className="w-5 h-5" /> {t("cv.downloadPDF", "Download PDF")}
              </button>`
);

fs.writeFileSync(filePath, '\xEF\xBB\xBF' + content, 'utf8');
console.log('Updated CVTailor.tsx with file upload + PDF download');
