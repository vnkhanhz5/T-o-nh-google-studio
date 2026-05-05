import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Play, 
  History as HistoryIcon, 
  LayoutDashboard, 
  Files, 
  Compass, 
  Settings, 
  ChevronDown, 
  Info, 
  Copy, 
  Maximize2, 
  Image as ImageIcon,
  MoreVertical,
  Minus,
  Plus,
  ArrowRight,
  Share2,
  Code2,
  Trash2,
  Search,
  Sparkles,
  Zap,
  Undo2,
  Redo2,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DropZone } from './components/DropZone';
import { ImageDisplay } from './components/ImageDisplay';
import { PixelDissolve } from './components/PixelDissolve';
import { SelectionAnimator } from './components/SelectionAnimator';
import type { Rect, HistoryStep, ImageDescription } from './types';
import { AppState } from './types';
import { cropImage } from './utils/imageUtils';
import { serviceEnhance } from './utils/serviceEnhance';
import { serviceDescribeImage } from './utils/serviceDescribeImage';
import { generateZoomGif } from './utils/gifGenerator';

interface EnhancementJob {
  originalRect: Rect;
  canvasWithSelectionDataUrl: string;
  pixelatedSrc: string;
  screenRect: Rect;
}

const App: React.FC = () => {
  // --- FEATURE FLAG ---
  const useFixedSelectionBox = true;
  const fixedSelectionSizePercentage = 0.125;

  const [appState, setAppState] = useState<AppState>(AppState.LOADING);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [pixelatedImageSrc, setPixelatedImageSrc] = useState<string | null>(null);
  const [enhancedImageSrc, setEnhancedImageSrc] = useState<string | null>(null);
  const [finalImageSrc, setFinalImageSrc] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [newHistoryEntryData, setNewHistoryEntryData] = useState<{description: ImageDescription, originalRect: Rect} | null>(null);

  const [enhancementJob, setEnhancementJob] = useState<EnhancementJob | null>(null);
  const [finalEnhancementRect, setFinalEnhancementRect] = useState<Rect | null>(null);
  const [displaySelection, setDisplaySelection] = useState<Rect | null>(null);
  const [isGeneratingGif, setIsGeneratingGif] = useState<boolean>(false);
  const [showBananaBanner, setShowBananaBanner] = useState<boolean>(false);
  
  // New Studio State
  const [prompt, setPrompt] = useState<string>('');
  const [resolution, setResolution] = useState<string>('1K');
  const [aspectRatio, setAspectRatio] = useState<string>('Auto');
  const [temperature, setTemperature] = useState<number>(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const imageObjectURLRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInitialImage = useCallback(async () => {
    if (imageObjectURLRef.current) {
      URL.revokeObjectURL(imageObjectURLRef.current);
      imageObjectURLRef.current = null;
    }

    setAppState(AppState.LOADING);
    try {
      const response = await fetch('https://www.gstatic.com/aistudio/starter-apps/enhance/living_room.png');
      if (!response.ok) {
        throw new Error(`Failed to fetch initial image: ${response.statusText}`);
      }
      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      imageObjectURLRef.current = objectURL;

      const img = new Image();
      img.onload = () => {
        const newStep: HistoryStep = { imageSrc: objectURL, description: null, originalRect: null };
        setHistory([newStep]);
        setHistoryIndex(0);
        setImage(img);
        setFinalImageSrc(objectURL);
        setDisplaySelection(null);
        setAppState(AppState.LOADED);
      };
      img.onerror = () => {
        setAppState(AppState.IDLE);
        if (imageObjectURLRef.current) {
          URL.revokeObjectURL(imageObjectURLRef.current);
          imageObjectURLRef.current = null;
        }
      };
      img.src = objectURL;
    } catch (error) {
      console.error("Failed to load initial image:", error);
      setAppState(AppState.IDLE);
    }
  }, []);
  
  const resetState = useCallback(() => {
    setEnhancementJob(null);
    setFinalEnhancementRect(null);
    setHistory([]);
    setHistoryIndex(-1);
    setNewHistoryEntryData(null);
    setDisplaySelection(null);
    setShowBananaBanner(false);
    setPrompt('');
    loadInitialImage();
  }, [loadInitialImage]);

  useEffect(() => {
    loadInitialImage();
    return () => {
      if (imageObjectURLRef.current) {
        URL.revokeObjectURL(imageObjectURLRef.current);
      }
    };
  }, [loadInitialImage]);


  const handleFileDrop = useCallback((file: File) => {
    if (imageObjectURLRef.current) {
      URL.revokeObjectURL(imageObjectURLRef.current);
      imageObjectURLRef.current = null;
    }
    
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const newImageSrc = e.target?.result as string;
          const newStep: HistoryStep = { imageSrc: newImageSrc, description: null, originalRect: null };
          setHistory([newStep]);
          setHistoryIndex(0);
          setImage(img);
          setFinalImageSrc(newImageSrc);
          setEnhancementJob(null);
          setFinalEnhancementRect(null);
          setDisplaySelection(null);
          setShowBananaBanner(false);
          setAppState(AppState.LOADED);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSelection = useCallback(async (originalRect: Rect, screenRect: Rect, canvasWithSelectionDataUrl: string) => {
    if (!image || !workspaceRef.current) return;

    if (historyIndex < history.length - 1) {
      const newHistory = history.slice(0, historyIndex + 1);
      setHistory(newHistory);
    }

    setAppState(AppState.ENHANCING);
    
    const workspaceBounds = workspaceRef.current.getBoundingClientRect();
    const aspectRatioVal = originalRect.w / originalRect.h;
    const padding = 0.1;
    const maxWidth = workspaceBounds.width * (1 - padding);
    const maxHeight = workspaceBounds.height * (1 - padding);

    let targetWidth = maxWidth;
    let targetHeight = targetWidth / aspectRatioVal;

    if (targetHeight > maxHeight) {
        targetHeight = maxHeight;
        targetWidth = targetHeight * aspectRatioVal;
    }
    
    setFinalEnhancementRect({
        w: targetWidth,
        h: targetHeight,
        x: (workspaceBounds.width - targetWidth) / 2, 
        y: (workspaceBounds.height - targetHeight) / 2,
    });

    const pixelatedSrc = await cropImage(image, originalRect, originalRect.w, originalRect.h, true);
    
    const relativeScreenRect = {
      x: screenRect.x - workspaceBounds.left,
      y: screenRect.y - workspaceBounds.top,
      w: screenRect.w,
      h: screenRect.h
    };

    setEnhancementJob({
      originalRect,
      canvasWithSelectionDataUrl,
      pixelatedSrc,
      screenRect: relativeScreenRect,
    });

  }, [image, history, historyIndex]);

  const runEnhancementJob = useCallback(async () => {
    if (!enhancementJob || !image) return;
    
    setPixelatedImageSrc(enhancementJob.pixelatedSrc);

    try {
      const lastDescription = historyIndex >= 0 ? history[historyIndex].description : null;
      const result = await serviceEnhance(
          enhancementJob.canvasWithSelectionDataUrl, 
          lastDescription,
          prompt
      );
      
      setEnhancedImageSrc(result.enhancedImageSrc);
      setNewHistoryEntryData({
          description: result.description,
          originalRect: enhancementJob.originalRect,
      });
      setAppState(AppState.ENHANCED);
      
      if (result.description.selectionDescription.toLowerCase().includes('banana')) {
        setShowBananaBanner(true);
      }
    } catch (error) {
      console.error("Enhancement failed:", error);
      setAppState(AppState.LOADED);
    }
  }, [enhancementJob, image, history, historyIndex, prompt]);

  const handleEnhancementComplete = useCallback(() => {
    if (!enhancedImageSrc || !newHistoryEntryData) return;
    
    const newStep: HistoryStep = { 
      imageSrc: enhancedImageSrc, 
      description: newHistoryEntryData.description,
      originalRect: newHistoryEntryData.originalRect,
    };
    
    const newHistory = [...history, newStep];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setFinalImageSrc(enhancedImageSrc);
    
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setAppState(AppState.LOADED);
      setEnhancementJob(null);
      setFinalEnhancementRect(null);
      setNewHistoryEntryData(null);
      setPixelatedImageSrc(null);
      setEnhancedImageSrc(null);
    };
    img.src = enhancedImageSrc;
  }, [enhancedImageSrc, newHistoryEntryData, history]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const step = history[newIndex];
      setHistoryIndex(newIndex);
      setFinalImageSrc(step.imageSrc);
      
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setDisplaySelection(history[newIndex + 1]?.originalRect || null);
      };
      img.src = step.imageSrc;
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const step = history[newIndex];
      setHistoryIndex(newIndex);
      setFinalImageSrc(step.imageSrc);
      
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setDisplaySelection(history[newIndex + 1]?.originalRect || null);
      };
      img.src = step.imageSrc;
    }
  }, [historyIndex, history]);

  const handleRegenerate = useCallback(() => {
    if (historyIndex > 0) {
      const stepBefore = history[historyIndex - 1];
      const currentStep = history[historyIndex];
      
      if (!currentStep.originalRect) return;

      const img = new Image();
      img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          
          ctx.strokeStyle = '#1a73e8';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(currentStep.originalRect!.x, currentStep.originalRect!.y, currentStep.originalRect!.w, currentStep.originalRect!.h);
          
          handleSelection(currentStep.originalRect!, {x:0, y:0, w:0, h:0}, canvas.toDataURL());
      };
      img.src = stepBefore.imageSrc;
    }
  }, [history, historyIndex, handleSelection]);

  const handleExportGif = useCallback(async () => {
    if (history.length < 2) return;
    setIsGeneratingGif(true);
    try {
      await generateZoomGif(history);
    } catch (error) {
      console.error("GIF generation failed:", error);
    } finally {
      setIsGeneratingGif(false);
    }
  }, [history]);

  const handleCopyPrompt = () => {
    if (prompt) {
      navigator.clipboard.writeText(prompt);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileDrop(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-[#0d0d0d] flex flex-col text-[#e3e3e3] overflow-hidden font-sans select-none"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="h-14 border-b border-[#303030] flex items-center justify-between px-4 bg-[#111111] shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-[#2d2d2d] rounded-full transition-colors"
          >
            <ChevronDown className={`w-5 h-5 transition-transform ${isSidebarOpen ? '' : '-rotate-90'}`} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white fill-current" />
            </div>
            <h1 className="font-medium text-lg tracking-tight flex items-center gap-2">
              Ai Studio <span className="text-[#8e8e8e] font-normal">| Playground</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2d2d2d] rounded-md text-sm transition-colors">
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2d2d2d] rounded-md text-sm transition-colors">
            <Code2 className="w-4 h-4" />
            <span className="hidden sm:inline">Get code</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-pink-500 border border-white/20 ml-2" />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <nav className="w-16 border-r border-[#303030] bg-[#111111] flex flex-col items-center py-4 gap-6 shrink-0 z-40">
          <button className="p-3 text-blue-500 bg-blue-500/10 rounded-xl">
              <Play className="w-5 h-5" />
          </button>
          <button className="p-3 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-xl transition-all">
              <HistoryIcon className="w-5 h-5" />
          </button>
          <button className="p-3 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-xl transition-all">
              <LayoutDashboard className="w-5 h-5" />
          </button>
          <button className="p-3 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-xl transition-all">
              <Compass className="w-5 h-5" />
          </button>
          <div className="mt-auto flex flex-col items-center gap-4">
            <button className="p-3 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-xl transition-all">
                <Settings className="w-5 h-5" />
            </button>
            <button className="p-3 text-[#8e8e8e] hover:text-white hover:bg-[#2d2d2d] rounded-xl transition-all">
                <Info className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* Recent Sidebar (Conditional) */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-[#303030] bg-[#111111] flex flex-col shrink-0 overflow-hidden"
            >
              <div className="p-4 flex items-center justify-between border-b border-[#303030]">
                <span className="text-xs font-semibold text-[#8e8e8e] uppercase tracking-wider">Recent</span>
                <button className="p-1 hover:bg-[#2d2d2d] rounded text-[#8e8e8e]"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {history.slice().reverse().map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const realIndex = history.length - 1 - idx;
                      setHistoryIndex(realIndex);
                      const img = new Image();
                      img.onload = () => {
                        setImage(img);
                        setFinalImageSrc(step.imageSrc);
                      };
                      img.src = step.imageSrc;
                      setDisplaySelection(history[realIndex + 1]?.originalRect || null);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex flex-col gap-1 border ${
                      (history.length - 1 - idx) === historyIndex 
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                      : 'border-transparent text-[#8e8e8e] hover:bg-[#2d2d2d] hover:text-white'
                    }`}
                  >
                    <span className="font-medium truncate">
                      {step.description?.selectionDescription || `Generation Step ${history.length - idx}`}
                    </span>
                    <span className="text-[10px] opacity-60">Just now • {resolution}</span>
                  </button>
                ))}
                {history.length === 0 && (
                  <div className="p-4 text-center text-[#8e8e8e] text-sm italic">
                    No recent activity
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Workspace */}
        <main ref={workspaceRef} className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden bg-dot-pattern">
            {showBananaBanner && (
              <motion.div 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-6 py-2 rounded-full z-100 font-bold text-sm shadow-2xl flex items-center gap-3 overflow-hidden shadow-yellow-400/20"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                <span className="relative">🍌 YOU FOUND THE NANO BANANA! 🍌</span>
                <button onClick={() => setShowBananaBanner(false)} className="relative hover:opacity-60 text-lg">&times;</button>
              </motion.div>
            )}

            {appState === AppState.IDLE && (
              <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
                <DropZone />
              </div>
            )}
            
            <div className="w-full h-full flex items-center justify-center relative">
              {finalImageSrc && ![AppState.ENHANCED, AppState.ENHANCING].includes(appState) && (
                <div className="relative group">
                   <div className="absolute -top-12 left-0 right-0 flex justify-between items-end px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-[#1e1e1e] border border-[#303030] rounded-lg px-3 py-1.5 flex items-center gap-3 shadow-xl">
                         <button onClick={handleCopyPrompt} className="p-1 hover:text-blue-400 transition-colors" title="Copy Prompt"><Copy className="w-4 h-4" /></button>
                         <button className="p-1 hover:text-blue-400 transition-colors"><Share2 className="w-4 h-4" /></button>
                         <button className="p-1 hover:text-blue-400 transition-colors"><Maximize2 className="w-4 h-4" /></button>
                      </div>
                   </div>
                   <ImageDisplay
                    imageSrc={finalImageSrc}
                    onSelect={handleSelection}
                    isEnhancing={appState === AppState.ENHANCING || isGeneratingGif}
                    historicalSelection={displaySelection}
                    useFixedSelectionBox={useFixedSelectionBox}
                    fixedSelectionSizePercentage={fixedSelectionSizePercentage}
                  />
                </div>
              )}
            </div>

            {enhancementJob && appState === AppState.ENHANCING && finalEnhancementRect && (
                <SelectionAnimator
                    rect={enhancementJob.screenRect}
                    finalRect={finalEnhancementRect}
                    src={enhancementJob.pixelatedSrc}
                    onComplete={runEnhancementJob}
                />
            )}

            {appState === AppState.ENHANCED && pixelatedImageSrc && enhancedImageSrc && finalEnhancementRect && (
              <div 
                className="absolute shadow-2xl shadow-blue-500/20"
                style={{
                  top: `${finalEnhancementRect.y}px`, 
                  left: `${finalEnhancementRect.x}px`, 
                  width: `${finalEnhancementRect.w}px`,
                  height: `${finalEnhancementRect.h}px`,
                }}
              >
                <PixelDissolve
                  lowResSrc={pixelatedImageSrc}
                  highResSrc={enhancedImageSrc}
                  onComplete={handleEnhancementComplete}
                />
              </div>
            )}
          </div>

          {/* Prompt Area */}
          <div className="p-4 px-6 border-t border-[#303030] bg-[#111111]/80 backdrop-blur-md">
            <div className="max-w-4xl mx-auto flex flex-col gap-3">
              <div className="relative group">
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Start typing a prompt to see what our models can do"
                  className="w-full bg-[#1e1e1e] border border-[#303030] focus:border-blue-500/50 rounded-xl p-4 pr-32 min-h-[100px] resize-none text-sm leading-relaxed transition-all focus:ring-1 focus:ring-blue-500/20 outline-none"
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                   <button 
                    onClick={handleCopyPrompt}
                    className="p-2 hover:bg-[#2d2d2d] rounded-lg text-[#8e8e8e] hover:text-white transition-colors"
                    title="Copy Prompt"
                  >
                     <Copy className="w-4 h-4" />
                   </button>
                   <button className="p-2 hover:bg-[#2d2d2d] rounded-lg text-[#8e8e8e] hover:text-white transition-colors">
                     <Search className="w-4 h-4" />
                   </button>
                   <button 
                    disabled={!prompt.trim() || appState === AppState.ENHANCING}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-[#303030] disabled:text-[#8e8e8e] px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-600/20"
                   >
                     Run
                     <ArrowRight className="w-4 h-4" />
                   </button>
                </div>
                <div className="absolute top-4 right-4 text-[10px] text-[#8e8e8e] flex items-center gap-2 pointer-events-none">
                   <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500 fill-current" /> Nano Banana Pro</span>
                </div>
              </div>
              <div className="flex items-center gap-4 px-2">
                 <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-xs font-semibold text-[#8e8e8e] hover:text-white hover:bg-[#1e1e1e] px-2 py-1 rounded transition-colors uppercase tracking-wider"
                 >
                   <Plus className="w-3.5 h-3.5" />
                   Add Image
                 </button>
                 <div className="w-[1px] h-3 bg-[#303030]" />
                 <button className="flex items-center gap-2 text-xs font-semibold text-[#8e8e8e] hover:text-white hover:bg-[#1e1e1e] px-2 py-1 rounded transition-colors uppercase tracking-wider">
                   Tools
                 </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Configuration Panel */}
        <aside className="w-80 border-l border-[#303030] bg-[#111111] overflow-y-auto shrink-0 flex flex-col font-sans">
          <div className="p-4 h-14 border-b border-[#303030] flex items-center justify-between sticky top-0 bg-[#111111] z-10">
            <span className="text-sm font-semibold tracking-tight">Run settings</span>
            <div className="flex items-center gap-1">
               <button className="p-1.5 hover:bg-[#2d2d2d] rounded text-[#8e8e8e]"><Settings className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="p-5 space-y-8 flex-1">
            {/* Model Selector Card */}
            <div className="p-4 bg-[#1e1e1e] rounded-xl border border-[#303030] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Model</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#8e8e8e]" />
              </div>
              <h3 className="text-sm font-semibold">Nano Banana Pro</h3>
              <p className="text-[11px] text-[#8e8e8e] leading-relaxed">
                State-of-the-art image generation and editing model.
              </p>
            </div>

            {/* Resolution */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#8e8e8e]">Resolution</label>
                <div className="flex items-center gap-1 group cursor-help">
                   <Info className="w-3 h-3 text-[#505050] group-hover:text-blue-500 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['1K', '2K', '4K'].map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                      resolution === res 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                      : 'border-[#303030] bg-[#1Ref1e1e] text-[#8e8e8e] hover:border-[#404040] hover:text-white'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#8e8e8e]">Aspect ratio</label>
                <span className="text-[10px] text-[#505050] font-mono">{aspectRatio}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Auto', '1:1', '4:3', '3:4', '16:9', '9:16'].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                      aspectRatio === ratio 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                      : 'border-[#303030] bg-[#1e1e1e] text-[#8e8e8e] hover:border-[#404040] hover:text-white'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#8e8e8e]">Temperature</label>
                <span className="text-xs font-mono px-2 py-0.5 bg-[#1e1e1e] rounded border border-[#303030]">{temperature}</span>
              </div>
              <div className="flex items-center gap-3">
                 <Minus onClick={() => setTemperature(Math.max(0, parseFloat((temperature - 0.1).toFixed(1))))} className="w-4 h-4 cursor-pointer hover:text-white text-[#8e8e8e]" />
                 <input 
                  type="range" 
                  min="0" 
                  max="2" 
                  step="0.1" 
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="flex-1 accent-blue-600 h-1 bg-[#303030] rounded-lg appearance-none cursor-pointer"
                />
                 <Plus onClick={() => setTemperature(Math.min(2, parseFloat((temperature + 0.1).toFixed(1))))} className="w-4 h-4 cursor-pointer hover:text-white text-[#8e8e8e]" />
              </div>
            </div>

            {/* History Operations */}
            <div className="space-y-3 pt-6 border-t border-[#303030]">
               <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handleUndo} 
                    disabled={historyIndex <= 0}
                    className="flex flex-col items-center gap-1 p-3 bg-[#1e1e1e] rounded-xl border border-[#303030] hover:bg-[#2d2d2d] disabled:opacity-20 transition-all"
                  >
                    <Undo2 className="w-4 h-4" />
                    <span className="text-[10px] font-medium uppercase tracking-tight">Undo</span>
                  </button>
                  <button 
                    onClick={handleRedo} 
                    disabled={historyIndex >= history.length - 1}
                    className="flex flex-col items-center gap-1 p-3 bg-[#1e1e1e] rounded-xl border border-[#303030] hover:bg-[#2d2d2d] disabled:opacity-20 transition-all"
                  >
                    <Redo2 className="w-4 h-4" />
                    <span className="text-[10px] font-medium uppercase tracking-tight">Redo</span>
                  </button>
               </div>
               <button 
                onClick={handleRegenerate} 
                disabled={historyIndex <= 0}
                className="w-full py-3 bg-[#1e1e1e] hover:bg-[#2d2d2d] disabled:opacity-20 rounded-xl text-xs font-semibold border border-[#303030] transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Regenerate Step
               </button>
               <button 
                onClick={handleExportGif}
                disabled={history.length < 2 || isGeneratingGif}
                className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 disabled:opacity-20 rounded-xl text-xs font-semibold border border-blue-500/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                  {isGeneratingGif ? 'Encoding...' : 'Export GIF Zoom'}
               </button>
               <button 
                onClick={resetState}
                className="w-full py-3 hover:bg-red-500/10 text-[#8e8e8e] hover:text-red-400 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hard Reset
               </button>
            </div>
          </div>
        </aside>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileDrop(e.target.files[0]);
        }}
        className="hidden"
        accept="image/*"
      />
      
      <style>{`
        .bg-dot-pattern {
          background-image: radial-gradient(#303030 0.5px, transparent 0.5px);
          background-size: 24px 24px;
        }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #111111;
        }
      `}</style>
    </div>
  );
};

export default App;
