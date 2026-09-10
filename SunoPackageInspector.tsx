import React, { useState } from 'react';
import {
  Package,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  Cpu,
  ShieldCheck,
  Sliders,
  Layers,
  Mic,
  Music2,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { SunoPackage, formatFullSunoPackageText } from './sunoPromptCompiler';

interface SunoPackageInspectorProps {
  pkg: SunoPackage;
  onCopyFeedback?: (msg: string) => void;
}

export const SunoPackageInspector: React.FC<SunoPackageInspectorProps> = ({
  pkg,
  onCopyFeedback
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
    if (onCopyFeedback) {
      onCopyFeedback(`Đã sao chép: ${label}`);
    }
  };

  const isGemini = pkg.diagnostics?.source === 'gemini';
  const hasStyle = Boolean(pkg.stylePrompt && pkg.stylePrompt.trim());
  const hasExclude = Boolean(pkg.exclude && pkg.exclude.trim());
  const hasArrangement = Boolean(pkg.arrangement && pkg.arrangement.trim());
  const hasVocal = Boolean(pkg.vocalGuide && pkg.vocalGuide.trim());
  const hasProduction = Boolean(pkg.productionGuide && pkg.productionGuide.trim());

  return (
    <div className="neu-flat p-6 transition-all duration-200">
      {/* Collapsible Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="neu-icon-btn text-purple-600">
            <Package size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">
              📦 Gói Suno Hoàn chỉnh
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Xuất bản đầy đủ Style, Exclude, Arrangement, Vocal, Production & Cài đặt
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Source Indicator Badge */}
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border shadow-sm ${
              isGemini
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
            title={isGemini ? 'Phối khí bởi Gemini AI' : 'Xử lý chuẩn hóa qua Local Blueprint Engine'}
          >
            {isGemini ? <Sparkles size={12} /> : <Cpu size={12} />}
            {isGemini ? 'Source: Gemini' : 'Source: Local Blueprint'}
          </span>

          {/* Quick Copy Full Package button on header */}
          <button
            onClick={() => handleCopy(formatFullSunoPackageText(pkg), 'full-header', 'Toàn bộ gói Suno')}
            className="neu-btn px-3 py-1.5 text-xs font-bold text-purple-600 flex items-center gap-1.5"
            title="Sao chép toàn bộ gói Suno (không kèm chẩn đoán)"
          >
            {copiedKey === 'full-header' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            {copiedKey === 'full-header' ? 'Đã chép' : 'Sao chép gói'}
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="neu-btn p-2 text-gray-600 hover:text-purple-600"
            aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
          >
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="mt-5 space-y-4 pt-4 border-t border-gray-200/60">
          
          {/* Primary Action Button */}
          <button
            onClick={() => handleCopy(formatFullSunoPackageText(pkg), 'full-main', 'Toàn bộ gói Suno')}
            className="w-full neu-btn py-3 text-purple-700 font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-200"
          >
            {copiedKey === 'full-main' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
            {copiedKey === 'full-main' ? 'Đã sao chép toàn bộ Gói Suno!' : 'Sao chép toàn bộ Gói Suno (Suno Custom Mode)'}
          </button>

          {/* 1. STYLE PROMPT (if not empty) */}
          {hasStyle && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Music2 size={13} className="text-purple-500" /> STYLE PROMPT
                </span>
                <button
                  onClick={() => handleCopy(pkg.stylePrompt, 'style', 'Style Prompt')}
                  className="neu-btn px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-purple-600 flex items-center gap-1"
                >
                  {copiedKey === 'style' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copiedKey === 'style' ? 'Đã chép' : 'Sao chép Style'}
                </button>
              </div>
              <div className="neu-pressed p-3.5 rounded-xl font-mono text-xs leading-relaxed text-gray-800 break-words select-all">
                {pkg.stylePrompt}
              </div>
            </div>
          )}

          {/* 2. EXCLUDE (if not empty) */}
          {hasExclude && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={13} className="text-red-500" /> EXCLUDE (ADVANCED OPTIONS)
                </span>
                <button
                  onClick={() => handleCopy(pkg.exclude, 'exclude', 'Exclude')}
                  className="neu-btn px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-red-600 flex items-center gap-1"
                >
                  {copiedKey === 'exclude' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copiedKey === 'exclude' ? 'Đã chép' : 'Sao chép Exclude'}
                </button>
              </div>
              <div className="neu-pressed p-3 rounded-xl text-xs text-red-700 font-medium break-words select-all bg-red-50/20">
                {pkg.exclude}
              </div>
            </div>
          )}

          {/* 3. ARRANGEMENT (if not empty) */}
          {hasArrangement && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={13} className="text-indigo-500" /> ARRANGEMENT
                </span>
                <button
                  onClick={() => handleCopy(pkg.arrangement, 'arrangement', 'Arrangement')}
                  className="neu-btn px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-indigo-600 flex items-center gap-1"
                >
                  {copiedKey === 'arrangement' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copiedKey === 'arrangement' ? 'Đã chép' : 'Sao chép Arrangement'}
                </button>
              </div>
              <div className="neu-pressed p-3 rounded-xl text-xs text-indigo-900 font-medium break-words select-all">
                {pkg.arrangement}
              </div>
            </div>
          )}

          {/* 4. VOCAL GUIDE (if not empty) */}
          {hasVocal && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Mic size={13} className="text-emerald-500" /> VOCAL GUIDE
                </span>
                <button
                  onClick={() => handleCopy(pkg.vocalGuide, 'vocal', 'Vocal Guide')}
                  className="neu-btn px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-emerald-600 flex items-center gap-1"
                >
                  {copiedKey === 'vocal' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copiedKey === 'vocal' ? 'Đã chép' : 'Sao chép Vocal'}
                </button>
              </div>
              <div className="neu-pressed p-3 rounded-xl text-xs text-emerald-900 font-medium break-words select-all">
                {pkg.vocalGuide}
              </div>
            </div>
          )}

          {/* 5. PRODUCTION (if not empty) */}
          {hasProduction && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={13} className="text-amber-500" /> PRODUCTION
                </span>
                <button
                  onClick={() => handleCopy(pkg.productionGuide, 'production', 'Production Guide')}
                  className="neu-btn px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-amber-600 flex items-center gap-1"
                >
                  {copiedKey === 'production' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copiedKey === 'production' ? 'Đã chép' : 'Sao chép Production'}
                </button>
              </div>
              <div className="neu-pressed p-3 rounded-xl text-xs text-amber-900 font-medium break-words select-all">
                {pkg.productionGuide}
              </div>
            </div>
          )}

          {/* 6. SUNO SETTINGS */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={13} className="text-purple-500" /> SUNO SETTINGS
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="neu-pressed p-2.5 rounded-xl text-center">
                <div className="text-gray-400 font-bold uppercase text-[10px]">Weirdness</div>
                <div className="text-sm font-extrabold text-purple-600 mt-0.5">{pkg.settings.weirdness}%</div>
              </div>
              <div className="neu-pressed p-2.5 rounded-xl text-center">
                <div className="text-gray-400 font-bold uppercase text-[10px]">Style Influence</div>
                <div className="text-sm font-extrabold text-purple-600 mt-0.5">{pkg.settings.styleInfluence}%</div>
              </div>
              <div className="neu-pressed p-2.5 rounded-xl text-center">
                <div className="text-gray-400 font-bold uppercase text-[10px]">Duration</div>
                <div className="text-sm font-extrabold text-purple-600 mt-0.5">{pkg.settings.duration}</div>
              </div>
              <div className="neu-pressed p-2.5 rounded-xl text-center">
                <div className="text-gray-400 font-bold uppercase text-[10px]">Model</div>
                <div className="text-xs font-extrabold text-purple-600 mt-1 truncate" title={pkg.settings.model}>{pkg.settings.model}</div>
              </div>
            </div>
          </div>

          {/* 7. DIAGNOSTICS VIEW (Tiny expandable section, hidden by default) */}
          {pkg.diagnostics && (
            <div className="pt-2 border-t border-gray-200/50">
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-purple-600 py-1"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  Thẩm quyền & Chẩn đoán an toàn (Diagnostics)
                </span>
                {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showDiagnostics && (
                <div className="mt-2 neu-pressed p-3 rounded-xl space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-gray-600">
                    <div>
                      <span className="text-gray-400">Độ tin cậy:</span>{' '}
                      <span className="font-bold text-gray-700">
                        {pkg.diagnostics.confidence !== undefined ? `${Math.round(pkg.diagnostics.confidence)}%` : 'Tự động'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Prompt Health:</span>{' '}
                      <span className="font-bold text-emerald-600">{pkg.diagnostics.promptHealth}/100</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Nguồn thực thi:</span>{' '}
                      <span className="font-bold text-purple-600 capitalize">{pkg.diagnostics.source}</span>
                    </div>
                  </div>

                  {/* Preserved Authorities */}
                  {pkg.diagnostics.preservedAuthorities && pkg.diagnostics.preservedAuthorities.length > 0 && (
                    <div>
                      <div className="text-gray-400 font-semibold mb-1 text-[11px]">Thẩm quyền bảo toàn:</div>
                      <div className="flex flex-wrap gap-1">
                        {pkg.diagnostics.preservedAuthorities.map((auth, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                            ✓ {auth}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blocked Conflicts */}
                  <div>
                    <div className="text-gray-400 font-semibold mb-1 text-[11px]">Xung đột đã lọc (Conflict Guard):</div>
                    {pkg.diagnostics.blockedConflicts && pkg.diagnostics.blockedConflicts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {pkg.diagnostics.blockedConflicts.map((conf, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                            🛡️ {conf}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic text-[11px]">Không phát hiện xung đột thẩm quyền</span>
                    )}
                  </div>

                  {/* Removed Duplicates */}
                  <div>
                    <div className="text-gray-400 font-semibold mb-1 text-[11px]">Thẻ trùng lặp đã gộp (Semantic Dedup):</div>
                    {pkg.diagnostics.removedDuplicates && pkg.diagnostics.removedDuplicates.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {pkg.diagnostics.removedDuplicates.map((dup, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-700">
                            {dup}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic text-[11px]">Không có thẻ lặp dư thừa</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
