// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Check, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Printer, 
  Send, 
  MessageSquare, 
  Search, 
  Sparkles, 
  Smartphone, 
  Activity, 
  FileText, 
  Calculator, 
  Zap, 
  Clock, 
  ChevronRight,
  TrendingUp, 
  Coins,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer 
} from 'recharts';
import { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp 
} from '../firebase';

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
}

interface ServiceInvoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  originalPrice: number;
  finalPrice: number;
  note?: string; // Additional details
  date: string; // ISO or human format
  createdAt: any;
  status: 'paid' | 'pending';
}

interface ServiceOfferDashboardProps {
  user: any;
  settings: any;
  setNotification: (notif: { type: 'success' | 'error' | 'info'; message: string }) => void;
}

const DEFAULT_SERVICES: Omit<Service, 'id'>[] = [
  { name: 'ফটোকপি (Photocopy - A4)', price: 5, category: 'ফটোকপি ও প্রিন্টিং', description: 'উচ্চমানের ফটোকপি সার্ভিস' },
  { name: 'রঙিন ছবি তোলা (Passport Photo)', price: 50, category: 'ছবি তোলা', description: 'পাসপোর্ট সাইজ ল্যাব প্রিন্ট ছবি' },
  { name: 'মোবাইলের গ্লাস লাগানো (Screen Glass Installation)', price: 100, category: 'মোবাইল এক্সেসরিজ', description: 'প্রিমিয়াম গ্লাস প্রোটেক্টর লাগানো' },
  { name: 'ল্যাপটপ/পিসি উইন্ডোজ সেটআপ (OS Installation)', price: 500, category: 'কম্পিউটার মেরামত', description: 'উইন্ডোজ সেটআপ ও প্রয়োজনীয় ড্রাইভার সফটওয়্যার' },
  { name: 'কম্পিউটার মেকানিক্যাল সার্ভিস (Hardware Repair)', price: 350, category: 'কম্পিউটার মেরামত', description: 'ডেস্কটপ বা বা ল্যাপটপের হার্ডওয়্যার চেকিং ও রিপেয়ারিং' },
  { name: 'মোবাইল চার্জার ও অরিজিনাল ক্যাবল (Charger & Cables)', price: 250, category: 'মোবাইল এক্সেসরিজ', description: 'ফাস্ট চার্জিং ক্যাবল ও এডাপ্টার বিক্রি' },
];

export default function ServiceOfferDashboard({ user, settings, setNotification }: ServiceOfferDashboardProps) {
  const shopId = user?.shopId || 'pos-merchant-master';

  // State Tabs
  const [activeTab, setActiveTab] = useState<'catalog' | 'billing' | 'logs'>('billing');

  // Core inventories
  const [services, setServices] = useState<Service[]>([]);
  const [invoices, setInvoices] = useState<ServiceInvoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search filter
  const [catalogSearch, setCatalogSearch] = useState('');
  const [logsSearch, setLogsSearch] = useState('');

  // Form states for new service
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('ফটোকপি ও প্রিন্টিং');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Billing forms
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [billingPrice, setBillingPrice] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [invoiceNote, setInvoiceNote] = useState<string>('');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<ServiceInvoice | null>(null);
  
  // WhatsApp dispatch status
  const [isSendingWa, setIsSendingWa] = useState(false);

  // Test Connection States
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testMsgStatus, setTestMsgStatus] = useState<string | null>(null);
  const [testMsgError, setTestMsgError] = useState<string | null>(null);

  const handleSendTestMessage = async () => {
    if (!testPhone) {
      setTestMsgError('অনুগ্রহ করে টেস্ট করার জন্য একটি মোবাইল নম্বর প্রদান করুন');
      return;
    }
    setTestSending(true);
    setTestMsgStatus(null);
    setTestMsgError(null);

    let cleanPhone = testPhone.trim().replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.slice(1);
    if (cleanPhone.length === 11 && cleanPhone.startsWith('01')) {
      cleanPhone = '88' + cleanPhone;
    }

    try {
      const response = await fetch('/api/gateways/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shopId,
          sale: {
            id: 'test-svc-' + Date.now(),
            customerPhone: cleanPhone,
            message: `🧪 *হোয়াটসঅ্যাপ কানেকশন টেস্ট*\n\nঅভিনন্দন! আপনার সার্ভিস অফার ড্যাশবোর্ড থেকে হোয়াটসঅ্যাপ মেসেজিং গেটওয়ে সফলভাবে কানেক্টেড রয়েছে।`
          },
          gatewayConfig: {
            default_route: 'whatsapp',
            waGatewayType: (settings as any).waGatewayType || 'baileys',
            meta_phone_number_id: (settings as any).meta_phone_number_id || (settings as any).metaPhoneNumberId || '',
            meta_access_token: (settings as any).meta_access_token || (settings as any).metaAccessToken || '',
            meta_waba_id: (settings as any).meta_waba_id || (settings as any).metaWabaId || '',
            baileys_phone: (settings as any).baileys_phone || (settings as any).baileysPhone || '',
            zender_api_key: (settings as any).waLinkSecret || settings.zender_api_key || (settings as any).waToken || '4fe17fcfe73d5035f55b9144fa10e07443659005',
            zender_whatsapp_device_id: settings.zender_whatsapp_device_id || settings.zender_device_id || '',
            zender_endpoint_url: 'https://app.sellerscampus.com/api/v1'
          }
        })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          setTestMsgStatus('✓ টেস্ট মেসেজ সফলভাবে পাঠানো হয়েছে!');
        } else {
          setTestMsgError(resData.error || 'তাহলে ডিভাইস সংযুক্ত নেই। বা সেশন সচল নয়। অনুগ্রহ করে কানেক্ট করুন।');
        }
      } else {
        setTestMsgError('সার্ভার ত্রুটি! আপনার গেটওয়ে সেটিংস পুনরায় চেক করুন।');
      }
    } catch (err: any) {
      console.error('Test dispatch error:', err);
      setTestMsgError('কানেকশন ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setTestSending(false);
    }
  };

  // Load and Listen to Firestore collections
  useEffect(() => {
    if (!db) {
      // Fallback local storage
      const cachedServices = localStorage.getItem(`services_${shopId}`);
      const cachedInvoices = localStorage.getItem(`invoices_${shopId}`);
      if (cachedServices) setServices(JSON.parse(cachedServices));
      else {
        // Populate initial defaults
        const initial = DEFAULT_SERVICES.map((s, idx) => ({ ...s, id: `svc_${idx}` }));
        setServices(initial);
        localStorage.setItem(`services_${shopId}`, JSON.stringify(initial));
      }
      if (cachedInvoices) setInvoices(JSON.parse(cachedInvoices));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // 1. Subscribe to Services
    const qServices = query(collection(db, 'services'), where('shopId', '==', shopId));
    const unsubServices = onSnapshot(qServices, (snapshot) => {
      const svcs: Service[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        svcs.push({
          id: doc.id,
          name: data.name || '',
          price: Number(data.price) || 0,
          category: data.category || '',
          description: data.description || ''
        });
      });
      
      setServices(svcs);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore services subscription failed", error);
      // fallback
      const cached = localStorage.getItem(`services_${shopId}`);
      if (cached) setServices(JSON.parse(cached));
      setIsLoading(false);
    });

    // 2. Subscribe to Service Invoices
    const qInvoices = query(collection(db, 'service_invoices'), where('shopId', '==', shopId));
    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      const invs: ServiceInvoice[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        invs.push({
          id: doc.id,
          invoiceNo: data.invoiceNo || '',
          customerName: data.customerName || '',
          customerPhone: data.customerPhone || '',
          serviceId: data.serviceId || '',
          serviceName: data.serviceName || '',
          originalPrice: Number(data.originalPrice) || 0,
          finalPrice: Number(data.finalPrice) || 0,
          note: data.note || '',
          date: data.date || '',
          status: data.status || 'paid',
          createdAt: data.createdAt
        });
      });
      // Sort newest first
      invs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setInvoices(invs);
    }, (error) => {
      console.error("Firestore invoices subscription failed", error);
      const cached = localStorage.getItem(`invoices_${shopId}`);
      if (cached) setInvoices(JSON.parse(cached));
    });

    return () => {
      unsubServices();
      unsubInvoices();
    };
  }, [shopId]);

  // Sync to local storage for quick access backups
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(`services_${shopId}`, JSON.stringify(services));
    }
  }, [services, shopId, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(`invoices_${shopId}`, JSON.stringify(invoices));
    }
  }, [invoices, shopId, isLoading]);

  // Handle selected service changes to auto-fill the base rate
  useEffect(() => {
    if (selectedServiceId) {
      const svc = services.find(s => s.id === selectedServiceId);
      if (svc) {
        setBillingPrice(svc.price.toString());
      }
    } else {
      setBillingPrice('');
    }
  }, [selectedServiceId, services]);

  // Create or Update Catalog Service
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrice) {
      setNotification({ type: 'error', message: 'সার্ভিসের নাম এবং রেট দেওয়া আবশ্যক!' });
      return;
    }

    const priceNum = parseFloat(newServicePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setNotification({ type: 'error', message: 'রেট অবশ্যই সঠিক সংখ্যা হতে হবে!' });
      return;
    }

    try {
      if (editingServiceId) {
        // Edit Mode
        if (db) {
          const docRef = doc(db, 'services', editingServiceId);
          await updateDoc(docRef, {
            name: newServiceName.trim(),
            price: priceNum,
            category: newServiceCategory,
            description: newServiceDesc.trim()
          });
        } else {
          setServices(prev => prev.map(s => s.id === editingServiceId ? {
            ...s,
            name: newServiceName.trim(),
            price: priceNum,
            category: newServiceCategory,
            description: newServiceDesc.trim()
          } : s));
        }
        setNotification({ type: 'success', message: 'সার্ভিসটি সফলভাবে আপডেট করা হয়েছে!' });
      } else {
        // Create Mode
        if (db) {
          await addDoc(collection(db, 'services'), {
            name: newServiceName.trim(),
            price: priceNum,
            category: newServiceCategory,
            description: newServiceDesc.trim(),
            shopId,
            createdAt: serverTimestamp()
          });
        } else {
          const newSvc: Service = {
            id: `svc_${Date.now()}`,
            name: newServiceName.trim(),
            price: priceNum,
            category: newServiceCategory,
            description: newServiceDesc.trim()
          };
          setServices(prev => [...prev, newSvc]);
        }
        setNotification({ type: 'success', message: 'নতুন সার্ভিস সফলভাবেযুক্ত হয়েছে!' });
      }

      // Reset
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDesc('');
      setEditingServiceId(null);
      setIsAddingService(false);
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'ডিবি সেভ করতে ত্রুটি হয়েছে!' });
    }
  };

  // Delete Service
  const handleDeleteService = async (id: string, name: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'services', id));
      } else {
        setServices(prev => prev.filter(s => s.id !== id));
      }
      setNotification({ type: 'success', message: 'সার্ভিস সফলভাবে ডিলেট করা হয়েছে!' });
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'সার্ভিস ডিলেট করতে সমস্যা হয়েছে।' });
    }
  };

  const handleEditInit = (svc: Service) => {
    setEditingServiceId(svc.id);
    setNewServiceName(svc.name);
    setNewServicePrice(svc.price.toString());
    setNewServiceCategory(svc.category);
    setNewServiceDesc(svc.description || '');
    setIsAddingService(true);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  // Generate Service Bill & Invoice Memory
  const handleGenerateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) {
      setNotification({ type: 'error', message: 'দয়া করে একটি সার্ভিস সিলেক্ট করুন!' });
      return;
    }
    if (!billingPrice) {
      setNotification({ type: 'error', message: 'বিল অ্যামাউন্ট বা রেট অবশ্যই নির্ধারণ করুন!' });
      return;
    }

    const finalPriceNum = parseFloat(billingPrice);
    if (isNaN(finalPriceNum) || finalPriceNum < 0) {
      setNotification({ type: 'error', message: 'সার্ভিস রেট সঠিক সংখ্যা হতে হবে!' });
      return;
    }

    setIsGeneratingInvoice(true);
    const selectedSvc = services.find(s => s.id === selectedServiceId);
    if (!selectedSvc) {
      setNotification({ type: 'error', message: 'সার্ভিস পাওয়া যায়নি!' });
      setIsGeneratingInvoice(false);
      return;
    }

    const invoiceNo = `SRV-INV-${Date.now().toString().slice(-6)}`;
    const newInvoice: Omit<ServiceInvoice, 'id'> = {
      invoiceNo,
      customerName: customerName.trim() || 'সাধারণ ক্রেতা (Walk-in Customer)',
      customerPhone: customerPhone.trim() || '',
      serviceId: selectedServiceId,
      serviceName: selectedSvc.name,
      originalPrice: selectedSvc.price,
      finalPrice: finalPriceNum,
      note: invoiceNote.trim(),
      date: new Date().toISOString(),
      status: 'paid'
    };

    try {
      let created: ServiceInvoice;
      if (db) {
        const docRef = await addDoc(collection(db, 'service_invoices'), {
          ...newInvoice,
          shopId,
          createdAt: serverTimestamp()
        });
        created = { ...newInvoice, id: docRef.id };
      } else {
        created = { ...newInvoice, id: `inv_${Date.now()}` };
        setInvoices(prev => [created, ...prev]);
      }

      setActiveInvoice(created);
      setNotification({ type: 'success', message: 'ক্যাশ মেমো সফলভাবে তৈরি হয়েছে!' });
      
      // Auto-send WhatsApp message as requested
      handleSendToWhatsApp(created);
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'মেমো সংরক্ষণ করতে ত্রুটি হয়েছে।' });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Send Invoice to WhatsApp (Automated Zender integration or fallback link)
  const handleSendToWhatsApp = async (inv: ServiceInvoice) => {
    if (!inv.customerPhone) {
      setNotification({ type: 'error', message: 'কাস্টমারের কোনো মোবাইল নম্বর প্রদান করা হয়নি!' });
      return;
    }

    // Check trial
    const safeDate = (timestamp: any): Date => {
      if (!timestamp) return new Date();
      if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
      if (timestamp instanceof Date) return timestamp;
      if (typeof timestamp === 'number') return new Date(timestamp);
      if (timestamp.seconds !== undefined) {
        return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
      }
      return new Date(timestamp);
    };

    const createdDate = settings?.createdAt ? safeDate(settings.createdAt) : new Date();
    const trialEnd = new Date(createdDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    const isPremium = (() => {
      const s = settings as any;
      if (!s) return false;
      if (s.premiumActive) return true;
      if (s.plan && s.plan !== 'free') return true;
      if (s.packageType === 'lifetime' || s.lifetime) return true;
      if (s.premiumUntil) {
        const untilDate = safeDate(s.premiumUntil);
        if (untilDate.getTime() > new Date().getTime()) return true;
      }
      if (trialEnd.getTime() > new Date().getTime()) return true;
      return false;
    })();
    if (!isPremium && trialEnd.getTime() < new Date().getTime()) {
      alert("আপনার ফ্রি ট্রায়াল (৯০ দিন) শেষ হয়েছে। WhatsApp অটো মেসেজ ফিচার ব্যবহার করতে আপনার প্যাকেজ আপগ্রেড করুন।");
      return;
    }

    setIsSendingWa(true);
    
    // Core shop name and message construction
    const shopName = settings.name || 'রিসেন্ট মার্ট ও সার্ভিস';
    const cleanNo = inv.customerPhone.trim();
    
    const formattedBillMsg = `*${shopName} - সার্ভিস ক্যাশ মেমো*\n` +
      `----------------------------------------\n` +
      `রশিদ নং: *${inv.invoiceNo}*\n` +
      `তারিখ: ${new Date(inv.date).toLocaleDateString('bn-BD')} ${new Date(inv.date).toLocaleTimeString('bn-BD')}\n` +
      `কাস্টমার নাম: *${inv.customerName}*\n` +
      `মোবাইল: ${cleanNo}\n` +
      `----------------------------------------\n` +
      `সার্ভিস ক্যাটাগরি: *${inv.serviceName}*\n` +
      `মূল রেট: ৳${inv.originalPrice}\n` +
      `পরিশোধিত বিল: *৳${inv.finalPrice}* (Paid)\n` +
      `----------------------------------------\n` +
      `ধন্যবাদ! আবারো আসবেন।`;

    let cleanPhone = cleanNo.replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+')) cleanPhone = cleanPhone.slice(1);
    if (cleanPhone.length === 11 && cleanPhone.startsWith('01')) {
      cleanPhone = '88' + cleanPhone;
    }

    try {
      const payload = {
        shopId: shopId,
        sale: {
          id: inv.invoiceNo,
          customerPhone: cleanPhone,
          message: formattedBillMsg
        },
        gatewayConfig: {
          default_route: 'whatsapp',
          waGatewayType: (settings as any).waGatewayType || 'baileys',
          meta_phone_number_id: (settings as any).meta_phone_number_id || (settings as any).metaPhoneNumberId || '',
          meta_access_token: (settings as any).meta_access_token || (settings as any).metaAccessToken || '',
          meta_waba_id: (settings as any).meta_waba_id || (settings as any).metaWabaId || '',
          baileys_phone: (settings as any).baileys_phone || (settings as any).baileysPhone || '',
          zender_api_key: (settings as any).waLinkSecret || settings.zender_api_key || (settings as any).waToken || '4fe17fcfe73d5035f55b9144fa10e07443659005',
          zender_whatsapp_device_id: settings.zender_whatsapp_device_id || settings.zender_device_id || '',
          zender_endpoint_url: 'https://app.sellerscampus.com/api/v1'
        }
      };

      const response = await fetch('/api/gateways/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          setNotification({ type: 'success', message: 'হোয়াটসঅ্যাপে ইনভয়েস সফলভাবে পাঠানো হয়েছে!' });
        } else {
          setNotification({ type: 'error', message: 'হোয়াটসঅ্যাপ সংযোগে ত্রুটি: ' + (resData.error || '') });
        }
      } else {
        setNotification({ type: 'error', message: 'সার্ভার ত্রুটি!' });
      }
    } catch (err) {
      console.error("WhatsApp dispatch failure", err);
      setNotification({ type: 'error', message: 'বার্তা পাঠানো সম্ভব হয়নি।' });
    } finally {
      setIsSendingWa(false);
    }
  };

  // Browser standard thermal print layout
  const handleThermalPrint = () => {
    window.print();
  };

  // Delete invoice log row
  const handleDeleteInvoiceLog = async (id: string, code: string) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'service_invoices', id));
      } else {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
      }
      setNotification({ type: 'success', message: 'হিস্ট্রি রো ডিলিট হয়েছে।' });
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'ডিলিট সম্পন্ন করা যায়নি।' });
    }
  };

  // Filter Catalog Data
  const filteredServices = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    if (!q) return services;
    return services.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.category.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }, [services, catalogSearch]);

  // Filter Logs Data
  const filteredInvoices = useMemo(() => {
    const q = logsSearch.toLowerCase().trim();
    if (!q) return invoices;
    return invoices.filter(inv => 
      inv.invoiceNo.toLowerCase().includes(q) || 
      inv.customerName.toLowerCase().includes(q) || 
      inv.customerPhone.includes(q) || 
      inv.serviceName.toLowerCase().includes(q)
    );
  }, [invoices, logsSearch]);

  // Financial Insights Calculations
  const insights = useMemo(() => {
    const totalEarnings = invoices.reduce((sum, inv) => sum + inv.finalPrice, 0);
    
    // Today check (using UTC local day segment check)
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEarnings = invoices
      .filter(inv => inv.date.slice(0, 10) === todayStr)
      .reduce((sum, inv) => sum + inv.finalPrice, 0);

    const totalOrdersCount = invoices.length;
    
    // Service distribution chart formatter
    const serviceDistributionMap: Record<string, { name: string; count: number; value: number }> = {};
    invoices.forEach(inv => {
      if (!serviceDistributionMap[inv.serviceName]) {
        serviceDistributionMap[inv.serviceName] = { 
          name: inv.serviceName.split('(')[0].trim(), 
          count: 0, 
          value: 0 
        };
      }
      serviceDistributionMap[inv.serviceName].count += 1;
      serviceDistributionMap[inv.serviceName].value += inv.finalPrice;
    });

    const categoriesArray = Object.values(serviceDistributionMap).sort((a, b) => b.value - a.value);

    return {
      totalEarnings,
      todayEarnings,
      totalOrdersCount,
      chartData: categoriesArray.slice(0, 5) // top 5 earners
    };
  }, [invoices]);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

  return (
    <div id="service-dashboard-container" className="space-y-6 animate-fade-in relative">
      
      {/* Hidden layout specifically customized for printing thermal pos bill */}
      <div className="hidden print:block print:bg-white print:text-black print:p-6 print:w-full print:absolute print:top-0 print:left-0 print:z-50 print:font-sans">
        {activeInvoice && (
          <div className="w-80 mx-auto border-2 border-dashed border-gray-400 p-4 rounded text-xs select-text">
            <div className="text-center font-bold text-lg uppercase tracking-wider mb-1">
              {settings.name || 'রিসেন্ট মার্ট'}
            </div>
            <div className="text-center text-[10px] text-gray-700 leading-tight mb-3">
              {settings.address || 'মুদি দোকান ও ডিজিটাল সার্ভিস সেন্টার'} <br />
              {settings.phone && `ফোন: ${settings.phone}`}
            </div>
            
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2 font-mono text-[10px]">
              <div>রশিদ নং: {activeInvoice.invoiceNo}</div>
              <div>তারিখ: {new Date(activeInvoice.date).toLocaleDateString('bn-BD')} {new Date(activeInvoice.date).toLocaleTimeString('bn-BD')}</div>
              <div className="font-bold">ক্রেতার নাম: {activeInvoice.customerName}</div>
              {activeInvoice.customerPhone && <div>মোবাইল: {activeInvoice.customerPhone}</div>}
            </div>

            <div className="font-bold uppercase tracking-wider mb-1 text-[11px] border-b border-dashed border-gray-400 pb-1">
              সার্ভিস মেমো বিল বিবরণী
            </div>

            <div className="space-y-2 py-2 text-[11px] border-b border-dashed border-gray-400 mb-2">
              <div className="flex justify-between font-bold">
                <span>{activeInvoice.serviceName}</span>
                <span>৳{activeInvoice.finalPrice}</span>
              </div>
              <div className="text-[10px] text-gray-500 italic">
                বেস রেট: ৳{activeInvoice.originalPrice}
              </div>
              {activeInvoice.note && (
                <div className="text-[10px] text-gray-600 mt-1 pb-1 border-t border-gray-200 border-dashed pt-1">
                  নোট: {activeInvoice.note}
                </div>
              )}
            </div>

            <div className="text-right space-y-1 mb-4 text-[12px] font-bold">
              <div className="flex justify-between">
                <span>সর্বমোট বিল (Net Bill):</span>
                <span>৳{activeInvoice.finalPrice}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>পরিশোধিত (Total Received):</span>
                <span>৳{activeInvoice.finalPrice}</span>
              </div>
            </div>

            <div className="text-center text-[10px] italic pt-2 border-t border-dashed border-gray-400 uppercase">
              *** ধন্যবাদ! আবারো আসবেন *** <br />
              Powered by Systems Campus
            </div>
          </div>
        )}
      </div>

      {/* Screen Interactive Panel Header */}
      <div className="print:hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial-gradient from-indigo-500/10 to-transparent pointer-events-none" />
        
        {/* Visual elements */}
        <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin-slow" />
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">স্মার্ট রিটেইল সার্ভিস পোর্টাল</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">সার্ভিস ক্যাশ মেমো ও বিলি (Service & Utility Center)</h1>
            <p className="text-xs md:text-sm text-slate-300 font-semibold max-w-2xl leading-relaxed">
              আপনার মুদি দোকানের ফটোকপি, ফটোগ্রাফি, মোবাইল গ্লাস, মেরামত ইত্যাদি সহযোগী সেবাগুলো রেজিস্টার করুন, বিল তৈরি করুন এবং স্বয়ংক্রিয় হোয়াটসঅ্যাপ নোটিফিকেশন ডেলিভার করুন।
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl md:self-stretch justify-center">
            <div className="text-center font-mono px-3">
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">আজকের আয় (Today)</p>
              <h2 className="text-xl md:text-2xl font-black text-emerald-400 mt-1">৳{insights.todayEarnings}</h2>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center font-mono px-3">
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">মোট সার্ভিস আয় (Total)</p>
              <h2 className="text-xl md:text-2xl font-black text-indigo-100 mt-1">৳{insights.totalEarnings}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="print:hidden flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-px">
        <div className="flex gap-2">
          {[
            { id: 'billing', label: 'ক্যাশ মেমো ও বিলিং (Create Bill)', icon: FileText },
            { id: 'catalog', label: 'সার্ভিসেস ডেটাবেজ (Catalog DB)', icon: Zap },
            { id: 'logs', label: 'সার্ভিস সেলস হিস্ট্রি ও আয় (Sales Logs & Reports)', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-2 px-5 py-3 text-xs font-black transition-all rounded-t-xl cursor-pointer ${
                  isActive 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border-t border-x border-gray-200 dark:border-slate-800 shadow-xs' 
                    : 'text-gray-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-900/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeServiceTabBorder"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600 dark:bg-indigo-400"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 font-mono">
          <span>WhatsApp Status:</span>
          <span className={`h-2.5 w-2.5 rounded-full ${settings.whatsapp_status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="uppercase">{settings.whatsapp_status || 'offline'}</span>
        </div>
      </div>

      {/* Tab Area Render */}
      <div className="print:hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">সার্ভিস ডাটা প্রসেস করা হচ্ছে...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            
            {/* TAB 1: SERVICE BILLING (CREATE MEMO) */}
            {activeTab === 'billing' && (
              <motion.div
                key="billing-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Left Side: Creation Form */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div className="border-b border-gray-100 dark:border-slate-900 pb-4">
                    <h3 className="font-extrabold text-base text-gray-950 dark:text-white flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-indigo-500" />
                      মেমো তৈরি ও তাৎক্ষণিক বিলিং (New Entry)
                    </h3>
                    <p className="text-[11px] text-gray-400 font-medium mt-1">গ্রাহকের সার্ভিস সিলেক্ট করুন, বিল মডিফাই করুন এবং ক্যাশ মেমো ইমিডিয়টলি জেনেরেট করুন।</p>
                  </div>

                  <form onSubmit={handleGenerateInvoiceSubmit} className="space-y-4">
                    {/* Select Service */}
                    <div>
                      <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                        সার্ভিস নির্বাচন করুন (Choose Service) *
                      </label>
                      <select
                        value={selectedServiceId}
                        onChange={(e) => setSelectedServiceId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- সার্ভিস সিলেক্ট করুন --</option>
                        {services.map((svc) => (
                          <option key={svc.id} value={svc.id}>
                            {svc.name} - (৳{svc.price} / {svc.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Price and Price Overriding capability */}
                    <div>
                      <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                        বিল মূল্য নির্ধারণ করুন (Price Override Option) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 dark:text-gray-500">৳</span>
                        <input
                          type="number"
                          value={billingPrice}
                          onChange={(e) => setBillingPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-black font-mono text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <p className="text-[9.5px] text-indigo-500 font-medium mt-1.5">💡 আপনি চাইলে প্রয়োজন অনুযায়ী মূল্যটি পরিবর্তন বা হ্রাস-বৃদ্ধি (Override) করতে পারবেন।</p>
                    </div>

                    <div className="w-full h-px bg-gray-100 dark:bg-slate-900 my-2" />

                    {/* Customer Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                          কাস্টমারের নাম (Customer Name)
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="যেমন: আব্দুর রহমান"
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                          হোয়াটসঅ্যাপ / মোবাইল নম্বর (WhatsApp Phone)
                        </label>
                        <input
                          type="text"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="যেমন: 017XXXXXXXX"
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1.5">
                        পরিষেবার বিস্তারিত / ডিভাইস / নোট (Details/Notes - Optional)
                      </label>
                      <input
                        type="text"
                        value={invoiceNote}
                        onChange={(e) => setInvoiceNote(e.target.value)}
                        placeholder="যেমন: ডিসপ্লে পরিবর্তন, ৬ মাসের ওয়ারেন্টি, মডেল: iPhone X"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isGeneratingInvoice}
                      className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-750 hover:to-purple-750 text-white font-black rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-150 dark:shadow-none flex items-center justify-center gap-2 "
                    >
                      {isGeneratingInvoice ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>বিল প্রক্রিয়া হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>মেমো ও বিল সংরক্ষণ করুন (Save Bill & View PDF)</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* WhatsApp Connectivity test section */}
                  <div 
                    id="ServiceOfferDashboard-test-section"
                    className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800/80 space-y-3.5"
                  >
                    <div>
                      <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        হোয়াটসঅ্যাপ কানেকশন টেস্ট (Test Connection)
                      </h4>
                      <p className="text-[10px] text-gray-450 dark:text-gray-400 font-semibold leading-relaxed">
                        হোয়াটসঅ্যাপ গেটওয়ে সঠিকভাবে সংযুক্ত আছে কিনা তা যাচাই করতে নিচে একটি নম্বর দিয়ে টেস্ট করুন।
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          placeholder="যেকোনো মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)"
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendTestMessage}
                        disabled={testSending || !testPhone}
                        className="px-5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-650 text-white font-bold rounded-xl text-xs shadow-md transition-all whitespace-nowrap cursor-pointer active:scale-98 disabled:opacity-55 flex items-center justify-center gap-1.5"
                      >
                        {testSending ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>পাঠানো হচ্ছে...</span>
                          </>
                        ) : (
                          <span>Verify</span>
                        )}
                      </button>
                    </div>

                    {testMsgStatus && (
                      <div className="flex items-start gap-2 text-[10.5px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/55 p-3 rounded-xl font-bold">
                        <span className="flex-shrink-0 mt-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-full p-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                        <div className="leading-snug">{testMsgStatus}</div>
                      </div>
                    )}

                    {testMsgError && (
                      <div className="flex items-start gap-2 text-[10.5px] text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100/55 p-3 rounded-xl font-bold">
                        <span className="flex-shrink-0 mt-0.5 bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-300 rounded-full p-0.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                        </span>
                        <div className="leading-snug">{testMsgError}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Cash Memo Visual representation (Designed like true Thermal Paper Receipt) */}
                <div className="lg:col-span-5 flex flex-col space-y-4">
                  
                  {activeInvoice ? (
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md relative overflow-hidden flex-1 flex flex-col justify-between">
                      <div className="absolute right-4 top-4 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        ✓ PAID / পরিশোধিত
                      </div>

                      {/* Header */}
                      <div className="text-center pb-4 border-b border-dashed border-gray-200 dark:border-slate-800">
                        <span className="text-[10px] font-black tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">Cash Memo</span>
                        <h4 className="font-extrabold text-base text-gray-900 dark:text-white mt-1 uppercase">
                          {settings.name || 'রিসেন্ট মার্ট'}
                        </h4>
                        <p className="text-[9.5px] text-gray-400 font-semibold">{settings.address || 'ডিজিটাল রিটেইল এন্ড সার্ভিসেস'}</p>
                      </div>

                      {/* Thermal Paper Interior */}
                      <div className="py-4 my-2 border-b border-dashed border-gray-200 dark:border-slate-800 flex-1 flex flex-col justify-start">
                        <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-gray-500 dark:text-slate-400 font-medium font-mono mb-4">
                          <div>রশিদ নং:</div>
                          <div className="text-right text-gray-900 dark:text-white font-bold">{activeInvoice.invoiceNo}</div>
                          
                          <div>তারিখ:</div>
                          <div className="text-right text-gray-900 dark:text-white">
                            {new Date(activeInvoice.date).toLocaleDateString('bn-BD')}
                          </div>

                          <div>কাস্টমার:</div>
                          <div className="text-right text-gray-900 dark:text-white font-black truncate">{activeInvoice.customerName}</div>
                          
                          {activeInvoice.customerPhone && (
                            <>
                              <div>মোবাইল:</div>
                              <div className="text-right text-gray-900 dark:text-white font-bold">{activeInvoice.customerPhone}</div>
                            </>
                          )}
                        </div>

                        {/* Mid bill details summary */}
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-100 dark:border-slate-850/60 font-sans">
                          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">সার্ভিস আইটেম (Delivered Service)</p>
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800/80">
                            <span className="text-xs font-extrabold text-gray-950 dark:text-white block max-w-[180px] truncate">{activeInvoice.serviceName}</span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">৳{activeInvoice.finalPrice}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10.5px] text-gray-400 mt-2 font-mono">
                            <span>বেস রেট (Base Rate):</span>
                            <span>৳{activeInvoice.originalPrice}</span>
                          </div>
                          {activeInvoice.note && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-800/50">
                              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block mb-1 uppercase tracking-wider">বিস্তারিত নোট:</span>
                              <p className="text-[11px] text-gray-700 dark:text-slate-300 leading-relaxed font-medium">
                                {activeInvoice.note}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Total Net values */}
                        <div className="mt-4 border-t border-dashed border-gray-200 dark:border-slate-800 pt-3 space-y-1 text-xs font-black">
                          <div className="flex justify-between text-gray-500">
                            <span>মোট সার্ভিস মূল্য:</span>
                            <span>৳{activeInvoice.finalPrice}</span>
                          </div>
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-sm">
                            <span>পরিশোধিত ক্যাশ:</span>
                            <span>৳{activeInvoice.finalPrice}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="space-y-3 pt-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleThermalPrint}
                            className="flex-1 flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 py-3 rounded-xl text-[11px] font-black cursor-pointer shadow-xs border border-transparent transition-all hover:scale-[1.01]"
                          >
                            <Printer className="w-4 h-4 text-slate-500" />
                            <span>থার্মাল প্রিন্ট করুন</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendToWhatsApp(activeInvoice)}
                            disabled={isSendingWa}
                            className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3 rounded-xl text-[11px] font-black cursor-pointer shadow-sm transition-all hover:scale-[1.01]"
                          >
                            <Send className="w-4 h-4" />
                            <span>{isSendingWa ? 'পাঠানো হচ্ছে...' : 'হোয়াটসঅ্যাপে পাঠান'}</span>
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            setActiveInvoice(null);
                            setSelectedServiceId('');
                            setCustomerName('');
                            setCustomerPhone('');
                            setInvoiceNote('');
                          }}
                          className="w-full text-center text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-slate-350 py-1.5 transition-colors font-bold uppercase tracking-wider"
                        >
                          নতুন বিল স্ক্রীন তৈরি করুন {'>>'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-gray-200 dark:border-slate-800 p-8 rounded-3xl text-center flex flex-col items-center justify-center flex-1">
                      <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 animate-pulse" />
                      </div>
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white mb-1.5">কোনো রিসিট সিলেক্টেড নেই</h4>
                      <p className="text-[11px] text-gray-400 dark:text-slate-400 max-w-xs font-semibold leading-normal">
                        বাম পাশের ফরম এ ডাটা ইনপুট দিয়ে ক্যাশ মেমো জেনারেট করলেই এখানে তার রিসিট ভিউ এবং প্রিন্ট অপশনটি চলে আসবে।
                      </p>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* TAB 2: SERVICE CATALOG (DATABASE) */}
            {activeTab === 'catalog' && (
              <motion.div
                key="catalog-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {/* Search Bar & Trigger Button */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-between bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="সার্ভিস বা ক্যাটাগরি খুজুন..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setNewServiceName('');
                      setNewServicePrice('');
                      setNewServiceDesc('');
                      setEditingServiceId(null);
                      setIsAddingService(true);
                    }}
                    className="flex items-center justify-center gap-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4 font-black" />
                    <span>নতুন সার্ভিস যুক্ত করুন</span>
                  </button>
                </div>

                {/* Form Drawer / Top Modal Wrapper */}
                {isAddingService && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-indigo-500/20 shadow-md space-y-4"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800/80">
                      <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                        {editingServiceId ? 'সার্ভিস এডিট করুন (Modify Service)' : 'নতুন ডিজিটাল সেবা যুক্ত করুন (Register Service)'}
                      </h4>
                      <button 
                        onClick={() => setIsAddingService(false)}
                        className="p-1 hover:bg-gray-105 hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-400 rounded-full cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveService} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                      
                      <div className="lg:col-span-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1">
                          সার্ভিস ক্যাটাগরি (Category) *
                        </label>
                        <input
                          list="service-categories"
                          value={newServiceCategory}
                          onChange={(e) => setNewServiceCategory(e.target.value)}
                          placeholder="সিলেক্ট বা টাইপ করুন"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                        />
                        <datalist id="service-categories">
                          <option value="ফটোকপি ও প্রিন্টিং" />
                          <option value="ছবি তোলা" />
                          <option value="মোবাইল এক্সেসরিজ" />
                          <option value="কম্পিউটার মেরামত" />
                          <option value="ইলেকট্রনিক্স সার্ভিস" />
                          <option value="অন্যান্য ডিজিটাল সেবা" />
                        </datalist>
                      </div>

                      <div className="lg:col-span-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1">
                          সেবার নাম (Name) *
                        </label>
                        <input
                          type="text"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          placeholder="যেমন: রঙিন ছবি তোলা"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1">
                          বিবরণ (Description)
                        </label>
                        <input
                          type="text"
                          value={newServiceDesc}
                          onChange={(e) => setNewServiceDesc(e.target.value)}
                          placeholder="যেমন: পাসপোর্ট সাইজ ছবি"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                        />
                      </div>

                      <div className="lg:col-span-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest block mb-1">
                          রেট (Base Price) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">৳</span>
                          <input
                            type="number"
                            value={newServicePrice}
                            onChange={(e) => setNewServicePrice(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-6 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black font-mono focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      <div className="lg:col-span-1 flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 rounded-lg text-[11px] cursor-pointer shadow-xs whitespace-nowrap active:scale-98 transition-all flex items-center justify-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{editingServiceId ? 'আপডেট' : 'যোগ করুন'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingService(false)}
                          className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold py-2.5 px-3 rounded-lg text-[11px] cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* Services Catalog Board Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredServices.length > 0 ? (
                    filteredServices.map((svc) => (
                      <div
                        key={svc.id}
                        className="bg-white dark:bg-slate-950 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 hover:shadow-md transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2.5 py-1 text-[9.5px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/30 rounded-full">
                              {svc.category}
                            </span>
                            <span className="text-sm font-black font-mono text-slate-800 dark:text-white">
                              ৳{svc.price}
                            </span>
                          </div>

                          <h4 className="font-extrabold text-xs text-gray-950 dark:text-slate-100 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {svc.name}
                          </h4>
                          {svc.description && (
                            <p className="text-[10.5px] text-gray-400 leading-normal">{svc.description}</p>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-900">
                          <button
                            onClick={() => handleEditInit(svc)}
                            className="flex-1 py-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>এডিট / আপডেট</span>
                          </button>
                          
                          <button
                            onClick={() => handleDeleteService(svc.id, svc.name)}
                            className="flex-1 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>ডিলেট</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full bg-white dark:bg-slate-950 p-12 text-center rounded-3xl border border-gray-200 dark:border-slate-800">
                      <p className="text-xs text-gray-450 font-bold uppercase tracking-wider">কোনো সার্ভিস পাওয়া যায়নি!</p>
                      <button
                        onClick={() => setIsAddingService(true)}
                        className="text-xs text-indigo-500 font-extrabold mt-2 underline block mx-auto cursor-pointer"
                      >
                        নতুন প্রথম সার্ভিস রেজিস্টার করুন
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 3: SALES HISTORIES & LOG REPORT */}
            {activeTab === 'logs' && (
              <motion.div
                key="logs-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {/* Insights analytical board */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Total summary charts */}
                  <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase mb-4 flex items-center gap-2">
                        <Activity className="w-4.5 h-4.5 text-indigo-500" />
                        সেবা চালানের মোট সামারি
                      </h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                          <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">সর্বমোট সার্ভিস মেমো</p>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{insights.totalOrdersCount} টি</h3>
                          </div>
                          <Coins className="w-8 h-8 text-indigo-600/20" />
                        </div>

                        <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                          <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">রিসেন্ট জেনারেটেড মোট প্রফিট</p>
                            <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">৳{insights.totalEarnings}</h3>
                          </div>
                          <TrendingUp className="w-8 h-8 text-emerald-600/20" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top services analytics bar graph */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                      শীর্ষ চাহিদা সম্পন্ন সেবা সমূহ (Revenue Distribution)
                    </h4>
                    
                    {insights.chartData.length > 0 ? (
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={insights.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                            <Tooltip contentStyle={{ fontSize: 10, borderRadius: 10 }} formatter={(val) => [`৳${val}`, 'রাজস্ব']} />
                            <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]}>
                              {insights.chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-44 flex items-center justify-center text-center text-gray-400 text-xs">
                        লগ হিস্ট্রি র ডাটা এড করার পর এখানে চার্ট লোড হবে।
                      </div>
                    )}
                  </div>
                </div>

                {/* Filter and Table Log */}
                <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-slate-900 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-gray-950 dark:text-white">সব মেমো রেজিস্টার লগ (Historic Logs)</h4>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">সবগুলো কাস্টমার সার্ভিস বিলের হিসাব নিকাশ রো ভিউ ও ট্র্যাক করুন।</p>
                    </div>

                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={logsSearch}
                        onChange={(e) => setLogsSearch(e.target.value)}
                        placeholder="রশিদ বা কাস্টমার মোবাইল দিয়ে খুজুন"
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 text-gray-400 dark:text-slate-400 uppercase tracking-widest text-[9.5px] font-black border-b border-slate-100 dark:border-slate-900">
                          <th className="py-4 px-6">রশিদ নং & তারিখ</th>
                          <th className="py-4 px-6">কাস্টমার নাম ও মোবাইল</th>
                          <th className="py-4 px-6">সার্ভিস প্রদান বিবরণী</th>
                          <th className="py-4 px-6 text-right">আসল রেট</th>
                          <th className="py-4 px-6 text-right">পরিশোধিত</th>
                          <th className="py-4 px-6 text-center">হোয়াটসঅ্যাপ</th>
                          <th className="py-4 px-6 text-center">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-900">
                        {filteredInvoices.length > 0 ? (
                          filteredInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                              <td className="py-4 px-6">
                                <span className="font-extrabold text-gray-950 dark:text-white block font-mono">{inv.invoiceNo}</span>
                                <span className="text-[10px] text-gray-400 mt-0.5 block">
                                  {new Date(inv.date).toLocaleString('bn-BD')}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <span className="font-extrabold text-slate-800 dark:text-slate-100 block">{inv.customerName}</span>
                                {inv.customerPhone ? (
                                  <span className="text-[10px] text-indigo-500 font-mono font-bold mt-0.5 block">{inv.customerPhone}</span>
                                ) : (
                                  <span className="text-[10px] text-gray-400 italic mt-0.5 block">নম্বর নেই</span>
                                )}
                              </td>
                              <td className="py-4 px-6">
                                <span className="font-bold text-gray-800 dark:text-slate-200">{inv.serviceName}</span>
                                {inv.note && <span className="text-[10px] text-gray-400 mt-0.5 block truncate max-w-[150px] italic" title={inv.note}>{inv.note}</span>}
                              </td>
                              <td className="py-4 px-6 text-right font-mono text-gray-400">
                                ৳{inv.originalPrice}
                              </td>
                              <td className="py-4 px-6 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                                ৳{inv.finalPrice}
                              </td>
                              <td className="py-4 px-6 text-center">
                                {inv.customerPhone ? (
                                  <button
                                    onClick={() => handleSendToWhatsApp(inv)}
                                    className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 hover:text-emerald-700 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    title="WhatsApp the bill to customer"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    <span className="text-[9.5px] font-black">মেমো পাঠান</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-gray-300 dark:text-slate-700 italic">অপ্রাপ্য</span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setActiveInvoice(inv);
                                      setTimeout(() => {
                                        window.print();
                                      }, 100);
                                    }}
                                    className="p-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 hover:text-indigo-700 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors border border-indigo-100 dark:border-indigo-900/50"
                                    title="Print Memo receipt directly"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span className="font-bold text-[10px]">প্রিন্ট</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setActiveInvoice(inv);
                                      setActiveTab('billing');
                                    }}
                                    className="p-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    title="View Memo receipt"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>রিসিট</span>
                                  </button>

                                  <button
                                    onClick={() => handleDeleteInvoiceLog(inv.id, inv.invoiceNo)}
                                    className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg cursor-pointer transition-colors"
                                    title="Delete record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-gray-400 font-bold uppercase">
                              কোন সার্ভিস বিল রেকর্ড পাওয়া যায়নি!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>

    </div>
  );
}
