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
  Edit2
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

  // AI Memory Center states
  const [currentMode, setCurrentMode] = useState<'assistant' | 'memory'>('assistant');
  const [memories, setMemories] = useState<any[]>([]);
  const [synonyms, setSynonyms] = useState<any[]>([]);
  const [aiSettings, setAiSettings] = useState<any>({
    personality: 'friendly',
    customGreeting: '',
    shortTermMemoryLimit: 10,
    strictnessLevel: 'optimal'
  });

  // Inputs for memory updates
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('business_rules');
  const [newSpokenWord, setNewSpokenWord] = useState('');
  const [newActualProduct, setNewActualProduct] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);

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

  const handleSaveAiSettings = async (updates: any) => {
    if (!shopId) return;
    try {
      const ref = doc(db, 'ai_settings', shopId);
      await setDoc(ref, {
        shopId,
        ...aiSettings,
        ...updates
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
          systemInstruction: `You are the AI Assistant for Bismillah Store Management System. Here to test your custom cognitive brain configuration in real-time.
          
          # CRITICAL WAKE-WORD PROTOCOL (STRICT MANDATE):
          - You must ONLY process the request, answer questions, or execute actions IF the user's prompt explicitly starts with or contains "হেই হাবিব", "hey habib", or "hey Habib" (case-insensitive).
          - If the user DOES NOT mention this exact name/wake-word, you MUST NOT provide any other answer. Instead, STRICTLY reply with: "অনুগ্রহ করে আমাকে সাহায্য করার আগে আমার নাম ধরে ডাকুন, যেমন: 'হেই হাবিব'।"

          # SYSTEM CONFIGURATION CURRENT SETTINGS:
          ${personalityBlock}
          ${customGreetingBlock}
          
          # BRAIN MEMORIES:
          ${customMemoriesString}

          # SPEECH SYNONYMS:
          ${customSynonymsString}
          
          Provide a test response according to your cognitive memories.`,
          tools: [{ googleSearch: {} }]
        })
      });

      const resJson = await responseFetch.json();
      if (resJson.text) {
        setTestResult(resJson.text);
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
  
  // Use settings from systemData
  const language = systemData.settings.jarvisLanguage || 'bn';
  const voiceGender = systemData.settings.jarvisVoiceGender === 'female' ? 'female' : 'male';

  useEffect(() => {
    console.log("JarvisAI Settings - Language:", language, "Voice Gender:", voiceGender);
  }, [language, voiceGender]);

  const [history, setHistory] = useState<{ role: 'user' | 'assistant', text: string }[]>([]);
  
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

  // Removed toggleLanguage as per user request to manage it via settings panel instead

  const handleVoiceCommandRef = useRef<(command: string) => void>(undefined);

  const isStartingRef = useRef(false);

  const startRecognition = (force = false) => {
    if (!recognitionRef.current || (isProcessing && !force) || isStartingRef.current) return;
    
    isStartingRef.current = true;

    try {
      recognitionRef.current.stop();
    } catch (e) {
      // Ignore
    }

    // Use a small timeout to ensure the stop takes effect before starting
    setTimeout(() => {
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

  // Initialize Speech Recognition
  useEffect(() => {
    // Warm up voices
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; 
      recognition.interimResults = true;
      recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US'; 

      recognition.onresult = (event: SpeechRecognitionEvent) => {
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
          if (handleVoiceCommandRef.current) {
            handleVoiceCommandRef.current(finalTranscript);
          }
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'aborted' && event.error !== 'not-allowed' && event.error !== 'network' && event.error !== 'no-speech') {
          console.error('Speech recognition error', event.error);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Restart speech recognition automatically if no explicit action is happening
        // Check if the component is still active and not muted/speaking/processing
        if (!isMutedRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (!isMutedRef.current && !isProcessingRef.current && !isSpeakingRef.current) {
              try {
                // Ensure we don't start if already listening
                if (recognitionRef.current) {
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
    
    return () => {
      recognitionRef.current?.stop();
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

  const speak = (text: string): boolean => {
    if (isMuted || !window.speechSynthesis) return false;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }

    // Clean text for TTS
    // Use short pause markers instead of long strings to avoid choppiness
    const cleanText = text
      .replace(/[^\u0980-\u09FFa-zA-Z0-9\s,.?।!]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/।/g, '. ') // Standard dot sometimes sounds better for pauses
      .trim();

    if (!cleanText) return false;

    // Split text into slightly smaller chunks to prevent engine stuttering on long sentences
    const chunks = cleanText.match(/.{1,120}(\s|$)/g) || [cleanText];
    let chunkIndex = 0;

    const speakChunk = () => {
      if (chunkIndex >= chunks.length || isMutedRef.current) {
        setIsSpeaking(false);
        if (speechWatchdogRef.current) {
          clearTimeout(speechWatchdogRef.current);
          speechWatchdogRef.current = null;
        }
        if (!isMutedRef.current && !isProcessingRef.current) {
          startRecognition(true);
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      
      const voices = window.speechSynthesis.getVoices();
      const isBengali = language === 'bn';
      
      const genderTerms = voiceGender === 'female' 
        ? ['female', 'google female', 'microsoft zira', 'pallabi', 'zaira', 'kalpana']
        : ['male', 'google male', 'microsoft david', 'niloy', 'bangladesh male', 'hemant'];

      const preferredBengaliVoices = voiceGender === 'female'
        ? ['google বাংলা', 'bn-bd-female', 'bn-in-female', 'pallabi', 'kiti']
        : ['google বাংলা', 'bn-bd-male', 'bn-in-male', 'amit', 'niloy'];

      let voice = voices.find(v => 
        v.lang.toLowerCase().includes('bn') && 
        preferredBengaliVoices.some(name => v.name.toLowerCase().includes(name))
      );

      if (!voice) {
        voice = voices.find(v => 
          v.lang.toLowerCase().includes('bn') && 
          genderTerms.some(term => v.name.toLowerCase().includes(term))
        );
      }

      if (!voice) {
        voice = voices.find(v => v.lang.toLowerCase().includes('bn'));
      }

      if (!isBengali && !voice) {
        voice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
      }
      
      if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
      } else {
          utterance.lang = isBengali ? 'bn-BD' : 'en-US';
      }
      
      utterance.rate = 1.0; 
      utterance.pitch = 1.0; 

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        chunkIndex++;
        speakChunk();
      };
      utterance.onerror = (e) => {
        console.error("SpeechSynthesis error:", e);
        chunkIndex++;
        speakChunk();
      };

      window.speechSynthesis.speak(utterance);
    };

    const expectedDuration = Math.max(3000, (cleanText.length * 150)); // 150ms per character
    speechWatchdogRef.current = setTimeout(() => {
      if (isSpeakingRef.current) {
        console.warn("TTS Watchdog Fired - Speech synthesis onend might have been dropped");
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        if (!isMutedRef.current && !isProcessingRef.current) {
          startRecognition(true);
        }
      }
    }, expectedDuration + 4000);

    speakChunk();
    return true;
  };

  useEffect(() => {
    handleVoiceCommandRef.current = handleVoiceCommand;
  }, [systemData, actions, isMuted]);

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
      }
    ];

    try {
      console.log("Processing command:", command, "Language:", language, "Voice Gender:", voiceGender);
      
      const lowerCmd = command.toLowerCase();
      if (lowerCmd.includes("সারাংশ") || lowerCmd.includes("summary") || lowerCmd.includes("আয়") || lowerCmd.includes("revenue") || lowerCmd.includes("হিসাব")) {
        const todaySales = systemData.sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString());
        const totalRevenue = todaySales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
        const feedback = language === 'bn'
          ? `আজকের সারাংশ: মোট ${todaySales.length} টি সেল হয়েছে। মোট আয় হয়েছে ${totalRevenue.toLocaleString()} টাকা।`
          : `Today's summary: Total ${todaySales.length} sales. Total revenue is ${totalRevenue.toLocaleString()}.`;
        setHistory(prev => [...prev, { role: 'assistant', text: feedback }]);
        speak(feedback);
        setIsProcessing(false);
        return;
      }

      // Compile long-term factual memories
      const customMemoriesString = memories && memories.length > 0
        ? memories.map(m => `- [${m.category}]: ${m.text}`).join('\n')
        : "No custom business rules or facts stored in the virtual memory yet.";

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

      // Read custom greeting override
      const customGreetingBlock = aiSettings?.customGreeting 
        ? `Additionally, whenever greeting the user or initiating chat, you should align with this custom style preference: "${aiSettings.customGreeting}"`
        : "";

      const responseFetch = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: command,
          systemInstruction: `You are the AI Assistant for Bismillah Store Management System. 

          # CRITICAL WAKE-WORD PROTOCOL (STRICT MANDATE):
          - You must ONLY process the request, answer questions, or execute actions IF the user's prompt explicitly starts with or contains "হেই হাবিব", "hey habib", or "hey Habib" (case-insensitive).
          - If the user DOES NOT mention this exact name/wake-word, you MUST NOT execute their command, check any stock, or provide any answer. Instead, STRICTLY reply with: "অনুগ্রহ করে আমাকে সাহায্য করার আগে আমার নাম ধরে ডাকুন, যেমন: 'হেই হাবিব'।" (or in English if the language is English: "Please call me by my name before I can help, e.g., 'Hey Habib'"). DO NOT process the rest of their request.

          # CRITICAL LANGUAGE PROTOCOL:
          - CURRENT LANGUAGE SETTING: ${language === 'bn' ? 'BENGALI (বাংলা)' : 'ENGLISH'}.
          - If the setting is 'bn', you MUST ONLY output text in BENGALI script.
          - ইউজার আপনার সাথে যেভাবে কথা করছে, আপনিও ঠিক সেভাবে রিঅ্যাক্ট করবেন। কোনো কৃত্রিমতা পরিহার করবেন। ছোট বাক্য ব্যবহার করবেন। "হ্যাঁ", "অবশ্যই", "ঠিক আছে", "জ্বি" comfortably.
          - EVEN IF the user speaks to you in English, if the setting is 'bn', you MUST respond in BENGALI.
          - ABSOLUTELY NO English sentences or phrases (except product names).
          
          # PERSONALITY & GREETINGS:
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
          If the user provides items (e.g., 'হাবিবের জন্য ১০ কেজি ময়দা আর ৫ কেজি আলু, ৫০০ টাকা জমা'):
          1. MAP the products to the inventory. If they say "ময়দা", search for "flour".
          2. Use 'createDirectSale' IMMEDIATELY.
          3. Confirm: "হাবিবের ৫ কেজি আলু আর ১০ কেজি ময়দার সেল অ্যাড করা হয়েছে। টোটাল বিল হয়েছে... টাকা, জমা... টাকা, বকেয়া... টাকা।"
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
          tools: [{ functionDeclarations: tools }, { googleSearch: {} }],
          contents: [
            ...history.slice(-10).map(h => ({
              role: h.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: h.text }]
            })),
            { role: 'user', parts: [{ text: command }] }
          ],
          config: { model: "gemini-3.5-flash" }
        })
      });

      if (!responseFetch.ok) {
        let errText = "API request failed";
        try {
          const errData = await responseFetch.json();
          errText = errData.error || errData.message || errText;
        } catch {}
        if (responseFetch.status === 429 || errText.toLowerCase().includes("quota") || errText.toLowerCase().includes("limit") || errText.includes("RESOURCE_EXHAUSTED")) {
          throw new Error("QUOTA_EXCEEDED: " + errText);
        }
        throw new Error(errText);
      }
      const data = await responseFetch.json();

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
          }
        }
      }

      if (text) {
        setHistory(prev => [...prev, { role: 'assistant', text }]);
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
      console.error('Error handling voice command:', error);
      
      // Try to run offline fallback command
      let offlineHandled = false;
      let offlineFeedback = "";
      const lowerCmd = command.toLowerCase().trim();
      
      if (lowerCmd.includes("স্টক") || lowerCmd.includes("stock") || lowerCmd.includes("কতটুকু আছে") || lowerCmd.includes("কত কেজি") || lowerCmd.includes("কত বস্তা")) {
        let word = lowerCmd.replace(/(স্টক|stock|কতটুকু|আছে|কত|কেজি|বস্তা|হাবিব|হেই)/g, "").trim();
        if (word.length > 1) {
          const matchedItem = fuzzyMatchProduct(systemData.items, word);
          if (matchedItem) {
            const idx = systemData.items.findIndex((i: any) => i.id === matchedItem.id) + 1;
            const serialNo = matchedItem.serialNumber || idx;
            offlineFeedback = language === 'bn'
              ? `অফলাইন মোড: ${matchedItem.name} (সিরিয়াল #${serialNo}) এর স্টক আছে ${matchedItem.stock} ${matchedItem.unit || 'টি'} এবং দাম ${matchedItem.price} টাকা।`
              : `Offline Mode: ${matchedItem.name} (Serial #${serialNo}) has ${matchedItem.stock} ${matchedItem.unit || 'units'} in stock with price of ${matchedItem.price} ${systemData.settings.currency || '৳'}.`;
            offlineHandled = true;
          }
        }
      }
      
      if (!offlineHandled && (lowerCmd.includes("প্রিন্ট") || lowerCmd.includes("print") || lowerCmd.includes("রসিদ"))) {
        actions.printLatestInvoice();
        offlineFeedback = language === 'bn'
          ? `অফলাইন মোড: শেষ চালানটি প্রিন্ট করা হচ্ছে।`
          : `Offline Mode: Printing the latest invoice.`;
        offlineHandled = true;
      }
      
      if (!offlineHandled && (lowerCmd.includes("হোয়াটসঅ্যাপ") || lowerCmd.includes("whatsapp") || lowerCmd.includes("মেসেজ পাঠাও") || lowerCmd.includes("ইনভয়েস পাঠাও"))) {
        if (actions.sendLatestInvoiceWhatsApp) {
          actions.sendLatestInvoiceWhatsApp();
          offlineFeedback = language === 'bn'
            ? `অফলাইন মোড: শেষ ইনভয়েসটি হোয়াটসঅ্যাপে পাঠানো হচ্ছে।`
            : `Offline Mode: Sending the latest invoice via WhatsApp.`;
          offlineHandled = true;
        }
      }
      
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
            ? `অফলাইন মোড: আপনাকে সেই প্যানেলে নিয়ে যাওয়া হচ্ছে।`
            : `Offline Mode: Navigating to the requested panel.`;
          onClose();
          offlineHandled = true;
        }
      }
      
      if (!offlineHandled && (lowerCmd.includes("বকেয়া") || lowerCmd.includes("বাকি") || lowerCmd.includes("due") || lowerCmd.includes("unpaid"))) {
        let word = lowerCmd.replace(/(বকেয়া|বাকি|কত|টাকা|পায়|due|unpaid|কার|হাবিব|হেই)/g, "").trim();
        if (word.length > 1) {
          const matchedCust = systemData.customers.find((c: any) => 
            c.name.toLowerCase().includes(word) || c.phone.includes(word)
          );
          if (matchedCust) {
            const due = matchedCust.currentDue || matchedCust.totalUnpaid || 0;
            offlineFeedback = language === 'bn'
              ? `অফলাইন মোড: ${matchedCust.name} এর কাছে আপনার বকেয়া পাওনা আছে ${due} টাকা।`
              : `Offline Mode: ${matchedCust.name} has a due balance of ${due} ${systemData.settings.currency || '৳'}.`;
            offlineHandled = true;
          }
        }
      }

      if (offlineHandled && offlineFeedback) {
        setHistory(prev => [...prev, { role: 'assistant', text: offlineFeedback }]);
        speak(offlineFeedback);
        return;
      }

      setErrorCount(prev => prev + 1);
      
      const errorStr = String(error).toLowerCase();
      const isQuota = errorStr.includes('quota') || errorStr.includes('429') || errorStr.includes('resource_exhausted');
      const isFetch = errorStr.includes('fetch') || errorStr.includes('request failed');

      let errorMsg = language === 'bn' 
        ? "দুঃখিত, এখন উত্তর দিতে পারছি না। অনুগ্রহ করে পরে আবার চেষ্টা করুন।" 
        : "Sorry, I can't respond right now. Please try again later.";

      if (isQuota) {
        errorMsg = language === 'bn'
          ? "দুঃখিত, আমার এআই (AI) কোটা শেষ হয়ে গেছে। অনুগ্রহ করে একটু পরে চেষ্টা করুন অথবা অফলাইন ম্যানুয়াল কন্ট্রোল ব্যবহার করুন।"
          : "Sorry, my AI Quota has been exceeded. Please try again later or use manual offline controls.";
      } else if (isFetch) {
        errorMsg = language === 'bn'
          ? "দুঃখিত, সার্ভারের সাথে সংযোগ করা যাচ্ছে না। অনুগ্রহ করে আপনার ইন্টারনেট কানেকশন চেক করুন।"
          : "Sorry, failed to connect to the server. Please check your internet connection.";
      }
      
      setHistory(prev => [...prev, { role: 'assistant', text: errorMsg }]);
      
      // Only speak if we haven't failed repeatedly
      if (errorCount < 2) {
        speak(errorMsg);
      } else {
        // Stop listening to prevent loops
        setIsListening(false);
        recognitionRef.current?.stop();
        setTimeout(() => setErrorCount(0), 10000); // Cool down
      }
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
             <div className="text-2xl lg:text-3xl font-black orbitron-clean tracking-tight text-slate-800 uppercase">AI Assistant</div>
             <div className="text-[8px] lg:text-[10px] uppercase font-bold tracking-[0.4em] text-indigo-500 opacity-70">BISMILLAH_STORE_AI</div>
          </div>
        </div>

        <div className="flex items-center bg-[#f1f5f9] p-1.5 rounded-2xl border border-indigo-100 shadow-sm relative z-40">
          <button 
            onClick={() => setCurrentMode('assistant')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${currentMode === 'assistant' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-705'}`}
          >
            <Bot className="w-4 h-4" />
            <span>কণ্ঠ সহকারী (Voice)</span>
          </button>
          <button 
            onClick={() => setCurrentMode('memory')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${currentMode === 'memory' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-705'}`}
          >
            <Brain className="w-4 h-4" />
            <span>মেমোরি সেন্টার (Memory Core)</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] orbitron-clean font-bold text-indigo-600 opacity-60">SYSTEM_LOAD</div>
            <div className="text-sm font-black mono text-slate-700">OPTIMAL</div>
          </div>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3.5 rounded-2xl transition-all duration-300 ${isMuted ? 'bg-red-50 text-red-500 border-red-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'} border hover:scale-105 active:scale-95 shadow-sm`}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 lg:p-6 overflow-hidden relative flex flex-col min-h-0">
        {currentMode === 'assistant' ? (
          <div className="hud-columns flex lg:flex-row flex-col gap-4 lg:gap-6 flex-1 overflow-hidden w-full pb-2 lg:pb-6">
          
          {/* LEFT COLUMN */}
          <div className="hud-column-left flex-1 lg:flex-none w-full lg:w-[320px] flex flex-col gap-4 shrink-0">
             <div className="hud-panel h-[220px] hidden lg:block">
               <div className="hud-header"><Bot className="w-3 h-3" /> CLIENT METRICS</div>
               <div className="overflow-y-auto h-[calc(100%-45px)] custom-scroll-jarvis">
                 <table className="hud-table">
                   <thead><tr><th>NAME</th><th className="text-right">CONTACT</th></tr></thead>
                   <tbody>
                     {systemData.customers.slice(0, 8).map((c) => (
                       <tr key={c.id} className="hover:bg-indigo-50/50 transition-colors">
                         <td className="truncate max-w-[120px] font-bold text-slate-700">{c.name}</td>
                         <td className="text-right font-mono text-[0.65rem] text-slate-400">{c.phone}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             <div className="hud-panel p-0 bg-indigo-50/10 flex-1 lg:flex-none lg:h-[auto] border border-indigo-100/50 shadow-inner rounded-3xl overflow-hidden mt-2 lg:mt-0 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
                <div className="hud-header px-5 pt-4 bg-transparent border-none"><ShieldCheck className="w-3 h-3 text-indigo-500" /> ASSISTANT LOG</div>
                <div className="p-4 flex flex-col h-full lg:h-[320px] lg:flex-1 min-h-0 relative z-10">
                   <div className="flex-1 overflow-y-auto custom-scroll-jarvis flex flex-col gap-4 pb-4 pr-1">
                      {history.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-4 rounded-3xl max-w-[85%] text-xs font-medium leading-relaxed tracking-wide ${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white shadow-lg rounded-tr-none' 
                              : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm'
                          }`}>
                              {msg.text}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                   </div>
                   
                   <div className="mt-4 relative">
                      <input 
                        type="text"
                        placeholder="হেই হাবিব (Hey Habib) বলে শুরু করুন..."
                        value={transcript}
                        onChange={e => setTranscript(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleVoiceCommand(transcript)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-400 rounded-2xl py-4 pl-5 pr-14 text-sm outline-none transition-all placeholder:text-slate-400 text-slate-700 shadow-sm"
                      />
                      <button 
                        onClick={() => handleVoiceCommand(transcript)}
                        disabled={isProcessing || !transcript.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-20 transition-all shadow-md"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                   </div>
                </div>
             </div>

             <div className="hud-panel p-6 hidden lg:block">
                <div className="hud-header">RECENT_TRAFFIC</div>
                <div className="space-y-4 mt-2">
                   {recentSales.map((sale, i) => (
                     <div key={sale.id} className="group cursor-pointer">
                       <div className="flex justify-between items-center text-[10px] font-bold orbitron-clean">
                         <span className="text-slate-400">TRANSACTION_{String(i+1).padStart(2, '0')}</span>
                         <span className="text-indigo-600">৳{sale.totalAmount.toLocaleString()}</span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-indigo-400 w-full transform -translate-x-full animate-[shimmer_2.5s_infinite]"></div>
                       </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          {/* CENTER COLUMN */}
          <div className="center-viz flex-1 relative flex items-center justify-center">
              <div className="circle-container">
                  <div className="circle-outer-ring"></div>
                  <div className="circle-scan"></div>
                  
                  <div 
                    className={`circle-core w-full h-full max-w-[240px] max-h-[240px] ${isListening ? 'is-listening' : ''}`}
                    onClick={toggleListening}
                  >
                     <AnimatePresence mode="wait">
                       {isProcessing ? (
                          <motion.div 
                            key="processing"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex flex-col items-center"
                          >
                             <div className="relative w-20 h-20 flex items-center justify-center">
                                <div className="absolute inset-0 border-4 border-indigo-50 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></div>
                             </div>
                             <div className="mt-5 text-[10px] orbitron-clean font-black text-indigo-700 tracking-[0.2em]">CONNECTED</div>
                          </motion.div>
                       ) : (
                          <motion.div 
                            key="idle"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex flex-col items-center"
                          >
                            <div className="relative mb-4">
                               <Bot className={`w-14 h-14 transition-all duration-700 ${isListening ? 'text-rose-500' : 'text-indigo-600'} ${isSpeaking ? 'scale-110 drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]' : ''}`} />
                               {isSpeaking && (
                                  <div className="absolute -inset-3 border-2 border-indigo-400 rounded-full animate-ping opacity-20"></div>
                               )}
                            </div>
                            <div className="text-3xl orbitron-clean font-black text-slate-800 tracking-tighter uppercase whitespace-nowrap">AI Assistant</div>
                            <div className="flex gap-1.5 mt-3">
                               <div className={`h-1.5 w-4 rounded-full ${isListening ? 'bg-rose-500' : 'bg-indigo-100'} animate-pulse`}></div>
                               <div className={`h-1.5 w-8 rounded-full ${isListening ? 'bg-rose-400' : 'bg-indigo-300'} animate-pulse [animation-delay:200ms]`}></div>
                               <div className={`h-1.5 w-4 rounded-full ${isListening ? 'bg-rose-500' : 'bg-indigo-100'} animate-pulse [animation-delay:400ms]`}></div>
                            </div>
                          </motion.div>
                       )}
                     </AnimatePresence>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="hud-column-right hidden lg:flex w-full lg:w-[340px] flex-col gap-4 shrink-0">
             <div className="hud-panel p-0">
               <div className="hud-header">SYSTEM_INVENTORY</div>
               <div className="p-6 space-y-5 max-h-[280px] overflow-y-auto custom-scroll-jarvis">
                  {systemData.items.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center gap-5 group">
                       <div className="w-12 h-12 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-center group-hover:border-indigo-300 transition-all">
                          <span className="font-black text-indigo-600 text-sm">{item.name.charAt(0)}</span>
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-slate-700 truncate">{item.name}</span>
                             <span className="text-[11px] mono font-bold text-indigo-600">{item.stock}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                             <div 
                               className={`h-full rounded-full transition-all duration-1000 ${
                                 item.stock < 10 ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
                               }`}
                               style={{ width: `${Math.min(100, item.stock)}%` }}
                             />
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
             </div>

             <div className="hud-panel flex-1 flex flex-col min-h-0 bg-slate-50/30">
                <div className="hud-header">ANALYTICS_CORE</div>
                <div className="p-6 flex-1 flex flex-col overflow-hidden">
                   <div className="flex gap-2.5 mb-6">
                      <button className="flex-1 hud-tab active">SUMMARY</button>
                      <button className="flex-1 hud-tab">TRENDS</button>
                   </div>

                   <div className="grid grid-cols-1 gap-4 mb-6">
                      <div className="bg-white p-5 rounded-2xl border border-indigo-50 relative overflow-hidden group shadow-sm">
                         <div className="text-[10px] orbitron-clean font-bold text-indigo-400 mb-1.5 uppercase">TODAY_REVENUE</div>
                         <div className="text-3xl font-black mono text-slate-800">৳{todayRevenue.toLocaleString()}</div>
                      </div>
                   </div>

                   <div className="flex-1 flex flex-col min-h-0">
                      <div className="text-[10px] orbitron-clean font-bold text-slate-400 mb-4 tracking-widest uppercase">NETWORK_LOAD</div>
                      <div className="flex-1 bg-white rounded-2xl border border-indigo-50 relative p-5 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.01)]">
                         <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-[0.07]">
                            <path d="M0,40 L0,30 L20,10 L40,25 L60,5 L80,20 L100,5 L100,40 Z" fill="url(#indigo-grad)" />
                            <polyline fill="none" stroke="#6366f1" strokeWidth="1.5" points="0,30 20,10 40,25 60,5 80,20 100,5" strokeLinecap="round" strokeLinejoin="round" />
                            <defs>
                               <linearGradient id="indigo-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
                                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                               </linearGradient>
                            </defs>
                         </svg>
                         <div className="relative z-10 flex flex-col justify-between h-full font-mono text-[10px] font-bold text-slate-500">
                            <div className="flex justify-between"><span className="text-indigo-500 font-bold">+8.1 TB/S</span><span>STABLE</span></div>
                            <div className="mt-auto flex justify-between"><span>UPTIME: 99.9%</span><span className="text-indigo-500">SECURE</span></div>
                         </div>
                      </div>
                   </div>

                   <div className="mt-6 p-5 bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl text-white shadow-xl overflow-hidden relative group">
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex items-center justify-between mb-2 relative z-10">
                          <ShieldCheck className="w-5 h-5 text-indigo-200" />
                          <span className="text-[10px] orbitron-clean font-black tracking-widest opacity-80">STABILITY_LINK</span>
                      </div>
                      <div className="text-3xl font-black mono relative z-10">HIGH</div>
                   </div>
                </div>
             </div>
          </div>
        </div>
        ) : (
          <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col gap-6 w-full pb-2 lg:pb-6 custom-scroll-jarvis">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full flex-1 min-h-0">
              
              {/* LEFT CARD: AI Configuration & Personality (Col span 4) */}
              <div className="lg:col-span-4 flex flex-col gap-5 h-full min-h-0 overflow-y-auto custom-scroll-jarvis">
                
                {/* Personality Card */}
                <div className="hud-panel p-6 bg-white flex flex-col gap-4 border border-indigo-150 shadow-md rounded-[20px]">
                  <div className="hud-header -mx-6 -mt-6 rounded-t-[20px] bg-gradient-to-r from-violet-500/10 to-indigo-500/10 text-indigo-700 px-6 py-4 flex items-center gap-2 font-bold uppercase tracking-wider text-xs">
                    <SettingsIcon className="w-4 h-4 text-indigo-605" />
                    <span>এআই ব্যক্তিত্ব সেটিংস (AI Personality Settings)</span>
                  </div>
                  
                  <div className="space-y-4 mt-2">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">এআই ব্যক্তিত্ব (AI Personality)</label>
                      <select 
                        value={aiSettings.personality || 'friendly'}
                        onChange={(e) => handleSaveAiSettings({ personality: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-205 focus:border-indigo-400 text-slate-700 font-semibold rounded-xl py-3 px-4 text-xs outline-none transition-all shadow-sm"
                      >
                        <option value="friendly">😊 বিনয়ী ও আন্তরিক সহকারী (Friendly & Warm)</option>
                        <option value="strict">💼 কড়া হিসাবরক্ষক ও পিনপয়েন্ট নির্ভুল (Strict & Firm)</option>
                        <option value="professional">🎓 প্রফেশনাল ও ধীরস্থির ম্যানেজার (Professional & Polite)</option>
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-semibold">
                        {aiSettings.personality === 'strict' 
                          ? 'এআই আপনার সাথে অত্যন্ত সংক্ষিপ্ত এবং শুধু নির্ভুল হিসাব নিয়ে কথা বলবে।'
                          : aiSettings.personality === 'friendly'
                          ? 'এআই খুব মধুর কণ্ঠে এবং আন্তরিকভাবে যেকোনো বিষয় বুঝিয়ে বলবে।'
                          : 'এআই প্রফেশনাল কর্পোরেট ম্যানেজারের মতো পরিমিত ভাষায় কথা বলবে।'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">কাস্টম স্বাগতম বার্তা (Custom Greeting Style)</label>
                      <textarea
                        value={aiSettings.customGreeting || ''}
                        onChange={(e) => handleSaveAiSettings({ customGreeting: e.target.value })}
                        placeholder="যেমন: 'আসসালামু আলাইকুম স্যার, বিসমিল্লাহ স্টোরে আপনাকে স্বাগতম। বলুন কিভাবে সাহায্য করতে পারি?'"
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-205 focus:border-indigo-400 text-slate-705 font-semibold rounded-xl py-3 px-4 text-xs outline-none transition-all shadow-sm placeholder:text-slate-350"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-semibold">
                        সহকারীকে প্রথম কানেক্ট করার সময় সে এই কাস্টম স্টাইল বজায় রেখে স্বাগতম জানাবে।
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-400 uppercase tracking-widest">শব্দকোষ স্মৃতিসীমা:</span>
                      <span className="font-bold text-indigo-600 font-mono">10,000+ TOKENS</span>
                    </div>
                  </div>
                </div>

                {/* Live AI Brain Simulator Sandbox */}
                <div className="hud-panel p-6 bg-slate-900 border border-slate-800 text-white rounded-[20px] shadow-lg flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                  
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300">লাইভ ব্রেন টেস্ট (Real-time Sandbox)</span>
                  </div>

                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                    আপনার সংরক্ষণ করা নতুন স্মৃতি এবং সেটিংস অ্যাসিস্ট্যান্টের উপরে কেমন প্রভাব ফেলছে তা রিয়েল-টাইমে এখানে পরীক্ষা করুন।
                  </p>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      placeholder="যেমন: শুক্রবার কি কোনো অফার আছে?"
                      className="w-full bg-slate-800/80 border border-slate-700 focus:border-indigo-500 text-white font-semibold rounded-xl py-2.5 px-4 text-xs outline-none transition-all placeholder:text-slate-500"
                    />

                    <button
                      onClick={handleTestBrain}
                      disabled={isTestingBrain || !testQuery.trim()}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      {isTestingBrain ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>ব্রেন জেনারেট করছে...</span>
                        </>
                      ) : (
                        <>
                          <Brain className="w-3.5 h-3.5 text-indigo-100" />
                          <span>মেমোরি টেস্ট করুন (Simulate Brain)</span>
                        </>
                      )}
                    </button>

                    {testResult && (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1 max-h-[140px] overflow-y-auto custom-scroll-jarvis">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">এআই ব্রেন রেসপন্স:</span>
                        <p className="text-xs text-slate-200 leading-relaxed font-semibold font-sans">{testResult}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instant Memory Templates */}
                <div className="hud-panel p-5 bg-indigo-50/50 border border-indigo-100 rounded-[20px] flex flex-col gap-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    <span>সহজ টেমপ্লেট গ্যালারি (Quick Templates)</span>
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "🎁 শুক্রবার অফার", text: "শুক্রবার সব কেনাকাটায় ৫% বিশেষ ক্যাশব্যাক অফার দেওয়া হবে এবং স্পেশাল গিফট পাবেন।", cat: "business_rules" },
                      { label: "🚚 ফ্রি হোম ডেলিভারি", text: "যে কোন কাস্টমার ৫,০০০ টাকার বেশি পণ্য অর্ডার করলে ঢাকার ভিতরে ফ্রি হোম ডেলিভারি দেওয়া হবে।", cat: "business_rules" },
                      { label: "⏰ দোকানের সময়", text: "দোকান খোলার সময় প্রতিদিন সকাল ১০:০০ টা এবং বন্ধের সময় রাত ১০:৩০ টা।", cat: "shop_info" },
                      { label: "👥 রহমান সাহেব নোট", text: "রহমান সাহেব আমাদের একজন রেগুলার কাস্টমার, উনার সাথে সদয় আচরণ করবেন এবং প্রয়োজনে বকেয়া অনুমোদন করতে পারেন।", cat: "customer_preference" }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={async () => {
                          if (!shopId) return;
                          try {
                            await addDoc(collection(db, 'ai_memories'), {
                              shopId,
                              text: item.text,
                              category: item.cat,
                              createdAt: new Date().toISOString(),
                              isActive: true
                            });
                          } catch (err) {
                            console.error("Error inserting template memory:", err);
                          }
                        }}
                        className="py-2.5 px-3 bg-white hover:bg-indigo-50 border border-slate-150 rounded-xl text-[10px] font-black text-slate-605 hover:text-indigo-600 transition-all text-left shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:scale-101 active:scale-99 h-[64px]"
                      >
                        <span className="text-indigo-600 truncate">{item.label}</span>
                        <span className="text-[8px] text-slate-400 font-bold line-clamp-1 block mt-1">ক্লিক করুন যুক্ত করতে</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* MIDDLE CARD: Knowledge Pool Facts (Col span 5) */}
              <div className="lg:col-span-5 flex flex-col gap-4 h-full min-h-0 overflow-hidden bg-white border border-indigo-100 shadow-md rounded-[20px] p-6">
                
                <div className="flex justify-between items-center border-b border-slate-105 pb-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">স্মৃতিভাণ্ডার ও সাধারণ নিয়ম (Knowledge Core)</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">এখানে এআই-এর জন্য কাস্টম তথ্য ও নিয়ম লিখুন</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full font-bold text-[10px] font-mono">
                    {memories.length} FACTS
                  </span>
                </div>

                {/* Add memory form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <input 
                        type="text"
                        placeholder="সহকারীকে মনে রাখতে বলুন: (যেমন: শুক্রবার ৫% ছাড়)"
                        value={newMemoryText}
                        onChange={e => setNewMemoryText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddMemory()}
                        className="w-full bg-white border border-slate-205 focus:border-indigo-400 text-slate-705 font-semibold rounded-lg py-2.5 px-3.5 text-xs outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <select 
                        value={newMemoryCategory}
                        onChange={e => setNewMemoryCategory(e.target.value)}
                        className="w-full bg-white border border-slate-205 focus:border-indigo-400 text-slate-705 font-semibold rounded-lg py-2.5 px-3 text-xs outline-none transition-all shadow-sm"
                      >
                        <option value="business_rules">📢 ব্যবসায়িক নিয়ম</option>
                        <option value="shop_info">🏪 সাধারণ তথ্য</option>
                        <option value="customer_preference">👥 কাস্টমার নোট</option>
                        <option value="general_context">📝 অন্যান্য জ্ঞান</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleAddMemory}
                      disabled={isSavingMemory || !newMemoryText.trim()}
                      className="px-5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 hover:scale-102 active:scale-98"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>মেমোরিতে যুক্ত করুন (Add to Core)</span>
                    </button>
                  </div>
                </div>

                {/* Memories list container */}
                <div className="flex-1 overflow-y-auto custom-scroll-jarvis space-y-3 pr-1">
                  {memories.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <Database className="w-10 h-10 text-slate-300 mb-3 animate-[pulse_2s_infinite]" />
                      <p className="text-xs text-slate-400 font-bold">কোনো কাস্টম স্মৃতি যুক্ত করা হয়নি এখনও।</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[240px]">ডানপাশের ফর্ম ব্যবহার করে প্রথম পয়েন্ট যোগ করুন, এবং অ্যাসিস্ট্যান্টকে সেটি বাস্তব সময়ে প্রয়োগ করতে দেখুন!</p>
                    </div>
                  ) : (
                    memories.map((m) => {
                      let catColor = "bg-rose-50 text-rose-600 border-rose-100";
                      let catLabel = "অন্যান্য জ্ঞান";
                      if (m.category === "business_rules") {
                        catColor = "bg-emerald-50 text-emerald-600 border-emerald-100";
                        catLabel = "ব্যবসায়িক নিয়ম";
                      } else if (m.category === "shop_info") {
                        catColor = "bg-blue-50 text-blue-600 border-blue-105";
                        catLabel = "সাধারণ তথ্য";
                      } else if (m.category === "customer_preference") {
                        catColor = "bg-purple-50 text-purple-600 border-purple-100";
                        catLabel = "কাস্টমার নোট";
                      }

                      return (
                        <div key={m.id} className="p-3.5 bg-white border border-slate-105 hover:border-indigo-100 rounded-xl flex items-start gap-3.5 justify-between transition-all group hover:shadow-sm">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${catColor}`}>
                              {catLabel}
                            </span>
                            <p className="text-xs font-semibold text-slate-700 leading-relaxed font-sans">{m.text}</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteMemory(m.id)}
                            className="p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all self-center shrink-0"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

              {/* RIGHT CARD: Phonetic Synonyms (Col span 3) */}
              <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-0 overflow-hidden bg-white border border-indigo-100 shadow-md rounded-[20px] p-6">
                
                <div className="flex justify-between items-center border-b border-slate-105 pb-4">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">উচ্চারণ অভিধান ও প্রতিশব্দ (Synonyms)</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">আঞ্চলিক বা কথ্য ভাষা ম্যাপিং রাখুন</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full font-bold text-[10px] font-mono">
                    {synonyms.length}
                  </span>
                </div>

                {/* Add Synonym Form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">উচ্চারণ বা ডাকনাম (Spoken Word)</label>
                    <input 
                      type="text"
                      placeholder="যেমন: আদা, পিয়াজ, চিনিগুড়া"
                      value={newSpokenWord}
                      onChange={e => setNewSpokenWord(e.target.value)}
                      className="w-full bg-white border border-slate-205 focus:border-indigo-400 text-slate-705 font-semibold rounded-lg py-2 px-3 text-xs outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">সিস্টেমের মূল প্রোডাক্ট (Actual Product)</label>
                    <input 
                      type="text"
                      placeholder="যেমন: Ginger, Onion Red, Rice Chinigura"
                      value={newActualProduct}
                      onChange={e => setNewActualProduct(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddSynonym()}
                      className="w-full bg-white border border-slate-205 focus:border-indigo-400 text-slate-705 font-semibold rounded-lg py-2 px-3 text-xs outline-none transition-all shadow-sm"
                    />
                  </div>
                  <button 
                    onClick={handleAddSynonym}
                    disabled={!newSpokenWord.trim() || !newActualProduct.trim()}
                    className="w-full py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 rounded-lg text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>শব্দ অভিধানে যুক্ত করুন</span>
                  </button>
                </div>

                {/* Synonym Mappings Table */}
                <div className="flex-1 overflow-y-auto custom-scroll-jarvis space-y-2 pr-1">
                  {synonyms.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-[10px] text-slate-400 font-bold">কোন শব্দ ম্যাপিং যোগ করা নেই।</p>
                      <p className="text-[8px] text-slate-400 mt-0.5 line-clamp-3">যেমন বাংলায় মুখের কথা "কোকা কোলা" কে ইনভেন্টরির "Coca Cola Can" এর সাথে মেলাতে প্রতিশব্দ যোগ করুন।</p>
                    </div>
                  ) : (
                    synonyms.map((s) => (
                      <div key={s.id} className="p-3 bg-white border border-slate-105 hover:border-indigo-50 rounded-lg flex justify-between items-center transition-all group shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-rose-500 font-mono">"{s.spokenWord}"</span>
                            <span className="text-[9px] text-slate-400">➔</span>
                            <span className="text-[10px] font-black text-indigo-600 font-mono truncate max-w-[100px]">{s.actualProductName}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteSynonym(s.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 rounded-md hover:bg-slate-50 transition-all ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
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
           onClick={onClose}
           className="px-8 hud-panel flex items-center justify-center group overflow-hidden border-indigo-100 hover:border-rose-300 transition-all"
         >
            <X className="w-5 h-5 text-indigo-400 group-hover:text-rose-500 transition-colors" />
            <div className="absolute inset-0 bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
         </button>
      </div>
      </div>
    </div>
  );
};
