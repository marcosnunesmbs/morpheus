import { useState, useRef } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Wand2, RefreshCw, Eye, ToggleLeft, ToggleRight, Tag, User, FolderOpen, Upload, AlertCircle, CheckCircle, X } from 'lucide-react';
import { skillsService, type Skill, type SkillDetailResponse } from '../services/skills';
import { Dialog, DialogHeader, DialogTitle } from '../components/Dialog'; // used by Upload modal

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

function SkillCard({
  skill,
  onToggle,
  onView,
}: {
  skill: Skill;
  onToggle: () => void;
  onView: () => void;
}) {
  return (
    <motion.div
      variants={item}
      className={`rounded-lg border flex flex-col transition-all ${
        skill.enabled
          ? 'border-azure-primary/50 dark:border-matrix-primary bg-white dark:bg-black'
          : 'border-azure-border dark:border-matrix-primary/30 bg-azure-surface/50 dark:bg-black'
      }`}
    >
      {/* Body */}
      <div className="p-4 flex items-start gap-3 flex-1">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          skill.enabled
            ? 'bg-azure-primary/10 dark:bg-matrix-highlight/10'
            : 'bg-azure-surface dark:bg-zinc-900'
        }`}>
          <Wand2 className={`w-4 h-4 ${
            skill.enabled
              ? 'text-azure-primary dark:text-matrix-highlight'
              : 'text-azure-text-secondary dark:text-matrix-tertiary'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-semibold truncate ${
              skill.enabled
                ? 'text-azure-text dark:text-matrix-highlight'
                : 'text-azure-text-secondary dark:text-matrix-secondary'
            }`}>
              {skill.name}
            </h3>
            {skill.version && (
              <span className="text-[10px] font-mono text-azure-text-secondary dark:text-matrix-tertiary bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/40 rounded px-1.5 py-0.5 shrink-0">
                v{skill.version}
              </span>
            )}
            {!skill.enabled && (
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 shrink-0">
                disabled
              </span>
            )}
          </div>
          <p className={`text-sm mt-1.5 line-clamp-2 leading-relaxed ${
            skill.enabled
              ? 'text-azure-text-secondary dark:text-matrix-secondary'
              : 'text-azure-text-secondary/70 dark:text-matrix-tertiary'
          }`}>
            {skill.description}
          </p>

          {skill.tags && skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {skill.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border border-azure-primary/20 dark:border-matrix-primary/40 bg-azure-primary/5 dark:bg-matrix-primary/10 text-azure-primary dark:text-matrix-secondary"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-azure-border dark:border-matrix-primary/30 flex items-center justify-between gap-2">
        {skill.author ? (
          <div className="flex items-center gap-1.5 text-xs text-azure-text-secondary dark:text-matrix-tertiary min-w-0">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">{skill.author}</span>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onView}
            className="p-1.5 rounded border border-azure-border dark:border-matrix-primary/50 text-azure-text-secondary dark:text-matrix-tertiary hover:text-azure-primary dark:hover:text-matrix-highlight hover:border-azure-primary dark:hover:border-matrix-highlight transition-colors"
            title="View details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded border transition-colors ${
              skill.enabled
                ? 'border-emerald-300 dark:border-emerald-700/60 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                : 'border-azure-border dark:border-matrix-primary/40 text-zinc-400 dark:text-zinc-600 hover:text-azure-text dark:hover:text-matrix-secondary hover:border-azure-border dark:hover:border-matrix-primary'
            }`}
            title={skill.enabled ? 'Disable skill' : 'Enable skill'}
          >
            {skill.enabled ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SkillDetailModal({
  skill,
  open,
  onOpenChange,
}: {
  skill: SkillDetailResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open || !skill) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-white dark:bg-black border border-azure-border dark:border-matrix-primary rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-azure-border dark:border-matrix-primary shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-azure-primary/10 dark:bg-matrix-highlight/10 flex items-center justify-center shrink-0">
              <Wand2 className="w-4 h-4 text-azure-primary dark:text-matrix-highlight" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-azure-text dark:text-matrix-highlight truncate">
                  {skill.name}
                </h2>
                {skill.version && (
                  <span className="text-[10px] font-mono text-azure-text-secondary dark:text-matrix-tertiary bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/40 rounded px-1.5 py-0.5 shrink-0">
                    v{skill.version}
                  </span>
                )}
              </div>
              {skill.author && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-azure-text-secondary dark:text-matrix-tertiary">
                  <User className="w-3 h-3 shrink-0" />
                  {skill.author}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded text-azure-text-secondary dark:text-matrix-tertiary hover:text-azure-text dark:hover:text-matrix-highlight hover:bg-azure-surface dark:hover:bg-zinc-900 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Description */}
          {skill.description && (
            <p className="text-sm text-azure-text-secondary dark:text-matrix-secondary leading-relaxed">
              {skill.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 text-xs text-azure-text-secondary dark:text-matrix-tertiary">
              <FolderOpen className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="break-all font-mono text-azure-text dark:text-matrix-secondary bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/40 rounded px-2 py-0.5">
                {skill.path}
              </span>
            </div>
          </div>

          {/* Tags */}
          {skill.tags && skill.tags.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border border-azure-primary/20 dark:border-matrix-primary/40 bg-azure-primary/5 dark:bg-matrix-primary/10 text-azure-primary dark:text-matrix-secondary"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Examples */}
          {skill.examples && skill.examples.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">Examples</p>
              <ul className="space-y-1.5">
                {skill.examples.map((example, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-azure-text-secondary dark:text-matrix-secondary bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/30 rounded px-3 py-2"
                  >
                    <span className="text-azure-text-secondary dark:text-matrix-tertiary font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                    {example}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* SKILL.md content */}
          {skill.content && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-azure-text-secondary dark:text-matrix-tertiary mb-2">SKILL.md</p>
              <pre className="rounded-lg bg-azure-surface dark:bg-zinc-900 border border-azure-border dark:border-matrix-primary/40 p-4 text-xs text-azure-text-secondary dark:text-matrix-secondary overflow-auto max-h-72 whitespace-pre-wrap leading-relaxed font-mono">
                {skill.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SkillsPage() {
  const [selectedSkill, setSelectedSkill] = useState<SkillDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<{ error: string; details?: string } | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data,
    mutate,
    isLoading,
  } = useSWR('/skills', () => skillsService.fetchSkills(), { refreshInterval: 10000 });

  const skills = data?.skills ?? [];
  const enabledCount = data?.enabled ?? 0;

  const handleReload = async () => {
    await skillsService.reloadSkills();
    mutate();
  };

  const handleToggle = async (skill: Skill) => {
    if (skill.enabled) {
      await skillsService.disableSkill(skill.name);
    } else {
      await skillsService.enableSkill(skill.name);
    }
    mutate();
  };

  const handleView = async (skill: Skill) => {
    setLoadingDetail(true);
    try {
      const detail = await skillsService.fetchSkill(skill.name);
      setSelectedSkill(detail);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);

    try {
      const result = await skillsService.uploadSkill(file);
      setUploadSuccess(`Skill "${result.skill.name}" uploaded successfully!`);
      mutate();
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError({
        error: err.message || 'Upload failed',
        details: err.details,
      });
    } finally {
      setUploading(false);
    }
  };

  const openUploadDialog = () => {
    setUploadError(null);
    setUploadSuccess(null);
    setUploadOpen(true);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-azure-primary/10 dark:bg-matrix-highlight/10 border border-azure-primary/20 dark:border-matrix-highlight/30 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-azure-primary dark:text-matrix-highlight" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-azure-text dark:text-matrix-highlight">Skills</h1>
            <p className="text-sm text-azure-text-secondary dark:text-matrix-tertiary">
              {skills.length} skill{skills.length !== 1 ? 's' : ''}, {enabledCount} enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openUploadDialog}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-azure-primary dark:border-matrix-primary text-azure-primary dark:text-matrix-primary font-medium hover:bg-azure-primary/10 dark:hover:bg-matrix-primary/10 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <button
            onClick={handleReload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-black font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        </div>
      </motion.div>

      {isLoading ? (
        <motion.div variants={item} className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-azure-text-secondary dark:text-matrix-dim" />
          <p className="mt-2 text-azure-text-secondary dark:text-matrix-dim">Loading skills...</p>
        </motion.div>
      ) : skills.length === 0 ? (
        <motion.div
          variants={item}
          className="rounded-lg border border-dashed border-azure-border dark:border-matrix-primary p-8 text-center"
        >
          <Wand2 className="w-12 h-12 mx-auto text-azure-text-tertiary dark:text-matrix-dim" />
          <h3 className="mt-4 text-lg font-medium text-azure-text-primary dark:text-matrix-highlight">
            No skills found
          </h3>
          <p className="mt-2 text-azure-text-secondary dark:text-matrix-secondary max-w-md mx-auto">
            Upload a skill ZIP or add skills manually to{' '}
            <code className="bg-azure-hover dark:bg-zinc-800 px-1 rounded">~/.morpheus/skills/</code>.
            Each skill folder must contain a{' '}
            <code className="bg-azure-hover dark:bg-zinc-800 px-1 rounded">SKILL.md</code> file with frontmatter.
          </p>
          <button
            onClick={openUploadDialog}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-azure-primary dark:bg-matrix-primary text-white dark:text-black font-medium hover:opacity-90 transition-opacity"
          >
            <Upload className="w-4 h-4" />
            Upload Skill
          </button>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {skills.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              onToggle={() => handleToggle(skill)}
              onView={() => handleView(skill)}
            />
          ))}
        </motion.div>
      )}

      <SkillDetailModal
        skill={selectedSkill}
        open={!!selectedSkill}
        onOpenChange={(open) => !open && setSelectedSkill(null)}
      />

      {/* Upload Modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Skill
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-azure-text-secondary dark:text-matrix-secondary text-sm">
            Upload a ZIP file containing your skill folder. The ZIP must have exactly one folder
            at root level with a valid <code className="bg-azure-hover dark:bg-zinc-800 px-1 rounded">SKILL.md</code> file.
          </p>

          <div className="border-2 border-dashed border-azure-border dark:border-matrix-primary rounded-lg p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
              id="skill-upload-input"
            />
            <label
              htmlFor="skill-upload-input"
              className={`flex flex-col items-center gap-2 cursor-pointer ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploading ? (
                <RefreshCw className="w-8 h-8 animate-spin text-azure-primary dark:text-matrix-primary" />
              ) : (
                <Upload className="w-8 h-8 text-azure-text-tertiary dark:text-matrix-dim" />
              )}
              <span className="text-azure-text-secondary dark:text-matrix-secondary">
                {uploading ? 'Uploading...' : 'Click to select ZIP file'}
              </span>
            </label>
          </div>

          {uploadError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  {uploadError.error}
                </p>
                {uploadError.details && (
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                    {uploadError.details}
                  </p>
                )}
              </div>
            </div>
          )}

          {uploadSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200">{uploadSuccess}</p>
            </div>
          )}

          <div className="rounded-lg bg-azure-hover dark:bg-zinc-900 p-3">
            <h4 className="text-sm font-medium text-azure-text-primary dark:text-matrix-highlight mb-2">
              ZIP Structure Example
            </h4>
            <pre className="text-xs text-azure-text-secondary dark:text-matrix-secondary">
{`my-skill.zip
└── my-skill/
    ├── SKILL.md (required)
    ├── scripts/ (optional)
    │   └── script.js
    └── examples/ (optional)
        └── output.txt`}
            </pre>
          </div>
        </div>
      </Dialog>

      {loadingDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <RefreshCw className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </motion.div>
  );
}
