import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle2, 
  ArrowLeft, 
  ChevronRight, 
  ShoppingBag, 
  Receipt, 
  History, 
  Globe, 
  Building2, 
  Phone, 
  User, 
  Barcode, 
  Download, 
  Printer, 
  MapPin, 
  Sparkles,
  SearchCode,
  AlertCircle,
  Hash,
  Mic,
  MicOff,
  MessageSquare,
  X,
  Bot,
  Send,
  Volume2,
  VolumeX,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, collection, addDoc, getDocs, query, where, doc, getDoc, onSnapshot, handleFirestoreError, OperationType } from '../firebase';
import ReactBarcode from 'react-barcode';

interface CustomerPortalProps {
  onBack: () => void;
  lang: 'en' | 'bn' | 'ar';
  platformBranding?: { logoBase64: string | null };
}

export function CustomerPortal({ onBack, lang, platformBranding }: CustomerPortalProps) {
  const isBn = lang === 'bn';

  const isValidImageSource = (src: any): boolean => {
    if (!src || typeof src !== 'string') return false;
    const s = src.trim();
    if (s.startsWith('<svg') || s.includes('xmlns="http://www.w3.org/2000/svg"')) return false;
    return s.startsWith('data:image/') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/') || s.startsWith('./');
  };

  const getShopInitials = (name: string): string => {
    if (!name) return 'M';
    const cleanName = name.trim();
    // Filter out parts and return initials
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'M';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  };

  const toBengaliNumber = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
  };

  const toArabicNumber = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null) return '';
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.toString().replace(/\d/g, (digit) => arabicDigits[parseInt(digit)]);
  };

  const formatVal = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === 'NaN') return '0';
    const num = Number(val);
    const formatted = isNaN(num) 
      ? '0' 
      : num.toLocaleString(lang === 'bn' ? 'bn-BD' : lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (lang === 'bn') return toBengaliNumber(formatted);
    if (lang === 'ar') return toArabicNumber(formatted);
    return formatted;
  };

  // UI Stages: 'shop_selection' | 'customer_login' | 'dashboard'
  const [stage, setStage] = useState<'shop_selection' | 'customer_login' | 'dashboard'>('shop_selection');
  
  // Lists fetched from DB
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<any>(null);

  const currencySuffix = selectedShop?.currencySymbol ? ' ' + selectedShop.currencySymbol : (lang === 'bn' ? ' ৳' : ' TK');
  const [searchShopQuery, setSearchShopQuery] = useState('');
  
  // Auth Form
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active User View Tabs: 'shop' | 'order_cart' | 'invoice_tracker' | 'orders'
  const [activeTab, setActiveTab] = useState<'shop' | 'order_cart' | 'invoice_tracker' | 'orders'>('shop');

  // Products under selected shop
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchProductQuery, setSearchProductQuery] = useState('');

  // Cart configuration
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bkash'>('cod');
  const [bKashSender, setBKashSender] = useState('');
  const [bKashTxnId, setBKashTxnId] = useState('');
  const [bKashScreenshot, setBKashScreenshot] = useState<string>('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccessId, setOrderSuccessId] = useState<string | null>(null);

  // Step 4: WhatsApp Sync and Handshake state
  const [orderSyncStatus, setOrderSyncStatus] = useState<'idle' | 'firebase' | 'compiler' | 'dispatching' | 'delivered' | 'failed'>('idle');
  const [syncOrderData, setSyncOrderData] = useState<any | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Invoice Lookup state
  const [invoiceSearchId, setInvoiceSearchId] = useState('');
  const [lookupSale, setLookupSale] = useState<any>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searchingInvoice, setSearchingInvoice] = useState(false);

  // Customer order history
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);

  // AI Voice and Chat Assistant State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<{ id: string; sender: 'user' | 'assistant'; text: string; timestamp: number }[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: lang === 'bn' 
        ? 'আসসালামু আলাইকুম! আমি আপনার সহকারী। ভয়েস দিয়ে প্রোডাক্ট অর্ডার করতে বা কোনো ইনভয়েস ট্র্যাক করতে নিচে মাইক বোতাম টিপুন। অথবা আপনি কোনো প্রশ্ন লিখে পাঠাতে পারেন।'
        : lang === 'ar'
        ? 'مرحباً! أنا مساعدك الشخصي. لطلب منتجات أو تتبع فاتورة بصوتك، اضغط على زر الميكروفون أدناه.'
        : 'Hello! I am your shop assistant. Press the microphone button below to order items by voice, track an invoice, or type any questions.',
      timestamp: Date.now()
    }
  ]);
  const [assistantInput, setAssistantInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechFeedback, setSpeechFeedback] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Helper function for Speech Synthesis (Text-to-Speech)
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'bn' ? 'bn-BD' : lang === 'ar' ? 'ar-EG' : 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS Speech Synthesis failed:", e);
    }
  };

  // Helper function to process voice or text query inputs from the customer
  const processCustomerVoiceCommand = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    // Add user message to history
    const userMsg = {
      id: 'cust_msg_' + Date.now(),
      sender: 'user' as const,
      text: text,
      timestamp: Date.now()
    };
    setAssistantMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const lower = text.toLowerCase();
      let handled = false;
      let replyText = "";

      // --- 1. RECEIPT / INVOICE TRACKER ---
      // Matches invoice numbers (like SL-WR-10, BR1-123, or just numbers)
      const invoiceTriggers = ["রশিদ", "ইনভয়েস", "চালান", "বিল", "receipt", "invoice", "bill", "track", "lookup", "দেখাও", "দেখুন", "খুঁজুন", "চেক"];
      const containsInvoiceKeyword = invoiceTriggers.some(keyword => lower.includes(keyword));

      if (containsInvoiceKeyword) {
        // Find potential alphanumeric pattern representing invoice ID
        const match = lower.match(/(?:no\.?|number|নং|নম্বর|ইনভয়েস|চালান|রশিদ|receipt|invoice|bill)?\s*([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)/i);
        if (match && match[1]) {
          const potentialId = match[1].toUpperCase();
          if (potentialId && potentialId.length >= 2) {
            setInvoiceSearchId(potentialId);
            setActiveTab('invoice_tracker');
            
            // Invoke tracking lookup directly
            setTimeout(async () => {
              // Set search state and trigger lookup
              setInvoiceSearchId(potentialId);
              const customEvent = new KeyboardEvent('keydown', { key: 'Enter' });
              // Direct lookup
              await handleViewInvoiceDirect(potentialId);
            }, 150);

            replyText = lang === 'bn' 
              ? `আমি আপনার জন্য রশিদ নং "${potentialId}" খুঁজে বের করছি।` 
              : lang === 'ar'
              ? `أبحث عن رقم الفاتورة "${potentialId}" من أجلك.`
              : `I am looking up the receipt number "${potentialId}" for you.`;
            handled = true;
          }
        }
      }

      // --- 2. SWITCH TAB TO CART / CHECKOUT ---
      if (!handled && (lower.includes("কার্ট") || lower.includes("অর্ডার কার্ট") || lower.includes("checkout") || lower.includes("চেকআউট") || lower.includes("অর্ডার দেখাও") || lower.includes("cart") || lower.includes("ঝুড়ি"))) {
        setActiveTab('order_cart');
        replyText = lang === 'bn' 
          ? "আমি আপনার অর্ডার কার্ট ওপেন করেছি। এখানে আপনার প্রোডাক্টগুলো দেখতে পাবেন এবং অর্ডার কনফার্ম করতে পারবেন।" 
          : lang === 'ar'
          ? "لقد فتحت سلة طلباتك. هنا يمكنك مراجعة وتأكيد طلبك."
          : "I have opened your order cart. Here you can see your selected products and submit your order.";
        handled = true;
      }

      // --- 2.1 VOICE ORDER PLACEMENT / CONFIRMATION (STEP 3) ---
      const placeOrderTriggers = [
        "অর্ডার কনফার্ম", "কনফার্ম করো", "কনফার্ম করুন", "অর্ডার করো", "অর্ডার করুন", 
        "প্লেস করো", "প্লেস করুন", "সাবমিট করো", "অর্ডার সম্পন্ন", "ডেলিভারি দাও",
        "confirm order", "place order", "submit order", "complete order", "place my order", "checkout cart"
      ];
      if (!handled && placeOrderTriggers.some(trigger => lower.includes(trigger))) {
        if (cart.length === 0) {
          replyText = lang === 'bn' 
            ? "আপনার কার্ট বর্তমানে খালি রয়েছে। দয়া করে প্রথমে কিছু প্রোডাক্ট কার্টে যোগ করুন।" 
            : lang === 'ar'
            ? "سلتك فارغة حالياً. يرجى إضافة بعض المنتجات أولاً."
            : "Your cart is currently empty. Please add some products to your cart first.";
        } else {
          setActiveTab('order_cart');
          setTimeout(async () => {
            await handlePlaceOrder();
          }, 500);
          replyText = lang === 'bn' 
            ? "জি, আমি এখনই আপনার অর্ডারটি কনফার্ম করে দিচ্ছি! দয়া করে একটু অপেক্ষা করুন..." 
            : lang === 'ar'
            ? "جاري تأكيد طلبك الآن! يرجى الانتظار لحظة..."
            : "Yes, I am placing your order right away! Please wait a moment...";
        }
        handled = true;
      }

      // --- 2.2 BILL / TOTAL VALUE INQUIRY (STEP 3) ---
      const billInquiryTriggers = [
        "বিল কত", "টোটাল কত", "মোট বিল", "আমার বিল", "কত টাকা হয়েছে", "টাকা কত", "কত টাকা",
        "total bill", "how much is my bill", "grand total", "total value", "how much money", "my bill"
      ];
      if (!handled && billInquiryTriggers.some(trigger => lower.includes(trigger))) {
        if (cart.length === 0) {
          replyText = lang === 'bn' 
            ? "আপনার কার্ট খালি রয়েছে। কোনো পণ্য যোগ করা হয়নি।" 
            : lang === 'ar'
            ? "سلتك فارغة. لم تقم بإضافة أي منتج بعد."
            : "Your cart is empty. No products have been added yet.";
        } else {
          const itemSummary = cart.map(i => `${i.quantity}টি ${i.product.name}`).join(", ");
          replyText = lang === 'bn' 
            ? `আপনার কার্টে রয়েছে ${itemSummary}। বিকাশ ফি সহ আপনার সর্বমোট বিল হচ্ছে ${cartTotal} টাকা।` 
            : lang === 'ar'
            ? `سلتك تحتوي على ${itemSummary}. إجمالي الفاتورة هو ${cartTotal} TK.`
            : `Your cart contains ${itemSummary}. Your grand total bill is ${cartTotal} TK.`;
        }
        handled = true;
      }

      // --- 2.3 EMPTY / CLEAR CART (STEP 3) ---
      const clearCartTriggers = [
        "কার্ট খালি", "খালি করো", "খালি করুন", "সব ডিলিট", "সব মুছে", "ডিলিট করো কার্ট",
        "clear cart", "empty cart", "clear my cart", "delete all items"
      ];
      if (!handled && clearCartTriggers.some(trigger => lower.includes(trigger))) {
        if (cart.length === 0) {
          replyText = lang === 'bn' 
            ? "আপনার কার্ট ইতিমধ্যে খালি রয়েছে।" 
            : lang === 'ar'
            ? "سلتك فارغة بالفعل."
            : "Your cart is already empty.";
        } else {
          setCart([]);
          replyText = lang === 'bn' 
            ? "জি, আমি আপনার কার্টের সব প্রোডাক্ট মুছে ফেলেছি এবং কার্ট খালি করে দিয়েছি।" 
            : lang === 'ar'
            ? "تم إفراغ سلة المشتريات بالكامل بنجاح."
            : "Understood, I have successfully cleared all products from your cart.";
        }
        handled = true;
      }

      // --- 2.4 REMOVE SPECIFIC ITEM FROM CART (STEP 3) ---
      const removeTriggers = ["রিমুভ", "বাদ দাও", "মুছে ফেলো", "ডিলিট করো", "বাদ দিন", "সরিয়ে ফেলুন", "remove", "delete", "discard", "throw away"];
      if (!handled && removeTriggers.some(trigger => lower.includes(trigger))) {
        let removedProduct = null;
        for (const item of cart) {
          const prodName = item.product.name.toLowerCase();
          if (lower.includes(prodName) || prodName.split(/\s+/).some((word: string) => word.length > 2 && lower.includes(word))) {
            removedProduct = item.product;
            break;
          }
        }
        if (removedProduct) {
          removeFromCart(removedProduct.id);
          replyText = lang === 'bn' 
            ? `ঠিক আছে, আমি আপনার কার্ট থেকে "${removedProduct.name}" বাদ দিয়েছি।` 
            : lang === 'ar'
            ? `حسناً، لقد قمت بإزالة "${removedProduct.name}" من سلتك.`
            : `Alright, I have removed "${removedProduct.name}" from your order cart.`;
          handled = true;
        }
      }

      // --- 3. SWITCH TAB TO PRODUCTS CATALOG ---
      if (!handled && (lower.includes("শপ") || lower.includes("প্রোডাক্ট") || lower.includes("ক্যাটালগ") || lower.includes("shop") || lower.includes("catalog") || lower.includes("মেনু") || lower.includes("menu"))) {
        setActiveTab('shop');
        replyText = lang === 'bn' 
          ? "আমি ক্যাটালগ শপ ওপেন করেছি। আপনার প্রয়োজনীয় প্রোডাক্টগুলো যোগ করুন।" 
          : lang === 'ar'
          ? "لقد فتحت دليل المنتجات. تصفح وأضف ما تريده إلى السلة."
          : "I have opened the shop catalog. Feel free to browse and add products to your cart.";
        handled = true;
      }

      // --- 4. VOICE ORDERING: MATCH PRODUCT AND ADD TO CART ---
      if (!handled) {
        const matchedItems: { product: any; qty: number }[] = [];

        // Simple fuzzy matching against current shop's product list
        for (const prod of products) {
          const prodName = prod.name.toLowerCase();
          if (lower.includes(prodName) || prodName.split(/\s+/).some((word: string) => word.length > 2 && lower.includes(word))) {
            let quantity = 1;
            // Search for quantity triggers before/after the name
            const numRegex = new RegExp(`([0-9\\u09E6-\\u09EF]+)\\s*(?:kg|kg\\.|piece|pcs|টি|কেজি|গ্রাম|gm|x)?\\s*${prodName}`, 'i');
            const matchNum = lower.match(numRegex);
            if (matchNum) {
              const rawNum = matchNum[1];
              const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
              let englishNum = '';
              for (const char of rawNum) {
                const index = bnDigits.indexOf(char);
                if (index !== -1) englishNum += index.toString();
                else englishNum += char;
              }
              const parsedQty = parseInt(englishNum, 10);
              if (!isNaN(parsedQty) && parsedQty > 0) {
                quantity = parsedQty;
              }
            }
            matchedItems.push({ product: prod, qty: quantity });
          }
        }

        if (matchedItems.length > 0) {
          // Add products to cart
          matchedItems.forEach(item => {
            for (let q = 0; q < item.qty; q++) {
              addToCart(item.product);
            }
          });

          const itemSummary = matchedItems.map(i => `${i.qty}x ${i.product.name}`).join(", ");
          replyText = lang === 'bn' 
            ? `আমি আপনার কার্টে ${itemSummary} যোগ করেছি!` 
            : lang === 'ar'
            ? `لقد أضفت ${itemSummary} إلى سلتك بنجاح!`
            : `I have successfully added ${itemSummary} to your cart!`;
          handled = true;
        }
      }

      // --- 5. DYNAMIC GENERAL CHAT AI ASSISTANT (FALLBACK VIA SERVER-SIDE GEMINI) ---
      if (!handled) {
        try {
          const prompt = `
You are a warm, extremely polite, and helpful AI shop assistant for the shop "${selectedShop?.name || 'ShopMaster'}".
The customer is logged in as: "${currentCustomer?.name || 'Guest'}" (Phone: ${currentCustomer?.phone || 'Unknown'}).
Available product categories: ${categories.map(c => c.name).join(", ")}.
Available products in stock catalog: ${products.map(p => `${p.name} (${p.price} TK)`).slice(0, 30).join(", ")}.
The customer asks: "${text}".

Rules:
1. Provide a helpful, concise answer in maximum 1-2 short sentences.
2. Be extremely polite and warm.
3. Match the user's spoken language exactly (Bengali, English, or Arabic).
4. Do not include markdown tags or raw JSON. Keep it as friendly natural voice output.
          `;

          const response = await fetch('/api/gemini/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              config: {
                model: "gemini-3.5-flash",
                generationConfig: {
                  temperature: 0.6,
                  maxOutputTokens: 120
                }
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.text) {
              replyText = data.text.trim();
              handled = true;
            }
          }
        } catch (apiErr) {
          console.error("Gemini assistant generation error:", apiErr);
        }
      }

      // Default fallback if no handler succeeded
      if (!replyText) {
        replyText = lang === 'bn' 
          ? "দুঃখিত, আমি আপনার কথাটি বুঝতে পারিনি। অনুগ্রহ করে অন্যভাবে বলুন।" 
          : lang === 'ar'
          ? "عذراً، لم أفهم طلبك جيداً. هل يمكنك إعادة صياغته؟"
          : "Sorry, I could not understand that request. Could you please rephrase?";
      }

      // Add assistant response
      const assistantMsg = {
        id: 'cust_msg_' + Date.now(),
        sender: 'assistant' as const,
        text: replyText,
        timestamp: Date.now()
      };
      setAssistantMessages(prev => [...prev, assistantMsg]);

      // Speak if not muted
      if (!isMuted) {
        speak(replyText);
      }

    } catch (err) {
      console.error("Error in processCustomerVoiceCommand:", err);
      const errText = lang === 'bn' 
        ? "ভয়েস প্রসেস করার সময় একটি সমস্যা দেখা দিয়েছে।" 
        : "An error occurred while processing your voice command.";
      setAssistantMessages(prev => [...prev, { id: 'cust_msg_err_' + Date.now(), sender: 'assistant', text: errText, timestamp: Date.now() }]);
      if (!isMuted) speak(errText);
    } finally {
      setIsProcessing(false);
    }
  };

  // Start Browser-level Speech Recognition
  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(lang === 'bn' ? "ভয়েস রিকগনিশন আপনার ব্রাউজারে সাপোর্ট করে না।" : "Speech recognition is not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch(e) {}
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = lang === 'bn' ? 'bn-BD' : lang === 'ar' ? 'ar-EG' : 'en-US';

    rec.onstart = () => {
      setIsListening(true);
      setSpeechFeedback("");
    };

    let finalTranscript = "";
    rec.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setSpeechFeedback(finalTranscript || interimTranscript);
    };

    rec.onerror = (e: any) => {
      console.error("Browser speech recognition error:", e.error);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
      const textToProcess = finalTranscript.trim();
      if (textToProcess) {
        processCustomerVoiceCommand(textToProcess);
      }
      setSpeechFeedback("");
    };

    recognitionRef.current = rec;
    rec.start();
  };

  // Stop Browser-level Speech Recognition
  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setIsListening(false);
  };

  // Fetch shops
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'shops'));
        const shopList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setShops(shopList);
        
        // Auto-select shop from URL if present
        const path = window.location.pathname;
        const match = path.match(/^\/merchant\/(.+)$/i);
        if (match && match[1]) {
           const codeFromUrl = match[1].trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
           const foundShop = (shopList as any[]).find((s: any) => {
              const dbShopCode = (s.shopCode || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
              const dbId = (s.id || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
              const dbShopId = (s.shopId || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
              return dbShopCode === codeFromUrl || dbId === codeFromUrl || dbShopId === codeFromUrl || (s.shopCode || '').toString().trim().toLowerCase() === match[1].trim().toLowerCase() || (s.id || '').toString().trim().toLowerCase() === match[1].trim().toLowerCase();
           });
           if (foundShop) {
              setSelectedShop(foundShop);
              setStage('customer_login');
           } else {
              setSearchShopQuery(match[1].trim());
           }
        }
      } catch (err) {
        console.error("Error fetching shops for customer:", err);
      }
    };
    fetchShops();
  }, []);

  // Fetch products and categories when shop is selected
  useEffect(() => {
    if (!selectedShop) return;

    // Load Categories
    const unsubCat = onSnapshot(query(collection(db, 'categories'), where('shopId', '==', selectedShop.id)), (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });

    // Load Products
    const unsubProd = onSnapshot(query(collection(db, 'products'), where('shopId', '==', selectedShop.id)), (snap) => {
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    return () => {
      unsubCat();
      unsubProd();
    };
  }, [selectedShop]);

  // Synchronize browser tab title based on selected merchant context
  useEffect(() => {
    if (selectedShop && stage !== 'shop_selection') {
      document.title = selectedShop.name || "SHP MASTER";
    } else {
      document.title = "SHP MASTER";
    }
  }, [selectedShop, stage]);

  // Sync historical orders for this phone of this shop
  useEffect(() => {
    if (!selectedShop || !currentCustomer) return;

    const q = query(
      collection(db, 'customer_orders'), 
      where('shopId', '==', selectedShop.id),
      where('customerPhone', '==', currentCustomer.phone)
    );

    const unsubOrders = onSnapshot(q, (snap) => {
      setCustomerOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customer_orders');
    });

    return () => unsubOrders();
  }, [selectedShop, currentCustomer]);

  const handleSelectShop = (shop: any) => {
    setSelectedShop(shop);
    setStage('customer_login');
  };

  // Auto-select shop if exact match is entered or scanned
  useEffect(() => {
    if (stage === 'shop_selection' && searchShopQuery.trim().length >= 4) {
      const queryRaw = searchShopQuery.trim().toLowerCase();
      const numericQuery = queryRaw.replace(/^shp-/, '').replace(/[^0-9]/g, '');
      const exactMatch = shops.find((s: any) => {
        const dbShopCode = (s.shopCode || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
        const dbId = (s.id || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
        const dbShopId = (s.shopId || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
        
        const isExactCode = dbShopCode === numericQuery || dbId === numericQuery || dbShopId === numericQuery;
        const isExactDirect = (s.shopCode || '').toString().trim().toLowerCase() === queryRaw || (s.id || '').toString().trim().toLowerCase() === queryRaw;
        
        return isExactCode || isExactDirect;
      });
      if (exactMatch) {
        setSelectedShop(exactMatch);
        setStage('customer_login');
      }
    }
  }, [searchShopQuery, shops, stage]);

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!phone.trim()) return;

    try {
      // Look up in database customers collection under selected shop
      const q = query(
        collection(db, 'customers'), 
        where('shopId', '==', selectedShop.id), 
        where('phone', '==', phone.trim())
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Customer exists
        const custDoc = querySnapshot.docs[0];
        setCurrentCustomer({ id: custDoc.id, ...custDoc.data() });
        setStage('dashboard');
      } else {
        // Customer not found, self-registration is disabled
        setLoginError(isBn 
          ? "এই মোবাইল নম্বরটি নিবন্ধিত নয়। কাস্টমার অ্যাকাউন্ট তৈরির অনুমতি নেই। এক্সেস পেতে অনুগ্রহ করে মার্চেন্ট বা দোকানদারের সাথে যোগাযোগ করুন।" 
          : "This mobile number is not registered. Self-registration is disabled. Please contact the merchant to be added as a customer for access."
        );
      }
    } catch (err) {
      console.error(err);
      setLoginError(isBn ? "লগইন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" : "Login failed. Please try again.");
    }
  };

  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !selectedShop) return;

    try {
      const newCustomer = {
        name: customerName.trim(),
        phone: phone.trim(),
        shopId: selectedShop.id,
        currentDue: 0,
        points: 0,
        totalSpent: 0,
        serialNumber: Date.now(),
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'customers'), newCustomer);
      setCurrentCustomer({ id: docRef.id, ...newCustomer });
      setStage('dashboard');
      setIsNewCustomer(false);
    } catch (err) {
      console.error(err);
      setLoginError(isBn ? "রেজিস্ট্রেশন ব্যর্থ হয়েছে।" : "Registration failed.");
    }
  };

  // Cart operations
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, val: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + val;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as any;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartSubtotal = cart.reduce((tot, item) => tot + ((Number(item.product.price) || 0) * item.quantity), 0);
  
  const bKashType = selectedShop?.paymentConfig?.bKashType || 'none';
  const paymentCharge = (paymentMethod === 'bkash' && (bKashType === 'merchant' || bKashType === 'personal')) 
    ? Math.round(cartSubtotal * 0.018) 
    : 0;
  const cartTotal = cartSubtotal + paymentCharge;

  const runWhatsAppSync = async (orderData: any) => {
    setOrderSyncStatus('firebase');
    setSyncOrderData(orderData);
    setSyncError(null);

    // Simulate invoice compilation
    setTimeout(async () => {
      setOrderSyncStatus('compiler');
      await new Promise(resolve => setTimeout(resolve, 1000));

      setOrderSyncStatus('dispatching');
      try {
        const itemsSummary = orderData.items.map((item: any) => `• ${item.productName} (${item.quantity} ${item.unit || 'unit'})`).join('\n');
        
        let customMessage = '';
        if (lang === 'bn') {
          customMessage = `🔔 *নতুন অর্ডার প্লেস হয়েছে!*

প্রিয় *${orderData.customerName}*,
আপনার ডিজিটাল অর্ডারটি সফলভাবে আমাদের সিস্টেমের সাথে সিঙ্ক করা হয়েছে।

📋 *অর্ডার নম্বর:* #${orderData.orderNumber}
💵 *সর্বমোট বিল:* ${orderData.totalAmount} TK
🚚 *পেমেন্ট পদ্ধতি:* ${orderData.paymentMethod === 'bkash' ? 'বিকাশ (যাচাইধীন)' : 'ক্যাশ অন ডেলিভারি'}

🛍️ *ক্রয়কৃত আইটেমস:*
${itemsSummary}

*স্টোর:* ${selectedShop?.name || 'স্টোর'}
আমরা শীঘ্রই আপনার সাথে যোগাযোগ করছি। ধন্যবাদ!`;
        } else {
          customMessage = `🔔 *New Order Placed!*

Dear *${orderData.customerName}*,
Your digital order has been successfully synced with our POS gateway.

📋 *Order Number:* #${orderData.orderNumber}
💵 *Grand Total:* ${orderData.totalAmount} TK
🚚 *Payment Method:* ${orderData.paymentMethod === 'bkash' ? 'bKash Verification' : 'Cash on Delivery'}

🛍️ *Order Items:*
${itemsSummary}

*Shop:* ${selectedShop?.name || 'Shop'}
We will contact you shortly to confirm your order. Thank you!`;
        }

        const shopId = selectedShop.id || 'pos-merchant-master';
        const activeApiKey = selectedShop.waLinkSecret || selectedShop.zender_api_key || selectedShop.waToken || '4fe17fcfe73d5035f55b9144fa10e07443659005';
        const activeDeviceId = selectedShop.waInstanceId || selectedShop.zender_whatsapp_device_id || selectedShop.zender_device_id || 'sim_device_pos_sync';

        const response = await fetch('/api/gateways/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopId,
            gatewayConfig: {
              default_route: 'whatsapp',
              waGatewayType: (selectedShop as any).waGatewayType || 'baileys',
              meta_phone_number_id: (selectedShop as any).meta_phone_number_id || (selectedShop as any).metaPhoneNumberId || '',
              meta_access_token: (selectedShop as any).meta_access_token || (selectedShop as any).metaAccessToken || '',
              meta_waba_id: (selectedShop as any).meta_waba_id || (selectedShop as any).metaWabaId || '',
              baileys_phone: (selectedShop as any).baileys_phone || (selectedShop as any).baileysPhone || '',
              zender_whatsapp_device_id: activeDeviceId,
              zender_api_key: activeApiKey,
              endpoint_url: 'https://app.sellerscampus.com/api/v1'
            },
            sale: {
              id: orderData.orderNumber,
              customerPhone: orderData.customerPhone,
              message: customMessage
            }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success) {
            setOrderSyncStatus('delivered');
          } else {
            console.error('Dispatch API error:', resData.error);
            setOrderSyncStatus('failed');
            setSyncError(resData.error || 'Gateway refused connection.');
          }
        } else {
          setOrderSyncStatus('failed');
          setSyncError(`Gateway error (HTTP ${response.status})`);
        }
      } catch (dispatchErr: any) {
        console.error('Dispatch error:', dispatchErr);
        setOrderSyncStatus('failed');
        setSyncError(dispatchErr.message || 'Network error.');
      }
    }, 1000);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || !currentCustomer || !selectedShop) return;
    if (paymentMethod === 'bkash' && (!bKashSender || !bKashTxnId)) {
      alert(isBn ? "বিকাশ নম্বর এবং ট্রানজ্যাকশন আইডি প্রদান করুন" : "Please provide bKash number and Transaction ID.");
      return;
    }

    setPlacingOrder(true);
    try {
      const orderData = {
        shopId: selectedShop.id,
        customerPhone: currentCustomer.phone,
        customerName: currentCustomer.name,
        customerId: currentCustomer.id,
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          unit: item.product.unit || 'unit',
          imageUrl: item.product.imageUrl || ''
        })),
        totalAmount: cartTotal,
        subtotal: cartSubtotal,
        paymentCharge: paymentCharge,
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === 'bkash' ? 'verifying' : 'unpaid',
        paymentDetails: paymentMethod === 'bkash' ? {
          sender: bKashSender,
          txnId: bKashTxnId,
          screenshot: bKashScreenshot
        } : null,
        status: 'pending', // pending, approved, cancelled
        notes: orderNotes.trim(),
        timestamp: new Date().toISOString(),
        orderNumber: 'ORD-' + Math.floor(100000 + Math.random() * 900000)
      };

      await addDoc(collection(db, 'customer_orders'), orderData);
      
      // Also save notification for merchant
      if (paymentMethod === 'bkash') {
        await addDoc(collection(db, 'notifications'), {
          shopId: selectedShop.id,
          title: 'bKash Payment Verification Needed',
          message: `Customer ${currentCustomer.name} sent ${cartTotal} Tk via bKash. Txn ID: ${bKashTxnId}, From: ${bKashSender}`,
          type: 'payment',
          timestamp: new Date().toISOString(),
          read: false,
          actionId: orderData.orderNumber
        });
      }

      setOrderSuccessId(orderData.orderNumber);
      setCart([]);
      setOrderNotes('');
      setPaymentMethod('cod');
      setBKashSender('');
      setBKashTxnId('');
      setBKashScreenshot('');
      
      // Trigger Step 4 sync
      await runWhatsAppSync(orderData);
    } catch (err) {
      console.error(err);
      alert(isBn ? "অর্ডার সাবমিট করতে সমস্যা হয়েছে।" : "Order submission failed.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const cleanInvoiceSearchKey = (input: string): string => {
    let clean = input.trim();
    // Strip common EN/BN prefixes (case-insensitive)
    const prefixRegex = /^(view\s*receipt\s*:?|receipt\s*no\.?\s*:?|receipt\s*:?|invoice\s*no\.?\s*:?|inv\s*no\.?\s*:?|invoice\s*:?|inv\s*:?|নং\s*:?|ইনভয়েস\s*নং\s*:?|চালান\s*নং\s*:?|ইনভয়েস\s*:?|চালান\s*রশিদ\s*দেখুন|রশিদ\s*দেখুন|রশিদ\s*:?)/i;
    clean = clean.replace(prefixRegex, '');
    // Strip any emojis, brackets, colons, or other symbols except letters, numbers, spaces, Bengali characters, and hyphens (crucial for invoice ranges like SL-WR-)
    clean = clean.replace(/[^\w\s\u0980-\u09FF\-]/gi, '');
    // Final trim of leading/trailing whitespaces, underscores or hyphens
    return clean.trim().replace(/^[\-\s_]+|[\-\s_]+$/g, '');
  };

  const lookupInvoice = async () => {
    if (!invoiceSearchId.trim() || !selectedShop) return;
    setSearchingInvoice(true);
    setLookupError(null);
    setLookupSale(null);

    try {
      const searchKey = cleanInvoiceSearchKey(invoiceSearchId);
      if (!searchKey) {
        setLookupError(isBn ? "অনুগ্রহ করে একটি সঠিক ইনভয়েস নম্বর লিখুন।" : "Please enter a valid invoice number.");
        return;
      }

      // Secure direct fetch of a single document by its precise document ID
      let docRef = doc(db, 'sales', searchKey);
      let docSnap = await getDoc(docRef);

      // Try uppercase fall-back if exact key does not exist
      if (!docSnap.exists()) {
        const upperKey = searchKey.toUpperCase();
        if (upperKey !== searchKey) {
          const upperDocRef = doc(db, 'sales', upperKey);
          docSnap = await getDoc(upperDocRef);
        }
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.shopId?.toString().trim().toLowerCase() === selectedShop.id?.toString().trim().toLowerCase()) {
          setLookupSale({ id: docSnap.id, ...data });
        } else {
          setLookupError(isBn ? "দুঃখিত, এই ইনভয়েস নম্বরটি পাওয়া যায়নি।" : "Sorry, this invoice number was not found.");
        }
      } else {
        setLookupError(isBn ? "দুঃখিত, এই ইনভয়েস নম্বরটি পাওয়া যায়নি।" : "Sorry, this invoice number was not found.");
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setLookupError(isBn ? `ইনভয়েস লোড করতে সমস্যা হয়েছে: ${msg}` : `Error fetching invoice: ${msg}`);
    } finally {
      setSearchingInvoice(false);
    }
  };

  const handleViewInvoiceDirect = async (invoiceId: string) => {
    if (!selectedShop) return;
    // Set search field properly cleaned
    const cleanedId = cleanInvoiceSearchKey(invoiceId);
    setInvoiceSearchId(cleanedId || invoiceId);
    setActiveTab('invoice_tracker');
    setSearchingInvoice(true);
    setLookupError(null);
    setLookupSale(null);

    try {
      const searchKey = cleanedId;
      if (!searchKey) {
        setLookupError(isBn ? "অনুগ্রহ করে একটি সঠিক ইনভয়েস নম্বর লিখুন।" : "Please enter a valid invoice number.");
        return;
      }

      // Secure direct fetch of a single document by its precise document ID
      let docRef = doc(db, 'sales', searchKey);
      let docSnap = await getDoc(docRef);

      // Try uppercase fall-back if exact key does not exist
      if (!docSnap.exists()) {
        const upperKey = searchKey.toUpperCase();
        if (upperKey !== searchKey) {
          const upperDocRef = doc(db, 'sales', upperKey);
          docSnap = await getDoc(upperDocRef);
        }
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.shopId?.toString().trim().toLowerCase() === selectedShop.id?.toString().trim().toLowerCase()) {
          setLookupSale({ id: docSnap.id, ...data });
        } else {
          setLookupError(isBn ? "দুঃখিত, এই ইনভয়েস নম্বরটি পাওয়া যায়নি।" : "Sorry, this invoice number was not found.");
        }
      } else {
        setLookupError(isBn ? "দুঃখিত, এই ইনভয়েস নম্বরটি পাওয়া যায়নি।" : "Sorry, this invoice number was not found.");
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setLookupError(isBn ? `ইনভয়েস লোড করতে সমস্যা হয়েছে: ${msg}` : `Error fetching invoice: ${msg}`);
    } finally {
      setSearchingInvoice(false);
    }
  };

  // Filtered store products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchProductQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredShops = shops.filter(s => {
    const queryRaw = searchShopQuery.trim().toLowerCase();
    const numericQuery = queryRaw.replace(/^shp-/, '').replace(/[^0-9]/g, '');
    if (queryRaw.length < 3) return false;

    const dbShopCode = (s.shopCode || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
    const dbId = (s.id || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
    const dbShopId = (s.shopId || '').toString().trim().toLowerCase().replace(/^shp-/, '').replace(/[^0-9]/g, '');
    const dbName = (s.name || '').toString().trim().toLowerCase();
    
    // Check if searching with numeric queries
    const hasDigits = /[0-9]/.test(queryRaw);
    
    let codeMatch = false;
    let idMatch = false;
    let shopIdMatch = false;
    let phoneMatch = false;
    let waMatch = false;

    if (hasDigits && numericQuery) {
      codeMatch = dbShopCode === numericQuery || dbShopCode.includes(numericQuery);
      idMatch = dbId === numericQuery || dbId.includes(numericQuery);
      shopIdMatch = dbShopId === numericQuery || dbShopId.includes(numericQuery);
      
      const phoneClean = (s.phone || '').toString().trim().replace(/[^0-9]/g, '');
      const waClean = (s.whatsapp || '').toString().trim().replace(/[^0-9]/g, '');
      phoneMatch = phoneClean.includes(numericQuery);
      waMatch = waClean.includes(numericQuery);
    }
    
    const directCodeMatch = (s.shopCode || '').toString().trim().toLowerCase() === queryRaw || (s.shopCode || '').toString().trim().toLowerCase().replace(/^shp-/, '') === queryRaw;
    const directIdMatch = (s.id || '').toString().trim().toLowerCase() === queryRaw;
    const directShopIdMatch = (s.shopId || '').toString().trim().toLowerCase() === queryRaw;

    const nameMatch = dbName.includes(queryRaw);

    return codeMatch || idMatch || shopIdMatch || phoneMatch || waMatch || nameMatch || directCodeMatch || directIdMatch || directShopIdMatch;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Header bar */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-100 px-4 py-3.5 md:px-8 flex items-center justify-between shadow-xs transition-all duration-300">
        <div className="flex items-center gap-3">
          <motion.button 
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (stage === 'dashboard') {
                setStage('customer_login');
              } else if (stage === 'customer_login') {
                setStage('shop_selection');
              } else {
                onBack();
              }
            }}
            className="p-2.5 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50/80 active:bg-indigo-150 transition-all border border-transparent hover:border-indigo-100/50 flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          
          {selectedShop && stage !== 'shop_selection' ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white border border-gray-150 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-xs relative">
                {isValidImageSource(selectedShop.logoUrl || selectedShop.logo || selectedShop.logoBase64) ? (
                  <img 
                    src={selectedShop.logoUrl || selectedShop.logo || selectedShop.logoBase64} 
                    alt={selectedShop.name} 
                    className="w-full h-full object-contain p-0.5 relative z-10" 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                      if (fallback) {
                        (fallback as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div 
                  className="logo-fallback absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-xs select-none uppercase tracking-tight"
                  style={{ display: isValidImageSource(selectedShop.logoUrl || selectedShop.logo || selectedShop.logoBase64) ? 'none' : 'flex' }}
                >
                  {getShopInitials(selectedShop.name || '')}
                </div>
              </div>
              <div>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/80 px-1.5 py-0.5 rounded-sm">
                  {selectedShop.shopCode ? `${selectedShop.shopCode.toString().replace(/^SHP-/i, '').replace(/[^0-9]/g, '')}` : 'MERCHANT'}
                </span>
                <h1 className="text-base md:text-lg font-black text-gray-900 tracking-tight leading-none mt-1">
                  {selectedShop.name}
                </h1>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1 h-1 bg-indigo-500 rounded-full animate-ping" />
                  <span>{isBn ? "গ্রাহক সেবা পোর্টাল" : "Customer Portal"}</span>
                </span>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 mt-0.5 tracking-tight leading-none">
                {isBn ? "আমাদের সেবা সমূহ" : "Access Corporate Service"}
              </h1>
            </div>
          )}
        </div>

        {/* Selected store badge */}
        {selectedShop && stage !== 'shop_selection' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/70 rounded-xl text-xs font-bold text-indigo-600 border border-indigo-100/40 shrink-0"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
            <span className="max-w-[100px] md:max-w-none truncate">{selectedShop.name}</span>
          </motion.div>
        )}
      </header>

      {/* Marquee Notice Banner */}
      <div id="notice-marquee-banner" className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 border-b border-amber-200/50 text-amber-900 text-xs font-bold py-2 px-4 shadow-inner overflow-hidden select-none transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <span className="bg-amber-600 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded-sm shrink-0 animate-pulse tracking-wider">
            {isBn ? "সতর্কবার্তা" : "Warning Notice"}
          </span>
          {/* @ts-ignore */}
          <marquee className="flex-1 font-bold text-xs" scrollamount="4" behavior="scroll" direction="left">
            {isBn 
              ? "পণ্যের দাম বাজার অনুযায়ী কম-বেশি হতে পারে এবং সব প্রোডাক্টের পর্যাপ্ত স্টক সবসময় নাও থাকতে পারে। দোকানদার চাইলে যেকোনো নির্দিষ্ট প্রোডাক্টের দাম পরিবর্তন করতে পারবেন, অথবা প্রোডাক্ট স্টক না থাকলে অর্ডারটি বাতিল (ক্যানসেল) করতে পারবেন।"
              : "Product prices are subject to change and stock availability may vary. The merchant reserves the right to adjust prices or cancel items/orders if they are unavailable."}
          {/* @ts-ignore */}
          </marquee>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {/* STAGE 1: SHOP SELECTION */}
          {stage === 'shop_selection' && (
            <motion.div
              key="shop_select"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="max-w-xl mx-auto w-full py-8 md:py-12 flex flex-col"
            >
            <div className="text-center mb-10">
              <div className="w-28 h-28 flex items-center justify-center mx-auto mb-4 overflow-hidden rounded-3xl">
                {platformBranding?.logoBase64 ? (
                  <img src={platformBranding.logoBase64} alt="Platform Logo" className="w-full h-full object-contain" />
                ) : (
                  <img src="/LOGO.JPG" alt="Brand Logo" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display='none'; if(e.currentTarget.nextElementSibling) (e.currentTarget.nextElementSibling as HTMLElement).style.display='block'; }} />
                )}
                {(!platformBranding?.logoBase64) && <Globe className="w-12 h-12 text-indigo-500 hidden" />}
              </div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none">
                {isBn ? "দোকান নির্বাচন করুন" : "Choose Your Store"}
              </h2>
              <p className="text-gray-500 mt-2.5 text-sm md:text-base">
                {isBn 
                  ? "যে দোকান থেকে সার্ভিস বা কেনাকাটা করতে চান, তার ৬ ডিজিটের শপ কোডটি লিখুন।" 
                  : "Enter the 6-digit shop code of the partner branch to load their services."}
              </p>
            </div>

            {/* Search Input */}
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="relative mb-6"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500/80 w-5 h-5 animate-pulse" />
              <input 
                type="text"
                placeholder={isBn ? "শপ কোড বা আইডি লিখুন (যেমন: ১২৩৪৫৬)..." : "Enter shop code or ID..."}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none text-gray-950 font-black text-sm tracking-widest text-center shadow-xs transition-all duration-300"
                value={searchShopQuery}
                onChange={(e) => setSearchShopQuery(e.target.value)}
              />
            </motion.div>

            {/* Shop List */}
            <div className="space-y-4">
              {searchShopQuery.trim().length === 0 ? (
                <div className="p-10 text-center bg-white border border-gray-100 rounded-3xl shadow-sm text-gray-400 font-semibold space-y-3 flex flex-col items-center animate-fade-in">
                  <Hash className="w-8 h-8 text-indigo-400 animate-pulse" />
                  <span className="text-sm">
                    {isBn ? "অগ্রসর হতে দয়া করে ৪ বা ৬ ডিজিটের শপ কোডটি ইনপুট করুন।" : "Please enter the 4 to 6 digit shop code to load the merchant."}
                  </span>
                </div>
              ) : searchShopQuery.trim().length < 4 ? (
                <div className="p-10 text-center bg-white border border-gray-100 rounded-3xl shadow-sm text-amber-500 font-semibold space-y-3 flex flex-col items-center animate-fade-in">
                  <div className="px-3 py-1 bg-amber-50 rounded-full text-xs font-black text-amber-600 font-mono animate-pulse">
                    {searchShopQuery.trim().length} / 4
                  </div>
                  <span className="text-sm">
                    {isBn ? "শপ কোড অবশ্যই কমপক্ষে ৪ ডিজিটের হতে হবে।" : "Shop code must be at least 4 digits long."}
                  </span>
                </div>
              ) : filteredShops.length === 0 ? (
                <div className="p-10 text-center bg-white border border-gray-100 rounded-3xl shadow-sm text-rose-500 font-semibold space-y-3 flex flex-col items-center animate-fade-in">
                  <AlertCircle className="w-8 h-8 text-rose-400" />
                  <span className="text-sm leading-relaxed">
                    {isBn 
                      ? `"${searchShopQuery}" কোডের কোনো দোকান পাওয়া যায়নি। অনুগ্রহ করে সঠিক কোডটি পুনরায় চেক করুন।` 
                      : `No store found for code "${searchShopQuery}". Please double check and try again.`}
                  </span>
                </div>
              ) : (
                filteredShops.map((shop) => (
                  <motion.button
                    key={shop.id}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectShop(shop)}
                    className="w-full p-5 bg-white border border-gray-100/80 hover:border-indigo-500 rounded-2xl text-left flex items-center justify-between shadow-xs hover:shadow-md transition-all duration-300 group cursor-pointer active:bg-indigo-50/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl overflow-hidden flex items-center justify-center font-black text-lg border border-indigo-100 group-hover:text-white transition-colors shrink-0 relative">
                        {isValidImageSource(shop.logo || shop.logoUrl || shop.logoBase64) ? (
                          <img 
                            src={shop.logo || shop.logoUrl || shop.logoBase64} 
                            alt={shop.name} 
                            className="w-full h-full object-contain p-0.5 relative z-10" 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                              if (fallback) {
                                (fallback as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div 
                          className="logo-fallback absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-base select-none"
                          style={{ display: isValidImageSource(shop.logo || shop.logoUrl || shop.logoBase64) ? 'none' : 'flex' }}
                        >
                          {getShopInitials(shop.name || '')}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors text-base">{shop.name}</h3>
                          {shop.shopCode && (
                            <span className="bg-gray-100 text-gray-600 text-xs font-mono font-black px-2 py-0.5 rounded-full border border-gray-200">
                              #{shop.shopCode.toString().replace(/^SHP-/i, '').replace(/[^0-9]/g, '')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-400 mt-1 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>{shop.address || (isBn ? 'ঠিকানা দেয়া নেই' : 'No address provided')}</span>
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* STAGE 2: CUSTOMER LOGIN & REGISTER */}
        {stage === 'customer_login' && (
          <motion.div
            key="cust_login"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="max-w-md mx-auto w-full py-8 md:py-12"
          >
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl -mr-10 -mt-10" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                  <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner relative">
                    {isValidImageSource(selectedShop?.logoUrl || selectedShop?.logo || selectedShop?.logoBase64) ? (
                      <img 
                        src={selectedShop.logoUrl || selectedShop.logo || selectedShop.logoBase64} 
                        alt={selectedShop.name} 
                        className="w-full h-full object-contain p-0.5 relative z-10" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                          if (fallback) {
                            (fallback as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div 
                      className="logo-fallback absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-lg select-none uppercase tracking-tight"
                      style={{ display: isValidImageSource(selectedShop?.logoUrl || selectedShop?.logo || selectedShop?.logoBase64) ? 'none' : 'flex' }}
                    >
                      {getShopInitials(selectedShop?.name || '')}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-950 leading-tight tracking-tight">{selectedShop?.name}</h3>
                    <p className="text-[10px] text-gray-400 font-bold tracking-wider uppercase mt-1">
                      {selectedShop?.shopCode ? `CODE: ${selectedShop.shopCode.toString().replace(/^SHP-/i, '').replace(/[^0-9]/g, '')}` : 'MERCHANT PARTNER'}
                    </p>
                  </div>
                </div>

                {!isNewCustomer ? (
                  <>
                    <h2 className="text-lg font-black text-gray-950 tracking-tight leading-none mb-1 text-center">
                      {isBn ? "কাস্টমার লগইন" : "Identify Yourself"}
                    </h2>
                    <p className="text-gray-500 text-xs font-medium mb-6 text-center">
                      {isBn ? "মোবাইল নম্বর দিয়ে আপনার পূর্বের খতিয়ান ও নতুন অর্ডার করুন।" : "Enter your mobile phone number to find your record or submit new orders."}
                    </p>

                    <form onSubmit={handleCustomerLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-600 uppercase tracking-widest">{isBn ? "মোবাইল নম্বর" : "Mobile Phone Number"}</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input 
                            type="text"
                            required
                            placeholder="01xxxxxxxxx"
                            className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all outline-none text-gray-900 font-bold"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      {loginError && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{loginError}</span>
                        </div>
                      )}

                      <button 
                        type="submit"
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 group mt-6"
                      >
                        <span>{isBn ? "এগিয়ে যান" : "Proceed & Match"}</span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-black text-gray-950 tracking-tight leading-none mb-1 text-center">
                      {isBn ? "নতুন অ্যাকাউন্ট তৈরি" : "Register Profile"}
                    </h2>
                    <p className="text-gray-500 text-xs font-medium mb-6 text-center leading-relaxed">
                      {isBn 
                        ? `এই নম্বর (${phone}) দিয়ে কোনো কাস্টমার খতিয়ান খুঁজে পাওয়া যায়নি। এক ক্লিকে নতুন রেজিস্ট্রেশন করুন!` 
                        : "No profile found for this mobile. Quick register as a customer of this business."}
                    </p>

                    <form onSubmit={handleCustomerRegister} className="space-y-4">
                      <div className="space-y-1.5 focus-within:text-indigo-600">
                        <label className="text-xs font-black uppercase tracking-widest text-inherit">{isBn ? "আপনার নাম" : "Your Name"}</label>
                        <input 
                          type="text"
                          required
                          placeholder={isBn ? "যেমন: আব্দুর রহমান" : "e.g., John Doe"}
                          className="w-full px-4 py-4 rounded-xl bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white transition-all outline-none text-gray-900 font-bold"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-600 uppercase tracking-widest">{isBn ? "মোবাইল নম্বর" : "Mobile Phone Number"}</label>
                        <input 
                          type="text"
                          disabled
                          className="w-full px-4 py-4 rounded-xl bg-gray-100 text-gray-500 font-bold outline-none border border-transparent"
                          value={phone}
                        />
                      </div>

                      <div className="flex gap-3 mt-6">
                        <button 
                          type="button"
                          onClick={() => setIsNewCustomer(false)}
                          className="flex-1 h-14 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-colors"
                        >
                          {isBn ? "পিছনে যান" : "Go Back"}
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100"
                        >
                          {isBn ? "অ্যাকাউন্ট খুলুন" : "Create Profile"}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* STAGE 3: BRAND CUSTOMER DASHBOARD */}
        {stage === 'dashboard' && currentCustomer && (
          <motion.div
            key="cust_dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="flex flex-col gap-6"
          >
            
            {/* Customer Header Block / Summary Card */}
            <div className="p-6 md:p-8 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
              
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center overflow-hidden">
                  {currentCustomer.photoUrl ? (
                    <img src={currentCustomer.photoUrl} alt="Customer" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight leading-none">{currentCustomer.name}</h2>
                  <p className="text-indigo-200 font-bold text-sm mt-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{currentCustomer.phone}</span>
                  </p>
                </div>
              </div>

              {/* Financial Status of Customer */}
              <div className="relative z-10 flex items-center gap-6 divide-x divide-white/10">
                <div className="text-left md:text-right">
                  <p className="text-indigo-200/80 text-xs uppercase tracking-widest font-black">{isBn ? "পূর্বের মোট বকেয়া" : "Remaining Total Due"}</p>
                  <p className="text-3xl font-black mt-1">
                    {currentCustomer.currentDue || 0} <span className="text-sm font-bold text-indigo-200">TK</span>
                  </p>
                </div>
                {currentCustomer.points !== undefined && (
                  <div className="pl-6 text-left md:text-right">
                    <p className="text-indigo-200/80 text-xs uppercase tracking-widest font-black">{isBn ? "অর্জিত পয়েন্ট" : "Earned Points"}</p>
                    <p className="text-2xl font-black mt-1 text-amber-300">
                      🌟 {currentCustomer.points || 0}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Dashboard Navigation Tabs */}
            <div className="flex flex-wrap md:flex-nowrap gap-2 p-1 bg-gray-200/60 rounded-2xl max-w-xl w-full font-bold text-sm shadow-inner mt-2">
              {[
                { id: 'shop', label: isBn ? 'অর্ডার করুন' : 'Shop / Order', icon: ShoppingBag },
                { id: 'order_cart', label: isBn ? 'অর্ডার কার্ট' : 'Order Cart', icon: ShoppingCart },
                { id: 'invoice_tracker', label: isBn ? 'ইনভয়েস ট্র্যাক' : 'Track Invoice', icon: Receipt },
                { id: 'orders', label: isBn ? 'অর্ডার ইতিহাস' : 'Order History', icon: History }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                const isCart = tab.id === 'order_cart';
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-3 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all relative ${isActive ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-750'}`}
                  >
                    <tab.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate text-xs md:text-sm">{tab.label}</span>
                    {isCart && cart.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-550 text-white font-black text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full border border-white animate-pulse">
                        {cart.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT: PRODUCT SHOP / ONLINE ORDERING */}
            {activeTab === 'shop' && (
              <div className="space-y-6 animate-fade-in">
                {/* Shop filters & search */}
                <div className="bg-white p-5 rounded-3xl border border-gray-105/90 shadow-sm">
                  {/* Catalog search */}
                  <div className="relative w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
                    <input 
                      type="text"
                      placeholder={isBn ? "প্রোডাক্টের নাম খুঁজুন..." : "Filter catalog..."}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 shadow-inner text-sm text-gray-905 outline-none focus:border-indigo-505 font-medium"
                      value={searchProductQuery}
                      onChange={(e) => setSearchProductQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Info block if items added */}
                {cart.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-600/10 text-indigo-600 rounded-xl">
                        <ShoppingCart className="w-5 h-5 animate-bounce" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-indigo-950">
                          {isBn ? `${cart.length} টি প্রোডাক্ট কার্টে যোগ করা হয়েছে!` : `${cart.length} items added to your cart!`}
                        </p>
                        <p className="text-xs text-indigo-600 font-extrabold mt-0.5">
                          {isBn ? "অর্ডার সম্পন্ন করতে অর্ডার কার্ট পেইজে যান" : "Navigate to Order Cart to submit request."}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('order_cart')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-150 inline-flex items-center gap-1.5 shrink-0"
                    >
                      <span>{isBn ? "কার্ট পেইজে যান" : "Go to Cart"}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-gray-102 rounded-3xl shadow-sm text-gray-400 font-semibold lg:col-span-3 text-sm">
                      {isBn ? "কোনো প্রোডাক্ট পাওয়া যায়নি।" : "No matches found in store catalogs."}
                    </div>
                  ) : (
                    filteredProducts.map(prod => (
                      <div 
                        key={prod.id}
                        className="p-5 bg-white border border-gray-100 hover:border-indigo-100 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="flex items-start gap-4">
                          {/* Product Thumbnail with standard referrer policy */}
                          <div className="w-18 h-18 bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center">
                            {prod.imageUrl ? (
                              <img 
                                src={prod.imageUrl} 
                                alt={prod.name} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <ShoppingBag className="w-8 h-8 text-gray-200" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wide px-2 py-0.5 bg-indigo-50/50 rounded-md">
                              {prod.category}
                            </span>
                            <h3 className="font-bold text-gray-900 mt-1.5 text-base truncate" title={prod.name}>{prod.name}</h3>
                            <p className="text-base font-black text-indigo-600 mt-1">
                              {prod.price} <span className="text-xs font-semibold text-gray-400">TK / {prod.unit || 'unit'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-gray-50 pt-3.5 mt-auto">
                          <button
                            onClick={() => addToCart(prod)}
                            className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 hover:shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isBn ? "যোগ করুন" : "Add"}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: ORDER CART */}
            {activeTab === 'order_cart' && (
              <div className="max-w-2xl mx-auto w-full animate-fade-in">
                <div className="p-6 md:p-8 bg-white border border-gray-100 rounded-[2rem] shadow-sm flex flex-col gap-6">
                  <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-55/75 text-indigo-600 rounded-xl flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-gray-950 text-lg leading-none">{isBn ? "অর্ডার কার্ট" : "Order Cart"}</h3>
                        <p className="text-xs text-gray-400 font-bold mt-1.5">{isBn ? "কার্টের বিবরণ চেক করে আপনার অর্ডারটি প্লেস করুন" : "Review your added products and place request"}</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      {cart.length} {isBn ? "টি প্রোডাক্ট" : "items"}
                    </span>
                  </div>

                  {/* Item list in basket */}
                  {cart.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 font-medium flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 animate-pulse">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-800">{isBn ? "কার্ট একদম খালি!" : "Your cart is empty!"}</p>
                        <p className="text-xs text-gray-400 mt-1">{isBn ? "অর্ডার করুন পেইজ থেকে প্রোডাক্ট আপনার কার্টে যোগ করুন।" : "Go back to Shop / Order to pick the products you need."}</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('shop')}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all mt-2"
                      >
                        {isBn ? "প্রোডাক্ট যোগ করুন" : "Add some items"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-4 divide-y divide-gray-50 max-h-96 overflow-y-auto pr-1">
                        {cart.map(item => (
                          <div key={item.product.id} className="pt-3.5 first:pt-0 flex items-center justify-between gap-4 text-sm">
                            <div className="min-w-0 flex-1 flex items-center gap-3">
                              {/* Thumbnail */}
                              <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                {item.product.imageUrl ? (
                                  <img 
                                    src={item.product.imageUrl} 
                                    alt={item.product.name} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <ShoppingBag className="w-5 h-5 text-gray-300" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-gray-900 truncate" title={item.product.name}>{item.product.name}</h4>
                                <p className="text-xs font-black text-indigo-600 mt-1">
                                  {formatVal(item.product.price)}{currencySuffix} × {formatVal(item.quantity)} = {formatVal(item.product.price * item.quantity)}{currencySuffix}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => updateCartQuantity(item.product.id, -1)}
                                className="p-1 px-1.5 bg-gray-50 hover:bg-gray-100 rounded-md text-gray-500 border border-gray-200 transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-black text-gray-800 text-xs w-6 text-center">{formatVal(item.quantity)}</span>
                              <button 
                                onClick={() => updateCartQuantity(item.product.id, 1)}
                                className="p-1 px-1.5 bg-gray-50 hover:bg-gray-100 rounded-md text-gray-500 border border-gray-200 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              
                              <button 
                                onClick={() => removeFromCart(item.product.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition-colors ml-1"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4 pt-6 border-t border-gray-100">
                        {/* Notes input */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{isBn ? "विशेष কোনো নির্দেশনা (ঐচ্ছিক)" : "Specific Notes (Optional)"}</label>
                          <textarea 
                            rows={3}
                            placeholder={isBn ? "যেমন: জলদি ডেলিভারি প্রয়োজন..." : "e.g., Please deliver in morning..."}
                            className="w-full px-4 py-3 rounded-xl bg-gray-55/40 border border-gray-200 text-xs font-semibold outline-none focus:border-indigo-500 text-gray-800 animate-fade-in"
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                          />
                        </div>

                        {/* Price Details Summary for Enhanced Transparency */}
                        <div className="bg-gray-50/75 rounded-2xl p-4 space-y-2 border border-gray-100 text-xs font-semibold text-gray-600 animate-fade-in">
                          <p className="text-gray-400 font-extrabold uppercase tracking-wider text-[10px] mb-2 flex items-center gap-1.5">
                            <ShoppingCart className="w-3 h-3 text-indigo-500" />
                            <span>{isBn ? "মূল্যের বিবরণ ও হিসাব" : "Price Details Summary"}</span>
                          </p>
                          <div className="space-y-2 divide-y divide-gray-100/50">
                            {cart.map((item, idx) => {
                              const unitPrice = Number(item.product.price) || 0;
                              const linePrice = unitPrice * item.quantity;
                              return (
                                <div key={idx} className="flex justify-between items-center gap-2 pt-2 first:pt-0 font-sans">
                                  <span className="truncate text-gray-700 font-bold">{item.product.name}</span>
                                  <span className="shrink-0 text-gray-950 font-black">
                                    {formatVal(unitPrice)}{currencySuffix} × {formatVal(item.quantity)} = {formatVal(linePrice)}{currencySuffix}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="border-t border-dashed border-gray-200 mt-2.5 pt-2.5 flex justify-between items-center font-black text-gray-500 font-sans">
                            <span>{isBn ? "কার্ট সাবটোটাল" : "Subtotal Value"}</span>
                            <span>{formatVal(cartSubtotal)}{currencySuffix}</span>
                          </div>
                        </div>

                        {/* Payment Selection */}
                        <div className="space-y-3">
                          <label className="text-xs font-black uppercase text-gray-500 tracking-wider">
                            {isBn ? "পেমেন্ট পদ্ধতি" : "Payment Method"}
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => setPaymentMethod('cod')}
                              className={`p-3 rounded-xl border text-center transition-all ${paymentMethod === 'cod' ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600/20' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                              <span className={`text-sm font-black ${paymentMethod === 'cod' ? 'text-indigo-600' : 'text-gray-700'}`}>
                                {isBn ? "ক্যাশ অন ডেলিভারি" : "Cash on Delivery"}
                              </span>
                            </button>

                            {selectedShop?.paymentConfig?.isEnabled && (
                              <button
                                onClick={() => setPaymentMethod('bkash')}
                                className={`p-3 rounded-xl border text-center transition-all ${paymentMethod === 'bkash' ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-500/20' : 'border-gray-200 hover:bg-gray-50'}`}
                              >
                                <span className={`text-sm font-black ${paymentMethod === 'bkash' ? 'text-pink-600' : 'text-gray-700'}`}>
                                  bKash {bKashType === 'agent' ? '(Cash Out)' : '(Send Money)'}
                                </span>
                              </button>
                            )}
                          </div>

                          {paymentMethod === 'bkash' && (
                            <div className="mt-4 p-4 bg-pink-50/50 rounded-2xl border border-pink-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                              <p className="text-xs text-pink-700 font-bold leading-relaxed">
                                Please {bKashType === 'agent' ? 'Cash Out' : 'Send'} <span className="font-black text-base">{formatVal(cartTotal)}{currencySuffix}</span> to our bKash {bKashType} account: <span className="font-black text-pink-900 px-2 py-0.5 bg-white rounded shadow-sm">{selectedShop?.paymentConfig?.bKashNumber}</span>
                              </p>

                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] font-black uppercase text-pink-800 tracking-widest">{isBn ? "বিকাশ নম্বর (যেই নম্বর থেকে পাঠিয়েছেন)" : "Sender bKash Number"}</label>
                                  <input 
                                    type="text" 
                                    placeholder="e.g. 01700000000"
                                    value={bKashSender}
                                    onChange={(e) => setBKashSender(e.target.value)}
                                    className="w-full px-4 py-3 text-sm bg-white border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-pink-900 font-bold mt-1"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-pink-800 tracking-widest">{isBn ? "ট্রানজ্যাকশন আইডি (TxnID)" : "Transaction ID"}</label>
                                  <input 
                                    type="text" 
                                    placeholder="e.g. 9B5X7Y2Z1"
                                    value={bKashTxnId}
                                    onChange={(e) => setBKashTxnId(e.target.value)}
                                    className="w-full px-4 py-3 text-sm bg-white border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-pink-900 font-bold mt-1 uppercase"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-pink-800 tracking-widest">{isBn ? "পেমেন্ট স্ক্রিনশট (প্রমান)" : "Payment Screenshot (Proof)"}</label>
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                          const img = new Image();
                                          img.onload = () => {
                                            const canvas = document.createElement('canvas');
                                            const MAX_WIDTH = 800;
                                            const MAX_HEIGHT = 800;
                                            let width = img.width;
                                            let height = img.height;

                                            if (width > height) {
                                              if (width > MAX_WIDTH) {
                                                height *= MAX_WIDTH / width;
                                                width = MAX_WIDTH;
                                              }
                                            } else {
                                              if (height > MAX_HEIGHT) {
                                                width *= MAX_HEIGHT / height;
                                                height = MAX_HEIGHT;
                                              }
                                            }

                                            canvas.width = width;
                                            canvas.height = height;
                                            const ctx = canvas.getContext('2d');
                                            if (ctx) {
                                              ctx.drawImage(img, 0, 0, width, height);
                                              setBKashScreenshot(canvas.toDataURL('image/jpeg', 0.7));
                                            } else {
                                              setBKashScreenshot(event.target?.result as string);
                                            }
                                          };
                                          img.src = event.target?.result as string;
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                    className="w-full px-4 py-3 text-sm bg-white border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-pink-900 font-bold mt-1"
                                  />
                                  {bKashScreenshot && (
                                    <div className="mt-2 text-center">
                                      <img src={bKashScreenshot} alt="Screenshot" className="h-16 rounded object-cover mx-auto" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Order calculation breakdown */}
                        <div className="space-y-2 pt-3 border-t border-dashed border-gray-100">
                          {paymentCharge > 0 && (
                            <div className="flex items-center justify-between text-xs font-bold text-pink-600">
                              <span>{isBn ? "বিকাশ ফি (১.৮%)" : "bKash Fee (1.8%)"}</span>
                              <span>+{formatVal(paymentCharge)}{currencySuffix}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-base font-black text-gray-900">
                            <span>{isBn ? "মোট বিল" : "Grand Order Value"}</span>
                            <span className="text-xl text-indigo-600">{formatVal(cartTotal)}{currencySuffix}</span>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <button
                          onClick={handlePlaceOrder}
                          disabled={placingOrder}
                          className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-150 flex items-center justify-center gap-2 group text-sm"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>{placingOrder ? (isBn ? "অর্ডার সাবমিট হচ্ছে..." : "Submitting Order...") : (isBn ? "অর্ডার প্লেস করুন" : "Submit & Request Order")}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: INVOICE DIGITAL TRACKER */}
            {activeTab === 'invoice_tracker' && (
              <div className="max-w-2xl mx-auto w-full space-y-8 py-4">
                
                {/* Search Bar */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-4">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input 
                      type="text"
                      placeholder={isBn ? "ইনভয়েস নম্বরটি লিখুন (যেমন: BR1-12345)" : "Enter Invoice ID number..."}
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-100 shadow-inner text-gray-950 font-bold outline-none focus:border-indigo-500"
                      value={invoiceSearchId}
                      onChange={(e) => setInvoiceSearchId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !searchingInvoice && invoiceSearchId.trim()) {
                          lookupInvoice();
                        }
                      }}
                    />
                  </div>
                  <button
                    onClick={lookupInvoice}
                    disabled={searchingInvoice || !invoiceSearchId.trim()}
                    className="h-14 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold px-8 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    <span>{searchingInvoice ? (isBn ? "খুঁজছি..." : "Searching...") : (isBn ? "ট্র্যাক করুন" : "Track Ledger")}</span>
                  </button>
                </div>

                {lookupError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-semibold flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <span>{lookupError}</span>
                  </div>
                )}

                {/* Invoice display */}
                {lookupSale && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 md:p-8 bg-white border border-gray-200 rounded-[2rem] shadow-lg relative overflow-hidden text-gray-800"
                  >
                    {/* Decorative Receipt Border Styling */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-indigo-600" />
                    
                    {/* Header receipt info */}
                    <div className="text-center pb-6 border-b border-gray-100 mt-2">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full inline-block">
                        {isBn ? "ডিজিটাল চালান রশিদ" : "Itemized Digital Receipt"}
                      </h3>
                      <h2 className="text-2xl font-black text-gray-900 mt-2.5 uppercase">{selectedShop?.name}</h2>
                      <p className="text-xs text-gray-400 font-bold mt-1 leading-tight">{selectedShop?.address}</p>
                      
                      <div className="mt-4 inline-block">
                        <ReactBarcode value={lookupSale.id} height={35} width={1.2} fontSize={10} displayValue={true} />
                      </div>
                    </div>

                    {/* Metadata column */}
                    <div className="grid grid-cols-2 gap-4 py-6 text-sm border-b border-gray-100">
                      <div>
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">{isBn ? "ইনভয়েস নম্বর" : "Invoice No"}</p>
                        <p className="font-mono font-black text-gray-900 mt-1">{lookupSale.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">{isBn ? "তারিখ ও সময়" : "Billing Date"}</p>
                        <p className="font-bold text-gray-900 mt-1">
                          {lookupSale.timestamp ? new Date(lookupSale.timestamp.seconds ? lookupSale.timestamp.seconds * 1000 : lookupSale.timestamp).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">{isBn ? "গ্রাহক" : "Client Name"}</p>
                        <p className="font-bold text-gray-900 mt-1">{lookupSale.customerName || (isBn ? 'নামবিহীন কাস্টমার' : 'Walk-in Customer')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">{isBn ? "মোবাইল" : "Contact Phone"}</p>
                        <p className="font-bold text-gray-900 mt-1">{lookupSale.customerPhone || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Invoice ordered products items table */}
                    <div className="py-6 border-b border-gray-100">
                      <p className="text-gray-400 font-black text-xs uppercase tracking-widest mb-4">{isBn ? "ক্রয়কৃত আইটেমস" : "Itemized Pricing Records"}</p>
                      
                      <div className="divide-y divide-gray-50">
                        {lookupSale.items?.map((item: any, idx: number) => {
                          const matchedProd = products.find(p => p.id === item.productId);
                          const originalPrice = Number(item.originalPrice) || Number(matchedProd?.price) || Number(item.price) || 0;
                          const price = Number(item.price) || originalPrice || 0;
                          return (
                            <div key={idx} className="py-3 flex items-center justify-between text-sm">
                              <div className="min-w-0 font-sans">
                                <p className="font-bold text-gray-900 truncate">{item.productName}</p>
                                <p className="text-xs font-semibold text-gray-400 mt-0.5">
                                  {formatVal(price)}{currencySuffix} × {formatVal(item.quantity)} {item.unit || 'unit'}
                                </p>
                              </div>
                              <span className="font-black text-gray-950 text-right font-mono">
                                {formatVal(price * item.quantity)}{currencySuffix}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* FINANCIAL BILL BREAKDOWN DETAILS - matches user request perfectly! */}
                    {(() => {
                      const itemsList = lookupSale.items || [];
                      const calculatedTotal = itemsList.reduce((sum: number, item: any) => {
                        const matchedProd = products.find(p => p.id === item.productId);
                        const originalPrice = Number(item.originalPrice) || Number(matchedProd?.price) || Number(item.price) || 0;
                        const price = Number(item.price) || originalPrice || 0;
                        return sum + (price * Number(item.quantity || 0));
                      }, 0) || 0;
                      const totalAmount = (isNaN(Number(lookupSale.totalAmount)) || Number(lookupSale.totalAmount) === 0) ? calculatedTotal : Number(lookupSale.totalAmount);
                      const discount = Number(lookupSale.discount) || 0;
                      const taxAmount = Number(lookupSale.taxAmount) || 0;
                      const finalAmount = (isNaN(Number(lookupSale.finalAmount)) || Number(lookupSale.finalAmount) === 0) ? (totalAmount - discount + taxAmount) : Number(lookupSale.finalAmount);
                      const previousBalance = Number(lookupSale.previousBalance) || 0;
                      const paidAmount = Number(lookupSale.paidAmount) || 0;
                      const dueAmount = (lookupSale.dueAmount !== undefined && !isNaN(Number(lookupSale.dueAmount))) ? Number(lookupSale.dueAmount) : (finalAmount - paidAmount);
                      const grandTotalBalance = previousBalance + dueAmount;
                      
                      return (
                        <div className="py-6 space-y-3 bg-gray-50/75 p-5 rounded-2xl mt-4 font-sans">
                          {/* Products Subtotal / Total price of product */}
                          <div className="flex justify-between text-sm text-gray-500 font-bold">
                            <span>{isBn ? "প্রোডাক্টের সর্বমোট মূল্য" : "Products Cost Subtotal"}</span>
                            <span className="font-mono">{formatVal(totalAmount)}{currencySuffix}</span>
                          </div>

                          {/* Discount amount */}
                          {discount > 0 && (
                            <div className="flex justify-between text-sm text-rose-500 font-bold">
                              <span>{isBn ? "ছাড় বা ডিসকাউন্ট (-)" : "Special Discount (-)"}</span>
                              <span className="font-mono">{formatVal(discount)}{currencySuffix}</span>
                            </div>
                          )}

                          {/* VAT / Taxes */}
                          {taxAmount > 0 && (
                            <div className="flex justify-between text-sm text-gray-500 font-bold">
                              <span>{isBn ? "ট্যাক্স বা ভ্যাট (+)" : "Applicable Itemized VAT (+)"}</span>
                              <span className="font-mono">{formatVal(taxAmount)}{currencySuffix}</span>
                            </div>
                          )}

                          {/* Current Invoice Total (finalAmount) - "টোটাল বিল কত" */}
                          <div className="flex justify-between text-sm font-black text-gray-900 border-b border-dashed border-gray-200 pb-3">
                            <span>{isBn ? "বর্তমান ইনভয়েস বিল" : "Current Invoice Total"}</span>
                            <span className="font-mono">{formatVal(finalAmount)}{currencySuffix}</span>
                          </div>

                          {/* Previous customer due - "আগের কত টাকা বাকি" */}
                          <div className="flex justify-between text-sm text-amber-600 font-bold">
                            <span>{isBn ? "পূর্বের বাকি বা বকেয়া" : "Previous Outstanding Due"}</span>
                            <span className="font-mono">{formatVal(previousBalance)}{currencySuffix}</span>
                          </div>

                          {/* Currently Paid in current transaction - "বর্তমানে কত টাকা দিয়েছে" */}
                          <div className="flex justify-between text-sm text-emerald-600 font-black">
                            <span>{isBn ? "বর্তমানে পরিশোধ করা টাকা (-)" : "Amount Paid Current (-)"}</span>
                            <span className="font-mono">{formatVal(paidAmount)}{currencySuffix}</span>
                          </div>

                          {/* Grand total outstanding remains - "সব মিলে কত টাকা বাকি" */}
                          <div className="flex justify-between text-base font-black text-gray-950 pt-2 border-t border-gray-200">
                            <span>{isBn ? "সব মিলিয়ে মোট বকেয়া (হাল বকেয়া)" : "Final Remaining Balance Due"}</span>
                            <span className="text-rose-600 font-mono">
                              {formatVal(grandTotalBalance)}{currencySuffix}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Friendly printable note footer */}
                    <div className="text-center pt-6 mt-6 border-t border-dashed border-gray-100 text-xs text-gray-400 font-semibold leading-relaxed">
                      <p>✨ {isBn ? "ডিজিটাল চালান রশিদের সাথে থাকার জন্য ধন্যবাদ" : "Thank you for buying from our certified store!"} ✨</p>
                      <p className="mt-1">{isBn ? "উন্নত গ্রাহক সেবায় আমরা সদা সচেষ্ট" : "Powered by ShopMaster POS Solutions Group"}</p>
                    </div>

                  </motion.div>
                )}

              </div>
            )}

            {/* TAB CONTENT: HISTORIC ORDERS */}
            {activeTab === 'orders' && (
              <div className="max-w-3xl mx-auto w-full space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-black text-gray-950 mb-4">{isBn ? "আমার সাবমিট করা অর্ডারসমূহ" : "Historic Store Orders"}</h3>
                  
                  {customerOrders.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 font-semibold text-sm">
                      {isBn ? "এখনো কোনো অর্ডার সাবমিট করা হয়নি।" : "You haven't placed any orders yet."}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {customerOrders.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(order => (
                        <div key={order.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-gray-900 text-sm">#{order.orderNumber}</span>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${order.status === 'pending' ? 'bg-amber-100 text-amber-700' : order.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {order.status === 'pending' ? (isBn ? 'পেন্ডিং' : 'Pending') : order.status === 'approved' ? (isBn ? 'অনুমোদিত' : 'Approved') : (isBn ? 'বাতিলকৃত' : 'Cancelled')}
                              </span>
                              {order.status === 'approved' && (
                                <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-mono">
                                  {isBn ? `ইনভয়েস নং: ${order.invoiceNumber || 'লোডিং...'}` : `Invoice No: ${order.invoiceNumber || 'Loading...'}`}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 font-semibold mt-1">
                              {new Date(order.timestamp).toLocaleString()}
                            </p>
                            {order.notes && (
                              <p className="text-xs text-gray-400 italic mt-1.5 bg-gray-50 px-2 py-1 rounded">
                                * {order.notes}
                              </p>
                            )}
                            {order.invoiceNumber && (
                              <div className="mt-2.5">
                                <button
                                  onClick={() => handleViewInvoiceDirect(order.invoiceNumber)}
                                  className="text-[10.5px] font-black text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-100 px-2.5 py-1 inline-flex items-center gap-1.5 font-mono transition-all"
                                >
                                  📄 {isBn ? "চালান রশিদ দেখুন" : "View Receipt"} ({order.invoiceNumber})
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-xs text-gray-400 font-black uppercase tracking-wider">{isBn ? "অর্ডার বিল" : "Order Value"}</p>
                            {order.status === 'approved' ? (
                              <p className="text-lg font-black text-indigo-600 mt-1">{order.totalAmount} TK</p>
                            ) : (
                              <p className="text-xs font-bold text-amber-600 mt-1 italic">
                                {isBn ? "কনফার্মেশনের অপেক্ষায়" : "Awaiting Confirmation"}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 2: DYNAMIC CUSTOMER AI VOICE & CHAT ASSISTANT PANEL */}
        {stage === 'dashboard' && currentCustomer && (
          <>
            {/* Floating Action Button (FAB) */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
              {/* Dynamic status tooltip */}
              <AnimatePresence>
                {!isAssistantOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    className="bg-white text-indigo-900 border border-indigo-100 shadow-xl px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 max-w-xs cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setIsAssistantOpen(true)}
                  >
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                    <span>
                      {lang === 'bn' 
                        ? 'হেই হাবিব! ভয়েস অর্ডার করুন' 
                        : lang === 'ar'
                        ? 'تحدث لطلب منتجات بصوتك!'
                        : 'Voice order or track invoice!'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Circular Glow Bot FAB */}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all relative outline-none focus:ring-4 focus:ring-indigo-300 ${isAssistantOpen ? 'bg-rose-500 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200'}`}
                id="floating_ai_assistant_btn"
              >
                {isAssistantOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <div className="relative">
                    <Bot className="w-7 h-7" />
                    <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-indigo-600 rounded-full" />
                  </div>
                )}
              </motion.button>
            </div>

            {/* Sidebar Assistant Drawer / Modal */}
            <AnimatePresence>
              {isAssistantOpen && (
                <>
                  {/* Backdrop Overlay for mobile */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsAssistantOpen(false)}
                    className="fixed inset-0 bg-slate-950 z-40 md:hidden"
                  />

                  {/* Assistant Container */}
                  <motion.div
                    initial={{ opacity: 0, y: 100, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    className="fixed bottom-24 right-4 left-4 md:left-auto md:w-96 h-[520px] bg-white border border-slate-100 shadow-2xl rounded-3xl z-40 flex flex-col overflow-hidden animate-fade-in"
                  >
                    {/* Header Block */}
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-4 flex items-center justify-between shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                          <Bot className="w-5.5 h-5.5 text-white animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                            <span>
                              {lang === 'bn' 
                                ? 'স্মার্ট এআই সহকারী' 
                                : lang === 'ar'
                                ? 'مساعد المتجر الذكي'
                                : 'Smart AI Assistant'}
                            </span>
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="text-[10px] text-indigo-200 font-extrabold uppercase tracking-wider">
                              {lang === 'bn' ? 'অনলাইন সহকারী' : lang === 'ar' ? 'متصل' : 'Assistant Online'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Audio Speak Mute Controller */}
                        <button 
                          type="button"
                          onClick={() => setIsMuted(!isMuted)}
                          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors text-white outline-none"
                          title={isMuted ? "Unmute" : "Mute"}
                        >
                          {isMuted ? (
                            <VolumeX className="w-4.5 h-4.5" />
                          ) : (
                            <Volume2 className="w-4.5 h-4.5 text-emerald-300" />
                          )}
                        </button>
                        
                        {/* Reset Conversation */}
                        <button 
                          type="button"
                          onClick={() => {
                            setAssistantMessages([
                              {
                                id: 'welcome',
                                sender: 'assistant',
                                text: lang === 'bn' 
                                  ? 'আসসালামু আলাইকুম! আমি আপনার সহকারী। ভয়েস দিয়ে প্রোডাক্ট অর্ডার করতে বা কোনো ইনভয়েস ট্র্যাক করতে নিচে মাইক বোতাম টিপুন। অথবা আপনি কোনো প্রশ্ন লিখে পাঠাতে পারেন।'
                                  : lang === 'ar'
                                  ? 'مرحباً! أنا مساعدك الشخصي. لطلب منتجات أو تتبع فاتورة بصوتك، اضغط على زر الميكروفون أدناه.'
                                  : 'Hello! I am your shop assistant. Press the microphone button below to order items by voice, track an invoice, or type any questions.',
                                timestamp: Date.now()
                              }
                            ]);
                            if (window.speechSynthesis) window.speechSynthesis.cancel();
                          }}
                          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors text-white outline-none"
                          title="Clear Chat"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        
                        {/* Close Button */}
                        <button 
                          type="button"
                          onClick={() => setIsAssistantOpen(false)}
                          className="p-1.5 hover:bg-white/10 active:bg-white/20 rounded-lg transition-colors text-white outline-none"
                        >
                          <X className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>

                    {/* Chat Messages Section */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                      {assistantMessages.map((msg) => {
                        const isUser = msg.sender === 'user';
                        return (
                          <div 
                            key={msg.id}
                            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                              isUser 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                            }`}>
                              <p className="whitespace-pre-line">{msg.text}</p>
                              <span className={`block text-[9px] mt-1 text-right ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* AI Generating Indicator */}
                      {isProcessing && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Speech Recognition Feedback Banner */}
                    {isListening && (
                      <div className="bg-indigo-50 border-t border-indigo-100 px-4 py-2 flex items-center justify-between text-xs font-bold text-indigo-700 animate-pulse">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-red-500 rounded-full" />
                          <span>{speechFeedback || (lang === 'bn' ? "কথা বলুন, আমি শুনছি..." : lang === 'ar' ? "تحدث، أنا أستمع..." : "Listening, please speak...")}</span>
                        </div>
                        <div className="flex gap-0.5 items-center">
                          <span className="w-1 h-3 bg-indigo-600 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1 h-5 bg-indigo-600 rounded animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-4 bg-indigo-600 rounded animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}

                    {/* Footer Input Area */}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!assistantInput.trim() || isProcessing) return;
                        const text = assistantInput;
                        setAssistantInput('');
                        processCustomerVoiceCommand(text);
                      }}
                      className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
                    >
                      {/* Interactive Mic Toggle */}
                      <button
                        type="button"
                        onClick={isListening ? stopVoiceInput : startVoiceInput}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                          isListening 
                            ? 'bg-rose-550 hover:bg-rose-600 text-white animate-pulse' 
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 active:scale-95'
                        }`}
                        title={isListening ? "Stop listening" : "Start speaking"}
                      >
                        {isListening ? (
                          <MicOff className="w-5 h-5" />
                        ) : (
                          <Mic className="w-5 h-5" />
                        )}
                      </button>

                      <input 
                        type="text"
                        placeholder={
                          isListening 
                            ? (lang === 'bn' ? 'শুনছি...' : lang === 'ar' ? 'أستمع...' : 'Listening...') 
                            : (lang === 'bn' ? 'মেসেজ লিখুন...' : lang === 'ar' ? 'اكتب رسالة...' : 'Type a message...')
                        }
                        value={assistantInput}
                        onChange={(e) => setAssistantInput(e.target.value)}
                        disabled={isListening || isProcessing}
                        className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-150 rounded-xl outline-none focus:bg-white focus:border-indigo-500 font-medium text-slate-805 disabled:opacity-50"
                      />

                      <button
                        type="submit"
                        disabled={!assistantInput.trim() || isProcessing || isListening}
                        className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl flex items-center justify-center transition-all shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}

        {/* STEP 4: WHATSAPP SYNC & DELIVERY HANDSHAKE OVERLAY */}
        <AnimatePresence>
          {orderSyncStatus !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 font-sans"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative"
              >
                {/* Decorative visual bar */}
                <div className="h-2 bg-gradient-to-r from-emerald-500 via-indigo-600 to-emerald-500" />

                <div className="p-8 space-y-6">
                  {/* Header visual icon */}
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto relative">
                      <MessageSquare className="w-8 h-8 animate-pulse" />
                      <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-indigo-600 rounded-full flex items-center justify-center text-[9px] text-white font-black">4</span>
                    </div>
                    <h3 className="text-lg font-black text-gray-900 mt-4 leading-tight">
                      {isBn ? "চতুর্থ ধাপ: হোয়াটসঅ্যাপ এআই সিঙ্ক" : "Step 4: WhatsApp AI Gateway Sync"}
                    </h3>
                    <p className="text-xs text-gray-400 font-semibold leading-relaxed">
                      {isBn 
                        ? "আপনার ভয়েস অর্ডারটি সফলভাবে রিসিভ করা হয়েছে। এখন এটি ক্লাউড ডেটাবেজ ও হোয়াটসঅ্যাপ গেটওয়ের সাথে সিঙ্ক হচ্ছে।" 
                        : "Your order was logged successfully. We are now establishing a live delivery handshake with the Zender gateway."}
                    </p>
                  </div>

                  {/* STEPPER STATUS LIST */}
                  <div className="space-y-4 pt-2">
                    {/* Sub-step 1: Firebase database entry */}
                    <div className="flex items-start gap-3.5">
                      <div className="mt-0.5 shrink-0">
                        {['firebase', 'compiler', 'dispatching', 'delivered', 'failed'].includes(orderSyncStatus) ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-200 animate-spin" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-800 leading-tight">
                          {isBn ? "ক্লাউড ডাটাবেজ এন্ট্রি (Firestore Handshake)" : "Durable Cloud DB Synchronization"}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          {isBn ? "অর্ডারটি সফলভাবে ফায়ারস্টোর ডেটাবেজে সংরক্ষিত হয়েছে।" : "Order requested & permanently logged on secure Firestore cloud layers."}
                        </p>
                      </div>
                    </div>

                    {/* Sub-step 2: Compilation */}
                    <div className="flex items-start gap-3.5">
                      <div className="mt-0.5 shrink-0">
                        {['compiler', 'dispatching', 'delivered', 'failed'].includes(orderSyncStatus) ? (
                          orderSyncStatus === 'firebase' ? (
                            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                          )
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-100" />
                        )}
                      </div>
                      <div className={['firebase'].includes(orderSyncStatus) ? 'opacity-40' : ''}>
                        <h4 className="text-xs font-bold text-gray-800 leading-tight">
                          {isBn ? "ইনভয়েস পে-লোড কম্পাইলেশন" : "Automated Invoice Compiling"}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          {isBn ? "বাংলায় এআই ভয়েস-ফরম্যাট রিসিট মেকিং সম্পন্ন হয়েছে।" : "Order contents dynamically parsed, structured, and translated into a custom receipt."}
                        </p>
                      </div>
                    </div>

                    {/* Sub-step 3: Gateway dispatching */}
                    <div className="flex items-start gap-3.5">
                      <div className="mt-0.5 shrink-0">
                        {['dispatching', 'delivered', 'failed'].includes(orderSyncStatus) ? (
                          orderSyncStatus === 'compiler' ? (
                            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                          ) : (
                            orderSyncStatus === 'failed' ? (
                              <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black">✗</div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                            )
                          )
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-100" />
                        )}
                      </div>
                      <div className={['firebase', 'compiler'].includes(orderSyncStatus) ? 'opacity-40' : ''}>
                        <h4 className="text-xs font-bold text-gray-800 leading-tight">
                          {isBn ? "গেটওয়ে ডিসপ্যাচ (SellersCampus Connect)" : "Zender Messaging Dispatcher"}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5 font-mono">
                          {orderSyncStatus === 'failed' 
                            ? (isBn ? `ব্যর্থ হয়েছে: ${syncError}` : `Failed: ${syncError}`)
                            : (isBn ? "অর্ডার ডিটেইলস হোয়াটসঅ্যাপ গেটওয়েতে পাঠানো হচ্ছে।" : "Connecting to cloud WhatsApp server via SellersCampus secure API port.")}
                        </p>
                      </div>
                    </div>

                    {/* Sub-step 4: Delivered Handshake */}
                    <div className="flex items-start gap-3.5">
                      <div className="mt-0.5 shrink-0">
                        {orderSyncStatus === 'delivered' ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">✓</div>
                        ) : (
                          orderSyncStatus === 'dispatching' ? (
                            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-100" />
                          )
                        )}
                      </div>
                      <div className={orderSyncStatus !== 'delivered' ? 'opacity-40' : ''}>
                        <h4 className="text-xs font-bold text-gray-800 leading-tight">
                          {isBn ? "সফল হোয়াটসঅ্যাপ রিসিট ডেলিভারি" : "Instant Receipt Delivered"}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          {isBn ? "গ্রাহক এবং স্টোর মালিকের হোয়াটসঅ্যাপ নম্বরে মেসজটি পৌঁছেছে।" : "WhatsApp message successfully queued and delivered to your designated contact phone."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Button Section */}
                  <div className="border-t border-gray-50 pt-6 flex items-center gap-3">
                    {orderSyncStatus === 'failed' && (
                      <button
                        onClick={async () => {
                          if (syncOrderData) {
                            await runWhatsAppSync(syncOrderData);
                          }
                        }}
                        className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-2xl text-xs transition-all border border-indigo-100 cursor-pointer"
                      >
                        {isBn ? "পুনরায় চেষ্টা করুন" : "Retry Connection"}
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        setOrderSyncStatus('idle');
                        setSyncOrderData(null);
                        setSyncError(null);
                        setActiveTab('orders'); // Jump to histories
                      }}
                      className={`flex-1 py-3.5 font-bold rounded-2xl text-xs transition-all shadow-md cursor-pointer ${orderSyncStatus === 'delivered' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'}`}
                    >
                      {orderSyncStatus === 'delivered'
                        ? (isBn ? "ধন্যবাদ, অর্ডার লিস্ট দেখুন" : "Done, View My Orders")
                        : (isBn ? "গেস্ট মুডে স্কিপ করুন" : "Bypass & View Orders")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
