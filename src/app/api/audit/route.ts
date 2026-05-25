// Basic in-memory rate limiter using LRU Cache for DDoS protection
const rateLimitCache = new LRUCache<string, number>({ max: 500, ttl: 1000 * 60 });

// Debugger AI setup
import { createDebugger } from 'debugger-ai';
const debuggerAI = createDebugger();