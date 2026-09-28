import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Check,
  Plus,
  Volume2,
  AlertCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { MarketItem, MarketUnit, UserSettings } from '../types';
import {
  parseMultipleVoiceMarketItems,
  ParsedVoiceMarketItem,
} from '../utils/voiceParser';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { formatCurrency, formatNum } from '../utils/numberFormat';

interface MarketVoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: Omit<MarketItem, 'id' | 'createdAt'>) => void;
  settings: UserSettings;
}

export const MarketVoiceInputModal: React.FC<MarketVoiceInputModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  settings,
}) => {
  const isBn = settings.numberFormat === 'bn';
  const [lang, setLang] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [autoAdd, setAutoAdd] = useState(true);
  const [parsedItems, setParsedItems] = useState<ParsedVoiceMarketItem[]>([]);
  // Only holds the item(s) from the single latest voice utterance (no old history)
  const [lastSpokenItems, setLastSpokenItems] = useState<
    Array<{ name: string; quantity: number; unit: MarketUnit; price: number | null }> | null
  >(null);
  const [manualFallbackText, setManualFallbackText] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    errorMessage,
    permissionStatus,
    requestPermission,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceRecognition({
    lang,
    continuous: true,
    interimResults: true,
    onResult: (text, isFinal) => {
      const items = parseMultipleVoiceMarketItems(text);
      if (items && items.length > 0) {
        setParsedItems(items);

        // If autoAdd is enabled and speech is final with valid items
        if (isFinal && autoAdd) {
          handleCommitItems(items);
        }
      }
    },
  });

  // Start listening when modal opens and completely clear all previous history on open/close
  useEffect(() => {
    if (isOpen) {
      // Always start with a completely clean slate when entering
      setParsedItems([]);
      setLastSpokenItems(null);
      setManualFallbackText('');
      setSuccessToast(null);
      resetTranscript();

      if (isSupported) {
        const timer = setTimeout(() => {
          startListening();
        }, 300);
        return () => {
          clearTimeout(timer);
          stopListening();
        };
      }
    } else {
      // Clear everything when exiting so no previous voice history remains
      stopListening();
      setParsedItems([]);
      setLastSpokenItems(null);
      setManualFallbackText('');
      setSuccessToast(null);
      resetTranscript();
    }
  }, [isOpen, isSupported, startListening, stopListening, resetTranscript]);

  const handleClose = () => {
    stopListening();
    setParsedItems([]);
    setLastSpokenItems(null);
    setManualFallbackText('');
    setSuccessToast(null);
    resetTranscript();
    onClose();
  };

  const handleCommitItems = (itemsToCommit: ParsedVoiceMarketItem[]) => {
    const valid = itemsToCommit.filter((it) => it.name.trim() && it.quantity > 0);
    if (valid.length === 0) return;

    for (const it of valid) {
      onAddItem({
        name: it.name.trim(),
        quantity: it.quantity,
        unit: it.unit,
        pricePerUnit: it.pricePerUnit,
        isPurchased: false,
      });
    }

    // Keep ONLY what was just spoken right now
    setLastSpokenItems(
      valid.map((it) => ({
        name: it.name.trim(),
        quantity: it.quantity,
        unit: it.unit,
        price: it.pricePerUnit,
      }))
    );

    if (valid.length === 1) {
      setSuccessToast(
        `✓ "${valid[0].name} (${formatNum(valid[0].quantity, isBn)} ${valid[0].unit})" যোগ করা হয়েছে!`
      );
    } else {
      setSuccessToast(`✓ এক সাথে ${formatNum(valid.length, isBn)}টি পণ্য সফলভাবে যোগ করা হয়েছে!`);
    }

    setTimeout(() => {
      setSuccessToast(null);
    }, 3000);

    setParsedItems([]);
    resetTranscript();
  };

  const handleManualFallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualFallbackText.trim()) return;
    const items = parseMultipleVoiceMarketItems(manualFallbackText);
    if (items.length > 0) {
      handleCommitItems(items);
      setManualFallbackText('');
    }
  };

  const handleMicButtonClick = async () => {
    if (isListening) {
      stopListening();
    } else {
      if (permissionStatus !== 'granted') {
        const ok = await requestPermission();
        if (ok) {
          startListening();
        }
      } else {
        startListening();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                বাজারের ভয়েস ইনপুট
              </h3>
              <p className="text-[10px] text-slate-500">
                মুখে বলুন এবং সরাসরি তালিকায় যুক্ত করুন
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as any)}
              className="text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 py-1 px-2 rounded-lg border-0 focus:outline-hidden"
              title="ভয়েস ভাষা নির্বাচন"
            >
              <option value="bn-BD">বাংলা (BN)</option>
              <option value="en-US">English (EN)</option>
            </select>

            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 py-3 space-y-3.5">
          {/* Success Toast */}
          {successToast && (
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm animate-bounce-short">
              <Check className="w-4 h-4" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Microphone Interactive Pulse Button */}
          <div className="text-center py-2">
            <div className="relative inline-flex items-center justify-center">
              {isListening && (
                <>
                  <span className="absolute w-24 h-24 rounded-full bg-emerald-500/20 animate-ping" />
                  <span className="absolute w-20 h-20 rounded-full bg-emerald-500/30 animate-pulse" />
                </>
              )}

              <button
                type="button"
                onClick={handleMicButtonClick}
                className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
                title={isListening ? 'শোনা বন্ধ করুন' : 'কথা বলা শুরু করুন'}
              >
                {isListening ? (
                  <Mic className="w-8 h-8 animate-bounce" />
                ) : (
                  <MicOff className="w-7 h-7 opacity-90" />
                )}
              </button>
            </div>

            <div className="mt-2.5">
              <p className="text-xs font-bold text-slate-800">
                {isListening ? (
                  <span className="text-emerald-700 flex items-center justify-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    শুনছি... এক সাথে একাধিক পণ্যও বলতে পারেন
                  </span>
                ) : (
                  <span className="text-slate-500">
                    মাইক্রোফোনে ট্যাপ করে মুখে বলুন
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Microphone Permission Prompt Banner */}
          {permissionStatus !== 'granted' && (
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-start gap-2.5 text-emerald-950">
                <div className="w-7 h-7 rounded-full bg-emerald-200/80 flex items-center justify-center shrink-0 mt-0.5 text-emerald-800 font-bold">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-extrabold text-xs text-emerald-950">
                    মাইক্রোফোন এক্সেস অনুমতি দিন 🎙️
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    আপনার কণ্ঠস্বর শুনে স্বয়ংক্রিয়ভাবে তালিকায় পণ্য যোগ করার জন্য একবার ব্রাউজারের মাইক্রোফোন অনুমতি প্রয়োজন।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const ok = await requestPermission();
                  if (ok) {
                    startListening();
                  }
                }}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <Mic className="w-4 h-4 text-emerald-200" />
                <span>মাইক্রোফোনের পারমিশন দিন ও কথা বলুন</span>
              </button>
            </div>
          )}

          {/* Real-time Spoken Transcript */}
          {(interimTranscript || transcript) && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">
                আপনার কণ্ঠস্বর
              </div>
              <p className="text-sm font-semibold text-slate-800 italic">
                "{transcript || interimTranscript}"
              </p>
            </div>
          )}

          {/* Parsed Multi-Item Preview Card */}
          {parsedItems.length > 0 && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  শনাক্তকৃত পণ্য ({formatNum(parsedItems.length, isBn)}টি)
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-md">
                  প্রস্তুত
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {parsedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-emerald-100 text-xs shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-extrabold text-slate-900 block truncate text-xs sm:text-sm">
                        {item.name}
                      </span>
                      {item.pricePerUnit && (
                        <span className="text-[10px] text-slate-500 font-medium block">
                          দর: {formatCurrency(item.pricePerUnit, settings.currency, isBn)}/{item.unit}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg text-xs">
                        {formatNum(item.quantity, isBn)} {item.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setParsedItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                        title="বাদ দিন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirm Add All Button */}
              <div className="pt-2 border-t border-emerald-200/60">
                <button
                  type="button"
                  onClick={() => handleCommitItems(parsedItems)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition active:scale-98"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>
                    {parsedItems.length === 1
                      ? 'তালিকায় যোগ করুন'
                      : `সবগুলো (${formatNum(parsedItems.length, isBn)}টি পণ্য) যোগ করুন`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Browser Error / Not Supported Notice & Manual Fallback */}
          {(!isSupported || errorMessage) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2">
              <div className="flex items-start gap-2 text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">
                    {errorMessage || 'আপনার ব্রাউজারে স্পিচ রিকগনিশন সক্রিয় নেই বা অনুমতি দেওয়া হয়নি।'}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    ব্রাউজার অ্যাড্রেসবারে সাইট সেটিংসে গিয়ে মাইক্রোফোন পারমিশন প্রদান করুন। আপনি নিচে সরাসরি লিখেও একাধিক পণ্য যোগ করতে পারেন।
                  </p>
                </div>
              </div>

              {/* Manual quick input as fallback */}
              <form onSubmit={handleManualFallbackSubmit} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={manualFallbackText}
                  onChange={(e) => setManualFallbackText(e.target.value)}
                  placeholder="যেমন: আলু ২ কেজি, পেঁয়াজ ১ কেজি"
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-amber-300 bg-white focus:outline-hidden focus:border-emerald-600"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shrink-0"
                >
                  যোগ
                </button>
              </form>
            </div>
          )}

          {/* Last Spoken / Added Item (Shows ONLY what was just spoken right now - no history accumulation) */}
          {lastSpokenItems && lastSpokenItems.length > 0 && (
            <div className="border-t border-slate-100 pt-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <Check className="w-4 h-4 text-emerald-600" />
                  এইমাত্র যা বলা হয়েছে ({formatNum(lastSpokenItems.length, isBn)}টি)
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold border border-emerald-200">
                  মেমোতে যুক্ত
                </span>
              </div>
              <div className="space-y-1.5">
                {lastSpokenItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs shadow-2xs"
                  >
                    <span className="font-extrabold text-slate-900">{item.name}</span>
                    <div className="flex items-center gap-2">
                      {item.price && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          {formatCurrency(item.price, settings.currency, isBn)}/{item.unit}
                        </span>
                      )}
                      <span className="font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                        {formatNum(item.quantity, isBn)} {item.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="pt-3 border-t border-slate-100 shrink-0 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 font-semibold">
            <input
              type="checkbox"
              checked={autoAdd}
              onChange={(e) => setAutoAdd(e.target.checked)}
              className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500"
            />
            <span>বলার সাথে সাথে যোগ করুন (Auto-add)</span>
          </label>

          <button
            type="button"
            onClick={handleClose}
            className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            সম্পন্ন
          </button>
        </div>
      </div>
    </div>
  );
};
