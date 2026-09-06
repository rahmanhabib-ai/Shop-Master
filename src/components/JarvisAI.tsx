import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  MicOff,
  Send,
  Volume2,
  VolumeX,
  ShieldCheck,
  Bot,
  Brain,
  Sparkles,
  Database,
  Plus,
  Trash2,
  Settings as SettingsIcon,
  Bookmark,
  CheckCircle2,
  History,
  MessageSquare,
  HelpCircle,
  Edit2,
  Key,
  KeyRound,
  Cpu,
  Radio,
  Layers,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ShoppingBag,
  TrendingUp,
  Activity,
  Globe,
  MapPin,
  Printer,
  MessageCircle,
  Sliders,
  Navigation,
  Shield,
  Compass,
  Link2,
  FileText,
  CheckSquare,
  Square,
  Search,
  Zap,
  Lock,
  Eye,
  SlidersHorizontal,
  Tag,
  Star,
  Users,
  Award,
  BookOpen,
  Filter,
  Sparkle,
  CheckCircle,
  Copy,
  Info
} from 'lucide-react';
import { db, collection, doc, updateDoc, deleteDoc, addDoc, handleFirestoreError, OperationType, query, where, onSnapshot, setDoc } from '../firebase';
import { fuzzyMatchProduct } from '../utils/productMatcher';

// Standard Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onerror: (event: any) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface JarvisAIProps {
  onClose: () => void;
  shopId: string;
  isMasterAdmin?: boolean;
  systemData: {
    items: any[];
    sales: any[];
    customers: any[];
    categories: any[];
    settings: any;
    merchants?: any[];
  };
  actions: {
    addItem: (item: any) => Promise<any>;
    addCustomer: (customer: any) => Promise<any>;
    removeItem: (id: string) => Promise<void>;
    navigate: (tab: string) => void;
    addToPOS: (items: any[]) => void;
    sendReminder: (customer: any) => void;
    printLatestInvoice: () => void;
    sendLatestInvoiceWhatsApp?: () => void;
    createDirectSale: (saleData: any) => Promise<any>;
  };
}

export const JarvisAI: React.FC<JarvisAIProps> = ({ onClose, shopId, systemData, actions, isMasterAdmin = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isMutedRef = useRef(false);
  
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  const [errorCount, setErrorCount] = useState(0);

  // AI Modes & Settings states
  const [currentMode, setCurrentMode] = useState<'assistant' | 'grounding' | 'memory' | 'api_config'>('assistant');
  const [memories, setMemories] = useState<any[]>([]);
  const [synonyms, setSynonyms] = useState<any[]>([]);
  const [aiSettings, setAiSettings] = useState<any>({
    persona: 'habib', // 'habib' (ছেলে) | 'ruhi' (মেয়ে)
    personality: 'friendly',
    customGreeting: '',
    shortTermMemoryLimit: 10,
    strictnessLevel: 'optimal',
    apiProvider: 'gemini',
    geminiApiKey: '',
    openrouterApiKey: '',
    openrouterModel: 'deepseek/deepseek-chat',
    isApiVerified: false,
    // Smart Capability Toggles (ধাপ ৩: ম্যানেজমেন্ট সুইচ)
    enableStoreDb: true,
    enableGoogleSearch: true,
    enableGoogleMaps: true,
    enableWhatsAppAction: true,
    enablePrintAction: true,
  });

  // Derived Dynamic Identity & Brand Persona
  const persona: 'habib' | 'ruhi' = aiSettings?.persona === 'ruhi' ? 'ruhi' : 'habib';
  const assistantName = persona === 'ruhi' ? 'রুহি' : 'হাবিব';
  const assistantNameEn = persona === 'ruhi' ? 'Ruhi' : 'Habib';
  const wakeWordBn = persona === 'ruhi' ? 'হেই রুহি' : 'হেই হাবিব';
  const wakeWordEn = persona === 'ruhi' ? 'Hey Ruhi' : 'Hey Habib';
  const storeName = systemData?.settings?.storeName || systemData?.settings?.name || 'শপ মাস্টার (Shop Master)';

  // Mandatory API Verification Gate
  const hasCustomKey = (aiSettings.apiProvider === 'gemini' && !!aiSettings.geminiApiKey?.trim()) ||
                       (aiSettings.apiProvider === 'openrouter' && !!aiSettings.openrouterApiKey?.trim());
  const isApiActive = (hasCustomKey && aiSettings.isApiVerified) || isMasterAdmin;

  // API Configuration Test & Diagnostic states
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [showApiKeyGuideModal, setShowApiKeyGuideModal] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ 
    success: boolean; 
    message: string;
    provider?: string;
    model?: string;
    latencyMs?: number;
    responsePreview?: string;
  } | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');

  // Live Speech Synthesis state & available voice cache
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playingDemoPersona, setPlayingDemoPersona] = useState<'habib' | 'ruhi' | null>(null);

  // Load and cache browser voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        try {
          const vList = window.speechSynthesis.getVoices();
          if (vList && vList.length > 0) {
            setAvailableVoices(vList);
          }
        } catch (e) {
          console.warn("Could not retrieve voices:", e);
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Inputs & Filters for Enterprise HUD Memory
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<'business_rules' | 'vip_preferences' | 'discounts_offers' | 'dialects_synonyms'>('business_rules');
  const [memorySearchTerm, setMemorySearchTerm] = useState('');
  const [activeMemoryTab, setActiveMemoryTab] = useState<'all' | 'business_rules' | 'vip_preferences' | 'discounts_offers' | 'dialects_synonyms'>('all');
  const [newSpokenWord, setNewSpokenWord] = useState('');
  const [newActualProduct, setNewActualProduct] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  // Grounding Sandbox States
  const [groundingTestQuery, setGroundingTestQuery] = useState('আজকের সয়াবিন তেলের লিটার প্রতি বাজারদর ও খোলা তেলের দাম কত?');
  const [isTestingGrounding, setIsTestingGrounding] = useState(false);
  const [groundingTestResult, setGroundingTestResult] = useState<any>(null);

  const handleToggleCapability = async (key: string, value: boolean) => {
    const updated = { ...aiSettings, [key]: value };
    setAiSettings(updated);
    await handleSaveAiSettings({ [key]: value });
  };

  const handleApplyPreset = async (preset: 'full' | 'store_only' | 'search_only' | 'readonly') => {
    let updates: any = {};
    if (preset === 'full') {
      updates = {
        enableStoreDb: true,
        enableGoogleSearch: true,
        enableGoogleMaps: true,
        enableWhatsAppAction: true,
        enablePrintAction: true,
      };
    } else if (preset === 'store_only') {
      updates = {
        enableStoreDb: true,
        enableGoogleSearch: false,
        enableGoogleMaps: false,
        enableWhatsAppAction: true,
        enablePrintAction: true,
      };
    } else if (preset === 'search_only') {
      updates = {
        enableStoreDb: false,
        enableGoogleSearch: true,
        enableGoogleMaps: true,
        enableWhatsAppAction: false,
        enablePrintAction: false,
      };
    } else if (preset === 'readonly') {
      updates = {
        enableStoreDb: true,
        enableGoogleSearch: true,
        enableGoogleMaps: true,
        enableWhatsAppAction: false,
        enablePrintAction: false,
      };
    }
    setAiSettings((prev: any) => ({ ...prev, ...updates }));
    await handleSaveAiSettings(updates);
  };

  const handleTestGrounding = async (queryText?: string) => {
    const promptToTest = (queryText || groundingTestQuery).trim();
    if (!promptToTest) return;

    setIsTestingGrounding(true);
    setGroundingTestResult(null);

    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToTest,
          systemInstruction: `You are ${assistantName}, the dedicated AI Business Assistant for ${storeName}. Use Google Search Grounding to find real-time, accurate, and reliable market prices or live information for Bangladesh in clean, natural Bengali. Always state the verified facts directly and concisely.`,
          tools: [{ googleSearch: {} }],
          config: { model: "gemini-3.8-flash" },
          apiProvider: aiSettings?.apiProvider || 'gemini',
          customApiKey: aiSettings?.geminiApiKey || undefined,
        })
      });

      const data = await response.json();
      if (response.ok && data.text) {
        setGroundingTestResult({
          success: true,
          text: data.text,
          groundingMetadata: data.groundingMetadata,
          latencyMs: data.latencyMs,
          model: data.model,
          provider: data.provider
        });
        speak(data.text, persona, true);
      } else {
        setGroundingTestResult({
          success: false,
          error: data.error || 'লাইভ গ্রাউন্ডিং তথ্য পাওয়া যায়নি। কোটা বা এপিআই চাবি পরীক্ষা করুন।'
        });
      }
    } catch (err: any) {
      setGroundingTestResult({
        success: false,
        error: `সংযোগ ত্রুটি: ${err.message || 'সার্ভারে সংযোগ করা যায়নি'}`
      });
    } finally {
      setIsTestingGrounding(false);
    }
  };

  // Firestore Real-time Synchronizers for AI memory & custom features
  useEffect(() => {
    if (!shopId) return;
    
    // Subscribe to custom factual memories
    const qMemories = query(collection(db, 'ai_memories'), where('shopId', '==', shopId));
    const unsubMemories = onSnapshot(qMemories, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setMemories(list);
    }, (err) => {
      console.error("Firestore onSnapshot error for ai_memories:", err);
    });

    // Subscribe to spoken to product synonyms/aliases
    const qSynonyms = query(collection(db, 'ai_synonyms'), where('shopId', '==', shopId));
    const unsubSynonyms = onSnapshot(qSynonyms, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setSynonyms(list);
    }, (err) => {
      console.error("Firestore onSnapshot error for ai_synonyms:", err);
    });

    // Subscribe to AI settings (personality and greetings)
    const unsubSettings = onSnapshot(doc(db, 'ai_settings', shopId), (snapshot) => {
      if (snapshot.exists()) {
        setAiSettings(snapshot.data());
      }
    }, (err) => {
      console.error("Firestore onSnapshot error for ai_settings:", err);
    });

    return () => {
      unsubMemories();
      unsubSynonyms();
      unsubSettings();
    };
  }, [shopId]);

  const handleAddMemory = async () => {
    if (!newMemoryText.trim() || !shopId) return;
    setIsSavingMemory(true);
    try {
      await addDoc(collection(db, 'ai_memories'), {
        shopId,
        text: newMemoryText.trim(),
        category: newMemoryCategory,
        createdAt: new Date().toISOString(),
        isActive: true
      });
      setNewMemoryText('');
    } catch (err) {
      console.error("Error adding AI memory:", err);
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ai_memories', id));
    } catch (err) {
      console.error("Error deleting AI memory:", err);
    }
  };

  const handleAddSynonym = async () => {
    if (!newSpokenWord.trim() || !newActualProduct.trim() || !shopId) return;
    try {
      await addDoc(collection(db, 'ai_synonyms'), {
        shopId,
        spokenWord: newSpokenWord.trim().toLowerCase(),
        actualProductName: newActualProduct.trim(),
        createdAt: new Date().toISOString()
      });
      setNewSpokenWord('');
      setNewActualProduct('');
    } catch (err) {
      console.error("Error adding pronunciation synonym:", err);
    }
  };

  const handleDeleteSynonym = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ai_synonyms', id));
    } catch (err) {
      console.error("Error deleting synonym:", err);
    }
  };

  const handleSaveAiSettings = async (updates?: any) => {
    if (!shopId) return;
    try {
      // Ensure updates is a clean plain object and not a React event
      const cleanUpdates = (updates && typeof updates === 'object' && !('nativeEvent' in updates) && !('_reactName' in updates) && !('preventDefault' in updates)) 
        ? updates 
        : {};

      const ref = doc(db, 'ai_settings', shopId);
      await setDoc(ref, {
        shopId,
        persona: aiSettings?.persona || 'habib',
        personality: aiSettings?.personality || 'friendly',
        customGreeting: aiSettings?.customGreeting || '',
        shortTermMemoryLimit: Number(aiSettings?.shortTermMemoryLimit) || 10,
        apiProvider: aiSettings?.apiProvider || 'gemini',
        geminiApiKey: aiSettings?.geminiApiKey || '',
        openrouterApiKey: aiSettings?.openrouterApiKey || '',
        openrouterModel: aiSettings?.openrouterModel || 'deepseek/deepseek-chat',
        isApiVerified: Boolean(aiSettings?.isApiVerified),
        enableStoreDb: aiSettings?.enableStoreDb !== false,
        enableGoogleSearch: aiSettings?.enableGoogleSearch !== false,
        enableGoogleMaps: aiSettings?.enableGoogleMaps !== false,
        enableWhatsAppAction: aiSettings?.enableWhatsAppAction !== false,
        enablePrintAction: aiSettings?.enablePrintAction !== false,
        updatedAt: new Date().toISOString(),
        ...cleanUpdates
      }, { merge: true });
    } catch (err) {
      console.error("Error saving AI settings configs:", err);
    }
  };

  // Brain Simulator states & evaluations
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState('');
  const [isTestingBrain, setIsTestingBrain] = useState(false);

  const handleTestBrain = async () => {
    if (!testQuery.trim()) return;
    setIsTestingBrain(true);
    setTestResult('');
    try {
      const customMemoriesString = memories && memories.length > 0
        ? memories.map(m => `- [${m.category}]: ${m.text}`).join('\n')
        : "No custom business rules or facts stored in the virtual memory yet.";

      const customSynonymsString = synonyms && synonyms.length > 0
        ? synonyms.map(s => `- Speaking "${s.spokenWord}" refers to product/inventory: "${s.actualProductName}"`).join('\n')
        : "No custom mappings stored yet.";

      let personalityBlock = "You are a professional shop manager assistant. You are extremely helpful, humble, and polite.";
      if (aiSettings?.personality === 'strict') {
        personalityBlock = "You are a strict, precise accountant & manager who is extremely firm, short, and highly accurate with financial numbers. No extra greetings.";
      } else if (aiSettings?.personality === 'friendly') {
        personalityBlock = "You are an incredibly warm, enthusiastic, and friendly shop assistant. Make the user feel relaxed, comfortable, and speak with high warmth.";
      } else if (aiSettings?.personality === 'professional') {
        personalityBlock = "You are a highly polished corporate assistant: formal, polite, objective, and clear.";
      }

      const customGreetingBlock = aiSettings?.customGreeting 
        ? `Additionally, whenever greeting the user or initiating chat, you should align with this custom style preference: "${aiSettings.customGreeting}"`
        : "";

      const responseFetch = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: testQuery,
          apiProvider: aiSettings?.apiProvider || 'gemini',
          customApiKey: aiSettings?.geminiApiKey || undefined,
          openrouterApiKey: aiSettings?.openrouterApiKey || undefined,
          openrouterModel: aiSettings?.openrouterModel || 'deepseek/deepseek-chat',
          systemInstruction: `You are ${assistantName}, the dedicated AI Business Manager for ${storeName}. Here to test your custom cognitive brain configuration in real-time.
          
          # CRITICAL WAKE-WORD PROTOCOL (STRICT MANDATE):
          - You must ONLY process the request, answer questions, or execute actions IF the user's prompt explicitly starts with or contains "${wakeWordBn}", "${wakeWordEn}", or "${assistantName}" (case-insensitive).
          - If the user DOES NOT mention this exact name/wake-word, you MUST NOT provide any other answer. Instead, STRICTLY reply with: "অনুগ্রহ করে আমাকে সাহায্য করার আগে আমার নাম ধরে ডাকুন, যেমন: '${wakeWordBn}'।"

          # SYSTEM CONFIGURATION CURRENT SETTINGS:
          ${personalityBlock}
          ${customGreetingBlock}
          
          # BRAIN MEMORIES:
          ${customMemoriesString}

          # SPEECH SYNONYMS:
          ${customSynonymsString}
          
          Provide a test response according to your cognitive memories.`,
          tools: []
        })
      });

      const resJson = await responseFetch.json();
      if (resJson.text) {
        setTestResult(resJson.text);
      } else if (resJson.quotaExceeded || resJson.offlineFallback) {
        setTestResult("ক্লাউড কোটা সীমাবদ্ধতায় অফলাইন ব্যাকআপ ব্রেন সক্রিয় আছে। আপনার সংরক্ষিত মেমোরি রুলস অফলাইনেও কাজ করছে।");
      } else {
        setTestResult("ক্ষমা করবেন, কোনো উত্তর পাওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।");
      }
    } catch (err) {
      console.error("Error simulating brain feedback:", err);
      setTestResult("Error evaluating assistant response: " + String(err));
    } finally {
      setIsTestingBrain(false);
    }
  };

  // Test API Gateway Connection live & Verify with Deep Diagnostics
  const handleTestApi = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);
    try {
      const activeProvider = aiSettings.apiProvider || 'gemini';
      const promptText = 'Hello! Please confirm AI connection status in one short friendly sentence in Bengali: "সংযোগ সফল হয়েছে, আমি আপনার ব্যবসার সেবায় প্রস্তুত।"';
      
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          apiProvider: activeProvider,
          customApiKey: aiSettings.geminiApiKey || undefined,
          openrouterApiKey: aiSettings.openrouterApiKey || undefined,
          openrouterModel: aiSettings.openrouterModel || 'deepseek/deepseek-chat'
        })
      });
      const data = await res.json();
      if (data.success || data.text) {
        const responseText = data.text ? data.text.trim() : 'সংযোগ সক্রিয়';
        const latency = typeof data.latencyMs === 'number' ? data.latencyMs : undefined;
        const prov = data.provider || (activeProvider === 'openrouter' ? 'OpenRouter' : 'Google Gemini');
        const mod = data.model || (activeProvider === 'openrouter' ? (aiSettings.openrouterModel || 'deepseek/deepseek-chat') : 'gemini-3.1-flash-lite');

        setApiTestResult({ 
          success: true, 
          message: `সংযোগ সফল ও পরীক্ষিত! এআই রেসপন্স: "${responseText}"`,
          provider: prov,
          model: mod,
          latencyMs: latency,
          responsePreview: responseText
        });
        
        setAiSettings((prev: any) => ({ ...prev, isApiVerified: true }));
        handleSaveAiSettings({ 
          isApiVerified: true,
          apiProvider: activeProvider,
          geminiApiKey: aiSettings.geminiApiKey || '',
          openrouterApiKey: aiSettings.openrouterApiKey || '',
          openrouterModel: aiSettings.openrouterModel || 'deepseek/deepseek-chat'
        });

        // Audible feedback upon successful API verification
        speak(`এপিআই সংযোগ সফল হয়েছে। আমি ${assistantName}, আপনার ব্যবসার সেবায় সম্পূর্ণ প্রস্তুত!`, persona, true);
      } else if (data.quotaExceeded || data.offlineFallback) {
        setApiTestResult({ 
          success: false, 
          message: 'কোটা সীমাবদ্ধতা দেখা দিয়েছে। দয়া করে আপনার সক্রিয় বা পেইড এপিআই চাবি প্রদান করুন।' 
        });
      } else {
        setApiTestResult({ 
          success: false, 
          message: data.error || 'এপিআই সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আপনার এপিআই চাবি (API Key) সঠিক কিনা যাচাই করুন।' 
        });
      }
    } catch (err: any) {
      setApiTestResult({ 
        success: false, 
        message: `সংযোগ ব্যর্থ: ${err.message || 'সার্ভারে সংযোগ করা যায়নি'}` 
      });
    } finally {
      setIsTestingApi(false);
    }
  };
  
  // Use settings from systemData
  const language = systemData.settings.jarvisLanguage || 'bn';
  const voiceGender = systemData.settings.jarvisVoiceGender === 'female' ? 'female' : 'male';

  useEffect(() => {
    console.log("JarvisAI Settings - Language:", language, "Voice Gender:", voiceGender);
  }, [language, voiceGender]);

  const [history, setHistory] = useState<{ 
    role: 'user' | 'assistant', 
    text: string,
    groundingMetadata?: any,
    isGoogleSearch?: boolean,
    isGoogleMaps?: boolean,
    provider?: string,
    model?: string,
    timestamp?: string
  }[]>([]);
  
  // Derived data for HUD
  const todayRevenue = systemData.sales
    .filter(s => new Date(s.date).toDateString() === new Date().toDateString())
    .reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    
  const recentSales = [...systemData.sales]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speechWatchdogRef = useRef<any>(null);
  const autoRestartTimerRef = useRef<any>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const isComponentMountedRef = useRef<boolean>(true);

  // Clean shutdown helper to completely terminate all voice, recognition, timers and audio playback
  const performCleanShutdown = () => {
    // 1. Invalidate mount status flag
    isComponentMountedRef.current = false;

    // 2. Clear any active watchdog or restart timers
    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
      autoRestartTimerRef.current = null;
    }

    // 3. Abort streaming audio network requests
    if (audioAbortControllerRef.current) {
      try {
        audioAbortControllerRef.current.abort();
      } catch (_) {}
      audioAbortControllerRef.current = null;
    }

    // 4. Stop and detach active audio stream element
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current.src = "";
        activeAudioRef.current.load();
      } catch (_) {}
      activeAudioRef.current = null;
    }

    // 5. Cancel Web SpeechSynthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    // 6. Stop and unhook SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = () => {};
        recognitionRef.current.onerror = () => {};
        recognitionRef.current.onend = () => {};
        recognitionRef.current.stop();
        if (typeof (recognitionRef.current as any).abort === 'function') {
          (recognitionRef.current as any).abort();
        }
      } catch (_) {}
      recognitionRef.current = null;
    }

    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
  };

  // Safe handler wrapper for closing Jarvis screen
  const handleSafeClose = () => {
    performCleanShutdown();
    onClose();
  };

  const handleVoiceCommandRef = useRef<(command: string) => void>(undefined);

  const isStartingRef = useRef(false);

  const startRecognition = (force = false) => {
    if (!isComponentMountedRef.current) return;
    if (!recognitionRef.current || (isProcessing && !force) || isStartingRef.current) return;
    
    isStartingRef.current = true;

    try {
      recognitionRef.current.stop();
    } catch (e) {
      // Ignore
    }

    // Use a small timeout to ensure the stop takes effect before starting
    setTimeout(() => {
      if (!isComponentMountedRef.current) {
        isStartingRef.current = false;
        return;
      }
      try {
        if (!isProcessing || force) {
          recognitionRef.current?.start();
          setIsListening(true);
        }
      } catch (e: any) {
        if (e.message.includes('already started')) {
          setIsListening(true);
        } else {
          console.error("Failed to start recognition:", e);
          setIsListening(false);
        }
      } finally {
        isStartingRef.current = false;
      }
    }, 300); // Increased timeout slightly for better stability
  };

  // Initialize Speech Recognition & Page Lifecycle Cleanup
  useEffect(() => {
    isComponentMountedRef.current = true;

    // Warm up voices
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; 
      recognition.interimResults = true;
      recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US'; 

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (!isComponentMountedRef.current) return;
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          if (handleVoiceCommandRef.current && isComponentMountedRef.current) {
            handleVoiceCommandRef.current(finalTranscript);
          }
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (!isComponentMountedRef.current) return;
        if (event.error !== 'aborted' && event.error !== 'not-allowed' && event.error !== 'network' && event.error !== 'no-speech') {
          console.error('Speech recognition error', event.error);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (!isComponentMountedRef.current) {
          setIsListening(false);
          return;
        }
        setIsListening(false);
        // Restart speech recognition automatically if no explicit action is happening
        // Check if the component is still active and not muted/speaking/processing
        if (!isMutedRef.current && !isProcessingRef.current && !isSpeakingRef.current && isComponentMountedRef.current) {
          if (autoRestartTimerRef.current) {
            clearTimeout(autoRestartTimerRef.current);
          }
          autoRestartTimerRef.current = setTimeout(() => {
            if (!isMutedRef.current && !isProcessingRef.current && !isSpeakingRef.current && isComponentMountedRef.current) {
              try {
                // Ensure we don't start if already listening or unmounted
                if (recognitionRef.current && isComponentMountedRef.current) {
                  recognition.start();
                  setIsListening(true);
                }
              } catch (e) {
                // Ignore start errors if already running
              }
            }
          }, 400);
        }
      };

      recognitionRef.current = recognition;
    }

    // Page Visibility Change (pause or halt audio/mic when switching browser tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden / switched away
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (_) {}
          setIsListening(false);
        }
      } else {
        // Tab restored / visible again
        if (isComponentMountedRef.current && !isMutedRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
          startRecognition();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean Shutdown On Component Unmount (When navigating away to any page)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      performCleanShutdown();
    };
  }, []); 

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, transcript]);

  // Auto start on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      startRecognition();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      startRecognition();
    }
  };

  // Update recognition language when state changes
  useEffect(() => {
    if (recognitionRef.current) {
        recognitionRef.current.lang = language === 'bn' ? 'bn-BD' : 'en-US';
    }
  }, [language]);

  const speak = (
    text: string, 
    overridePersona?: 'habib' | 'ruhi', 
    forceUnmute = false, 
    onComplete?: () => void
  ): boolean => {
    if (typeof window === 'undefined') {
      onComplete?.();
      return false;
    }

    if (forceUnmute && isMutedRef.current) {
      setIsMuted(false);
      isMutedRef.current = false;
    }
    
    if (isMutedRef.current) {
      onComplete?.();
      return false;
    }
    
    // Stop any existing stream or SpeechSynthesis
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch (_) {}
      activeAudioRef.current = null;
    }

    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
      audioAbortControllerRef.current = null;
    }

    try {
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.resume();
    } catch (_) {}

    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }

    // Clean text for Spoken Bengali TTS
    const cleanText = text
      .replace(/[*#_`~[\]()<>{}]/g, ' ')
      .replace(/[^\u0980-\u09FFa-zA-Z0-9\s,.?।!]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      onComplete?.();
      return false;
    }

    // Strict Persona Determination: Habib is 100% Male, Ruhi is 100% Female
    const targetPersona: 'habib' | 'ruhi' = overridePersona || (aiSettings?.persona === 'ruhi' ? 'ruhi' : 'habib');
    const isFemalePersona = targetPersona === 'ruhi';

    // Break text into natural spoken fragments (sentences / clauses) under 140 chars
    const rawChunks = cleanText.split(/([।?!,.])/g);
    const chunks: string[] = [];
    let temp = '';
    for (const part of rawChunks) {
      if (!part) continue;
      if (['।', '?', '!', ',', '.'].includes(part)) {
        temp += part;
        if (temp.trim().length > 0) {
          chunks.push(temp.trim());
          temp = '';
        }
      } else {
        if ((temp + part).length > 130) {
          if (temp.trim()) chunks.push(temp.trim());
          temp = part;
        } else {
          temp += ' ' + part;
        }
      }
    }
    if (temp.trim()) {
      chunks.push(temp.trim());
    }

    const playQueue = chunks.length > 0 ? chunks : [cleanText];
    let currentIdx = 0;
    const controller = new AbortController();
    audioAbortControllerRef.current = controller;

    // Fallback using browser speechSynthesis if network stream fails
    const fallbackToSpeechSynthesis = () => {
      if (!window.speechSynthesis) {
        setIsSpeaking(false);
        onComplete?.();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = (availableVoices && availableVoices.length > 0) 
        ? availableVoices 
        : window.speechSynthesis.getVoices();
      
      const preferredVoices = isFemalePersona
        ? ['google বাংলা', 'bn-bd-female', 'bn-in-female', 'pallabi', 'kiti', 'zaira', 'bangla female', 'female']
        : ['google বাংলা', 'bn-bd-male', 'bn-in-male', 'amit', 'niloy', 'bangla male', 'male'];

      let voice = voices.find(v => 
        v.lang.toLowerCase().includes('bn') && 
        preferredVoices.some(name => v.name.toLowerCase().includes(name))
      );
      if (!voice) voice = voices.find(v => v.lang.toLowerCase().includes('bn'));
      if (!voice) voice = voices.find(v => v.lang.toLowerCase().startsWith('en'));

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'bn-BD';
      }

      utterance.rate = isFemalePersona ? 1.02 : 0.95;
      utterance.pitch = isFemalePersona ? 1.25 : 0.92;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onComplete?.();
        if (!isMutedRef.current && !isProcessingRef.current && currentMode === 'assistant') {
          startRecognition(true);
        }
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        onComplete?.();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (_) {
        setIsSpeaking(false);
        onComplete?.();
      }
    };

    // Sequential streaming player
    const playNextChunk = () => {
      if (controller.signal.aborted || isMutedRef.current) {
        setIsSpeaking(false);
        onComplete?.();
        return;
      }

      if (currentIdx >= playQueue.length) {
        setIsSpeaking(false);
        onComplete?.();
        if (speechWatchdogRef.current) {
          clearTimeout(speechWatchdogRef.current);
          speechWatchdogRef.current = null;
        }
        if (!isMutedRef.current && !isProcessingRef.current && currentMode === 'assistant') {
          startRecognition(true);
        }
        return;
      }

      const chunkText = playQueue[currentIdx];
      const audioUrl = `/api/tts/stream?text=${encodeURIComponent(chunkText)}&persona=${targetPersona}&lang=bn`;
      
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.playbackRate = 1.0;

      let chunkFinished = false;
      const advanceChunk = () => {
        if (chunkFinished) return;
        chunkFinished = true;
        currentIdx++;
        playNextChunk();
      };

      audio.onplay = () => {
        setIsSpeaking(true);
      };

      audio.onended = () => {
        advanceChunk();
      };

      audio.onerror = (e) => {
        console.warn('Streaming audio chunk failed, invoking speech fallback:', e);
        fallbackToSpeechSynthesis();
      };

      // Safety timeout per individual audio chunk (max 8s)
      const chunkTimeout = setTimeout(() => {
        if (!chunkFinished && isSpeakingRef.current) {
          console.warn('Chunk playback timeout, advancing...');
          advanceChunk();
        }
      }, 8000);

      audio.play().catch((playErr) => {
        clearTimeout(chunkTimeout);
        console.warn('Audio.play() error (possibly autoplay policy):', playErr);
        fallbackToSpeechSynthesis();
      });
    };

    const expectedDuration = Math.max(4000, (cleanText.length * 160));
    speechWatchdogRef.current = setTimeout(() => {
      if (isSpeakingRef.current) {
        console.warn("TTS Watchdog safety reset");
        try {
          activeAudioRef.current?.pause();
          window.speechSynthesis?.cancel();
        } catch (_) {}
        setIsSpeaking(false);
        onComplete?.();
        if (!isMutedRef.current && !isProcessingRef.current && currentMode === 'assistant') {
          startRecognition(true);
        }
      }
    }, expectedDuration + 5000);

    playNextChunk();
    return true;
  };

  useEffect(() => {
    handleVoiceCommandRef.current = handleVoiceCommand;
  }, [systemData, actions, isMuted]);

  // Helper Analytics Engine for Deep Database Intelligence
  const getAnalyticsEngine = () => {
    const now = new Date();
    const todayStr = now.toDateString();

    const getSalesByPeriod = (period: string = 'week') => {
      if (period === 'today') {
        return systemData.sales.filter((s: any) => new Date(s.date).toDateString() === todayStr);
      } else if (period === 'month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return systemData.sales.filter((s: any) => new Date(s.date) >= lastMonth);
      } else {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return systemData.sales.filter((s: any) => new Date(s.date) >= lastWeek);
      }
    };

    const getTopSelling = (period: string = 'week', limit: number = 5) => {
      const sales = getSalesByPeriod(period);
      const productMap: { [key: string]: { name: string; quantity: number; revenue: number; unit?: string } } = {};
      
      sales.forEach((s: any) => {
        (s.items || []).forEach((item: any) => {
          const name = item.productName || item.name || 'Unknown';
          const qty = Number(item.quantity || 1);
          const rev = Number(item.price || item.total || 0) * (item.total ? 1 : qty);
          if (!productMap[name]) {
            productMap[name] = { name, quantity: 0, revenue: 0, unit: item.unit || 'টি' };
          }
          productMap[name].quantity += qty;
          productMap[name].revenue += rev;
        });
      });

      return Object.values(productMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, limit);
    };

    const getMostProfitable = (period: string = 'week', limit: number = 5) => {
      const sales = getSalesByPeriod(period);
      const productProfitMap: { [key: string]: { name: string; quantity: number; revenue: number; profit: number } } = {};

      sales.forEach((s: any) => {
        (s.items || []).forEach((item: any) => {
          const name = item.productName || item.name || 'Unknown';
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || (qty > 0 && item.total ? item.total / qty : 0));
          const matchedDbItem = systemData.items.find((p: any) => p.name.toLowerCase() === name.toLowerCase());
          const costPrice = Number(matchedDbItem?.costPrice || matchedDbItem?.purchasePrice || matchedDbItem?.wholesalePrice || price * 0.8);
          const unitProfit = Math.max(0, price - costPrice);
          const totalProfit = unitProfit * qty;
          const rev = price * qty;

          if (!productProfitMap[name]) {
            productProfitMap[name] = { name, quantity: 0, revenue: 0, profit: 0 };
          }
          productProfitMap[name].quantity += qty;
          productProfitMap[name].revenue += rev;
          productProfitMap[name].profit += totalProfit;
        });
      });

      return Object.values(productProfitMap)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, limit);
    };

    const getFinancialBreakdown = () => {
      const todaySales = systemData.sales.filter((s: any) => new Date(s.date).toDateString() === todayStr);
      const todayTotal = todaySales.reduce((acc: number, s: any) => acc + (s.finalAmount || s.totalAmount || 0), 0);
      const todayCash = todaySales.reduce((acc: number, s: any) => acc + (s.paidAmount !== undefined ? s.paidAmount : (s.finalAmount || s.totalAmount || 0)), 0);
      const todayDue = todaySales.reduce((acc: number, s: any) => acc + (s.dueAmount || 0), 0);

      const thisMonthSales = systemData.sales.filter((s: any) => {
        const d = new Date(s.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const monthTotal = thisMonthSales.reduce((acc: number, s: any) => acc + (s.finalAmount || s.totalAmount || 0), 0);
      const monthCash = thisMonthSales.reduce((acc: number, s: any) => acc + (s.paidAmount !== undefined ? s.paidAmount : (s.finalAmount || s.totalAmount || 0)), 0);
      const monthDue = thisMonthSales.reduce((acc: number, s: any) => acc + (s.dueAmount || 0), 0);

      return {
        today: { count: todaySales.length, total: todayTotal, cash: todayCash, due: todayDue },
        month: { count: thisMonthSales.length, total: monthTotal, cash: monthCash, due: monthDue }
      };
    };

    const getTopDueCustomers = (limit: number = 5) => {
      return (systemData.customers || [])
        .filter((c: any) => (c.currentDue || c.totalUnpaid || 0) > 0)
        .map((c: any) => ({
          name: c.name,
          phone: c.phone,
          due: c.currentDue || c.totalUnpaid || 0
        }))
        .sort((a: any, b: any) => b.due - a.due)
        .slice(0, limit);
    };

    const getInactiveCustomers = (days: number = 7) => {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return (systemData.customers || []).filter((c: any) => {
        const customerSales = (systemData.sales || []).filter((s: any) => s.customerId === c.id || s.customerPhone === c.phone);
        if (customerSales.length === 0) return true;
        const lastSaleDate = new Date(Math.max(...customerSales.map((s: any) => new Date(s.date).getTime())));
        return lastSaleDate < cutoff;
      }).map((c: any) => {
        const customerSales = (systemData.sales || []).filter((s: any) => s.customerId === c.id || s.customerPhone === c.phone);
        let daysAgo = -1;
        if (customerSales.length > 0) {
          const lastSaleDate = new Date(Math.max(...customerSales.map((s: any) => new Date(s.date).getTime())));
          daysAgo = Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
        }
        return {
          name: c.name,
          phone: c.phone,
          daysInactive: daysAgo === -1 ? 'কখনো কেনেননি' : `${daysAgo} দিন`,
          due: c.currentDue || c.totalUnpaid || 0
        };
      });
    };

    const getCustomerLastTransaction = (query: string) => {
      const c = (systemData.customers || []).find((cust: any) =>
        cust.phone.toLowerCase().includes(query.toLowerCase()) ||
        cust.name.toLowerCase().includes(query.toLowerCase())
      );
      if (!c) return null;
      const customerSales = (systemData.sales || [])
        .filter((s: any) => s.customerId === c.id || s.customerPhone === c.phone)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const lastSale = customerSales[0] || null;
      return { customer: c, lastSale, totalSalesCount: customerSales.length };
    };

    const getRestockList = (threshold: number = 5) => {
      return (systemData.items || [])
        .filter((item: any) => item.stock <= (item.reorderLevel || threshold))
        .map((item: any) => ({
          name: item.name,
          stock: item.stock,
          unit: item.unit || 'টি',
          price: item.price,
          costPrice: item.costPrice || item.purchasePrice || (item.price * 0.8),
          suggestedOrder: Math.max(10, (item.reorderLevel || 10) * 2 - item.stock)
        }));
    };

    return {
      getTopSelling,
      getMostProfitable,
      getFinancialBreakdown,
      getTopDueCustomers,
      getInactiveCustomers,
      getCustomerLastTransaction,
      getRestockList
    };
  };

  // Offline Intelligent Brain Helper (works seamlessly even when cloud quotas are exhausted or internet drops)
  const executeOfflineIntelligence = (command: string) => {
    let offlineHandled = false;
    let offlineFeedback = "";
    const lowerCmd = command.toLowerCase().trim();
    const analytics = getAnalyticsEngine();

    // Check Wake Word Protocol
    const hasWakeWord = persona === 'ruhi'
      ? (lowerCmd.includes("হেই রুহি") || lowerCmd.includes("hey ruhi") || lowerCmd.includes("রুহি") || lowerCmd.includes("ruhi"))
      : (lowerCmd.includes("হেই হাবিব") || lowerCmd.includes("hey habib") || lowerCmd.includes("হাবিব") || lowerCmd.includes("habib"));

    if (!hasWakeWord) {
      const wakeMsg = language === 'bn' 
        ? `অনুগ্রহ করে আমাকে সাহায্য করার আগে আমার নাম ধরে ডাকুন, যেমন: '${wakeWordBn}'।` 
        : `Please call me by my name before I can help, e.g., '${wakeWordEn}'.`;
      setHistory(prev => [...prev, { role: 'assistant', text: wakeMsg }]);
      speak(wakeMsg);
      return;
    }

    // 1. Top Selling Products Analytics
    if (lowerCmd.includes("বেশি বিক্রি") || lowerCmd.includes("টপ বিক্রি") || lowerCmd.includes("টপ প্রোডাক্ট") || lowerCmd.includes("সর্বোচ্চ বিক্রি") || lowerCmd.includes("best selling")) {
      const period = (lowerCmd.includes("আজ") || lowerCmd.includes("today")) ? 'today' : (lowerCmd.includes("মাস") || lowerCmd.includes("month")) ? 'month' : 'week';
      const periodName = period === 'today' ? 'আজকের' : (period === 'month' ? 'এই মাসের' : 'গত ১ সপ্তাহের');
      const topItems = analytics.getTopSelling(period, 4);
      if (topItems.length === 0) {
        offlineFeedback = language === 'bn'
          ? `${periodName} কোনো বিক্রির রেকর্ড পাওয়া যায়নি।`
          : `No sales record found for ${period}.`;
      } else {
        const listStr = topItems.map((item, idx) => `${idx + 1}. ${item.name} (${item.quantity} ${item.unit || 'টি'}, মোট ${item.revenue.toLocaleString()} টাকা)`).join('; ');
        offlineFeedback = language === 'bn'
          ? `${periodName} সবচেয়ে বেশি বিক্রি হওয়া পণ্যগুলো হলো: ${listStr}।`
          : `Top selling items for ${period}: ${listStr}.`;
      }
      offlineHandled = true;
    }

    // 2. Most Profitable Products Analytics
    if (!offlineHandled && (lowerCmd.includes("লাভ") || lowerCmd.includes("প্রফিট") || lowerCmd.includes("profit") || lowerCmd.includes("লাভজনক"))) {
      const period = (lowerCmd.includes("আজ") || lowerCmd.includes("today")) ? 'today' : (lowerCmd.includes("মাস") || lowerCmd.includes("month")) ? 'month' : 'week';
      const periodName = period === 'today' ? 'আজকের' : (period === 'month' ? 'এই মাসের' : 'গত ১ সপ্তাহের');
      const profitableItems = analytics.getMostProfitable(period, 4);
      if (profitableItems.length === 0) {
        offlineFeedback = language === 'bn'
          ? `${periodName} কোনো লাভের রেকর্ড পাওয়া যায়নি।`
          : `No profit records found for ${period}.`;
      } else {
        const listStr = profitableItems.map((item, idx) => `${idx + 1}. ${item.name} (আনুমানিক লাভ ${item.profit.toLocaleString()} টাকা)`).join('; ');
        offlineFeedback = language === 'bn'
          ? `${periodName} সবচেয়ে বেশি লাভ এসেছে: ${listStr}।`
          : `Most profitable items for ${period}: ${listStr}.`;
      }
      offlineHandled = true;
    }

    // 3. Cash vs Due Financial Breakdown
    if (!offlineHandled && (lowerCmd.includes("ক্যাশ") || lowerCmd.includes("বাকি কত") || lowerCmd.includes("আজকের বাকি") || lowerCmd.includes("আর্থিক") || lowerCmd.includes("হিসাব"))) {
      const fin = analytics.getFinancialBreakdown();
      offlineFeedback = language === 'bn'
        ? `আজকের মোট সেল ${fin.today.total.toLocaleString()} টাকা (ক্যাশ জমা ${fin.today.cash.toLocaleString()} টাকা, বকেয়া ${fin.today.due.toLocaleString()} টাকা)। এই মাসের মোট সেল ${fin.month.total.toLocaleString()} টাকা (ক্যাশ ${fin.month.cash.toLocaleString()} টাকা, বকেয়া ${fin.month.due.toLocaleString()} টাকা)।`
        : `Today's total sales ${fin.today.total.toLocaleString()} (Cash: ${fin.today.cash.toLocaleString()}, Due: ${fin.today.due.toLocaleString()}). This month's total: ${fin.month.total.toLocaleString()}.`;
      offlineHandled = true;
    }

    // 4. Inactive Customers Query
    if (!offlineHandled && (lowerCmd.includes("দোকানে আসেনি") || lowerCmd.includes("আসেনি") || lowerCmd.includes("নিষ্ক্রিয়") || lowerCmd.includes("inactive") || lowerCmd.includes("আসে না"))) {
      const days = lowerCmd.includes("মাস") ? 30 : 7;
      const inactiveList = analytics.getInactiveCustomers(days);
      if (inactiveList.length === 0) {
        offlineFeedback = language === 'bn'
          ? `গত ${days} দিনে আপনার সকল কাস্টমার দোকানে সক্রিয় ছিলেন!`
          : `All customers were active in the last ${days} days!`;
      } else {
        const names = inactiveList.slice(0, 4).map(c => `${c.name} (${c.daysInactive})`).join(', ');
        offlineFeedback = language === 'bn'
          ? `গত ${days} দিনে কেনাকাটা করেননি এমন ${inactiveList.length} জন কাস্টমার রয়েছেন। তাদের মধ্যে আছেন: ${names}। আপনি চাইলে তাদের হোয়াটসঅ্যাপে শুভেচ্ছা বা অফার পাঠাতে পারেন।`
          : `There are ${inactiveList.length} inactive customers in the last ${days} days: ${names}.`;
      }
      offlineHandled = true;
    }

    // 5. Restock / Low Stock Order Sheet
    if (!offlineHandled && (lowerCmd.includes("রিস্টক") || lowerCmd.includes("অর্ডার তালিকা") || lowerCmd.includes("মাল তুলতে হবে") || lowerCmd.includes("stock out") || lowerCmd.includes("মাল শেষ"))) {
      const restockList = analytics.getRestockList(5);
      if (restockList.length === 0) {
        offlineFeedback = language === 'bn'
          ? `ইনভেন্টরিতে পর্যাপ্ত স্টক আছে। বর্তমানে কোনো প্রোডাক্ট রিস্টক করার প্রয়োজন নেই।`
          : `Stock levels are healthy. No items need immediate restocking.`;
      } else {
        const itemsStr = restockList.slice(0, 4).map(i => `${i.name} (বর্তমান স্টক: ${i.stock} ${i.unit}, অর্ডার: ${i.suggestedOrder} ${i.unit})`).join('; ');
        offlineFeedback = language === 'bn'
          ? `জরুরি রিস্টক করার জন্য ${restockList.length} টি পণ্য পাওয়া গেছে: ${itemsStr}।`
          : `Restock needed for ${restockList.length} products: ${itemsStr}.`;
      }
      offlineHandled = true;
    }

    // 6. Top Customer Dues
    if (!offlineHandled && (lowerCmd.includes("কার কার কাছে বাকি") || lowerCmd.includes("বেশি বকেয়া") || lowerCmd.includes("বকেয়া তালিকা") || lowerCmd.includes("টপ বকেয়া"))) {
      const topDues = analytics.getTopDueCustomers(5);
      if (topDues.length === 0) {
        offlineFeedback = language === 'bn' ? `দোকানের কারও কাছে কোনো বকেয়া নেই!` : `There are no outstanding customer dues!`;
      } else {
        const duesStr = topDues.map((c, idx) => `${idx + 1}. ${c.name} (${c.due.toLocaleString()} টাকা)`).join('; ');
        offlineFeedback = language === 'bn'
          ? `সবচেয়ে বেশি বকেয়া থাকা কাস্টমাররা হলেন: ${duesStr}।`
          : `Top due customers: ${duesStr}.`;
      }
      offlineHandled = true;
    }

    // 7. Customer Last Transaction
    if (!offlineHandled && (lowerCmd.includes("শেষ কেনাকাটা") || lowerCmd.includes("শেষ লেনদেন") || lowerCmd.includes("কবে কিনেছিল") || lowerCmd.includes("লাস্ট সেল"))) {
      let word = lowerCmd.replace(/(শেষ|কেনাকাটা|লেনদেন|কবে|কিনেছিল|লাস্ট|সেল|হিসাব|হাবিব|রুহি|হেই|hey|habib|ruhi|এর)/g, "").trim();
      if (word.length >= 2) {
        const trans = analytics.getCustomerLastTransaction(word);
        if (trans && trans.customer) {
          if (trans.lastSale) {
            const dateFormatted = new Date(trans.lastSale.date).toLocaleDateString('bn-BD');
            const itemsList = (trans.lastSale.items || []).map((i: any) => `${i.productName || i.name} (${i.quantity} ${i.unit || 'টি'})`).join(', ');
            offlineFeedback = language === 'bn'
              ? `${trans.customer.name} এর শেষ কেনাকাটা ছিল ${dateFormatted} তারিখে। কিনেছিলেন: ${itemsList}। মোট বিল ছিল ${trans.lastSale.totalAmount || trans.lastSale.finalAmount || 0} টাকা এবং বর্তমান বকেয়া ${trans.customer.currentDue || trans.customer.totalUnpaid || 0} টাকা।`
              : `${trans.customer.name}'s last transaction was on ${dateFormatted}. Total bill was ${trans.lastSale.totalAmount}. Current due: ${trans.customer.currentDue || 0}.`;
          } else {
            offlineFeedback = language === 'bn'
              ? `${trans.customer.name} কাস্টমার লিস্টে আছেন, তবে কোনো আগের কেনাকাটা রেকর্ড নেই। বর্তমান বকেয়া: ${trans.customer.currentDue || 0} টাকা।`
              : `${trans.customer.name} is in the system with no recorded sales history. Due: ${trans.customer.currentDue || 0}.`;
          }
          offlineHandled = true;
        }
      }
    }

    // 8. Single Customer Due / Balance
    if (!offlineHandled && (lowerCmd.includes("বকেয়া") || lowerCmd.includes("বাকি") || lowerCmd.includes("due") || lowerCmd.includes("unpaid"))) {
      let word = lowerCmd.replace(/(বকেয়া|বাকি|কত|টাকা|পায়|due|unpaid|কার|হাবিব|রুহি|হেই|hey|habib|ruhi)/g, "").trim();
      if (word.length > 1) {
        const matchedCust = systemData.customers.find((c: any) => 
          c.name.toLowerCase().includes(word) || c.phone.includes(word)
        );
        if (matchedCust) {
          const due = matchedCust.currentDue || matchedCust.totalUnpaid || 0;
          offlineFeedback = language === 'bn'
            ? `${matchedCust.name} এর কাছে আপনার বকেয়া পাওনা আছে ${due} টাকা।`
            : `${matchedCust.name} has a due balance of ${due} ${systemData.settings.currency || '৳'}.`;
          offlineHandled = true;
        }
      }
    }

    // 9. Stock / Inventory inquiry with Retail + Wholesale/Cost price
    if (!offlineHandled && (lowerCmd.includes("স্টক") || lowerCmd.includes("stock") || lowerCmd.includes("কতটুকু আছে") || lowerCmd.includes("কত কেজি") || lowerCmd.includes("কত বস্তা") || lowerCmd.includes("সিরিয়াল") || lowerCmd.includes("নম্বর") || lowerCmd.includes("দাম কত") || lowerCmd.includes("পাইকারি"))) {
      let word = lowerCmd.replace(/(স্টক|stock|কতটুকু|আছে|কত|কেজি|বস্তা|হাবিব|রুহি|হেই|hey|habib|ruhi|সিরিয়াল|নম্বর|নম্বরে|কি|প্রোডাক্ট|দাম|দর|পাইকারি|খুচরা)/g, "").trim();
      if (word.length >= 1) {
        const matchedItem = fuzzyMatchProduct(systemData.items, word);
        if (matchedItem) {
          const idx = systemData.items.findIndex((i: any) => i.id === matchedItem.id) + 1;
          const serialNo = matchedItem.serialNumber || idx;
          const costInfo = matchedItem.costPrice || matchedItem.purchasePrice || matchedItem.wholesalePrice
            ? ` (পাইকারি/ক্রয় মূল্য ${matchedItem.costPrice || matchedItem.purchasePrice || matchedItem.wholesalePrice} টাকা)`
            : '';
          offlineFeedback = language === 'bn'
            ? `${matchedItem.name} (সিরিয়াল #${serialNo}) এর বিক্রয় মূল্য ${matchedItem.price} টাকা${costInfo} এবং বর্তমান স্টক আছে ${matchedItem.stock} ${matchedItem.unit || 'টি'}।`
            : `${matchedItem.name} (Serial #${serialNo}) price is ${matchedItem.price}${costInfo} and stock is ${matchedItem.stock} ${matchedItem.unit || 'units'}.`;
          offlineHandled = true;
        }
      }
    }

    // 10. Print Latest Invoice
    if (!offlineHandled && (lowerCmd.includes("প্রিন্ট") || lowerCmd.includes("print") || lowerCmd.includes("রসিদ") || lowerCmd.includes("মেমো"))) {
      actions.printLatestInvoice();
      offlineFeedback = language === 'bn'
        ? `শেষ চালানটি প্রিন্ট করা হচ্ছে।`
        : `Printing the latest invoice.`;
      offlineHandled = true;
    }

    // 11. WhatsApp Invoice
    if (!offlineHandled && (lowerCmd.includes("হোয়াটসঅ্যাপ") || lowerCmd.includes("whatsapp") || lowerCmd.includes("মেসেজ পাঠাও") || lowerCmd.includes("ইনভয়েস পাঠাও"))) {
      if (actions.sendLatestInvoiceWhatsApp) {
        actions.sendLatestInvoiceWhatsApp();
        offlineFeedback = language === 'bn'
          ? `শেষ ইনভয়েসটি হোয়াটসঅ্যাপে পাঠানো হচ্ছে।`
          : `Sending the latest invoice via WhatsApp.`;
        offlineHandled = true;
      }
    }

    // 12. Navigation
    if (!offlineHandled && (lowerCmd.includes("যাও") || lowerCmd.includes("চল") || lowerCmd.includes("খোল") || lowerCmd.includes("navigate") || lowerCmd.includes("open"))) {
      let dest = "";
      if (lowerCmd.includes("ইনভেন্টরি") || lowerCmd.includes("স্টক") || lowerCmd.includes("inventory") || lowerCmd.includes("product")) dest = "inventory";
      else if (lowerCmd.includes("সেল") || lowerCmd.includes("pos") || lowerCmd.includes("invoice") || lowerCmd.includes("point")) dest = "pos";
      else if (lowerCmd.includes("কাস্টমার") || lowerCmd.includes("customer")) dest = "customers";
      else if (lowerCmd.includes("রিপোর্ট") || lowerCmd.includes("report")) dest = "reports";
      else if (lowerCmd.includes("সেটিং") || lowerCmd.includes("setting")) dest = "settings";
      else if (lowerCmd.includes("ড্যাশবোর্ড") || lowerCmd.includes("dashboard")) dest = "dashboard";
      
      if (dest) {
        actions.navigate(dest);
        offlineFeedback = language === 'bn'
          ? `আপনাকে সেই প্যানেলে নিয়ে যাওয়া হচ্ছে।`
          : `Navigating to the requested panel.`;
        onClose();
        offlineHandled = true;
      }
    }

    // 13. General Friendly Greeting / Fallback
    if (!offlineHandled) {
      if (lowerCmd.includes("কেমন আছো") || lowerCmd.includes("how are you")) {
        offlineFeedback = language === 'bn'
          ? `আমি ভালো আছি! আমি ${assistantName}, ${storeName} এর সব হিসাব ও বিক্রিতে সাহায্য করতে প্রস্তুত।`
          : `I am doing well! I am ${assistantNameEn}, ready to assist with ${storeName}.`;
      } else {
        offlineFeedback = language === 'bn'
          ? `জ্বি বলুন, আমি শুনছি। আপনি পণ্যের স্টক ও দাম, সবচেয়ে বেশি বিক্রি হওয়া পণ্য, বেশি লাভের হিসাব, বকেয়া বা চালান প্রিন্ট করতে বলতে পারেন।`
          : `Yes, I am listening. You can ask for product stock, top selling items, profit analytics, customer dues, or print invoices.`;
      }
    }

    setHistory(prev => [...prev, { role: 'assistant', text: offlineFeedback }]);
    speak(offlineFeedback);
  };

  const handleVoiceCommand = async (command: string) => {
    if (!command.trim()) return;
    
    setTranscript('');
    setHistory(prev => [...prev, { role: 'user', text: command }]);
    setIsProcessing(true);

    // Define tool declarations for Jarvis
    const tools: any[] = [
      {
        name: "addProduct",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Name of the product in Bengali or English" },
            price: { type: "NUMBER", description: "Price of the product" },
            stock: { type: "NUMBER", description: "Initial stock quantity" },
            category: { type: "STRING", description: "Category name" }
          },
          required: ["name", "price", "stock"]
        }
      },
      {
        name: "checkInventory",
        parameters: {
          type: "OBJECT",
          properties: {
            productName: { type: "STRING", description: "Name of the product to check" }
          }
        }
      },
      {
        name: "addSale",
        parameters: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  productName: { type: "STRING", description: "Name of the product being sold" },
                  quantity: { type: "NUMBER", description: "Quantity sold" }
                }
              }
            },
            customerPhone: { type: "STRING", description: "Optional customer phone number" }
          }
        }
      },
      {
        name: "addCustomer",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Customer Name" },
            phone: { type: "STRING", description: "Customer Phone Number" },
            address: { type: "STRING", description: "Customer Address" }
          },
          required: ["name", "phone"]
        }
      },
      {
        name: "checkCustomer",
        parameters: {
          type: "OBJECT",
          properties: {
            phoneOrName: { type: "STRING", description: "Customer Name or Phone Number to search for" }
          }
        }
      },
      {
        name: "removeProduct",
        parameters: {
          type: "OBJECT",
          properties: {
            productName: { type: "STRING", description: "Name of the product to remove" }
          },
          required: ["productName"]
        }
      },
      {
        name: "getSystemSummary",
        parameters: {
          type: "OBJECT",
          properties: {}
        }
      },
      {
        name: "updateProduct",
        parameters: {
          type: "OBJECT",
          properties: {
            productName: { type: "STRING", description: "Name of the product to update" },
            price: { type: "NUMBER", description: "New price of the product" },
            stock: { type: "NUMBER", description: "New stock amount" }
          },
          required: ["productName"]
        }
      },
      {
        name: "removeCustomer",
        parameters: {
          type: "OBJECT",
          properties: {
            phoneOrName: { type: "STRING", description: "Customer Name or Phone to remove" }
          },
          required: ["phoneOrName"]
        }
      },
      {
        name: "prepareInvoice",
        description: "Open Point of Sale and add items to cart",
        parameters: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  productName: { type: "STRING" },
                  quantity: { type: "NUMBER" }
                }
              }
            }
          }
        }
      },
      {
        name: "navigateApp",
        description: "Navigate to a specific part of the app (dashboard, inventory, sales, customers, reports, settings, pos)",
        parameters: {
          type: "OBJECT",
          properties: {
            destination: { type: "STRING" }
          },
          required: ["destination"]
        }
      },
      {
        name: "updateSettings",
        description: "Modify the shop settings (e.g. language, vat rate, currency, shop name)",
        parameters: {
          type: "OBJECT",
          properties: {
            shopName: { type: "STRING", description: "Shop name" },
            currency: { type: "STRING", description: "Currency symbol, e.g. ৳ or $" },
            taxRate: { type: "NUMBER", description: "Tax / VAT rate percentage" }
          }
        }
      },
      {
        name: "sendCustomerReminder",
        description: "Send a due payment reminder to a customer via WhatsApp",
        parameters: {
          type: "OBJECT",
          properties: {
            phoneOrName: { type: "STRING", description: "Customer Name or Phone to send reminder to" }
          },
          required: ["phoneOrName"]
        }
      },
      {
        name: "checkLowStock",
        description: "Get a list of products that are currently out of stock or have low stock",
        parameters: {
          type: "OBJECT",
          properties: {}
        }
      },
      {
        name: "checkCustomerDue",
        description: "Check the total unpaid due amount of a specific customer",
        parameters: {
          type: "OBJECT",
          properties: {
            phoneOrName: { type: "STRING", description: "Customer Name or Phone" }
          },
          required: ["phoneOrName"]
        }
      },
      {
        name: "createDirectSale",
        description: "Create a completed sale directly without going to Point of Sale. Very important for immediate sales. Use this when user says exactly what is sold.",
        parameters: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  productName: { type: "STRING" },
                  quantity: { type: "NUMBER" }
                }
              }
            },
            customerPhoneOrName: { type: "STRING", description: "Customer Phone or Name if existing customer. Empty if walk-in / retail." },
            paidAmount: { type: "NUMBER", description: "Amount paid by customer. If missing, assume full payment for retail." },
            printInvoice: { type: "BOOLEAN", description: "Whether to print the invoice immediately." },
            sendWhatsApp: { type: "BOOLEAN", description: "Whether to send the invoice via WhatsApp to the customer." }
          },
          required: ["items"]
        }
      },
      {
        name: "printLatestInvoice",
        description: "Print the latest invoice / receipt",
        parameters: {
          type: "OBJECT",
          properties: {}
        }
      },
      {
        name: "sendLatestInvoiceWhatsApp",
        description: "Send the most recently created invoice to the customer via WhatsApp. Use this when the user says 'Yes' after being asked if they want to send it.",
        parameters: {
          type: "OBJECT",
          properties: {}
        }
      },
      {
        name: "getSalesSummary",
        description: "Get a summary of sales for a specific period (today, week, month)",
        parameters: {
          type: "OBJECT",
          properties: {
            period: { type: "STRING", enum: ["today", "week", "month"], description: "The time period for sales summary" }
          },
          required: ["period"]
        }
      },
      {
        name: "getCustomerDetails",
        description: "Get detailed history and balance for a specific customer",
        parameters: {
          type: "OBJECT",
          properties: {
            phoneOrName: { type: "STRING", description: "Customer name or phone" }
          },
          required: ["phoneOrName"]
        }
      },
      {
        name: "getTopSellingProducts",
        description: "Get the top selling products based on real database sales history for a specific period (today, week, month)",
        parameters: {
          type: "OBJECT",
          properties: {
            period: { type: "STRING", enum: ["today", "week", "month"], description: "Period: today, week (last 7 days), or month (last 30 days)" },
            limit: { type: "NUMBER", description: "Number of top products to return (default 5)" }
          }
        }
      },
      {
        name: "getMostProfitableProducts",
        description: "Analyze sales and profit margins to find the most profitable products for a given period",
        parameters: {
          type: "OBJECT",
          properties: {
            period: { type: "STRING", enum: ["today", "week", "month"], description: "Period: today, week, or month" },
            limit: { type: "NUMBER", description: "Number of profitable products to return (default 5)" }
          }
        }
      },
      {
        name: "getFinancialBreakdown",
        description: "Get detailed financial analytics: Cash collected vs Due/Credit sales for today and this month",
        parameters: {
          type: "OBJECT",
          properties: {}
        }
      },
      {
        name: "getTopDueCustomers",
        description: "Get the list of customers with highest unpaid due balance",
        parameters: {
          type: "OBJECT",
          properties: {
            limit: { type: "NUMBER", description: "Number of due customers to return (default 5)" }
          }
        }
      },
      {
        name: "getInactiveCustomers",
        description: "Get list of customers who haven't visited or purchased in a given number of days (e.g. 7 or 30 days)",
        parameters: {
          type: "OBJECT",
          properties: {
            days: { type: "NUMBER", description: "Inactivity threshold in days (e.g. 7 or 30)" }
          }
        }
      },
      {
        name: "getCustomerLastTransaction",
        description: "Get the exact last purchase date, items bought, bill total, and due for a specific customer",
        parameters: {
          type: "OBJECT",
          properties: {
            phoneOrName: { type: "STRING", description: "Customer name or phone number" }
          },
          required: ["phoneOrName"]
        }
      },
      {
        name: "getRestockList",
        description: "Get low stock products and recommended reorder quantities for restocking",
        parameters: {
          type: "OBJECT",
          properties: {
            threshold: { type: "NUMBER", description: "Stock threshold level (default 5)" }
          }
        }
      }
    ];

    try {
      console.log("Processing command:", command, "Language:", language, "Voice Gender:", voiceGender);

      // Categorized Enterprise Long-term Memory Compilation
      const businessRulesList = (memories || []).filter(m => m.category === 'business_rules' || !m.category);
      const vipPrefsList = (memories || []).filter(m => m.category === 'vip_preferences' || m.category === 'customer_preference');
      const discountsList = (memories || []).filter(m => m.category === 'discounts_offers');
      const shopInfoList = (memories || []).filter(m => m.category === 'shop_info' || m.category === 'general_context');

      let customMemoriesString = "## 1. STORE BUSINESS RULES & POLICIES (দোকানের নীতিমালা):\n";
      customMemoriesString += businessRulesList.length > 0 
        ? businessRulesList.map(m => `- [RULE]: ${m.text}`).join('\n') 
        : "- No specific custom rules added.";

      customMemoriesString += "\n\n## 2. VIP CUSTOMER PREFERENCES & PRIORITIES (ভিআইপি কাস্টমার অগ্রাধিকার):\n";
      customMemoriesString += vipPrefsList.length > 0 
        ? vipPrefsList.map(m => `- [VIP PREFERENCE]: ${m.text}`).join('\n') 
        : "- Regular customer protocols apply.";

      customMemoriesString += "\n\n## 3. SPECIAL DISCOUNTS & OFFERS POLICY (বিশেষ ছাড় ও অফার পলিসি):\n";
      customMemoriesString += discountsList.length > 0 
        ? discountsList.map(m => `- [OFFER POLICY]: ${m.text}`).join('\n') 
        : "- Standard pricing and normal discount protocols.";

      if (shopInfoList.length > 0) {
        customMemoriesString += "\n\n## 4. GENERAL STORE CONTEXT & TIMINGS (সাধারণ তথ্য):\n";
        customMemoriesString += shopInfoList.map(m => `- [INFO]: ${m.text}`).join('\n');
      }

      // Compile pronunciation/slang synonyms
      const customSynonymsString = synonyms && synonyms.length > 0
        ? synonyms.map(s => `- Speaking "${s.spokenWord}" refers to product/inventory: "${s.actualProductName}"`).join('\n')
        : "No custom mappings stored yet.";

      // Determine personality instruction override
      let personalityBlock = "You are a professional shop manager assistant. You are extremely helpful, humble, and polite.";
      if (aiSettings?.personality === 'strict') {
        personalityBlock = "You are a strict, precise accountant & manager who is extremely firm, short, and highly accurate with financial numbers. No extra greetings.";
      } else if (aiSettings?.personality === 'friendly') {
        personalityBlock = "You are an incredibly warm, enthusiastic, and friendly shop assistant. Make the user feel relaxed, comfortable, and speak with high warmth.";
      } else if (aiSettings?.personality === 'professional') {
        personalityBlock = "You are a highly polished corporate assistant: formal, polite, objective, and clear.";
      }

      // Character Persona Directives (Habib vs Ruhi)
      let personaBlock = "";
      if (persona === 'habib') {
        personaBlock = `
        # PERSONA PROFILE: HABIB (হাবিব)
        - ROLE: প্রধান ব্যবসায়িক উপদেষ্টা ও স্টোর ম্যানেজার (Chief Business Advisor & Store Manager).
        - PERSONALITY: আত্মবিশ্বাসী, বাস্তবমুখী, দূরদর্শী ও অত্যন্ত গোছানো।
        - COMMUNICATION STYLE: মানুষের মতো বাস্তবসম্মত পুরুষ কণ্ঠে কথা বলুন। আপনি দোকানের হিসাব, স্টক-বিক্রি, বকেয়া এবং লাভ-লোকসানের গভীর অ্যানালাইসিস সরাসরি ও নির্ভুলভাবে বুঝিয়ে বলেন।
        - MANNERISMS: স্পষ্ট, গোছানো এবং প্রফেশনাল অভিব্যক্তি (যেমন: "আসসালামু আলাইকুম, আমি হাবিব...", "আপনার ব্যবসার ডেটা অনুযায়ী...", "হিসাব সম্পূর্ণ নির্ভুল আছে")।
        `;
      } else {
        personaBlock = `
        # PERSONA PROFILE: RUHI (রুহি)
        - ROLE: স্মার্ট কাস্টমার রিলেশনস ও ইনভেন্টরি স্পেশালিস্ট (Customer Relations & Inventory Specialist).
        - PERSONALITY: অত্যন্ত মিষ্টি, নম্র, সহানুভূতিশীল, দায়িত্বশীল ও চটপটে।
        - COMMUNICATION STYLE: মানুষের মতো চমৎকার, মিষ্ট ও সাবলীল নারী কণ্ঠে কথা বলুন। কাস্টমার সার্ভিস, বকেয়া তাগাদা, পণ্যের খোঁজ এবং দৈনন্দিন সমস্যার ঝটপট মিষ্টি সমাধান দিন।
        - MANNERISMS: বিনম্র ও আন্তরিক অভিব্যক্তি (যেমন: "আসসালামু আলাইকুম! আমি রুহি...", "আমি এক্ষুনি আপনার কাজটি করে দিচ্ছি", "কাস্টমারের বকেয়ার তালিকা তৈরি করেছি")।
        `;
      }

      // Read custom greeting override
      const customGreetingBlock = aiSettings?.customGreeting 
        ? `Additionally, whenever greeting the user or initiating chat, you should align with this custom style preference: "${aiSettings.customGreeting}"`
        : "";

      // Smart Capability Switches from Settings
      const enableStoreDb = aiSettings?.enableStoreDb !== false;
      const enableGoogleSearch = aiSettings?.enableGoogleSearch !== false;
      const enableGoogleMaps = aiSettings?.enableGoogleMaps !== false;
      const enableWhatsAppAction = aiSettings?.enableWhatsAppAction !== false;
      const enablePrintAction = aiSettings?.enablePrintAction !== false;

      // Filter active function tools based on toggles
      const activeTools = tools.filter((tool: any) => {
        const name = tool.name;
        if (!enableStoreDb) {
          const dbTools = [
            'checkInventory', 'addProduct', 'updateProduct', 'removeProduct', 
            'checkCustomer', 'addCustomer', 'removeCustomer', 'getSystemSummary', 
            'getSalesSummary', 'getCustomerDetails', 'getTopSellingProducts', 
            'getMostProfitableProducts', 'getFinancialBreakdown', 'getTopDueCustomers', 
            'getInactiveCustomers', 'getCustomerLastTransaction', 'getRestockList', 
            'checkLowStock', 'checkCustomerDue'
          ];
          if (dbTools.includes(name)) return false;
        }
        if (!enableWhatsAppAction) {
          if (name === 'sendCustomerReminder' || name === 'sendLatestInvoiceWhatsApp') return false;
        }
        if (!enablePrintAction) {
          if (name === 'printLatestInvoice') return false;
        }
        return true;
      });

      // Construct hybrid tools payload (Function Declarations + Google Search Grounding)
      const toolsPayload: any[] = [];
      if (activeTools.length > 0) {
        toolsPayload.push({ functionDeclarations: activeTools });
      }
      if (enableGoogleSearch || enableGoogleMaps) {
        toolsPayload.push({ googleSearch: {} });
      }

      const responseFetch = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: command,
          systemInstruction: `You are ${assistantName}, the dedicated AI Business Assistant and Manager for ${storeName}. 

          # CRITICAL WAKE-WORD PROTOCOL (STRICT MANDATE):
          - You must ONLY process the request, answer questions, or execute actions IF the user's prompt explicitly starts with or contains "${wakeWordBn}", "${wakeWordEn}", or "${assistantName}" (case-insensitive).
          - If the user DOES NOT mention this exact name/wake-word, you MUST NOT execute their command, check any stock, or provide any answer. Instead, STRICTLY reply with: "অনুগ্রহ করে আমাকে সাহায্য করার আগে আমার নাম ধরে ডাকুন, যেমন: '${wakeWordBn}'।" (or in English if the language is English: "Please call me by my name before I can help, e.g., '${wakeWordEn}'"). DO NOT process the rest of their request.

          # CRITICAL LANGUAGE PROTOCOL:
          - CURRENT LANGUAGE SETTING: ${language === 'bn' ? 'BENGALI (বাংলা)' : 'ENGLISH'}.
          - If the setting is 'bn', you MUST ONLY output text in BENGALI script.
          - ইউজার আপনার সাথে যেভাবে কথা বলছে, আপনিও ঠিক সেভাবে মানুষের মতো রিঅ্যাক্ট করবেন। রোবোটিক বা কৃত্রিমতা পরিহার করবেন। ছোট ও প্রাণবন্ত বাক্য ব্যবহার করবেন।
          - EVEN IF the user speaks to you in English, if the setting is 'bn', you MUST respond in BENGALI.
          - ABSOLUTELY NO English sentences or phrases (except product names).
          
          # ACTIVE CAPABILITY & PERMISSION CONTROLS:
          - Store Database Access: ${enableStoreDb ? 'ENABLED (Full access to inventory, sales, dues & financials)' : 'DISABLED (Do NOT query or update database)'}
          - Google Live Search Grounding: ${enableGoogleSearch ? 'ENABLED (Search real-time market prices e.g. soybean oil, rice, dal, sugar, live news, weather)' : 'DISABLED'}
          - Google Maps & Area Intelligence: ${enableGoogleMaps ? 'ENABLED (Search locations, wholesale markets/mokam, logistics)' : 'DISABLED'}
          - WhatsApp Message Actions: ${enableWhatsAppAction ? 'ENABLED' : 'DISABLED'}
          - Thermal / Invoice Print Actions: ${enablePrintAction ? 'ENABLED' : 'DISABLED'}

          # LIVE SEARCH & REAL-TIME GROUNDING INTELLIGENCE:
          ${(enableGoogleSearch || enableGoogleMaps) ? `
          - If the user asks about real-time market commodity prices (যেমন: আজকের সয়াবিন তেলের লিটার প্রতি দাম, খোলা ও বোতলজাত তেল, মিনিকেট/নাজিরশাইল চাল, মসুর ডাল, চিনি, পেঁয়াজ, ডিম, আলু, ব্রয়লার মুরগি), বর্তমান দেশের খবর, আবহাওয়া, বা এলাকাভিত্তিক পাইকারি মোকাম/মার্কেটের তথ্য, Google Search Grounding ব্যবহার করে আপ-টু-ডেট সঠিক তথ্য বাংলায় দিন।
          - তথ্যের সোর্স বা নির্ভরযোগ্যতা বজায় রেখে পরিষ্কার ও মার্জিত ভাষায় উত্তর দিন।` : ''}

          # ACTIVE PERSONA & CHARACTER TRAITS:
          ${personaBlock}
          ${personalityBlock}
          ${customGreetingBlock}
          
          # DATABASE RAG CONTEXT (Real-Time System Data):
          - Total Products in Inventory: ${systemData.items.length}
          - Total Customers: ${systemData.customers.length}
          - Today's Revenue: ${todayRevenue} Taka
          - Low Stock Products (<=5): ${systemData.items.filter((i:any) => i.stock <= 5).slice(0, 5).map((i:any) => i.name).join(', ')}

          # COGNITIVE MEMORY SYSTEM (DYNAMICALLY LEARNED FROM MEMORY CORE):
          You have access to the business rules and facts below. Strictly comply with them as if they are hardcoded laws:
          ${customMemoriesString}

          # PHONETIC PRONUNCIATION SYNONYMS:
          The user might use local Bengali/slang spoken words which map to actual inventory items. Keep these in mind:
          ${customSynonymsString}
          
          # NO REDIRECTION / SILENT PERFORMANCE PROTOCOL:
          - Do NOT automatically use 'navigateApp' to switch tabs or close the assistant panel when checking stock, adding sales, adding products, or checking details. Keep the user on their active view.
          - Only use 'navigateApp' if the user explicitly/literally asks to change screens (e.g., "আমাকে ইনভেন্টরি পেজে নিয়ে যাও" or "রিপোর্ট প্যানেলে যাও"). Otherwise, do everything SILENTLY through the appropriate calls without moving them.
          
          # DIRECT SALE PROTOCOL:
          If the user provides items (e.g., '${assistantName} ১০ কেজি ময়দা আর ৫ কেজি আলু, ৫০০ টাকা জমা'):
          1. MAP the products to the inventory. If they say "ময়দা", search for "flour".
          2. Use 'createDirectSale' IMMEDIATELY.
          3. Confirm: "৫ কেজি আলু আর ১০ কেজি ময়দার সেল অ্যাড করা হয়েছে। টোটাল বিল হয়েছে... টাকা, জমা... টাকা, বকেয়া... টাকা।"
          4. ASK: "আমি কি ইনভয়েসটি হোয়াটসঅ্যাপে পাঠিয়ে দিবো?" (Should I send the invoice on WhatsApp?).
          5. If they say "Yes" or "পাঠিয়ে দাও", use 'sendLatestInvoiceWhatsApp'.
          
          # ACCESS & KNOWLEDGE:
          - You have full access to database (Inventory, Customers, Sales).
          - If they ask for sales summary (today, week, month), use 'getSalesSummary'.
          - If they ask about a customer's history/dues, use 'getCustomerDetails'.
          
          # SERIAL NUMBERS & STOCK POSITIONS:
          - If the user asks about a serial number/index (e.g., "১১ নম্বর সিরিয়ালে কি প্রোডাক্ট আছে", "১২ নম্বর কি", "১১ নম্বরে কি প্রোডাক্ট"), use 'checkInventory' with the number as productName (e.g. productName: "11" or "১১").
          - If they ask for a product's serial number or stock (e.g., "ময়দা কত নম্বর সিরিয়াল" or "গমের ভুসি কত স্টক আছে"), use 'checkInventory' with the product name (e.g. productName: "ময়দা").
          - Always mention both the stock and the serial number/index in your response.
          
          # VOICE:
          - Continuous listening is ACTIVE. Talk like a real person.
          
          # FUNCTION USAGE:
          Execute tools when requested/implied and confirm in ${language === 'bn' ? 'বাংলা' : 'English'}.`,
          tools: toolsPayload,
          contents: [
            ...history.slice(-10).map(h => ({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: h.text }]
            })),
            { role: 'user', parts: [{ text: command }] }
          ],
          config: { model: "gemini-3.1-flash-lite" },
          apiProvider: aiSettings?.apiProvider || 'gemini',
          customApiKey: aiSettings?.geminiApiKey || undefined,
          openrouterApiKey: aiSettings?.openrouterApiKey || undefined,
          openrouterModel: aiSettings?.openrouterModel || 'deepseek/deepseek-chat',
        })
      });

      let data: any = null;
      try {
        data = await responseFetch.json();
      } catch {
        data = {};
      }

      if (!responseFetch.ok || data?.quotaExceeded || data?.offlineFallback || (!data?.text && !data?.functionCalls)) {
        console.warn('Handling voice command via offline database intelligence');
        executeOfflineIntelligence(command);
        setIsProcessing(false);
        return;
      }

      const text = data.text || "";
      const fCalls = data.functionCalls;
      let accumulatedSpeech = "";

      if (fCalls) {
        for (const call of fCalls) {
          if (call.name === 'addProduct') {
            const res = await actions.addItem({
              name: call.args.name,
              price: Number(call.args.price),
              stock: Number(call.args.stock),
              category: call.args.category || 'General',
              id: `p-${Date.now()}`
            });
            const feedback = language === 'bn' 
              ? `ঠিক আছে, আমি ${call.args.name} প্রোডাক্টটি যোগ করেছি। এর দাম ${call.args.price} টাকা।`
              : `Okay, I've added the product ${call.args.name} with price ${call.args.price}.`;
            setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
            accumulatedSpeech += feedback + " ";
          } else if (call.name === 'checkInventory') {
            const productName = String(call.args.productName || '');
            const item = fuzzyMatchProduct(systemData.items, productName);
            const idx = systemData.items.findIndex((i: any) => i.id === (item?.id || '')) + 1;
            const serialNo = item?.serialNumber || idx;
            const feedback = item 
              ? (language === 'bn' 
                  ? `${item.name} (সিরিয়াল নম্বর #${serialNo}) এর বর্তমান স্টক আছে ${item.stock} ${item.unit || 'টি'} এবং এটার দাম ${item.price} টাকা।`
                  : `${item.name} (Serial No. #${serialNo}) currently has ${item.stock} ${item.unit || 'units'} in stock with a price of ${item.price} ${systemData.settings.currency || '৳'}.`)
              : (language === 'bn' 
                  ? `দুঃখিত, আমি "${productName}" নামের কোনো প্রোডাক্ট খুঁজে পাইনি।` 
                  : `Sorry, I could not find product "${productName}".`);
            setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
            accumulatedSpeech += feedback + " ";
          } else if (call.name === 'addSale') {
            const items = (call.args.items as any[]) || [];
            if (items.length > 0) {
              actions.addToPOS(items);
              const feedback = language === 'bn' ? `পয়েন্ট অফ সেলে আপনার জন্য আইটেমগুলো যোগ করা হয়েছে।` : `I've opened the POS and added these items for you.`;
              setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
              accumulatedSpeech += feedback + " ";
              onClose(); 
            }
          } else if (call.name === 'addCustomer') {
             await actions.addCustomer({
               name: String(call.args.name),
               phone: String(call.args.phone),
               address: call.args.address ? String(call.args.address) : '',
               id: `c-${Date.now()}`,
               initialDue: 0,
               createdAt: new Date().toISOString()
             });
             const feedback = language === 'bn' 
              ? `কাস্টমার ${call.args.name} কে সিস্টেমে যোগ করা হয়েছে।`
              : `Customer ${call.args.name} has been added to the system.`;
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'checkCustomer') {
             const query = String(call.args.phoneOrName || '').toLowerCase();
             const c = systemData.customers.find((c: any) => 
                c.phone.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
             );
             if (c) {
               const feedback = language === 'bn'
                 ? `হ্যাঁ, কাস্টমার সিস্টেমে আছে। নাম: ${c.name}, ফোন: ${c.phone}, ঠিকানা: ${c.address || 'দেওয়া হয়নি'}।`
                 : `Yes, customer found. Name: ${c.name}, Phone: ${c.phone}, Address: ${c.address || 'Not provided'}.`;
               setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
               accumulatedSpeech += feedback + " ";
             } else {
               const feedback = language === 'bn' ? `দুঃখিত, কোনো কাস্টমার খুঁজে পাইনি।` : `Sorry, I couldn't find that customer.`;
               setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
               accumulatedSpeech += feedback + " ";
             }
          } else if (call.name === 'removeProduct') {
             const productName = String(call.args.productName || '');
             const item = systemData.items.find(i => 
               i.name.toLowerCase().includes(productName.toLowerCase())
             );
             if (item) {
               await actions.removeItem(item.id);
               const feedback = language === 'bn' 
                 ? `আমি ${item.name} প্রোডাক্টটি মুছে ফেলেছি।`
                 : `I have removed the product ${item.name}.`;
               setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
               accumulatedSpeech += feedback + " ";
             } else {
               const feedback = language === 'bn' 
                 ? `দুঃখিত, আমি "${productName}" নামের কোনো প্রোডাক্ট খুঁজে পাইনি।`
                 : `Sorry, I couldn't find the product "${productName}".`;
               setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
               accumulatedSpeech += feedback + " ";
             }
          } else if (call.name === 'getSystemSummary') {
            const todaySales = systemData.sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString());
            const totalRevenue = todaySales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
            let feedback = language === 'bn'
              ? `আজকের সারাংশ: মোট ${todaySales.length} টি সেল হয়েছে। মোট আয় হয়েছে ${totalRevenue.toLocaleString()} টাকা। ইনভেন্টরিতে এখন ${systemData.items.length} টি প্রোডাক্ট আছে।`
              : `Today's summary: Total ${todaySales.length} sales. Total revenue is ${totalRevenue.toLocaleString()}. There are ${systemData.items.length} products in inventory.`;
            
            if (isMasterAdmin && systemData.merchants) {
               const merchantCount = systemData.merchants.length;
               feedback += language === 'bn' 
                 ? ` এছাড়া আমাদের নেটওয়ার্কে বর্তমানে মোট ${merchantCount} জন মার্চেন্ট যুক্ত আছেন।`
                 : ` Additionally, there are a total of ${merchantCount} merchants in our network.`;
            }

            setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
            accumulatedSpeech += feedback + " ";
          } else if (call.name === 'updateProduct') {
            const productName = String(call.args.productName || '');
            const item = systemData.items.find(i => 
              i.name.toLowerCase().includes(productName.toLowerCase())
            );
            if (item) {
              const updates: any = {};
              if (call.args.price !== undefined) updates.price = Number(call.args.price);
              if (call.args.stock !== undefined) updates.stock = Number(call.args.stock);
              if (Object.keys(updates).length > 0) {
                 try {
                   await updateDoc(doc(db, "products", item.id), updates);
                   const feedback = language === 'bn' ? `${item.name} আপডেট করা হয়েছে।` : `${item.name} has been updated.`;
                   setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                   accumulatedSpeech += feedback + " ";
                 } catch (e) {
                   handleFirestoreError(e, OperationType.UPDATE, `products/${item.id}`);
                 }
              }
            } else {
               const feedback = language === 'bn' ? `দুঃখিত, কোনো প্রোডাক্ট খুঁজে পাইনি।` : `Sorry, I couldn't find the product.`;
               setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
               accumulatedSpeech += feedback + " ";
            }
          } else if (call.name === 'removeCustomer') {
            const query = String(call.args.phoneOrName || '').toLowerCase();
            const c = systemData.customers.find((c: any) => 
               c.phone.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
            );
            if (c) {
               try {
                 await deleteDoc(doc(db, "customers", c.id));
                 const feedback = language === 'bn' ? `${c.name} কাস্টমার মুছে ফেলা হয়েছে।` : `Customer ${c.name} has been removed.`;
                 setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                 accumulatedSpeech += feedback + " ";
               } catch (e) {
                 handleFirestoreError(e, OperationType.DELETE, `customers/${c.id}`);
               }
            } else {
               const feedback = language === 'bn' ? `দুঃখিত, কোনো কাস্টমার খুঁজে পাইনি।` : `Sorry, I couldn't find that customer.`;
               setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
               accumulatedSpeech += feedback + " ";
            }
          } else if (call.name === 'prepareInvoice') {
            const items = (call.args.items as any[]) || [];
            if (items.length > 0) {
              actions.addToPOS(items);
              const feedback = language === 'bn' ? `পয়েন্ট অফ সেলে আপনার জন্য আইটেমগুলো যোগ করা হয়েছে।` : `I've opened the POS and added these items for you.`;
              setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
              accumulatedSpeech += feedback + " ";
              onClose(); // Hide Jarvis so user can see POS
            }
          } else if (call.name === 'navigateApp') {
             const dest = String(call.args.destination || '').toLowerCase();
             let targetTab = 'dashboard';
             if (dest.includes('inventory') || dest.includes('stock') || dest.includes('product')) targetTab = 'inventory';
             else if (dest.includes('sale') || dest.includes('pos') || dest.includes('invoice') || dest.includes('point')) targetTab = 'pos';
             else if (dest.includes('customer') || dest.includes('remind')) targetTab = 'customers';
             else if (dest.includes('report') || dest.includes('closing')) targetTab = 'reports';
             else if (dest.includes('setting') || dest.includes('admin')) targetTab = 'settings';
             else targetTab = 'dashboard';

             actions.navigate(targetTab);
             const feedback = language === 'bn' ? `আমি আপনাকে সেই প্যানেলে নিয়ে যাচ্ছি।` : `I am navigating to that panel.`;
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
             onClose(); // Hide Jarvis so user can see new screen
          } else if (call.name === 'updateSettings') {
             const updates: any = {};
             if (call.args.shopName !== undefined) updates.shopName = call.args.shopName;
             if (call.args.currency !== undefined) updates.currency = call.args.currency;
             if (call.args.taxRate !== undefined) updates.taxRate = call.args.taxRate;
             if (Object.keys(updates).length > 0) {
                 try {
                   await updateDoc(doc(db, "settings", shopId), updates);
                   const feedback = language === 'bn' ? `সেটিংস সফলভাবে সেভ হয়েছে।` : `Settings have been updated.`;
                   setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                   accumulatedSpeech += feedback + " ";
                 } catch (e) {
                   handleFirestoreError(e, OperationType.UPDATE, `settings/${shopId}`);
                 }
             } else {
                 actions.navigate('settings');
                 onClose();
             }
          } else if (call.name === 'sendCustomerReminder') {
             const query = String(call.args.phoneOrName || '').toLowerCase();
             const c = systemData.customers.find((c: any) => 
                c.phone.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
             );
             if (c) {
                actions.sendReminder(c);
                const feedback = language === 'bn' ? `${c.name} কে রিমাইন্ডার পাঠানো হচ্ছে।` : `Sending reminder to ${c.name}.`;
                setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                accumulatedSpeech += feedback + " ";
             } else {
                const feedback = language === 'bn' ? `দুঃখিত, কাস্টমার খুঁজে পাইনি।` : `Sorry, I couldn't find the customer.`;
                setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                accumulatedSpeech += feedback + " ";
             }
          } else if (call.name === 'checkLowStock') {
             const lowStockItems = systemData.items.filter((i: any) => i.stock <= 5);
             let feedback = "";
             if (lowStockItems.length === 0) {
                feedback = language === 'bn' ? `বর্তমানে কোনো প্রোডাক্টের স্টক কম নেই। সব কিছু ঠিক আছে।` : `There are no low stock products at the moment.`;
             } else {
                feedback = language === 'bn' 
                   ? `আপনার ${lowStockItems.length} টি প্রোডাক্টের স্টক কম। এর মধ্যে রয়েছে ${lowStockItems.slice(0,3).map((i:any)=>i.name).join(', ')}${lowStockItems.length > 3 ? ' সহ আরও কিছু' : ''}।` 
                   : `You have ${lowStockItems.length} products with low stock, including ${lowStockItems.slice(0,3).map((i:any)=>i.name).join(', ')}.`;
             }
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'checkCustomerDue') {
             const query = String(call.args.phoneOrName || '').toLowerCase();
             const c = systemData.customers.find((c: any) => 
                c.phone.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
             );
             if (c) {
                const totalDue = c.totalUnpaid || 0;
                let feedback = "";
                if (totalDue > 0) {
                   feedback = language === 'bn' ? `${c.name} এর কাছে আপনার মোট ${totalDue} টাকা পাওনা আছে।` : `${c.name} has a total due of ${totalDue}.`;
                } else {
                   feedback = language === 'bn' ? `${c.name} এর কোনো বকেয়া নেই।` : `${c.name} does not have any dues.`;
                }
                setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                accumulatedSpeech += feedback + " ";
             } else {
                const feedback = language === 'bn' ? `আমি এই নামের কোনো কাস্টমারকে খুঁজে পাইনি।` : `I couldn't find a customer with that info.`;
                setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                accumulatedSpeech += feedback + " ";
             }
          } else if (call.name === 'createDirectSale') {
             try {
                const res = await actions.createDirectSale(call.args);
                let feedback = "";
                if (res.success) {
                   feedback = language === 'bn' 
                      ? `সেল সম্পন্ন হয়েছে। মোট বিল ${res.total} টাকা, জমা ${res.paid} টাকা, বকেয়া ${res.due} টাকা। ${call.args.sendWhatsApp ? 'হোয়াটসঅ্যাপ মেসেজ পাঠানো হচ্ছে।' : 'আপনি কি ইনভয়েস হোয়াটসঅ্যাপে পাঠাতে চান?'}`
                      : `Sale completed. Total ${res.total}, Paid ${res.paid}, Due ${res.due}. ${call.args.sendWhatsApp ? 'Sending WhatsApp.' : 'Do you want to send on WhatsApp?'}`;
                } else {
                   feedback = language === 'bn' ? `দুঃখিত, সেল সম্পন্ন করতে সমস্যা হয়েছে: ${res.error}` : `Failed to complete sale: ${res.error}`;
                }
                setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                accumulatedSpeech += feedback + " ";
             } catch(e: any) {
                const feedback = language === 'bn' ? `দুঃখিত, একটি সমস্যা হয়েছে।` : `Sorry, there was an error.`;
                setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                accumulatedSpeech += feedback + " ";
             }
          } else if (call.name === 'printLatestInvoice') {
             actions.printLatestInvoice();
             const feedback = language === 'bn' ? `শেষ ইনভয়েস প্রিন্ট করা হচ্ছে।` : `Printing the latest invoice.`;
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'sendLatestInvoiceWhatsApp') {
             if (actions.sendLatestInvoiceWhatsApp) {
               actions.sendLatestInvoiceWhatsApp();
               const feedback = language === 'bn' ? `শেষ ইনভয়েসটি হোয়াটসঅ্যাপে পাঠানো হচ্ছে।` : `Sending the latest invoice via WhatsApp.`;
               setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
               accumulatedSpeech += feedback + " ";
             } else {
               const feedback = language === 'bn' ? `দুঃখিত, হোয়াটসঅ্যাপে পাঠানোর সুবিধাটি এখন কাজ করছে না।` : `Sorry, sending via WhatsApp is currently unavailable.`;
               setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
               accumulatedSpeech += feedback + " ";
             }
          } else if (call.name === 'getSalesSummary') {
             const period = String(call.args.period || 'today');
             let filteredSales = [];
             const now = new Date();
             if (period === 'today') {
                filteredSales = systemData.sales.filter(s => new Date(s.date).toDateString() === now.toDateString());
             } else if (period === 'week') {
                const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filteredSales = systemData.sales.filter(s => new Date(s.date) >= lastWeek);
             } else {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                filteredSales = systemData.sales.filter(s => new Date(s.date) >= lastMonth);
             }
             const total = filteredSales.reduce((sum, s) => sum + (s.finalAmount || 0), 0);
             const count = filteredSales.length;
             const feedback = language === 'bn' 
                ? (period === 'today' ? `আজকে` : (period === 'week' ? `এই সপ্তাহে` : `এই মাসে`)) + ` মোট ${count} টি সেল হয়েছে এবং মোট আয় হয়েছে ${total} টাকা।`
                : `${period.charAt(0).toUpperCase() + period.slice(1)} sales: ${count} entries, totaling ${total} revenue.`;
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'getCustomerDetails') {
             const query = String(call.args.phoneOrName || '').toLowerCase();
             const c = systemData.customers.find((c: any) => 
                c.phone.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
             );
             if (c) {
                const customerSales = systemData.sales.filter(s => s.customerId === c.id);
                const totalSpent = customerSales.reduce((sum, s) => sum + (s.finalAmount || 0), 0);
                const due = c.currentDue || 0;
                const feedback = language === 'bn'
                  ? `${c.name} এপর্যন্ত মোট ${totalSpent} টাকার শপিং করেছেন। বর্তমানে তার কাছে আপনার ${due} টাকা বকেয়া পাওনা আছে।`
                  : `${c.name} has spent a total of ${totalSpent}. Currently, there is a ${due} due balance.`;
                setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                accumulatedSpeech += feedback + " ";
             } else {
                const feedback = language === 'bn' ? `আমি এই নামের কোনো কাস্টমার খুঁজে পাইনি।` : `I couldn't find a customer with that name or phone.`;
                setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
                accumulatedSpeech += feedback + " ";
             }
          } else if (call.name === 'getTopSellingProducts') {
             const analytics = getAnalyticsEngine();
             const period = call.args.period || 'today';
             const limit = call.args.limit || 5;
             const topList = analytics.getTopSelling(period, limit);
             let feedback = "";
             if (topList.length === 0) {
               feedback = language === 'bn' 
                 ? `${period === 'today' ? 'আজকে' : period === 'week' ? 'গত ৭ দিনে' : 'গত ৩০ দিনে'} এখনো কোনো বিক্রি রেকর্ড করা হয়নি।`
                 : `No sales recorded for ${period}.`;
             } else {
               const listText = topList.map((t: any, idx: number) => `${idx + 1}. ${t.name} (${t.quantity} ${t.unit || 'টি'}, মোট ${t.revenue} টাকা)`).join('; ');
               feedback = language === 'bn'
                 ? `${period === 'today' ? 'আজকের' : period === 'week' ? 'গত ৭ দিনের' : 'গত ৩০ দিনের'} শীর্ষ বিক্রিত পণ্য: ${listText}।`
                 : `Top selling products for ${period}: ${listText}.`;
             }
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'getMostProfitableProducts') {
             const analytics = getAnalyticsEngine();
             const period = call.args.period || 'today';
             const limit = call.args.limit || 5;
             const profitList = analytics.getMostProfitable(period, limit);
             let feedback = "";
             if (profitList.length === 0) {
               feedback = language === 'bn' 
                 ? `লাভের হিসাব দেখার মতো পর্যাপ্ত বিক্রির রেকর্ড পাওয়া যায়নি।`
                 : `No sufficient sales records found to calculate profit margins.`;
             } else {
               const listText = profitList.map((p: any, idx: number) => `${idx + 1}. ${p.name} (আনুমানিক লাভ ${Math.round(p.profit)} টাকা)`).join('; ');
               feedback = language === 'bn'
                 ? `${period === 'today' ? 'আজকে' : period === 'week' ? 'গত ৭ দিনে' : 'গত ৩০ দিনে'} সবচেয়ে লাভজনক পণ্য: ${listText}।`
                 : `Most profitable products for ${period}: ${listText}.`;
             }
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'getFinancialBreakdown') {
             const analytics = getAnalyticsEngine();
             const fin = analytics.getFinancialBreakdown();
             const feedback = language === 'bn'
               ? `আজকের মোট বিক্রি ${fin.today.total} টাকা, যার মধ্যে নগদ জমা ${fin.today.cash} টাকা এবং বাকি বা বকেয়া ${fin.today.due} টাকা। চলতি মাসে সর্বমোট বিক্রি ${fin.month.total} টাকা (নগদ ${fin.month.cash} টাকা, বকেয়া ${fin.month.due} টাকা)।`
               : `Today total sales: ${fin.today.total} (Cash: ${fin.today.cash}, Due: ${fin.today.due}). Month total: ${fin.month.total} (Cash: ${fin.month.cash}, Due: ${fin.month.due}).`;
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'getTopDueCustomers') {
             const analytics = getAnalyticsEngine();
             const limit = call.args.limit || 5;
             const dueList = analytics.getTopDueCustomers(limit);
             let feedback = "";
             if (dueList.length === 0) {
               feedback = language === 'bn' ? `বর্তমানে কোনো কাস্টমারের কাছে বকেয়া নেই।` : `There are no customers with due balance.`;
             } else {
               const listText = dueList.map((c: any, idx: number) => `${idx + 1}. ${c.name} (${c.due || 0} টাকা)`).join('; ');
               feedback = language === 'bn'
                 ? `শীর্ষ বকেয়াদার কাস্টমারগণ: ${listText}। আপনি চাইলে তাদের সরাসরি রিমাইন্ডার পাঠাতে পারেন।`
                 : `Top due customers: ${listText}.`;
             }
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'getInactiveCustomers') {
             const analytics = getAnalyticsEngine();
             const days = call.args.days || 7;
             const inactList = analytics.getInactiveCustomers(days);
             let feedback = "";
             if (inactList.length === 0) {
               feedback = language === 'bn'
                 ? `সব রেজিস্টার্ড কাস্টমারই গত ${days} দিনের মধ্যে কেনাকাটা করেছেন।`
                 : `All customers have visited within the last ${days} days.`;
             } else {
               const names = inactList.slice(0, 5).map((c: any) => c.name).join(', ');
               feedback = language === 'bn'
                 ? `গত ${days} দিন ধরে ${inactList.length} জন কাস্টমার কেনাকাটা করেননি, যেমন: ${names}${inactList.length > 5 ? ' সহ আরও অনেকে' : ''}।`
                 : `${inactList.length} customers haven't purchased in ${days} days: ${names}.`;
             }
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'getCustomerLastTransaction') {
             const analytics = getAnalyticsEngine();
             const query = String(call.args.phoneOrName || '').toLowerCase();
             const trans = analytics.getCustomerLastTransaction(query);
             let feedback = "";
             if (!trans || !trans.customer) {
               feedback = language === 'bn' ? `এই কাস্টমারের তথ্য খুঁজে পাওয়া যায়নি।` : `Customer information not found.`;
             } else if (trans.lastSale) {
               const dateFormatted = new Date(trans.lastSale.date).toLocaleDateString('bn-BD');
               const itemsList = (trans.lastSale.items || []).map((i: any) => `${i.productName || i.name} (${i.quantity} ${i.unit || 'টি'})`).join(', ');
               feedback = language === 'bn'
                 ? `${trans.customer.name} এর শেষ কেনাকাটা ছিল ${dateFormatted} তারিখে। পণ্য: ${itemsList}। মোট বিল ${trans.lastSale.totalAmount || trans.lastSale.finalAmount || 0} টাকা এবং বর্তমান বকেয়া ${trans.customer.currentDue || trans.customer.totalUnpaid || 0} টাকা।`
                 : `${trans.customer.name}'s last transaction was on ${dateFormatted}. Total bill: ${trans.lastSale.totalAmount}. Current due: ${trans.customer.currentDue || 0}.`;
             } else {
               feedback = language === 'bn'
                 ? `${trans.customer.name} কাস্টমার লিস্টে আছেন, তবে কোনো আগের কেনাকাটা রেকর্ড নেই। বকেয়া: ${trans.customer.currentDue || 0} টাকা।`
                 : `${trans.customer.name} is registered with no past sales history. Due: ${trans.customer.currentDue || 0}.`;
             }
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          } else if (call.name === 'getRestockList') {
             const analytics = getAnalyticsEngine();
             const threshold = call.args.threshold || 5;
             const restockList = analytics.getRestockList(threshold);
             let feedback = "";
             if (restockList.length === 0) {
               feedback = language === 'bn' ? `বর্তমানে সব পণ্যের পর্যাপ্ত স্টক আছে। কোনো পণ্য রিঅর্ডার করার প্রয়োজন নেই।` : `All items are well stocked.`;
             } else {
               const listText = restockList.map((r: any, idx: number) => `${idx + 1}. ${r.name} (বর্তমান স্টক: ${r.currentStock} ${r.unit || 'টি'}, প্রস্তাবিত অর্ডার: ${r.recommendedReorder} ${r.unit || 'টি'})`).join('; ');
               feedback = language === 'bn'
                 ? `স্টক শেষ বা কম থাকায় রিঅর্ডার করার প্রস্তাবিত তালিকা: ${listText}।`
                 : `Restock recommendations: ${listText}.`;
             }
             setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
             accumulatedSpeech += feedback + " ";
          }
        }
      }

      if (text) {
        const groundingMetadata = data.groundingMetadata;
        const isSearchSource = Boolean(
          groundingMetadata?.groundingChunks?.length ||
          groundingMetadata?.webSearchQueries?.length ||
          (enableGoogleSearch && !fCalls && (
            command.includes('দাম') || command.includes('দর') || command.includes('খবর') || 
            command.includes('আবহাওয়া') || command.includes('তেল') || command.includes('চাল') || 
            command.includes('বাজার') || command.includes('পেঁয়াজ') || command.includes('ডাল') ||
            command.includes('rate') || command.includes('price') || command.includes('market')
          ))
        );
        const isMapsSource = Boolean(
          enableGoogleMaps && (
            command.includes('ম্যাপ') || command.includes('লোকেশান') || 
            command.includes('ঠিকানা') || command.includes('মোকাম') || 
            command.includes('বাজারের অবস্থান') || command.includes('রাস্তা') ||
            command.includes('লোকেশন') || command.includes('area') || command.includes('location')
          )
        );

        setHistory(prev => [...prev, { 
          role: 'assistant', 
          text,
          groundingMetadata,
          isGoogleSearch: isSearchSource,
          isGoogleMaps: isMapsSource,
          provider: data.provider || aiSettings?.apiProvider,
          model: data.model,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        accumulatedSpeech += text;
      }
      
      if (accumulatedSpeech.trim()) {
        const speechStarted = speak(accumulatedSpeech.trim());
        if (!speechStarted) {
          // If speech is unavailable/muted, restart mic after a short delay
          setTimeout(() => {
            if (!isMuted) {
              try {
                recognitionRef.current?.start();
                setIsListening(true);
              } catch {}
            }
          }, 1500);
        }
      } else {
        // If there is no text response, just restart listening now
        setTimeout(() => {
          if (!isMuted) {
            try {
              recognitionRef.current?.start();
              setIsListening(true);
            } catch {}
          }
        }, 1500);
      }
    } catch (error) {
      console.warn('Voice command processing fell back to local intelligence:', error);
      executeOfflineIntelligence(command);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-[calc(100dvh-64px)] lg:h-[calc(100vh-24px)] bg-[#fcfdfe] text-[#1e293b] overflow-hidden lg:rounded-[2.5rem] border border-indigo-100 shadow-2xl relative jarvis-theme flex flex-col" style={{ fontFamily: "'Inter', 'Hind Siliguri', sans-serif" }}>
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-[1]">
        <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>
      <div className="absolute inset-0 pointer-events-none z-[1]" style={{ background: 'linear-gradient(rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0.02) 50%), linear-gradient(90deg, rgba(0, 188, 212, 0.01), rgba(0, 129, 255, 0.01), rgba(0, 188, 212, 0.01))', backgroundSize: '100% 3px, 3px 100%' }}></div>

      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
          
          .jarvis-theme {
              --p-glow: #6366f1;
              --p-glow-accent: #4f46e5;
              --panel-bg: rgba(255, 255, 255, 0.9);
              --panel-border: rgba(99, 102, 241, 0.1);
              --text-main: #1e293b;
              --text-muted: #64748b;
          }

          .orbitron-clean { font-family: 'Inter', sans-serif; letter-spacing: 0.05em; font-weight: 700; }
          .mono { font-family: 'JetBrains Mono', monospace; }
          
          .hud-panel {
              background: var(--panel-bg);
              backdrop-filter: blur(16px);
              border: 1px solid var(--panel-border);
              border-radius: 24px;
              position: relative;
              overflow: hidden;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          }
          
          .hud-header {
              font-family: 'Inter', sans-serif;
              font-size: 0.75rem;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 14px 20px;
              background: linear-gradient(90deg, rgba(99, 102, 241, 0.05), transparent);
              border-bottom: 1px solid var(--panel-border);
              display: flex;
              align-items: center;
              gap: 10px;
              color: var(--p-glow);
          }

          .hud-table { width: 100%; font-size: 0.75rem; border-collapse: collapse; }
          .hud-table th { text-align: left; color: var(--text-muted); font-size: 0.6rem; text-transform: uppercase; padding: 10px 16px; border-bottom: 1px solid var(--panel-border); }
          .hud-table td { padding: 10px 16px; border-bottom: 1px solid rgba(99, 102, 241, 0.05); color: var(--text-main); }
          
          .circle-container {
              position: relative;
              width: min(80vw, 500px);
              height: min(80vw, 500px);
              display: flex;
              align-items: center;
              justify-content: center;
          }

          .circle-outer-ring {
              position: absolute;
              inset: 0;
              border: 1px solid var(--p-glow);
              border-radius: 50%;
              opacity: 0.1;
              animation: pulse 4s ease-in-out infinite;
          }
          
          .circle-scan {
              position: absolute;
              inset: 10px;
              border: 1px solid var(--p-glow);
              border-radius: 50%;
              border-top-color: transparent;
              border-bottom-color: transparent;
              animation: spin 10s linear infinite;
              opacity: 0.1;
          }

          .circle-core {
              position: absolute;
              inset: 28%;
              background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(243, 244, 246, 0.8) 100%);
              border: 2px solid var(--p-glow);
              border-radius: 50%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-shadow: 0 20px 40px rgba(99, 102, 241, 0.1), inset 0 0 20px rgba(99, 102, 241, 0.05);
              z-index: 10;
              transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
              cursor: pointer;
          }

          .circle-core:hover {
              transform: scale(1.05);
              box-shadow: 0 15px 50px rgba(8, 145, 178, 0.2), inset 0 0 30px rgba(8, 145, 178, 0.1);
              border-color: #0ea5e9;
          }
          
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 0.1; transform: scale(1); } 50% { opacity: 0.15; transform: scale(1.02); } }
          
          @keyframes core-listening {
              0% { box-shadow: 0 0 40px rgba(8, 145, 178, 0.1); border-color: var(--p-glow); }
              50% { box-shadow: 0 0 80px rgba(239, 68, 68, 0.3); border-color: #ef4444; }
              100% { box-shadow: 0 0 40px rgba(8, 145, 178, 0.1); border-color: var(--p-glow); }
          }

          .is-listening { animation: core-listening 1.5s ease-in-out infinite; }

          @keyframes ai-core-pulse {
            0%, 100% {
              box-shadow: 0 0 20px rgba(79, 70, 229, 0.35), inset 0 0 15px rgba(79, 70, 229, 0.35);
              transform: scale(1);
            }
            50% {
              box-shadow: 0 0 45px rgba(79, 70, 229, 0.8), inset 0 0 25px rgba(79, 70, 229, 0.8);
              transform: scale(1.03);
            }
          }

          @keyframes stream-receive {
            0% { stroke-dashoffset: 100; opacity: 0.2; }
            50% { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0.2; }
          }

          @keyframes stream-send {
            0% { stroke-dashoffset: 0; opacity: 0.2; }
            50% { opacity: 1; }
            100% { stroke-dashoffset: -100; opacity: 0.2; }
          }

          .ai-core-pulse {
            animation: ai-core-pulse 2.5s infinite ease-in-out;
          }

          .stream-receive {
            stroke-dasharray: 6, 6;
            animation: stream-receive 1.8s linear infinite;
          }

          .stream-send {
            stroke-dasharray: 6, 6;
            animation: stream-send 1.8s linear infinite;
          }

          .hud-tab.active {
              background: var(--p-glow);
              color: white;
              border-color: var(--p-glow);
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }
          
          .custom-scroll-jarvis::-webkit-scrollbar { width: 3px; }
          .custom-scroll-jarvis::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); }
          .custom-scroll-jarvis::-webkit-scrollbar-thumb { background: var(--p-glow); border-radius: 10px; }
          
          @media (max-width: 1280px) {
              .hud-columns { flex-direction: column !important; overflow: hidden; }
              .hud-column-left, .hud-column-right { width: 100% !important; min-height: 0; }
              .center-viz { min-height: 200px; order: -1; margin-bottom: 5px; flex-shrink: 0; }
              .circle-container { width: min(50vw, 200px); height: min(50vw, 200px); }
          }
          @media (max-width: 640px) {
              .hud-panel { border-radius: 16px; }
              .hud-header { font-size: 0.65rem; padding: 8px 12px; }
              .center-viz { min-height: 160px; }
              .circle-container { width: 150px; height: 150px; }
          }
        `}
      </style>

      {/* Top Bar */}
      <div className="h-[70px] lg:h-[80px] p-4 lg:p-6 flex justify-between items-center relative z-20 border-b border-indigo-100 shrink-0">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="relative">
            <div className="w-10 h-10 lg:w-12 lg:h-12 border-2 border-indigo-500 rounded-xl flex items-center justify-center rotate-45 group">
               <div className="w-5 h-5 lg:w-6 lg:h-6 border border-indigo-500 rounded-lg -rotate-45 flex items-center justify-center animate-pulse">
                  <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-indigo-500 rounded-full"></div>
               </div>
            </div>
            <div className="absolute -inset-1 border border-indigo-300 rounded-xl rotate-45 opacity-20 group-hover:scale-110 transition-transform"></div>
          </div>
          <div>
             <div className="text-xl lg:text-2xl font-black orbitron-clean tracking-tight text-slate-800 uppercase truncate max-w-[220px] lg:max-w-[340px]">{storeName}</div>
             <div className="text-[8px] lg:text-[10px] uppercase font-bold tracking-[0.3em] text-indigo-500 opacity-80 flex items-center gap-1.5">
               <span>SHOP_MASTER_AI</span>
               <span>•</span>
               <span className="text-indigo-700 font-black">{assistantNameEn.toUpperCase()} ENGINE</span>
             </div>
          </div>
        </div>

        <div className="hidden md:flex items-center bg-[#f1f5f9] p-1.5 rounded-2xl border border-indigo-100 shadow-sm relative z-40">
          <button 
            onClick={() => setCurrentMode('assistant')}
            className={`px-3.5 lg:px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${currentMode === 'assistant' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Bot className="w-4 h-4" />
            <span>কণ্ঠ সহকারী ({assistantName})</span>
          </button>
          <button 
            onClick={() => setCurrentMode('grounding')}
            className={`px-3.5 lg:px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${currentMode === 'grounding' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Globe className="w-4 h-4" />
            <span>স্মার্ট কন্ট্রোল ও গ্রাউন্ডিং</span>
          </button>
          <button 
            onClick={() => setCurrentMode('memory')}
            className={`px-3.5 lg:px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${currentMode === 'memory' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Brain className="w-4 h-4" />
            <span>মেমোরি সেন্টার</span>
          </button>
          <button 
            onClick={() => setCurrentMode('api_config')}
            className={`px-3.5 lg:px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${currentMode === 'api_config' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <KeyRound className="w-4 h-4" />
            <span>এপিআই গেটওয়ে {isApiActive ? '✓' : '⚠️'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Voice Persona Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-indigo-100 shadow-inner">
            <button
              onClick={() => {
                setAiSettings((prev: any) => ({ ...prev, persona: 'habib' }));
                handleSaveAiSettings({ persona: 'habib' });
                speak("আসসালামু আলাইকুম! আমি হাবিব। কিভাবে সাহায্য করতে পারি?", 'habib', true);
              }}
              title="ছেলে কণ্ঠ: হাবিব"
              className={`px-2.5 lg:px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                persona === 'habib' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👦 হাবিব</span>
            </button>
            <button
              onClick={() => {
                setAiSettings((prev: any) => ({ ...prev, persona: 'ruhi' }));
                handleSaveAiSettings({ persona: 'ruhi' });
                speak("আসসালামু আলাইকুম! আমি রুহি। কিভাবে সাহায্য করতে পারি?", 'ruhi', true);
              }}
              title="মেয়ে কণ্ঠ: রুহি"
              className={`px-2.5 lg:px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                persona === 'ruhi' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👧 রুহি</span>
            </button>
          </div>

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3 rounded-2xl transition-all duration-300 ${isMuted ? 'bg-red-50 text-red-500 border-red-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'} border hover:scale-105 active:scale-95 shadow-sm`}
            title={isMuted ? "আনমিউট করুন" : "মিউট করুন"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 lg:w-5 lg:h-5" /> : <Volume2 className="w-4 h-4 lg:w-5 lg:h-5" />}
          </button>

          <button 
            onClick={handleSafeClose}
            className="p-3 rounded-2xl border border-rose-100 hover:border-rose-300 bg-rose-50/50 hover:bg-rose-100 text-rose-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="জারভিস বন্ধ করুন (Safe Exit)"
          >
            <X className="w-4 h-4 lg:w-5 lg:h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 lg:p-6 overflow-hidden relative flex flex-col min-h-0">
        {currentMode === 'assistant' ? (
          <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
            {/* Background Neural Stream Lines (SVG Connecting Streams) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40">
              {/* Center to Top-Left */}
              <line x1="50%" y1="45%" x2="18%" y2="15%" stroke="#818cf8" strokeWidth="1.5" className="stream-send" />
              {/* Center to Bottom-Left */}
              <line x1="50%" y1="55%" x2="18%" y2="80%" stroke="#6366f1" strokeWidth="1.5" className="stream-receive" />
              {/* Center to Top-Right */}
              <line x1="50%" y1="45%" x2="82%" y2="15%" stroke="#6366f1" strokeWidth="1.5" className="stream-receive" />
              {/* Center to Bottom-Right */}
              <line x1="50%" y1="55%" x2="82%" y2="80%" stroke="#818cf8" strokeWidth="1.5" className="stream-send" />
            </svg>

            {/* Mandatory API Key Activation Notice Banner (Zero Hardcoding API Policy) */}
            {!isApiActive && (
              <div className="mb-3 p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-indigo-500/15 border-2 border-amber-300 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 relative z-30 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <KeyRound className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-amber-950 flex items-center gap-2">
                      <span>স্বচ্ছ এআই সক্রিয়করণ পলিসি (Zero Hardcoding Policy)</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-amber-200 text-amber-900 uppercase font-mono font-bold">API Required</span>
                    </div>
                    <div className="text-[11px] text-amber-950/80 mt-0.5 leading-relaxed">
                      জারভিস এআই চালনা করতে আপনার নিজস্ব Google Gemini API Key প্রয়োজন। নিচের বোতামে চাপ দিয়ে মাত্র ১ মিনিটে ফ্রি চাবি সংগ্রহ করুন।
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                  <button
                    onClick={() => setShowApiKeyGuideModal(true)}
                    className="px-3.5 py-2 bg-white/90 hover:bg-white text-amber-900 border border-amber-300 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>সহজ গাইড দেখুন</span>
                  </button>
                  <button
                    onClick={() => setCurrentMode('api_config')}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>এপিআই কী যুক্ত করুন</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Capability Toggles & Grounding Bar (স্মার্ট সুইচ দ্রুত কন্ট্রোল) */}
            <div className="mb-3 px-3.5 py-2.5 rounded-2xl bg-white/90 backdrop-blur-md border border-indigo-100 shadow-sm flex flex-wrap items-center justify-between gap-2.5 relative z-20 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-700 hidden sm:inline">স্মার্ট সুইচ ও লাইভ পাওয়ার:</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-start sm:justify-center">
                {/* Store DB Toggle */}
                <button
                  onClick={() => handleToggleCapability('enableStoreDb', aiSettings?.enableStoreDb === false)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                    aiSettings?.enableStoreDb !== false
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 opacity-60'
                  }`}
                  title="স্টোর ডাটাবেজ এক্সেস সুইচ"
                >
                  <Database className="w-3 h-3" />
                  <span>স্টোর ডাটাবেজ</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${aiSettings?.enableStoreDb !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                </button>

                {/* Google Search Grounding Toggle */}
                <button
                  onClick={() => handleToggleCapability('enableGoogleSearch', aiSettings?.enableGoogleSearch === false)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                    aiSettings?.enableGoogleSearch !== false
                      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/80'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 opacity-60'
                  }`}
                  title="গুগল লাইভ সার্চ গ্রাউন্ডিং (বাজারদর, খবর, আবহাওয়া)"
                >
                  <Globe className="w-3 h-3" />
                  <span>গুগল সার্চ</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${aiSettings?.enableGoogleSearch !== false ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                </button>

                {/* Google Maps Toggle */}
                <button
                  onClick={() => handleToggleCapability('enableGoogleMaps', aiSettings?.enableGoogleMaps === false)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                    aiSettings?.enableGoogleMaps !== false
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/80'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 opacity-60'
                  }`}
                  title="গুগল ম্যাপস ও এলাকাভিত্তিক তথ্য"
                >
                  <MapPin className="w-3 h-3" />
                  <span>গুগল ম্যাপস</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${aiSettings?.enableGoogleMaps !== false ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                </button>

                {/* WhatsApp Action Toggle */}
                <button
                  onClick={() => handleToggleCapability('enableWhatsAppAction', aiSettings?.enableWhatsAppAction === false)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                    aiSettings?.enableWhatsAppAction !== false
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 opacity-60'
                  }`}
                  title="হোয়াটসঅ্যাপ মেসেজিং অ্যাকশন"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>হোয়াটসঅ্যাপ</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${aiSettings?.enableWhatsAppAction !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                </button>

                {/* Print Action Toggle */}
                <button
                  onClick={() => handleToggleCapability('enablePrintAction', aiSettings?.enablePrintAction === false)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                    aiSettings?.enablePrintAction !== false
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/80'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 opacity-60'
                  }`}
                  title="ইনভয়েস প্রিন্ট অ্যাকশন"
                >
                  <Printer className="w-3 h-3" />
                  <span>প্রিন্ট</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${aiSettings?.enablePrintAction !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                </button>
              </div>

              <button
                onClick={() => setCurrentMode('grounding')}
                className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-1"
                title="সম্পূর্ণ স্মার্ট কন্ট্রোল প্যানেল খুলুন"
              >
                <Sliders className="w-3 h-3" />
                <span>ম্যানেজমেন্ট সুইচ</span>
              </button>
            </div>

            {/* Main Interactive Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-0 overflow-y-auto lg:overflow-hidden relative z-10 pb-3 custom-scroll-jarvis">
              
              {/* LEFT COLUMN: Orders Queue & Inventory Alert (Cols 4) */}
              <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
                
                {/* Active Order Queue */}
                <div className="hud-panel p-4 bg-white/95 border border-indigo-100/80 shadow-sm rounded-2xl flex flex-col h-[230px] lg:h-[48%]">
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">চলমান অর্ডার কিউ</div>
                        <div className="text-[10px] text-slate-400">Active POS Queue</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      লাইভ
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scroll-jarvis space-y-2 pr-1">
                    {recentSales.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-3 text-slate-400">
                        <ShoppingBag className="w-6 h-6 mb-1 opacity-40" />
                        <p className="text-xs">আজকে কোনো অর্ডার এখনও হয়নি</p>
                      </div>
                    ) : (
                      recentSales.map((sale) => (
                        <div key={sale.id} className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-100 transition-all flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{sale.customerName || 'ক্যাশ কাস্টমার'}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {sale.items?.length || 1} টি আইটেম
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-black text-indigo-600">৳{(sale.totalAmount || 0).toLocaleString()}</div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100/60 text-indigo-700 font-semibold">সম্পন্ন</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Stock & Inventory Alert */}
                <div className="hud-panel p-4 bg-white/95 border border-indigo-100/80 shadow-sm rounded-2xl flex flex-col flex-1 min-h-[220px]">
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">স্টক ও ইনভেন্টরি অ্যালার্ট</div>
                        <div className="text-[10px] text-slate-400">Stock Warnings</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                      সতর্কতা
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scroll-jarvis space-y-2 pr-1">
                    {systemData.items.slice(0, 5).map((item, idx) => (
                      <div key={item.id} className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 flex items-center justify-between transition-all">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-slate-800 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">সিরিয়াল #{item.serialNumber || idx + 1} • ৳{item.price}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                            (item.stock || 0) < 10 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {item.stock || 0} {item.unit || 'টি'}
                          </span>
                          <button
                            onClick={() => handleVoiceCommand(`${wakeWordBn} ${item.name} এর স্টক কত`)}
                            title={`${assistantName}-কে জিজ্ঞাসা করুন`}
                            className="p-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
                          >
                            <Mic className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* CENTER COLUMN: Centralized Neural Node & Core Controls (Cols 4) */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center min-h-[380px] lg:min-h-0 relative p-4">
                
                {/* Character Badge Header */}
                <div className="mb-3 text-center">
                  <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-sm ${
                    persona === 'habib' 
                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900' 
                      : 'bg-rose-50/80 border-rose-200 text-rose-900'
                  }`}>
                    <span className="text-base">{persona === 'habib' ? '👦' : '👧'}</span>
                    <span className="text-xs font-bold">{assistantName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      persona === 'habib' ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      {persona === 'habib' ? 'প্রধান ব্যবসায়িক উপদেষ্টা' : 'স্মার্ট কাস্টমার স্পেশালিস্ট'}
                    </span>
                  </div>
                </div>

                {/* Central AI Orb Visualizer */}
                <div className="relative flex flex-col items-center justify-center my-auto">
                  {/* Glowing halo concentric pulses */}
                  <div className={`w-52 h-52 lg:w-64 lg:h-64 rounded-full border-2 ${persona === 'ruhi' ? 'border-rose-400/30' : 'border-indigo-400/30'} flex items-center justify-center relative ${
                    isListening || isSpeaking ? 'ai-core-pulse' : ''
                  }`}>
                    {/* Outer animated rotation line */}
                    <div className={`absolute inset-2 rounded-full border border-dashed ${persona === 'ruhi' ? 'border-rose-400/40' : 'border-indigo-400/40'} animate-[spin_18s_linear_infinite]`}></div>
                    {/* Inner glowing circle */}
                    <div className={`w-36 h-36 lg:w-44 lg:h-44 rounded-full ${persona === 'ruhi' ? 'bg-gradient-to-tr from-rose-600 via-pink-500 to-violet-500' : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500'} p-1 shadow-2xl flex items-center justify-center relative group cursor-pointer hover:scale-105 transition-transform`}
                         onClick={toggleListening}>
                      
                      <div className="w-full h-full rounded-full bg-gradient-to-b from-slate-900 to-indigo-950 flex flex-col items-center justify-center text-white relative overflow-hidden">
                        {/* Audio wave effects */}
                        <div className="flex items-center gap-1 mb-2">
                          <span className={`w-1 ${persona === 'ruhi' ? 'bg-rose-400' : 'bg-indigo-400'} rounded-full transition-all duration-300 ${isListening || isSpeaking ? 'h-6 animate-pulse' : 'h-2'}`}></span>
                          <span className={`w-1 ${persona === 'ruhi' ? 'bg-pink-300' : 'bg-indigo-300'} rounded-full transition-all duration-300 ${isListening || isSpeaking ? 'h-10 animate-pulse' : 'h-3'}`}></span>
                          <span className="w-1 bg-white rounded-full transition-all duration-300 h-4"></span>
                          <span className={`w-1 ${persona === 'ruhi' ? 'bg-pink-300' : 'bg-indigo-300'} rounded-full transition-all duration-300 ${isListening || isSpeaking ? 'h-10 animate-pulse' : 'h-3'}`}></span>
                          <span className={`w-1 ${persona === 'ruhi' ? 'bg-rose-400' : 'bg-indigo-400'} rounded-full transition-all duration-300 ${isListening || isSpeaking ? 'h-6 animate-pulse' : 'h-2'}`}></span>
                        </div>
                        
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md mb-1">
                          {isListening ? (
                            <Mic className="w-5 h-5 text-rose-400 animate-bounce" />
                          ) : isSpeaking ? (
                            <Volume2 className={`w-5 h-5 ${persona === 'ruhi' ? 'text-pink-300' : 'text-indigo-300'} animate-pulse`} />
                          ) : (
                            <Sparkles className={`w-5 h-5 ${persona === 'ruhi' ? 'text-rose-300' : 'text-indigo-300'}`} />
                          )}
                        </div>
                        <span className={`text-[10px] font-bold tracking-wider uppercase ${persona === 'ruhi' ? 'text-rose-200' : 'text-indigo-200'}`}>
                          {isListening ? "রেকর্ড হচ্ছে..." : isSpeaking ? "কথা বলছি..." : isProcessing ? "প্রসেসিং..." : `${assistantName} সক্রিয়`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status subtitle */}
                  <div className="mt-3 text-center">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-indigo-100 shadow-sm text-xs font-semibold text-slate-700">
                      <span className={`w-2 h-2 rounded-full ${
                        isListening ? 'bg-rose-500 animate-ping' : isSpeaking ? (persona === 'ruhi' ? 'bg-pink-500 animate-pulse' : 'bg-indigo-500 animate-pulse') : isProcessing ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}></span>
                      {isListening 
                        ? 'কথা শুনছি... বলুন' 
                        : isSpeaking 
                        ? `${assistantName} উত্তর দিচ্ছে...` 
                        : isProcessing 
                        ? 'চিন্তা করছে...' 
                        : `বলুন: "${wakeWordBn}..."`}
                    </div>
                  </div>
                </div>

                {/* Quick Action Suggestion Chips */}
                <div className="w-full mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleVoiceCommand(`${wakeWordBn} আজকের মোট বিক্রি কত`)}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 text-slate-700 text-xs font-medium shadow-sm transition-all hover:scale-105"
                  >
                    💰 আজকের মোট বিক্রি কত?
                  </button>
                  <button
                    onClick={() => handleVoiceCommand(`${wakeWordBn} শেষ চালান প্রিন্ট করো`)}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 text-slate-700 text-xs font-medium shadow-sm transition-all hover:scale-105"
                  >
                    🖨️ শেষ চালান প্রিন্ট করো
                  </button>
                  <button
                    onClick={() => handleVoiceCommand(`${wakeWordBn} চালান হোয়াটসঅ্যাপে পাঠাও`)}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 text-slate-700 text-xs font-medium shadow-sm transition-all hover:scale-105"
                  >
                    📲 চালান হোয়াটসঅ্যাপে পাঠাও
                  </button>
                  <button
                    onClick={() => handleVoiceCommand(`${wakeWordBn} সয়াবিন তেল এর স্টক কতটুকু আছে`)}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 text-slate-700 text-xs font-medium shadow-sm transition-all hover:scale-105"
                  >
                    📦 সয়াবিন তেল স্টক কত?
                  </button>
                </div>

              </div>

              {/* RIGHT COLUMN: AI Command Center & Financials (Cols 4) */}
              <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
                
                {/* Voice Command Status & Last Interaction */}
                <div className="hud-panel p-4 bg-white/95 border border-indigo-100/80 shadow-sm rounded-2xl flex flex-col h-[230px] lg:h-[48%]">
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">এআই কমান্ড সেন্টার</div>
                        <div className="text-[10px] text-slate-400">AI Command Engine</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowHistoryModal(true)}
                      className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-[10px] font-bold transition-colors flex items-center gap-1"
                    >
                      <History className="w-3 h-3" />
                      লগ ({history.length})
                    </button>
                  </div>

                  {/* Engine Specs & Last Voice Log */}
                  <div className="flex-1 flex flex-col justify-between overflow-hidden">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                        <span className="text-slate-400">মডেল ইঞ্জিন:</span>
                        <span className="font-bold text-indigo-600 font-mono text-[11px]">
                          {aiSettings?.apiProvider === 'openrouter' ? 'OpenRouter / DeepSeek' : 'Google Gemini 2.5 Flash'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                        <span className="text-slate-400">অফলাইন ব্যাকআপ:</span>
                        <span className="font-bold text-emerald-600 flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> শতভাগ সক্রিয়
                        </span>
                      </div>
                    </div>

                    {/* Latest Assistant Message or Welcome */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 mt-2 overflow-hidden">
                      <div className="text-[10px] font-bold text-indigo-500 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> সর্বশেষ বার্তা:
                      </div>
                      <div className="line-clamp-3 italic">
                        {history.length > 0 
                          ? history[history.length - 1].text 
                          : "হেই হাবিব বলে ডাকুন। আমি আপনার দোকানের স্টক, বিক্রি, কাস্টমারের বকেয়া হিসাব দেখতে এবং রসিদ প্রিন্ট করতে পারি।"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Today's Sales & Financial Overview */}
                <div className="hud-panel p-4 bg-white/95 border border-indigo-100/80 shadow-sm rounded-2xl flex flex-col flex-1 min-h-[220px]">
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-50 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">আজকের বিক্রির হিসাব</div>
                        <div className="text-[10px] text-slate-400">Financial Metrics</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      লাইভ আয়
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">মোট বিক্রয় (Today Revenue)</div>
                      <div className="text-3xl font-black text-slate-800 tracking-tight">
                        ৳{todayRevenue.toLocaleString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-indigo-50">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-medium">আজকের চালান</div>
                        <div className="text-base font-black text-indigo-600 mt-0.5">
                          {systemData.sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).length} টি
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-medium">মোট কাস্টমার</div>
                        <div className="text-base font-black text-slate-700 mt-0.5">
                          {systemData.customers.length} জন
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => { actions.navigate('pos'); onClose(); }}
                      className="w-full mt-3 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>সরাসরি POS স্ক্রিনে যান</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Command Prompt Bar */}
            <div className="pt-2 pb-1 relative z-20 shrink-0">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder={`${assistantName}-কে কমান্ড দিন (যেমন: 'হেই ${assistantName} আজকের মোট বিক্রি কত?' অথবা মাইক চাপুন)...`}
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualPrompt.trim()) {
                      handleVoiceCommand(manualPrompt.trim());
                      setManualPrompt('');
                    }
                  }}
                  className="w-full bg-white border border-indigo-200 focus:border-indigo-500 rounded-2xl py-3.5 pl-5 pr-28 text-xs lg:text-sm outline-none shadow-md transition-all text-slate-800 placeholder:text-slate-400"
                />
                
                <div className="absolute right-2 flex items-center gap-1.5">
                  <button
                    onClick={toggleListening}
                    title={isListening ? "মাইক বন্ধ করুন" : "মাইক দিয়ে বলুন"}
                    className={`p-2.5 rounded-xl transition-all ${
                      isListening ? 'bg-rose-500 text-white animate-pulse shadow-md' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (manualPrompt.trim()) {
                        handleVoiceCommand(manualPrompt.trim());
                        setManualPrompt('');
                      }
                    }}
                    disabled={!manualPrompt.trim()}
                    title="পাঠান"
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-md"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Conversation History Modal / Drawer */}
            {showHistoryModal && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl border border-indigo-100 shadow-2xl w-full max-w-xl h-[80vh] max-h-[650px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-indigo-50 flex items-center justify-between bg-indigo-50/50">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-600" />
                      <div className="text-sm font-bold text-slate-800">কথোপকথনের সম্পূর্ণ লগ (Voice History)</div>
                    </div>
                    <button
                      onClick={() => setShowHistoryModal(false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll-jarvis">
                    {history.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
                        <Bot className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs">এখনও কোনো কথা হয়নি।</p>
                      </div>
                    ) : (
                      history.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm'
                              : 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none shadow-sm'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-500">মোট বার্তা: {history.length} টি</span>
                    <button
                      onClick={() => setHistory([])}
                      className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition-colors"
                    >
                      লগ ক্লিয়ার করুন
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : currentMode === 'grounding' ? (
          <div className="flex-1 overflow-y-auto flex flex-col gap-6 w-full pb-6 custom-scroll-jarvis">
            
            {/* Top Overview & Quick Presets Header */}
            <div className="hud-panel p-6 bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-900 text-white rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-indigo-300 border border-white/15 shadow-inner shrink-0">
                  <SlidersHorizontal className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg lg:text-xl font-black">স্মার্ট টগল কন্ট্রোল ও লাইভ গ্রাউন্ডিং</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ম্যানেজমেন্ট সুইচ
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
                    সহকারীর ক্ষমতার পরিধি নিয়ন্ত্রণ করুন। স্টোর ডাটাবেজ, গুগল লাইভ সার্চ (বাজারদর ও খবর), গুগল ম্যাপস এবং স্বয়ংক্রিয় অ্যাকশন আলাদাভাবে চালু বা বন্ধ রাখুন।
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2 relative z-10 w-full md:w-auto">
                <button
                  onClick={() => handleApplyPreset('full')}
                  className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  title="সবগুলো ক্ষমতা সক্রিয় করুন"
                >
                  <span>⚡ ফুল পাওয়ার</span>
                </button>
                <button
                  onClick={() => handleApplyPreset('store_only')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-indigo-200 hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
                  title="শুধুমাত্র স্টোর ডাটাবেজ চালু রাখুন"
                >
                  <span>🏪 শুধু স্টোর</span>
                </button>
                <button
                  onClick={() => handleApplyPreset('search_only')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-indigo-200 hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
                  title="শুধুমাত্র গুগল সার্চ ও মার্কেট রিসার্চ চালু রাখুন"
                >
                  <span>🌐 শুধু সার্চ ও বাজারদর</span>
                </button>
                <button
                  onClick={() => handleApplyPreset('readonly')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-indigo-200 hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
                  title="অ্যাকশনবিহীন নিরাপদ রিড-অনলি মোড"
                >
                  <span>🛡️ নিরাপদ মোড</span>
                </button>
              </div>
            </div>

            {/* Grid of 5 Smart Capability Switches */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              
              {/* Switch 1: Store Database Access */}
              <div className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between bg-white shadow-sm ${
                aiSettings?.enableStoreDb !== false ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 opacity-75'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                        aiSettings?.enableStoreDb !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span>স্টোর ডাটাবেজ এক্সেস</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Store Database Engine</div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleCapability('enableStoreDb', aiSettings?.enableStoreDb === false)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enableStoreDb !== false ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enableStoreDb !== false ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    ইনভেন্টরি স্টক, পণ্যের দাম, কাস্টমারের বকেয়া খাতা ও দৈনিক বিক্রির হিসাব বিশ্লেষণ করার পূর্ণ ক্ষমতা।
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">কমান্ড উদাহরণ:</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">"আজকের মোট বিক্রি কত?"</span>
                </div>
              </div>

              {/* Switch 2: Google Search Grounding */}
              <div className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between bg-white shadow-sm ${
                aiSettings?.enableGoogleSearch !== false ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 opacity-75'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                        aiSettings?.enableGoogleSearch !== false ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span>গুগল লাইভ সার্চ গ্রাউন্ডিং</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Live Web & Market Search</div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleCapability('enableGoogleSearch', aiSettings?.enableGoogleSearch === false)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enableGoogleSearch !== false ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enableGoogleSearch !== false ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    দেশের বাজারদর (সয়াবিন তেল, চাল, পেঁয়াজ ইত্যাদি), আবহাওয়া, তাজা খবর ও সাধারণ জ্ঞানের লাইভ অনুসন্ধান।
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">কমান্ড উদাহরণ:</span>
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">"আজকের তেলের বাজারদর কত?"</span>
                </div>
              </div>

              {/* Switch 3: Google Maps Intelligence */}
              <div className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between bg-white shadow-sm ${
                aiSettings?.enableGoogleMaps !== false ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-slate-200 opacity-75'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                        aiSettings?.enableGoogleMaps !== false ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span>গুগল ম্যাপস ও এলাকা তথ্য</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Location & Supplier Trends</div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleCapability('enableGoogleMaps', aiSettings?.enableGoogleMaps === false)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enableGoogleMaps !== false ? 'bg-amber-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enableGoogleMaps !== false ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    আশেপাশের পাইকারি মোকাম, বাজার, ডিলার এবং সরবরাহকারী এলাকাভিত্তিক ভৌগোলিক তথ্য বিশ্লেষণ।
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">কমান্ড উদাহরণ:</span>
                  <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">"কারওয়ান বাজারের অবস্থান কোথায়?"</span>
                </div>
              </div>

              {/* Switch 4: WhatsApp Automation Actions */}
              <div className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between bg-white shadow-sm ${
                aiSettings?.enableWhatsAppAction !== false ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 opacity-75'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                        aiSettings?.enableWhatsAppAction !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span>হোয়াটসঅ্যাপ মেসেজিং অ্যাকশন</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">WhatsApp Auto Dispatch</div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleCapability('enableWhatsAppAction', aiSettings?.enableWhatsAppAction === false)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enableWhatsAppAction !== false ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enableWhatsAppAction !== false ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    বকেয়া তাগাদা এবং বিক্রয় ইনভয়েস গ্রাহকের হোয়াটসঅ্যাপ নাম্বারে সরাসরি স্বয়ংক্রিয়ভাবে প্রেরণের ক্ষমতা।
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">কমান্ড উদাহরণ:</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">"রহমান সাহেবকে তাগাদা পাঠাও"</span>
                </div>
              </div>

              {/* Switch 5: Invoice Print Action */}
              <div className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between bg-white shadow-sm ${
                aiSettings?.enablePrintAction !== false ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 opacity-75'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                        aiSettings?.enablePrintAction !== false ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Printer className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <span>ইনভয়েস প্রিন্ট অ্যাকশন</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Thermal & POS Printing</div>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggleCapability('enablePrintAction', aiSettings?.enablePrintAction === false)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enablePrintAction !== false ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enablePrintAction !== false ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    ভয়েস নির্দেশে বা বিক্রয় চূড়ান্ত হওয়ার পর স্বয়ংক্রিয়ভাবে ইনভয়েস বা রিসিট প্রিন্টারের কমান্ড ট্রিগার করা।
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">কমান্ড উদাহরণ:</span>
                  <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">"রিসিট প্রিন্ট করো"</span>
                </div>
              </div>

              {/* Status Summary Card */}
              <div className="p-5 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-slate-50 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">স্বয়ংক্রিয় সমন্বয় নীতি (Sync Status)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    সুইচ পরিবর্তন করার সাথে সাথেই এআই সহকারীর ফাংশন কলিং ফিল্টার আপডেট হয়ে যায়। কোনো অতিরিক্ত রিস্টার্ট প্রয়োজন নেই।
                  </p>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-indigo-100/60 text-[11px]">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>সক্রিয় ক্ষমতার সংখ্যা:</span>
                    <span className="font-bold text-indigo-700 font-mono">
                      {[
                        aiSettings?.enableStoreDb !== false,
                        aiSettings?.enableGoogleSearch !== false,
                        aiSettings?.enableGoogleMaps !== false,
                        aiSettings?.enableWhatsAppAction !== false,
                        aiSettings?.enablePrintAction !== false
                      ].filter(Boolean).length} / 5 টি সক্রিয়
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* LIVE GROUNDING SEARCH & MAPS TEST SANDBOX */}
            <div className="hud-panel p-6 bg-white border border-indigo-100 shadow-md rounded-3xl flex flex-col gap-5">
              <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-indigo-50/60 text-indigo-800 px-6 py-4 flex items-center justify-between font-bold text-xs">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>লাইভ গুগল গ্রাউন্ডিং টেস্ট স্যান্ডবক্স (Live Grounding Search Sandbox)</span>
                </div>
                <span className="text-[10px] text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-full font-bold">
                  রিয়েল-টাইম তথ্য যাচাই
                </span>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  সরাসরি প্রশ্ন করে গুগল সার্চ ও বাজারদরের লাইভ গ্রাউন্ডিং পরীক্ষা করুন:
                </label>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={groundingTestQuery}
                    onChange={(e) => setGroundingTestQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTestGrounding()}
                    placeholder="যেমন: আজকের সয়াবিন তেলের লিটার প্রতি বাজারদর কত?"
                    className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs outline-none shadow-sm transition-all text-slate-800 font-medium"
                  />
                  <button
                    onClick={() => handleTestGrounding()}
                    disabled={isTestingGrounding || !groundingTestQuery.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 shrink-0"
                  >
                    {isTestingGrounding ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>অনুসন্ধান চলছে...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>লাইভ সার্চ ও যাচাই</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Quick Sample Queries */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400">সহজ নমুনা প্রশ্ন:</span>
                  {[
                    "আজকের সয়াবিন তেলের লিটার প্রতি দাম কত?",
                    "মিনিকেট চাল ৫০ কেজি বস্তার বর্তমান পাইকারি দর কত?",
                    "আজকের ঢাকার আবহাওয়া ও বৃষ্টির সম্ভাবনা কেমন?",
                    "কারওয়ান বাজার পাইকারি মোকাম কোন এলাকায়?"
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setGroundingTestQuery(sample);
                        handleTestGrounding(sample);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-[10px] font-medium rounded-lg border border-slate-200 transition-all"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grounding Test Result Display */}
              {groundingTestResult && (
                <div className={`p-5 rounded-2xl border text-xs leading-relaxed flex flex-col gap-3.5 transition-all ${
                  groundingTestResult.success 
                    ? 'bg-blue-50/50 border-blue-200 text-slate-800' 
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-sm text-slate-900">
                          {groundingTestResult.success ? 'গুগল লাইভ সার্চ থেকে প্রাপ্ত উত্তর' : '⚠️ গ্রাউন্ডিং ফলাফল'}
                        </div>
                        {groundingTestResult.latencyMs && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ⚡ {groundingTestResult.latencyMs}ms Latency • Google Grounding Engine
                          </div>
                        )}
                      </div>
                    </div>

                    {groundingTestResult.success && (
                      <button
                        onClick={() => speak(groundingTestResult.text, persona, true)}
                        className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>পুনরায় শুনুন</span>
                      </button>
                    )}
                  </div>

                  {groundingTestResult.success ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-white rounded-xl border border-blue-100 shadow-2xs text-slate-800 font-medium leading-relaxed font-sans text-xs">
                        {groundingTestResult.text}
                      </div>

                      {/* Grounding Metadata / Citations if available */}
                      {groundingTestResult.groundingMetadata?.webSearchQueries && (
                        <div className="p-3 bg-white/70 rounded-xl border border-blue-100 text-[11px] space-y-1.5">
                          <span className="font-bold text-blue-900 block">গুগল সার্চ কোয়েরি:</span>
                          <div className="flex flex-wrap gap-1">
                            {groundingTestResult.groundingMetadata.webSearchQueries.map((q: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-mono">
                                🔍 {q}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-900 font-semibold">{groundingTestResult.error}</p>
                  )}
                </div>
              )}

            </div>

          </div>
        ) : currentMode === 'memory' ? (
          /* ENTERPRISE HUD MEMORY CENTER (MODERN BENTO GRID & CATEGORIZED POLICIES) */
          <div className="flex-1 overflow-y-auto flex flex-col gap-6 w-full pb-6 custom-scroll-jarvis">
            
            {/* Top Enterprise Memory Hero Banner */}
            <div className="hud-panel p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white rounded-3xl shadow-xl relative overflow-hidden border border-indigo-500/20">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-indigo-500/20 flex items-center justify-center backdrop-blur-md border border-indigo-400/30 text-indigo-300 shadow-inner">
                    <Brain className="w-7 h-7 text-indigo-300 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">এন্টারপ্রাইজ মেমোরি সেন্টার (Enterprise HUD Memory)</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                        {assistantName} এর জ্ঞানভাণ্ডার
                      </span>
                    </div>
                    <p className="text-xs text-indigo-200/80 mt-0.5">
                      দোকানের নীতিমালা, ভিআইপি অগ্রাধিকার, বিশেষ ডিসকাউন্ট এবং আঞ্চলিক ভাষা ম্যাপিং
                    </p>
                  </div>
                </div>

                {/* Quick Stats Pill */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3.5 py-1.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <div className="text-left">
                      <div className="text-[10px] text-slate-300 font-bold">মোট মেমোরি রুলস</div>
                      <div className="text-xs font-black text-white font-mono">{memories.length} টি সক্রিয়</div>
                    </div>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-amber-400" />
                    <div className="text-left">
                      <div className="text-[10px] text-slate-300 font-bold">আঞ্চলিক শব্দকোষ</div>
                      <div className="text-xs font-black text-white font-mono">{synonyms.length} টি প্রতিশব্দ</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Filter Tabs & Search Bar */}
              <div className="mt-6 pt-5 border-t border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setActiveMemoryTab('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeMemoryTab === 'all'
                        ? 'bg-white text-indigo-950 shadow-md font-black'
                        : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>সকল মেমোরি ({memories.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveMemoryTab('business_rules')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeMemoryTab === 'business_rules'
                        ? 'bg-emerald-500 text-white shadow-md font-black'
                        : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>দোকানের নীতিমালা ({memories.filter(m => m.category === 'business_rules' || !m.category).length})</span>
                  </button>
                  <button
                    onClick={() => setActiveMemoryTab('vip_preferences')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeMemoryTab === 'vip_preferences'
                        ? 'bg-purple-500 text-white shadow-md font-black'
                        : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span>ভিআইপি অগ্রাধিকার ({memories.filter(m => m.category === 'vip_preferences' || m.category === 'customer_preference').length})</span>
                  </button>
                  <button
                    onClick={() => setActiveMemoryTab('discounts_offers')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeMemoryTab === 'discounts_offers'
                        ? 'bg-amber-500 text-white shadow-md font-black'
                        : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>ডিসকাউন্ট ও অফার ({memories.filter(m => m.category === 'discounts_offers').length})</span>
                  </button>
                  <button
                    onClick={() => setActiveMemoryTab('dialects_synonyms')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeMemoryTab === 'dialects_synonyms'
                        ? 'bg-blue-500 text-white shadow-md font-black'
                        : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>আঞ্চলিক অভিধান ({synonyms.length})</span>
                  </button>
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="মেমোরি বা নিয়ম খুঁজুন..."
                    value={memorySearchTerm}
                    onChange={(e) => setMemorySearchTerm(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-indigo-400 text-white text-xs rounded-xl pl-9 pr-3.5 py-2 outline-none placeholder:text-slate-500"
                  />
                  {memorySearchTerm && (
                    <button
                      onClick={() => setMemorySearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Preset Library Bar */}
            <div className="p-4 bg-white border border-indigo-100 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">স্মার্ট মেমোরি প্রিসেট (১-ক্লিকে ইনস্টল করুন):</span>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {[
                  {
                    label: "🛡️ বাকির সীমা",
                    text: "যেকোনো নতুন বা অনিয়মিত কাস্টমারকে সর্বোচ্চ ১,০০০ টাকার বেশি বকেয়া দেওয়া যাবে না।",
                    cat: "business_rules"
                  },
                  {
                    label: "⭐ ভিআইপি সুবিধা",
                    text: "ভিআইপি ও নিয়মিত সম্মানিত কাস্টমারদের বকেয়ায় সর্বোচ্চ অগ্রাধিকার দিন এবং সর্বোচ্চ সম্মান প্রদর্শন করুন।",
                    cat: "vip_preferences"
                  },
                  {
                    label: "🏷️ ৫% ক্যাশব্যাক",
                    text: "শুক্রবার দিন নগদ কেনাকাটায় মোট বিলের উপর ৫% বিশেষ ছাড় প্রযোজ্য হবে।",
                    cat: "discounts_offers"
                  },
                  {
                    label: "🚚 ফ্রি ডেলিভারি",
                    text: "৩,০০০ টাকার বেশি অর্ডারে লোকাল এরিয়ায় ফ্রি হোম ডেলিভারি নিশ্চিত করতে হবে।",
                    cat: "discounts_offers"
                  },
                  {
                    label: "🗣️ সোয়াবিন তেল",
                    spoken: "সোয়াবিন",
                    actual: "সয়াবিন তেল (Soybean Oil)",
                    isSynonym: true
                  }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={async () => {
                      if (!shopId) return;
                      try {
                        if (item.isSynonym) {
                          await addDoc(collection(db, 'ai_synonyms'), {
                            shopId,
                            spokenWord: item.spoken!.toLowerCase(),
                            actualProductName: item.actual,
                            createdAt: new Date().toISOString()
                          });
                        } else {
                          await addDoc(collection(db, 'ai_memories'), {
                            shopId,
                            text: item.text,
                            category: item.cat,
                            createdAt: new Date().toISOString(),
                            isActive: true
                          });
                        }
                      } catch (err) {
                        console.error("Error inserting preset memory:", err);
                      }
                    }}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold border border-indigo-100 transition-all hover:scale-102 active:scale-98"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main HUD Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* LEFT COLUMN: Add New Memory & Personality / Brain Test (Col 5) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Add New Memory / Policy Card */}
                <div className="hud-panel p-6 bg-white border border-indigo-100 shadow-sm rounded-3xl flex flex-col gap-4">
                  <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-indigo-50/60 text-indigo-700 px-6 py-4 flex items-center justify-between font-bold text-xs">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-indigo-600" />
                      <span>নতুন মেমোরি / নীতিমালা যুক্ত করুন (Add Rule)</span>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-indigo-100">
                      Auto-Sync
                    </span>
                  </div>

                  <div className="space-y-3.5 mt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                        মেমোরি ক্যাটাগরি নির্বাচন করুন:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'business_rules', label: '🛡️ দোকানের নীতিমালা', desc: 'Business Rules' },
                          { id: 'vip_preferences', label: '⭐ ভিআইপি অগ্রাধিকার', desc: 'VIP Preferences' },
                          { id: 'discounts_offers', label: '🏷️ ছাড় ও অফার পলিসি', desc: 'Discounts & Offers' },
                          { id: 'dialects_synonyms', label: '🗣️ আঞ্চলিক শব্দ ও ভাষা', desc: 'Dialects & Synonyms' },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setNewMemoryCategory(cat.id as any)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              newMemoryCategory === cat.id
                                ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs'
                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="text-xs font-bold">{cat.label}</div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">{cat.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {newMemoryCategory === 'dialects_synonyms' ? (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            উচ্চারণ বা মুখের ভাষা (Spoken Word):
                          </label>
                          <input
                            type="text"
                            placeholder="যেমন: সোয়াবিন, মিনিকেট চাইল, চিনিগুড়া"
                            value={newSpokenWord}
                            onChange={(e) => setNewSpokenWord(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            ইনভেন্টরির মূল প্রোডাক্টের নাম (Actual Product):
                          </label>
                          <input
                            type="text"
                            placeholder="যেমন: সয়াবিন তেল (Soybean Oil), Miniket Rice 25kg"
                            value={newActualProduct}
                            onChange={(e) => setNewActualProduct(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs text-slate-800 outline-none transition-all"
                          />
                        </div>
                        <button
                          onClick={handleAddSynonym}
                          disabled={!newSpokenWord.trim() || !newActualProduct.trim()}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>আঞ্চলিক শব্দ অভিধানে যোগ করুন</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            {newMemoryCategory === 'business_rules'
                              ? 'দোকানের নিয়ম বা পলিসি বিস্তারিত লিখুন:'
                              : newMemoryCategory === 'vip_preferences'
                              ? 'ভিআইপি কাস্টমারের নোট বা বিশেষ সুবিধা লিখুন:'
                              : 'ডিসকাউন্ট, ক্যাশব্যাক বা স্পেশাল অফারের নিয়ম লিখুন:'}
                          </label>
                          <textarea
                            rows={3}
                            placeholder={
                              newMemoryCategory === 'business_rules'
                                ? "যেমন: 'বিকাশ বা নগদে পেমেন্ট করলে কোনো অতিরিক্ত ক্যাশ-আউট চার্জ কাটা হবে না।'"
                                : newMemoryCategory === 'vip_preferences'
                                ? "যেমন: 'হাজী সাহেব ও কালাম ভাই আসলে বিশেষ সম্মান দিন এবং বাকিতে যেকোনো পণ্য দেওয়া যাবে।'"
                                : "যেমন: 'একসাথে ৫ বস্তা চাল কিনলে প্রতি বস্তায় ১০০ টাকা ক্যাশ ছাড় দেওয়া হবে।'"
                            }
                            value={newMemoryText}
                            onChange={(e) => setNewMemoryText(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl py-2.5 px-3.5 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 font-medium"
                          />
                        </div>
                        <button
                          onClick={handleAddMemory}
                          disabled={isSavingMemory || !newMemoryText.trim()}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          {isSavingMemory ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>মেমোরিতে সংরক্ষণ করুন</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Personality & Greetings Configuration */}
                <div className="hud-panel p-6 bg-white border border-indigo-100 shadow-sm rounded-3xl flex flex-col gap-4">
                  <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-indigo-50/60 text-indigo-700 px-6 py-4 flex items-center justify-between font-bold text-xs">
                    <div className="flex items-center gap-2">
                      <SettingsIcon className="w-4 h-4 text-indigo-605" />
                      <span>এআই ব্যক্তিত্ব ও সম্ভাষণ (AI Personality)</span>
                    </div>
                  </div>

                  <div className="space-y-3.5 mt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5">কথা বলার ধরণ ও আচরণ:</label>
                      <select
                        value={aiSettings.personality || 'friendly'}
                        onChange={(e) => handleSaveAiSettings({ personality: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 text-slate-800 font-semibold rounded-xl py-2.5 px-3 text-xs outline-none transition-all shadow-xs"
                      >
                        <option value="friendly">😊 বিনয়ী ও আন্তরিক সহকারী (Friendly & Warm)</option>
                        <option value="strict">💼 কড়া হিসাবরক্ষক ও পিনপয়েন্ট নির্ভুল (Strict & Firm)</option>
                        <option value="professional">🎓 প্রফেশনাল ও ধীরস্থির ম্যানেজার (Professional & Polite)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5">কাস্টম স্বাগতম বার্তা:</label>
                      <textarea
                        value={aiSettings.customGreeting || ''}
                        onChange={(e) => handleSaveAiSettings({ customGreeting: e.target.value })}
                        placeholder="যেমন: 'আসসালামু আলাইকুম স্যার, বিসমিল্লাহ স্টোরে আপনাকে স্বাগতম।'"
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 text-slate-800 font-medium rounded-xl py-2 px-3 text-xs outline-none transition-all shadow-xs placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Brain Simulator */}
                <div className="hud-panel p-6 bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-lg flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                  
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <span className="text-xs font-bold text-slate-200">লাইভ মেমোরি সিমুলেটর (Test Brain)</span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    সংরক্ষিত মেমোরি ও নীতিমালা অনুযায়ী এআই কেমন প্রতিক্রিয়া জানায় তা এখানে সাথে সাথে যাচাই করুন।
                  </p>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      placeholder="যেমন: শুক্রবার কি কোনো বিশেষ অফার আছে?"
                      className="w-full bg-slate-800/90 border border-slate-700 focus:border-indigo-400 text-white font-medium rounded-xl py-2 px-3 text-xs outline-none placeholder:text-slate-500"
                    />

                    <button
                      onClick={handleTestBrain}
                      disabled={isTestingBrain || !testQuery.trim()}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      {isTestingBrain ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>মেমোরি ব্রেন যাচাই করছে...</span>
                        </>
                      ) : (
                        <>
                          <Brain className="w-3.5 h-3.5 text-indigo-100" />
                          <span>মেমোরি প্রতিক্রিয়া টেস্ট করুন</span>
                        </>
                      )}
                    </button>

                    {testResult && (
                      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1 max-h-[140px] overflow-y-auto custom-scroll-jarvis">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block">এআই ব্রেন ফলাফল:</span>
                        <p className="text-xs text-slate-200 leading-relaxed font-medium">{testResult}</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Categorized Enterprise HUD Cards (Col 7) */}
              <div className="lg:col-span-7 flex flex-col gap-6">

                {/* 1. BUSINESS RULES SECTION (দোকানের নীতিমালা) */}
                {(activeMemoryTab === 'all' || activeMemoryTab === 'business_rules') && (
                  <div className="hud-panel p-6 bg-white border border-emerald-100 shadow-sm rounded-3xl flex flex-col gap-4">
                    <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-emerald-50/70 text-emerald-800 px-6 py-4 flex items-center justify-between font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        <span>১. দোকানের নীতিমালা ও শর্তাবলী (Business Rules & Policies)</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {memories.filter(m => m.category === 'business_rules' || !m.category).length} টি নিয়ম
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {memories.filter(m => (m.category === 'business_rules' || !m.category) && (!memorySearchTerm || m.text.toLowerCase().includes(memorySearchTerm.toLowerCase()))).length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-emerald-200 rounded-2xl bg-emerald-50/30 text-emerald-700/80">
                          <p className="text-xs font-bold">দোকানের কোনো নীতিমালা যুক্ত করা নেই।</p>
                          <p className="text-[10px] mt-1 text-slate-500">বামে ফর্ম থেকে বা উপরের প্রিসেট থেকে নিয়ম যুক্ত করুন।</p>
                        </div>
                      ) : (
                        memories
                          .filter(m => (m.category === 'business_rules' || !m.category) && (!memorySearchTerm || m.text.toLowerCase().includes(memorySearchTerm.toLowerCase())))
                          .map((m) => (
                            <div
                              key={m.id}
                              className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50/50 transition-all flex items-start justify-between gap-3 group"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
                                  🛡️
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-800 leading-relaxed font-sans">{m.text}</p>
                                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                                    সংরক্ষিত: {new Date(m.createdAt || Date.now()).toLocaleDateString('bn-BD')}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteMemory(m.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all opacity-80 group-hover:opacity-100 shrink-0"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}

                {/* 2. VIP CUSTOMER PREFERENCES SECTION (ভিআইপি অগ্রাধিকার) */}
                {(activeMemoryTab === 'all' || activeMemoryTab === 'vip_preferences') && (
                  <div className="hud-panel p-6 bg-white border border-purple-100 shadow-sm rounded-3xl flex flex-col gap-4">
                    <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-purple-50/70 text-purple-800 px-6 py-4 flex items-center justify-between font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-purple-600" />
                        <span>২. ভিআইপি কাস্টমার অগ্রাধিকার ও বিশেষ খাতির (VIP Preferences)</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        {memories.filter(m => m.category === 'vip_preferences' || m.category === 'customer_preference').length} টি নোট
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {memories.filter(m => (m.category === 'vip_preferences' || m.category === 'customer_preference') && (!memorySearchTerm || m.text.toLowerCase().includes(memorySearchTerm.toLowerCase()))).length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-purple-200 rounded-2xl bg-purple-50/30 text-purple-700/80">
                          <p className="text-xs font-bold">কোনো ভিআইপি কাস্টমার অগ্রাধিকার যোগ করা হয়নি।</p>
                          <p className="text-[10px] mt-1 text-slate-500">বিশেষ কাস্টমারদের নাম ও অগ্রাধিকার পলিসি সংরক্ষণ করুন।</p>
                        </div>
                      ) : (
                        memories
                          .filter(m => (m.category === 'vip_preferences' || m.category === 'customer_preference') && (!memorySearchTerm || m.text.toLowerCase().includes(memorySearchTerm.toLowerCase())))
                          .map((m) => (
                            <div
                              key={m.id}
                              className="p-4 rounded-2xl border border-purple-100 bg-purple-50/20 hover:bg-purple-50/50 transition-all flex items-start justify-between gap-3 group"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
                                  ⭐
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-800 leading-relaxed font-sans">{m.text}</p>
                                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">
                                    ভিআইপি প্রায়োরিটি: হাই (High Priority)
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteMemory(m.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all opacity-80 group-hover:opacity-100 shrink-0"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}

                {/* 3. DISCOUNTS & OFFERS POLICY SECTION (ডিসকাউন্ট ও অফার পলিসি) */}
                {(activeMemoryTab === 'all' || activeMemoryTab === 'discounts_offers') && (
                  <div className="hud-panel p-6 bg-white border border-amber-100 shadow-sm rounded-3xl flex flex-col gap-4">
                    <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-amber-50/70 text-amber-800 px-6 py-4 flex items-center justify-between font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-amber-600" />
                        <span>৩. বিশেষ ডিসকাউন্ট ও অফার পলিসি (Discounts & Offers Policy)</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {memories.filter(m => m.category === 'discounts_offers').length} টি অফার
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {memories.filter(m => m.category === 'discounts_offers' && (!memorySearchTerm || m.text.toLowerCase().includes(memorySearchTerm.toLowerCase()))).length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-amber-200 rounded-2xl bg-amber-50/30 text-amber-700/80">
                          <p className="text-xs font-bold">কোনো ডিসকাউন্ট বা বিশেষ অফার পলিসি যুক্ত নেই।</p>
                          <p className="text-[10px] mt-1 text-slate-500">ক্যাশব্যাক, স্পেশাল ডে ডিসকাউন্ট বা ফ্রি ডেলিভারি অফার যোগ করুন।</p>
                        </div>
                      ) : (
                        memories
                          .filter(m => m.category === 'discounts_offers' && (!memorySearchTerm || m.text.toLowerCase().includes(memorySearchTerm.toLowerCase())))
                          .map((m) => (
                            <div
                              key={m.id}
                              className="p-4 rounded-2xl border border-amber-100 bg-amber-50/20 hover:bg-amber-50/50 transition-all flex items-start justify-between gap-3 group"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
                                  🏷️
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-800 leading-relaxed font-sans">{m.text}</p>
                                  <span className="text-[9px] text-amber-600 font-bold mt-1 block">
                                    অফার স্ট্যাটাস: সক্রিয় (Active)
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteMemory(m.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all opacity-80 group-hover:opacity-100 shrink-0"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}

                {/* 4. REGIONAL DIALECTS & SYNONYMS DICTIONARY (আঞ্চলিক উচ্চারণ ও প্রতিশব্দ অভিধান) */}
                {(activeMemoryTab === 'all' || activeMemoryTab === 'dialects_synonyms') && (
                  <div className="hud-panel p-6 bg-white border border-blue-100 shadow-sm rounded-3xl flex flex-col gap-4">
                    <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-blue-50/70 text-blue-800 px-6 py-4 flex items-center justify-between font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <span>৪. অঞ্চলভিত্তিক উচ্চারণ ও প্রতিশব্দ অভিধান (Dialects & Synonyms)</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        {synonyms.length} টি ম্যাপিং
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {synonyms.filter(s => !memorySearchTerm || s.spokenWord.toLowerCase().includes(memorySearchTerm.toLowerCase()) || s.actualProductName.toLowerCase().includes(memorySearchTerm.toLowerCase())).length === 0 ? (
                        <div className="sm:col-span-2 text-center py-6 border border-dashed border-blue-200 rounded-2xl bg-blue-50/30 text-blue-700/80">
                          <p className="text-xs font-bold">কোনো আঞ্চলিক শব্দ ম্যাপিং যুক্ত করা নেই।</p>
                          <p className="text-[10px] mt-1 text-slate-500">মুখের কথ্য ভাষা বা আঞ্চলিক ডাকনামকে ইনভেন্টরি প্রোডাক্টের সাথে ম্যাপ করুন।</p>
                        </div>
                      ) : (
                        synonyms
                          .filter(s => !memorySearchTerm || s.spokenWord.toLowerCase().includes(memorySearchTerm.toLowerCase()) || s.actualProductName.toLowerCase().includes(memorySearchTerm.toLowerCase()))
                          .map((s) => (
                            <div
                              key={s.id}
                              className="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/20 hover:bg-blue-50/50 transition-all flex items-center justify-between gap-2.5 group"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-rose-600 font-mono bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                                    "{s.spokenWord}"
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold">➔</span>
                                  <span className="text-xs font-black text-indigo-700 truncate max-w-[140px]">
                                    {s.actualProductName}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400 block mt-1">ভয়েস শনাক্তকরণ সক্রিয়</span>
                              </div>
                              <button
                                onClick={() => handleDeleteSynonym(s.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all opacity-80 group-hover:opacity-100 shrink-0"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>
        ) : (
          /* API ENGINE & GATEWAY CONFIGURATION PANEL */
          <div className="flex-1 overflow-y-auto flex flex-col gap-6 w-full pb-2 lg:pb-6 custom-scroll-jarvis">
            <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
              
              {/* Header Banner */}
              <div className="hud-panel p-6 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10 text-indigo-300 shadow-inner">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{storeName} এআই গেটওয়ে ইঞ্জিন</h3>
                      <p className="text-xs text-indigo-200">Google Gemini এবং OpenRouter কাস্টম এপিআই ও পার্সোনা কনফিগারেশন</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 self-start sm:self-auto flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {isApiActive ? 'এপিআই সংযোগ সক্রিয়' : 'অফলাইন ব্যাকআপ সক্রিয়'}
                  </span>
                </div>
              </div>

              {/* Voice Persona Selection (Habib vs Ruhi) */}
              <div className="hud-panel p-6 bg-white border border-indigo-100 shadow-sm rounded-3xl">
                <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-indigo-50/50 text-indigo-700 px-6 py-4 flex items-center justify-between font-bold text-xs">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-600" />
                    <span>ভয়েস পার্সোনা নির্বাচন (Select Voice Persona & Identity)</span>
                  </div>
                  <span className="text-[10px] text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded-full font-bold">
                    বর্তমান: {assistantName} ({assistantNameEn})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  {/* Habib Card */}
                  <div 
                    onClick={() => {
                      setAiSettings((prev: any) => ({ ...prev, persona: 'habib' }));
                      handleSaveAiSettings({ persona: 'habib' });
                    }}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                      persona === 'habib' 
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20' 
                        : 'border-slate-200 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl shadow-sm border border-indigo-200 shrink-0">
                          👦
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <span>হাবিব (Habib)</span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">ছেলে কণ্ঠ (Male)</span>
                          </div>
                          <div className="text-[11px] font-medium text-indigo-600">প্রধান ব্যবসায়িক উপদেষ্টা ও স্টোর ম্যানেজার</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">ওয়েক ওয়ার্ড: "হেই হাবিব"</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        persona === 'habib' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {persona === 'habib' && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100/60 text-indigo-800 text-[10px] font-semibold">আত্মবিশ্বাসী</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100/60 text-indigo-800 text-[10px] font-semibold">বাস্তবমুখী</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100/60 text-indigo-800 text-[10px] font-semibold">স্টক ও লাভ অ্যানালাইসিস</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100/60 text-indigo-800 text-[10px] font-semibold">পেশাদার পুরুষ কণ্ঠ</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      আত্মবিশ্বাসী, বাস্তবমুখী ও গোছানো। গভীর অ্যানালাইসিস এবং স্টক-বিক্রির নিখুঁত হিসাব মানুষের মতো সরাসরি বুঝিয়ে বলে।
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAiSettings((prev: any) => ({ ...prev, persona: 'habib' }));
                        handleSaveAiSettings({ persona: 'habib' });
                        setPlayingDemoPersona('habib');
                        speak(
                          "আসসালামু আলাইকুম! আমি হাবিব, আপনার প্রধান ব্যবসায়িক উপদেষ্টা ও স্টোর ম্যানেজার। সব ধরনের হিসাব-নিকাশ ও স্টক পরিচালনায় আমি প্রস্তুত।",
                          'habib',
                          true,
                          () => setPlayingDemoPersona(null)
                        );
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        playingDemoPersona === 'habib' 
                          ? 'bg-indigo-600 text-white shadow-md animate-pulse' 
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{playingDemoPersona === 'habib' ? '🔊 হাবিব কথা বলছে...' : 'হাবিব-এর ভয়েস সিগনেচার শুনুন'}</span>
                    </button>
                  </div>

                  {/* Ruhi Card */}
                  <div 
                    onClick={() => {
                      setAiSettings((prev: any) => ({ ...prev, persona: 'ruhi' }));
                      handleSaveAiSettings({ persona: 'ruhi' });
                    }}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                      persona === 'ruhi' 
                        ? 'border-rose-500 bg-rose-50/40 shadow-md ring-2 ring-rose-500/20' 
                        : 'border-slate-200 hover:border-rose-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 text-2xl shadow-sm border border-rose-200 shrink-0">
                          👧
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <span>রুহি (Ruhi)</span>
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">মেয়ে কণ্ঠ (Female)</span>
                          </div>
                          <div className="text-[11px] font-medium text-rose-600">স্মার্ট কাস্টমার রিলেশনস ও ইনভেন্টরি স্পেশালিস্ট</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">ওয়েক ওয়ার্ড: "হেই রুহি"</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        persona === 'ruhi' ? 'border-rose-600 bg-rose-600' : 'border-slate-300'
                      }`}>
                        {persona === 'ruhi' && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-rose-100/60 text-rose-800 text-[10px] font-semibold">মিষ্টি ও নম্র</span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100/60 text-rose-800 text-[10px] font-semibold">কাস্টমার সার্ভিস</span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100/60 text-rose-800 text-[10px] font-semibold">বকেয়া তাগাদা</span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100/60 text-rose-800 text-[10px] font-semibold">সাবলীল নারী কণ্ঠ</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      অত্যন্ত মিষ্টি, নম্র এবং দায়িত্বশীল। কাস্টমার সার্ভিস, বকেয়া তাগাদা এবং দৈনন্দিন কাজের দ্রুত সমাধান দিবে।
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAiSettings((prev: any) => ({ ...prev, persona: 'ruhi' }));
                        handleSaveAiSettings({ persona: 'ruhi' });
                        setPlayingDemoPersona('ruhi');
                        speak(
                          "আসসালামু আলাইকুম! আমি রুহি, আপনার কাস্টমার রিলেশনস ও ইনভেন্টরি স্পেশালিস্ট। আজ আপনাকে কীভাবে সহায়তা করতে পারি?",
                          'ruhi',
                          true,
                          () => setPlayingDemoPersona(null)
                        );
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        playingDemoPersona === 'ruhi' 
                          ? 'bg-rose-600 text-white shadow-md animate-pulse' 
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>{playingDemoPersona === 'ruhi' ? '🔊 রুহি কথা বলছে...' : 'রুহি-র ভয়েস সিগনেচার শুনুন'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Provider Selection */}
              <div className="hud-panel p-6 bg-white border border-indigo-100 shadow-sm rounded-3xl">
                <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-indigo-50/50 text-indigo-700 px-6 py-4 flex items-center gap-2 font-bold text-xs">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>প্রাথমিক এআই প্রোভাইডার নির্বাচন (Select Primary AI Engine)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  {/* Google Gemini Card */}
                  <div 
                    onClick={() => setAiSettings((prev: any) => ({ ...prev, apiProvider: 'gemini' }))}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      aiSettings.apiProvider === 'gemini' 
                        ? 'border-indigo-600 bg-indigo-50/30 shadow-md' 
                        : 'border-slate-200 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          G
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">Google Gemini</div>
                          <div className="text-[11px] text-slate-400">Gemini 2.5 Flash / Cascade</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        aiSettings.apiProvider === 'gemini' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {aiSettings.apiProvider === 'gemini' && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      গুগল জেমিনাই উচ্চগতি ও বুদ্ধিমত্তার সাথে দোকানের বিক্রয় ও হিসাব সংক্রান্ত আদেশ পালন করে।
                    </p>
                  </div>

                  {/* OpenRouter Card */}
                  <div 
                    onClick={() => setAiSettings((prev: any) => ({ ...prev, apiProvider: 'openrouter' }))}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      aiSettings.apiProvider === 'openrouter' 
                        ? 'border-indigo-600 bg-indigo-50/30 shadow-md' 
                        : 'border-slate-200 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 font-bold">
                          OR
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">OpenRouter</div>
                          <div className="text-[11px] text-slate-400">DeepSeek / Llama 3 / Claude</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        aiSettings.apiProvider === 'openrouter' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {aiSettings.apiProvider === 'openrouter' && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      ওপেনরাউটারের মাধ্যমে যেকোনো অত্যাধুনিক ওপেন-সোর্স বা প্রিমিয়াম মডেল ব্যবহার করতে পারেন।
                    </p>
                  </div>
                </div>
              </div>

              {/* Smart Management Switches & Capability Controls Card in API Config */}
              <div className="hud-panel p-6 bg-white border border-indigo-100 shadow-sm rounded-3xl flex flex-col gap-4">
                <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-indigo-50/50 text-indigo-700 px-6 py-4 flex items-center justify-between font-bold text-xs">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                    <span>স্মার্ট টগল কন্ট্রোল ও ম্যানেজমেন্ট সুইচ (Smart Capability Switches)</span>
                  </div>
                  <button
                    onClick={() => setCurrentMode('grounding')}
                    className="text-[10px] text-indigo-600 hover:underline font-bold"
                  >
                    ফুল গ্রাউন্ডিং প্যানেল খুলুন →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-1">
                  {/* Toggle 1: Store DB */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">স্টোর ডাটাবেজ এক্সেস</div>
                        <div className="text-[10px] text-slate-400 font-mono">Store Database</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleCapability('enableStoreDb', aiSettings?.enableStoreDb === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enableStoreDb !== false ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enableStoreDb !== false ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Toggle 2: Google Live Search */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">গুগল লাইভ সার্চ</div>
                        <div className="text-[10px] text-slate-400 font-mono">Market & News</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleCapability('enableGoogleSearch', aiSettings?.enableGoogleSearch === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enableGoogleSearch !== false ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enableGoogleSearch !== false ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Toggle 3: Google Maps */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">গুগল ম্যাপস ও এলাকা</div>
                        <div className="text-[10px] text-slate-400 font-mono">Location Grounding</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleCapability('enableGoogleMaps', aiSettings?.enableGoogleMaps === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enableGoogleMaps !== false ? 'bg-amber-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enableGoogleMaps !== false ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Toggle 4: WhatsApp Action */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">হোয়াটসঅ্যাপ অ্যাকশন</div>
                        <div className="text-[10px] text-slate-400 font-mono">Auto Messaging</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleCapability('enableWhatsAppAction', aiSettings?.enableWhatsAppAction === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enableWhatsAppAction !== false ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enableWhatsAppAction !== false ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Toggle 5: Print Action */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">ইনভয়েস প্রিন্ট অ্যাকশন</div>
                        <div className="text-[10px] text-slate-400 font-mono">POS Printing</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleCapability('enablePrintAction', aiSettings?.enablePrintAction === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        aiSettings?.enablePrintAction !== false ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        aiSettings?.enablePrintAction !== false ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* API Credentials Input Form */}
              <div className="hud-panel p-6 bg-white border border-indigo-100 shadow-sm rounded-3xl flex flex-col gap-5">
                <div className="hud-header -mx-6 -mt-6 rounded-t-3xl bg-indigo-50/50 text-indigo-700 px-6 py-4 flex items-center justify-between font-bold text-xs">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-600" />
                    <span>এপিআই চাবি ও মডেল কনফিগারেশন (API Credentials & Models)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal">ক্লাউড ডাটাবেজে এনক্রিপ্ট হয়ে সংরক্ষিত থাকে</span>
                </div>

                {/* Gemini Settings Fields */}
                <div className={`space-y-3 p-4 rounded-2xl border transition-all ${
                  aiSettings.apiProvider === 'gemini' ? 'bg-indigo-50/20 border-indigo-200' : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      Google Gemini API Key (কাস্টম কী)
                    </label>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      গুগল এআই স্টুডিও থেকে ফ্রি চাবি নিন <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="AIzaSy... (খালি রাখলে সিস্টেমের ডিফল্ট চাবি ব্যবহৃত হবে)"
                    value={aiSettings.geminiApiKey || ''}
                    onChange={(e) => setAiSettings((prev: any) => ({ ...prev, geminiApiKey: e.target.value }))}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-xl p-3 text-xs font-mono outline-none shadow-sm transition-all text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400">
                    * আপনার নিজস্ব গুগল জেমিনাই এপিআই কী ব্যবহার করলে কোনো কোটা সীমাবদ্ধতার সমস্যা হবে না।
                  </p>
                </div>

                {/* OpenRouter Settings Fields */}
                <div className={`space-y-3 p-4 rounded-2xl border transition-all ${
                  aiSettings.apiProvider === 'openrouter' ? 'bg-violet-50/20 border-violet-200' : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                      OpenRouter API Key
                    </label>
                    <a 
                      href="https://openrouter.ai/keys" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[11px] text-violet-600 hover:underline flex items-center gap-1"
                    >
                      OpenRouter থেকে কী নিন <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={aiSettings.openrouterApiKey || ''}
                    onChange={(e) => setAiSettings((prev: any) => ({ ...prev, openrouterApiKey: e.target.value }))}
                    className="w-full bg-white border border-violet-400 rounded-xl p-3 text-xs font-mono outline-none shadow-sm transition-all text-slate-800"
                  />

                  <div className="mt-3">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      OpenRouter মডেল নির্বাচন (Model Identifier):
                    </label>
                    <select
                      value={aiSettings.openrouterModel || 'deepseek/deepseek-chat'}
                      onChange={(e) => setAiSettings((prev: any) => ({ ...prev, openrouterModel: e.target.value }))}
                      className="w-full bg-white border border-slate-200 focus:border-violet-400 rounded-xl p-3 text-xs font-mono outline-none shadow-sm transition-all text-slate-800"
                    >
                      <option value="deepseek/deepseek-chat">deepseek/deepseek-chat (দ্রুত ও সাশ্রয়ী - সাজেস্টেড)</option>
                      <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (OpenRouter Gateway)</option>
                      <option value="meta-llama/llama-3.3-70b-instruct">meta-llama/llama-3.3-70b-instruct</option>
                      <option value="anthropic/claude-3.5-haiku">anthropic/claude-3.5-haiku</option>
                      <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                    </select>
                  </div>
                </div>

                {/* API Test Feedback & Deep Diagnostics Card */}
                {apiTestResult && (
                  <div className={`p-4 rounded-2xl border text-xs font-medium leading-relaxed flex flex-col gap-3 ${
                    apiTestResult.success 
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                      : 'bg-amber-50/80 border-amber-200 text-amber-900'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {apiTestResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-bold text-sm mb-0.5 flex items-center justify-between">
                          <span>{apiTestResult.success ? '✓ এপিআই গেটওয়ে সংযোগ সফল ও ভেরিফাইড' : '⚠️ সংযোগ ডায়াগনস্টিক রিপোর্ট'}</span>
                          {apiTestResult.latencyMs !== undefined && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                              ⚡ {apiTestResult.latencyMs}ms Latency
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700">{apiTestResult.message}</p>
                      </div>
                    </div>

                    {apiTestResult.success && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-[11px]">
                        <div className="p-2 bg-white/80 rounded-xl border border-emerald-100">
                          <div className="text-slate-400 font-bold uppercase text-[9px]">ইঞ্জিন প্রোভাইডার</div>
                          <div className="font-bold text-slate-800">{apiTestResult.provider || 'Google Gemini'}</div>
                        </div>
                        <div className="p-2 bg-white/80 rounded-xl border border-emerald-100">
                          <div className="text-slate-400 font-bold uppercase text-[9px]">মডেল শনাক্তকারী</div>
                          <div className="font-bold text-slate-800 truncate font-mono text-[10px]">{apiTestResult.model || 'gemini-3.8-flash'}</div>
                        </div>
                        <div className="p-2 bg-white/80 rounded-xl border border-emerald-100 col-span-2 sm:col-span-1">
                          <div className="text-slate-400 font-bold uppercase text-[9px]">স্ট্যাটাস</div>
                          <div className="font-bold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>১০০% কার্যকর</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Buttons: Test & Save */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={handleTestApi}
                    disabled={isTestingApi}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isTestingApi ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                        <span>পরীক্ষা করা হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4" />
                        <span>লাইভ সংযোগ পরীক্ষা করুন (Test Live)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleSaveAiSettings()}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>কনফিগারেশন সেভ করুন (Save Changes)</span>
                  </button>
                </div>

              </div>

            </div>
          </div>
        )}

      {/* Bottom Footer Info (GAUG Area) */}
      <div className="h-[70px] px-6 pb-6 flex gap-4 shrink-0 mt-auto">
         <div className="flex-1 hud-panel border-indigo-50 flex items-center px-6">
            <div className="flex-1">
               <div className="text-[9px] font-bold text-slate-400 mb-2 uppercase">DATA_INTEGRITY</div>
               <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-100">
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 w-[98%] h-full"></div>
               </div>
            </div>
         </div>
         <button 
           onClick={handleSafeClose}
           className="px-8 hud-panel flex items-center justify-center group overflow-hidden border-indigo-100 hover:border-rose-300 transition-all"
           title="জারভিস বন্ধ করুন"
         >
            <X className="w-5 h-5 text-indigo-400 group-hover:text-rose-500 transition-colors" />
            <div className="absolute inset-0 bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
         </button>
      </div>

      {/* Zero Hardcoding API Key Setup Interactive Modal (ধাপ ৬ স্বচ্ছ পলিসি ও গাইড) */}
      {showApiKeyGuideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-indigo-100 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <KeyRound className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Google Gemini API Key সংগ্রহ ও সক্রিয়করণ</h3>
                  <p className="text-xs text-indigo-100">স্বচ্ছ এপিআই নীতি • কোনো হিডেন বা অজানা চাবি ব্যবহৃত হয় না</p>
                </div>
              </div>
              <button 
                onClick={() => setShowApiKeyGuideModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs custom-scroll-jarvis">
              {/* Step by step card */}
              <div className="space-y-3">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">1</span>
                  <span>১ মিনিটে একদম ফ্রিতে নিজস্ব API Key তৈরি করুন:</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 pl-8">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                    <span className="font-mono font-bold text-indigo-600">ক.</span>
                    <div>
                      নিচের <strong>"Google AI Studio খুলুন"</strong> বোতামে চাপ দিন এবং আপনার জিমেইল একাউন্ট দিয়ে লগইন করুন।
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                    <span className="font-mono font-bold text-indigo-600">খ.</span>
                    <div>
                      স্ক্রিনে <strong>"Create API key"</strong> বাটনে ক্লিক করে একটি নতুন চাবি জেনারেট করুন।
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                    <span className="font-mono font-bold text-indigo-600">গ.</span>
                    <div>
                      তৈরি হওয়া চাবিটি কপি করে এনে নিচের বক্সে পেস্ট করে <strong>"ভেরিফাই ও সেভ করুন"</strong> চাপুন।
                    </div>
                  </div>
                </div>

                <div className="pt-2 pl-8">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-indigo-200 transition-all active:scale-95 text-xs"
                  >
                    <span>Google AI Studio খুলুন (Create Free Key)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* API Key Input Box in Modal */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">2</span>
                  <span>আপনার প্রাপ্ত Google Gemini Key পেস্ট করুন:</span>
                </div>

                <div className="pl-8 space-y-3">
                  <input
                    type="text"
                    placeholder="AIzaSy..."
                    value={aiSettings.geminiApiKey || ''}
                    onChange={(e) => setAiSettings((prev: any) => ({ ...prev, geminiApiKey: e.target.value, apiProvider: 'gemini' }))}
                    className="w-full bg-slate-50 border-2 border-indigo-200 focus:border-indigo-600 rounded-2xl p-3.5 text-xs font-mono outline-none shadow-inner transition-all text-slate-800"
                  />

                  {apiTestResult && (
                    <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                      apiTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                      {apiTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold mb-0.5">{apiTestResult.success ? 'এপিআই চাবি ভেরিফাইড ও সক্রিয়!' : 'ভেরিফিকেশন ব্যর্থ হয়েছে'}</div>
                        <p className="text-[11px] opacity-90">{apiTestResult.message}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Security & Zero Hardcoding Guarantee Notice */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-900/80 leading-relaxed flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>
                  <strong>গ্যারান্টি:</strong> আপনার দেওয়া চাবিটি শুধুমাত্র আপনার স্টোরের জন্য সুরক্ষিত থাকবে। কোনো হার্ডকোডেড বা গোপন শেয়ারিং পলিসি নেই।
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowApiKeyGuideModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
              >
                পরে করব
              </button>

              <button
                onClick={async () => {
                  await handleTestApi();
                  if (aiSettings.geminiApiKey?.trim()) {
                    setShowApiKeyGuideModal(false);
                  }
                }}
                disabled={isTestingApi || !aiSettings.geminiApiKey?.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isTestingApi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>ভেরিফাই হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>ভেরিফাই ও সক্রিয় করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
