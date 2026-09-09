import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Compass, AlertTriangle, CheckCircle2, Sparkles, Cpu, Ban, Layers, Radio } from 'lucide-react';
import { MusicIntentProfile } from './musicIntentProfile';

interface BlueprintVisualizerProps {
  intentProfile: MusicIntentProfile | null;
}

export const BlueprintVisualizer: React.FC<BlueprintVisualizerProps> = ({ intentProfile }) => {
  // Default to COLLAPSED as mandated by V4.5 specification
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!intentProfile) {
    return null;
  }

  const {
    coreGenre,
    subGenres,
    moods,
    energy,
    vocals,
    instruments,
    arrangement,
    production,
    mustInclude,
    mustExclude,
    inferredElements,
    conflicts,
    conflictResolutions,
    source,
    confidence,
    fallbackReason,
  } = intentProfile;

  const hasConflicts = conflicts && conflicts.length > 0;
  const isGemini = source === 'gemini';

  return (
    <div
      id="blueprint-visualizer-panel"
      className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 shadow-sm transition-all duration-200 mb-4"
    >
      {/* Collapsed Header / Toggle Bar */}
      <div
        id="blueprint-visualizer-toggle"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center justify-between cursor-pointer select-none group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800 text-sm tracking-tight">
                🧭 Bản đồ Ý định Âm nhạc (Music Blueprint)
              </span>
              <span
                id="intent-source-badge"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                  isGemini
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isGemini ? (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Gemini AI
                  </>
                ) : (
                  <>
                    <Cpu className="w-3 h-3" />
                    Local Blueprint {fallbackReason === 'overload' ? '(Fallback do quá tải)' : ''}
                  </>
                )}
              </span>
              <span
                id="intent-confidence-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                <CheckCircle2 className="w-3 h-3" />
                Độ tin cậy: {confidence}%
              </span>
              {hasConflicts && (
                <span
                  id="intent-conflict-indicator"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {conflicts.length} Xung đột đã xử lý
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              Khóa {mustInclude.length} ý định trực tiếp · Loại trừ {mustExclude.length} yếu tố cấm ·{' '}
              {inferredElements.length} gợi ý hòa âm
            </p>
          </div>
        </div>

        <button
          type="button"
          id="blueprint-expand-collapse-btn"
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors shrink-0 ml-2"
          aria-label={isExpanded ? 'Thu gọn Blueprint' : 'Mở rộng Blueprint'}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div id="blueprint-visualizer-expanded-content" className="mt-4 pt-3.5 border-t border-slate-200/80 space-y-4 text-xs">
          {/* Conflict Resolution Banner (if any) */}
          {hasConflicts && (
            <div
              id="intent-conflict-box"
              className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 text-rose-900"
            >
              <div className="flex items-center gap-1.5 font-semibold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>⚠ Xung đột ý định được phát hiện & Đã tự động giải quyết</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-rose-800/90 pl-1">
                {conflicts.map((conflict, idx) => (
                  <li key={`conflict-${idx}`}>
                    <span className="font-medium">{conflict}</span>
                  </li>
                ))}
              </ul>
              {conflictResolutions && conflictResolutions.length > 0 && (
                <div className="pt-1 text-[11px] text-rose-700 font-mono bg-rose-100/50 p-2 rounded-lg border border-rose-200/50 space-y-0.5">
                  <div className="font-semibold text-rose-800">Quy tắc ưu tiên tất định V4.5:</div>
                  {conflictResolutions.map((res, idx) => (
                    <div key={`res-${idx}`}>✓ {res}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Engine & Source Status */}
          <div className="flex items-center justify-between bg-white/70 p-2.5 rounded-xl border border-slate-200/60 text-slate-600">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-indigo-500" />
              <span>Nguồn giải mã ý định:</span>
              <strong className="text-slate-800">
                {isGemini ? 'Gemini 3.8 Flash (Server-side AI)' : 'Local Music Blueprint (Tất định)'}
              </strong>
            </div>
            {fallbackReason && (
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {fallbackReason === 'overload' ? 'Gemini tạm thời quá tải' : 'Gemini API chưa khả dụng'}
              </span>
            )}
          </div>

          {/* Structured Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Core Genre & Subgenres */}
            {coreGenre.length > 0 && (
              <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-xs">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-400" />
                  Thể loại chính & Nhánh phong cách
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {coreGenre.map((g, i) => (
                    <span
                      key={`core-${i}`}
                      className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80 text-xs"
                    >
                      {g}
                    </span>
                  ))}
                  {subGenres.map((sg, i) => (
                    <span
                      key={`sub-${i}`}
                      className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-xs"
                    >
                      {sg}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Moods & Atmosphere */}
            {moods.length > 0 && (
              <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-xs">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Cảm xúc & Không khí (Moods)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {moods.map((m, i) => (
                    <span
                      key={`mood-${i}`}
                      className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/70 text-xs"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Vocals */}
            {vocals.length > 0 && (
              <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-xs">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Định hướng Giọng hát (Vocals)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {vocals.map((v, i) => (
                    <span
                      key={`vocal-${i}`}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        v.includes('Instrumental')
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                          : 'bg-violet-50 text-violet-700 border-violet-200'
                      }`}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Instruments */}
            {instruments.length > 0 && (
              <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-xs">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nhạc cụ đặc trưng (Instruments)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {instruments.map((inst, i) => (
                    <span
                      key={`inst-${i}`}
                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-xs"
                    >
                      {inst}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Arrangement & Progression */}
            {arrangement.length > 0 && (
              <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-xs md:col-span-2">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Cấu trúc & Cao trào (Arrangement)
                </div>
                <div className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-[11px]">
                  {arrangement.join(' · ')}
                </div>
              </div>
            )}

            {/* 6. Production & Texture */}
            {production.length > 0 && (
              <div className="p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-xs md:col-span-2">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Sản xuất & Không gian âm thanh (Production)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {production.map((p, i) => (
                    <span
                      key={`prod-${i}`}
                      className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/70 text-xs"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Three Tier Intent Breakdown: Explicit, Excluded, Inferred */}
          <div className="space-y-3 pt-2 border-t border-slate-200/60">
            {/* Phải giữ (Must Include) */}
            {mustInclude.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  PHẢI GIỮ (Yêu cầu trực tiếp từ người dùng)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mustInclude.map((item, i) => (
                    <span
                      key={`must-${i}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-medium text-xs shadow-xs"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Không được có (Must Exclude - Negative constraints) */}
            {mustExclude.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                  KHÔNG ĐƯỢC CÓ (Lệnh cấm / Phủ định tuyệt đối)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mustExclude.map((item, i) => (
                    <span
                      key={`excl-${i}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium text-xs line-through shadow-xs"
                    >
                      <Ban className="w-3 h-3 text-rose-500" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI suy luận thêm (Inferred Elements) */}
            {inferredElements.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                  AI SUY LUẬN THÊM (Gợi ý hòa âm & tối ưu bản phối)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inferredElements.map((item, i) => (
                    <span
                      key={`inf-${i}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-medium text-xs shadow-xs"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
