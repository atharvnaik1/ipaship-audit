import React, { useState, useEffect } from 'react';
import { Terminal, Play, Pause, Square, Bug, ChevronRight, Layout, Settings, FileCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- TYPES ---
type LogEntry = {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
};

type Breakpoint = {
  id: string;
  file: string;
  line: number;
  condition?: string;
  enabled: boolean;
};

// --- COMPONENTS ---

export default function AIDebugger() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [prompt, setPrompt] = useState('');
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [activeTab, setActiveTab] = useState<'console' | 'breakpoints' | 'state'>('console');

  // Simulation effect
  useEffect(() => {
    if (isRunning && !isPaused) {
      const interval = setInterval(() => {
        const newLog: LogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          level: Math.random() > 0.1 ? 'info' : 'warn',
          source: 'audit-engine.ts',
          message: `Analyzing chunk ${Math.floor(Math.random() * 100)}...`,
        };
        setLogs(prev => [newLog, ...prev].slice(0, 50));
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isRunning, isPaused]);

  const handleRun = () => {
    setIsRunning(true);
    setIsPaused(false);
    setLogs([{
      id: 'start',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      source: 'system',
      message: 'Debugger initialized. Starting audit session...',
    }]);
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    // Add "AI Prompt" log
    const userLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      level: 'debug',
      source: 'User Prompt',
      message: prompt,
    };
    setLogs(prev => [userLog, ...prev]);
    
    // Simulate AI response
    setTimeout(() => {
      const aiLog: LogEntry = {
        id: (Date.now() + 1).toString(),
        timestamp: new Date().toLocaleTimeString(),
        level: 'info',
        source: 'Debugger AI',
        message: `Analyzing code at current state for: "${prompt}". Check suggested fix in the report view.`,
      };
      setLogs(prev => [aiLog, ...prev]);
    }, 1000);
    
    setPrompt('');
  };

  return (
    <div className="w-full h-[600px] bg-[#0d0d17] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <Bug className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-bold text-white">AI Debugger Console</span>
          <div className="px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-[10px] text-green-400 font-mono">
            LIVE
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={isRunning ? () => setIsPaused(!isPaused) : handleRun}
            className={`p-1.5 rounded-lg transition-all ${isRunning ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'}`}
          >
            {isRunning && !isPaused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => setIsRunning(false)}
            disabled={!isRunning}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-30"
          >
            <Square className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <div className="w-12 border-r border-white/10 bg-black/20 flex flex-col items-center py-4 gap-4">
          <button 
            onClick={() => setActiveTab('console')}
            className={`p-2 rounded-lg transition-all ${activeTab === 'console' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'}`}
          >
            <Terminal className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('breakpoints')}
            className={`p-2 rounded-lg transition-all ${activeTab === 'breakpoints' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'}`}
          >
            <Bug className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('state')}
            className={`p-2 rounded-lg transition-all ${activeTab === 'state' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-white'}`}
          >
            <Layout className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-black/40 relative">
          {/* Tabs Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 font-mono text-xs">
            <AnimatePresence mode="wait">
              {activeTab === 'console' && (
                <motion.div 
                  key="console"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {logs.length === 0 && !isRunning && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 pt-20">
                      <Terminal className="w-12 h-12 mb-4" />
                      <p>Click Play to start the debugger</p>
                    </div>
                  )}
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-3 group">
                      <span className="text-muted-foreground/40 shrink-0 select-none">[{log.timestamp}]</span>
                      <span className={`shrink-0 font-bold ${
                        log.level === 'error' ? 'text-red-400' : 
                        log.level === 'warn' ? 'text-amber-400' : 
                        log.level === 'debug' ? 'text-blue-400' : 'text-primary'
                      }`}>
                        {log.source.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground/80 break-words">{log.message}</span>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'breakpoints' && (
                <motion.div 
                  key="breakpoints"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-bold text-sm">Active Breakpoints</h3>
                    <button className="text-[10px] text-primary hover:underline">Add New</button>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        <div>
                          <p className="text-white font-medium">audit-retrieval.ts</p>
                          <p className="text-[10px] text-muted-foreground">Line 42: buildRetrievedContext</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px]">if files.length &gt; 0</div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {activeTab === 'state' && (
                <motion.div 
                  key="state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h3 className="text-white font-bold text-sm mb-4">Memory State (Heap)</h3>
                  <div className="space-y-2 font-mono">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center text-muted-foreground border-b border-white/5 pb-2 mb-2">
                        <span>Variable</span>
                        <span>Value</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-blue-400">filesAnalyzed</span>
                          <span className="text-amber-400">{filesScanned}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-400">activeProvider</span>
                          <span className="text-green-400">&quot;{provider}&quot;</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-400">auditPhase</span>
                          <span className="text-green-400">&quot;{phase}&quot;</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI Debug Prompt Input */}
          <div className="p-3 bg-black/60 border-t border-white/10 backdrop-blur-md">
            <form onSubmit={handlePromptSubmit} className="relative">
              <input 
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask the AI Debugger to check specific code or state..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-10 py-2.5 text-xs text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-all"
              />
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-bold transition-all"
              >
                ASK AI
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
