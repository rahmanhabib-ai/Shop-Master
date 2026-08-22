import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Tv, 
  Phone, 
  FileText, 
  Mail, 
  ShieldAlert, 
  Building2, 
  CheckCircle2, 
  MessageSquare, 
  Plus, 
  Trash2, 
  Send, 
  Copy, 
  Share2, 
  TrendingUp, 
  MapPin, 
  Clock, 
  ExternalLink, 
  Play, 
  Pause, 
  Settings, 
  AlertTriangle, 
  Search, 
  Upload, 
  Sliders, 
  Laptop, 
  Bell, 
  RefreshCw, 
  Check, 
  X,
  Volume2,
  VolumeX,
  Zap,
  Radio,
  Eye,
  Menu,
  Sparkles,
  Award
} from 'lucide-react';

interface ContactQuery {
  id: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  status: 'pending' | 'resolved';
  timestamp: string;
}

interface ReleaseNote {
  id: string;
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: { category: 'new' | 'fix' | 'perf'; text: string }[];
  isPublished: boolean;
}

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  tag: 'PROMOTION' | 'ANNOUNCEMENT' | 'NOTICE' | 'OFFER';
  likes: number;
  commentsCount: number;
  timestamp: string;
  isLikedByUser?: boolean;
}

interface PageManagementProps {
  systemLanguage?: 'bn' | 'en';
  customers?: any[];
  shopSettings?: any;
}

export const PageManagement: React.FC<PageManagementProps> = ({ 
  systemLanguage = 'bn',
  customers = [],
  shopSettings = {} 
}) => {
  const isBn = systemLanguage === 'bn';

  // State Tabs
  const [activeTab, setActiveTab] = useState<'community' | 'livetv' | 'contact' | 'release' | 'mail'>('community');

  // Copy Action feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // 1. COMMUNITY STATE & DATA
  const [communityLinks, setCommunityLinks] = useState({
    facebookGroup: localStorage.getItem('pm_fb_group') || 'https://facebook.com/groups/my-store-community',
    whatsappCommunity: localStorage.getItem('pm_wa_comm') || 'https://chat.whatsapp.com/invite/MyStoreChannel',
    telegramChannel: localStorage.getItem('pm_tele_channel') || 'https://t.me/mystore_alerts',
    youtubeChannel: localStorage.getItem('pm_yt_channel') || 'https://youtube.com/@mystoreonline'
  });

  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(() => {
    const cached = localStorage.getItem('pm_posts');
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 'post-1',
        title: isBn ? 'নতুন বছরের ধামাকা ক্যাশব্যাক অফার ২০২৬!' : 'New Year Cashback Extravaganza 2026!',
        content: isBn 
          ? 'আমাদের রিটেইল শপে আগামী ১৫ জুন পর্যন্ত নির্দিষ্ট ইলেকট্রনিক্স পণ্যে ১০% ক্যাশব্যাক দেওয়া হবে। এখনই আমাদের আউটলেট ভিজিট করুন!' 
          : 'Get up to 10% instant cashback on selected electronics until June 15. Visit our outlet or place an order today!',
        tag: 'OFFER',
        likes: 124,
        commentsCount: 28,
        timestamp: '2026-06-08 10:15'
      },
      {
        id: 'post-2',
        title: isBn ? 'জরুরি বিজ্ঞপ্তি: ডেলিভারি আপডেট' : 'Urgent Notice: Delivery System Update',
        content: isBn 
          ? 'আমাদের কুরিয়ার চ্যানেল আরো উন্নত করা হয়েছে। এখন ঢাকার ভিতরে ২৪ ঘণ্টা ও ঢাকার বাইরে সর্বোচ্চ ৩ কার্যদিবসের মধ্যে ডেলিভারি পাবেন।' 
          : 'Our delivery channels have been optimized. Expect next-day delivery inside Dhaka and max 3 business days nationwide!',
        tag: 'ANNOUNCEMENT',
        likes: 83,
        commentsCount: 14,
        timestamp: '2026-06-07 14:00'
      }
    ];
  });

  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTag, setNewPostTag] = useState<'PROMOTION' | 'ANNOUNCEMENT' | 'NOTICE' | 'OFFER'>('PROMOTION');

  const savePosts = (posts: CommunityPost[]) => {
    setCommunityPosts(posts);
    localStorage.setItem('pm_posts', JSON.stringify(posts));
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      title: newPostTitle,
      content: newPostContent,
      tag: newPostTag,
      likes: 0,
      commentsCount: 0,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    const updated = [newPost, ...communityPosts];
    savePosts(updated);
    setNewPostTitle('');
    setNewPostContent('');
  };

  const handleLikePost = (id: string) => {
    const updated = communityPosts.map(post => {
      if (post.id === id) {
        const isLiked = !post.isLikedByUser;
        return {
          ...post,
          likes: isLiked ? post.likes + 1 : post.likes - 1,
          isLikedByUser: isLiked
        };
      }
      return post;
    });
    savePosts(updated);
  };

  const handleDeletePost = (id: string) => {
    if (confirm(isBn ? 'আপনি কি এই পোস্টটি মুছে ফেলতে নিশ্চিত?' : 'Are you sure you want to delete this post?')) {
      const filtered = communityPosts.filter(p => p.id !== id);
      savePosts(filtered);
    }
  };


  // 2. LIVE TV STATE & DATA
  const [isLive, setIsLive] = useState<boolean>(true);
  const [liveStreamUrl, setLiveStreamUrl] = useState('https://www.youtube.com/embed/5Eqb_-j3FDA');
  const [liveTitle, setLiveTitle] = useState(isBn ? 'লাইভ শপিং ফেস্টিভ্যাল: জুন অফার এবং ডিসকাউন্ট' : 'Live Shopping Festival: June Offers & Discounts');
  const [liveViewers, setLiveViewers] = useState(482);
  const [livePlatform, setLivePlatform] = useState<'youtube' | 'custom'>('youtube');

  // Realistic rolling comments for live stream
  const [liveComments, setLiveComments] = useState<{ id: string; user: string; text: string }[]>([
    { id: '1', user: 'Rahman Hasan', text: isBn ? 'ভাইয়া ক্যাশ ব্যাক লিমিট কত?' : 'What is the cashback limit?' },
    { id: '2', user: 'Anika Bushra', text: isBn ? 'অনলাইন থেকে কিভাবে অর্ডার করবো?' : 'How do I order online?' },
    { id: '3', user: 'Zakir Hossain', text: isBn ? 'সুপার শো ভাইয়া! চমৎকার আইডিয়া!' : 'Super show brother! Excellent idea!' }
  ]);
  const [newLiveComment, setNewLiveComment] = useState('');

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      // Random mock comments appearing
      const names = ['Karim Mia', 'Noshin S', 'Imran Khan', 'Shopna Begum', 'Mainul Islam', 'Rifat A'];
      const comments = [
        isBn ? 'এই প্রোডাক্টের প্রাইস কত?' : 'How much is this product?',
        isBn ? 'হোম ডেলিভারি চার্জ কত ভাই?' : 'How much is the home delivery fee?',
        isBn ? 'আমি একটি অর্ডার প্লেস করেছি' : 'I just placed an order',
        isBn ? 'বেস্ট প্রাইজ এবং কোয়ালিটি' : 'Best price and premium quality!',
        isBn ? 'দারুণ লাইভ স্ট্রিমিং ফিচার' : 'Awesome live streaming feature!',
        isBn ? 'দোকানে স্টক আছে তো?' : 'Is this currently in stock?'
      ];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomText = comments[Math.floor(Math.random() * comments.length)];
      
      setLiveComments(prev => [...prev.slice(-12), { id: Date.now().toString(), user: randomName, text: randomText }]);
      setLiveViewers(v => Math.max(10, v + Math.floor(Math.random() * 11) - 5));
    }, 4500);

    return () => clearInterval(interval);
  }, [isLive, isBn]);

  const handleSendLiveComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLiveComment.trim()) return;
    setLiveComments(prev => [...prev, { id: Date.now().toString(), user: 'Merchant (Owner)', text: newLiveComment }]);
    setNewLiveComment('');
  };


  // 3. CONTACT PAGE STATE & DATA
  const [contactSettings, setContactSettings] = useState(() => {
    const cached = localStorage.getItem('pm_contact');
    if (cached) return JSON.parse(cached);
    return {
      hotline: '+৮৮০১৭১২-৩৪৫৬৭৮',
      whatsapp: '+৮৮০১৭১২-৩৪৫৬৭৮',
      email: 'support@mystore.com',
      address: '১২/এ, রোড নং ৩, গুলশান-২, ঢাকা-১২১২, বাংলাদেশ',
      gmapUrl: 'https://maps.google.com/maps?q=Gulshan%202&t=&z=13&ie=UTF8&iwloc=&output=embed',
      supportHours: '১০:০০ AM - ০৮:০০ PM'
    };
  });

  const [contactQueries, setContactQueries] = useState<ContactQuery[]>(() => {
    const cached = localStorage.getItem('pm_queries');
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 'q-1',
        name: 'সোহেল রানা',
        phone: '01711223344',
        email: 'sohel@gmail.com',
        subject: 'বুল্ক অর্ডার ডিসকাউন্ট',
        message: 'আসসালামু আলাইকুম, আমি আমাদের কর্পোরেট গিফটিং এর জন্য প্রায় ৫০ পিস ব্লুটুথ স্পিকার নিতে চাচ্ছিলাম। কোনো এক্সট্রা ডিসকাউন্ট দেওয়া যাবে কি না দয়া করে জানাবেন।',
        status: 'pending',
        timestamp: '2026-06-08 09:30'
      },
      {
        id: 'q-2',
        name: 'তানজিলা রহমান',
        phone: '01911998877',
        email: 'tanjila@yahoo.com',
        subject: 'রিফান্ড ডেলিভারি সমস্যা',
        message: 'ভাইয়া, গতকাল আমি একটি হেডফোন ডেলিভারি পেয়েছি কিন্তু এটার ডান সাইড কাজ করছে না। রিলিপ্লেস অথবা রিফান্ড কীভাবে পেতে পারি?',
        status: 'resolved',
        timestamp: '2026-06-06 16:45'
      }
    ];
  });

  const saveContactQueries = (queries: ContactQuery[]) => {
    setContactQueries(queries);
    localStorage.setItem('pm_queries', JSON.stringify(queries));
  };

  const handleResolveQuery = (id: string) => {
    const updated = contactQueries.map(q => {
      if (q.id === id) {
        return { ...q, status: q.status === 'resolved' ? 'pending' as const : 'resolved' as const };
      }
      return q;
    });
    saveContactQueries(updated);
  };

  const handleDeleteQuery = (id: string) => {
    if (confirm(isBn ? 'আপনি কি এই কন্টাক্ট মেসেজটি ডিলিট করতে চান?' : 'Are you sure you want to delete this message?')) {
      const filtered = contactQueries.filter(q => q.id !== id);
      saveContactQueries(filtered);
    }
  };


  // 4. RELEASE VERSION STATE & DATA
  const [currentVersion, setCurrentVersion] = useState(localStorage.getItem('pm_version') || 'v4.2.5');
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>(() => {
    const cached = localStorage.getItem('pm_releases');
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 'rel-new-v425',
        version: 'v4.2.5',
        date: '2026-06-11',
        type: 'patch',
        isPublished: true,
        changes: [
          { category: 'new', text: isBn ? 'হোস্টিংগারের ডিফল্ট "server.js" এন্ট্রি ফাইল সাপোর্ট করার জন্য রুট-লেভেল অটোমেটিক ব্রিজ যুক্ত করা হয়েছে।' : 'Created automatic root-level server.js entry bridge for default Hostinger Node.js hPanel support.' },
          { category: 'fix', text: isBn ? 'হোস্টিংগার ম্যানুয়াল পোর্ট সার্চ ছাড়াই ডাইনামিক পোর্ট বাইন্ডিং নিশ্চিত করা হয়েছে।' : 'Guaranteed dynamic port binding capability to bypass manual hPanel port field requests.' }
        ]
      },
      {
        id: 'rel-new-v424',
        version: 'v4.2.4',
        date: '2026-06-11',
        type: 'patch',
        isPublished: true,
        changes: [
          { category: 'new', text: isBn ? 'রিয়েল-টাইম ওয়ার্কস্পেস সিঙ্ক এবং গিট কমিট ইন্টিগ্রেশনের জন্য মেটাডাটা অপ্টিমাইজেশন।' : 'Optimized metadata tracking for real-time workspace syncing and Git commit integration.' },
          { category: 'fix', text: isBn ? 'নো-চেঞ্জেস টু কমিট ব্লকিং সলভ করা হয়েছে এবং ক্যাশ রিস্টার্ট হ্যান্ডলিং উন্নত করা হয়েছে।' : 'Resolved "no changes to commit" blocking blocks and refined cache-restart resilience.' },
          { category: 'perf', text: isBn ? 'হোস্টিংগার লাইভ রিলিজ পাইপলাইন ভেলোসিটি ডেভেলপমেন্ট বৃদ্ধি করা হয়েছে।' : 'Accelerated the release pipeline deployment velocity on Hostinger production nodes.' }
        ]
      },
      {
        id: 'rel-new-0',
        version: 'v4.2.3',
        date: '2026-06-11',
        type: 'patch',
        isPublished: true,
        changes: [
          { category: 'new', text: isBn ? 'ইউজার গিট সিঙ্ক এবং ডাইরেক্ট হোস্টিংগার ডেপ্লয়মেন্ট মডিউলের জন্য আপডেট করা হয়েছে।' : 'Verified user Git synchronization and optimized direct Hostinger deployment module.' },
          { category: 'perf', text: isBn ? 'বিল্ড পাইপলাইন স্পিড বাড়ানো হয়েছে এবং ক্যাশে ক্লিয়ারেন্স ইমপ্রুভ করা হয়েছে।' : 'Boosted build pipeline speed and improved compiled static asset cache clearance.' }
        ]
      },
      {
        id: 'rel-0',
        version: 'v4.2.2',
        date: '2026-06-11',
        type: 'patch',
        isPublished: true,
        changes: [
          { category: 'new', text: isBn ? 'হোস্টিংগার এবং প্রোডাকশন এনভায়রনমেন্টের জন্য বিল্ড সেটআপ অপ্টিমাইজ করা হয়েছে।' : 'Optimized production build, esbuild bundle configuration, and setup for Hostinger.' },
          { category: 'fix', text: isBn ? 'ডুপ্লিকেট ইম্পোর্ট ফিক্স এবং টাইপস্ক্রিপ্ট টেমপ্লেট কোড এডিটিং পরিষ্কার করা হয়েছে।' : 'Fixed duplicate imports, reference syntax issues, and cleared linter warnings.' },
          { category: 'perf', text: isBn ? 'প্রোডাকশন সার্ভার স্টার্টআপ সময় এবং সিডিএন সম্পদ লোডিং ত্বরান্বিত করা হয়েছে।' : 'Accelerated server startup times and asset loading optimization in production.' }
        ]
      },
      {
        id: 'rel-1',
        version: 'v4.2.1',
        date: '2026-06-05',
        type: 'patch',
        isPublished: true,
        changes: [
          { category: 'new', text: isBn ? 'ইউজার লগইন পাসওয়ার্ড টগল লক যুক্ত করা হয়েছে।' : 'User login password visibility toggle added.' },
          { category: 'fix', text: isBn ? 'পি ডাব্লিউ এ ইনস্টলেশন ডিরেক্ট লিংক ঠিক করা হয়েছে।' : 'PWA installation direct download fixes implemented.' },
          { category: 'perf', text: isBn ? 'সেলস রিপোর্ট ও পিওএস লোডিং স্পিড ২০০ms হ্রাস করা হয়েছে।' : 'Reduced sales report and POS loading times by 200ms.' }
        ]
      },
      {
        id: 'rel-2',
        version: 'v4.2.0',
        date: '2026-05-18',
        type: 'minor',
        isPublished: true,
        changes: [
          { category: 'new', text: isBn ? 'জারভিস ভয়েস অ্যাসিস্ট্যান্ট কন্ট্রোল আপগ্রেড করা হয়েছে।' : 'Upgraded Jarvis Voice assistant speech synthesis algorithms.' },
          { category: 'new', text: isBn ? 'বকেয়া কাস্টমারদের জন্য ডাইরেক্ট হোয়াটসএপ রিমাইন্ডার পাঠানো সুবিধা।' : 'Direct WhatsApp payment reminders integration.' },
          { category: 'fix', text: isBn ? 'অ্যাকাউন্টিং ট্রানজেকশন কাস্টম ডেট সিলেকশন বাউন্স সমস্যা ফিক্স।' : 'Fixed transaction custom date selector layout shift bug.' }
        ]
      }
    ];
  });

  const [newVersionInput, setNewVersionInput] = useState('');
  const [newVersionType, setNewVersionType] = useState<'major' | 'minor' | 'patch'>('patch');
  const [newVersionChanges, setNewVersionChanges] = useState<{ category: 'new' | 'fix' | 'perf'; text: string }[]>([
    { category: 'new', text: '' }
  ]);

  const handleAddChangeRow = () => {
    setNewVersionChanges([...newVersionChanges, { category: 'new', text: '' }]);
  };

  const handleRemoveChangeRow = (index: number) => {
    if (newVersionChanges.length === 1) return;
    setNewVersionChanges(newVersionChanges.filter((_, i) => i !== index));
  };

  const handlePublishRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionInput.trim() || newVersionChanges.some(c => !c.text.trim())) {
      alert(isBn ? 'দয়া করে সংস্করণ নম্বর এবং সমস্ত পরিবর্তনের তথ্য দিন।' : 'Please supply version string and all changes text.');
      return;
    }

    const newRelease: ReleaseNote = {
      id: `rel-${Date.now()}`,
      version: newVersionInput,
      date: new Date().toISOString().split('T')[0],
      type: newVersionType,
      isPublished: true,
      changes: newVersionChanges.filter(c => c.text.trim() !== '')
    };

    const updated = [newRelease, ...releaseNotes];
    setReleaseNotes(updated);
    localStorage.setItem('pm_releases', JSON.stringify(updated));
    setCurrentVersion(newVersionInput);
    localStorage.setItem('pm_version', newVersionInput);

    // Reset Form
    setNewVersionInput('');
    setNewVersionChanges([{ category: 'new', text: '' }]);
    alert(isBn ? 'রিলিজ সংস্করণ সফলভাবে আপগ্রেড এবং পাবলিশ হয়েছে!' : 'Release version successfully updated & published!');
  };


  // 5. BUSINESS MAIL STATE & DATA
  const [smtpSettings, setSmtpSettings] = useState({
    outgoingEmail: 'ceo@retailsuite.com',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '465',
    username: 'ceo@retailsuite.com',
    apiKey: '••••••••••••••••••••'
  });

  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('promotional');
  const [mailBatchProgress, setMailBatchProgress] = useState<{ active: boolean; currentCount: number; totalCount: number; statusLog: string[] }>({
    active: false,
    currentCount: 0,
    totalCount: 0,
    statusLog: []
  });

  const mailTemplates = {
    promotional: {
      subject: isBn ? 'ঈদ ধামাকা অফার: সকল কেনাকাটায় বিশেষ ক্যাশব্যাক!' : 'Eid Dhamaka Deal: Mega Cashpacks on Storewide purchase!',
      body: isBn 
        ? 'সম্মানিত কাস্টমার,\n\nআমাদের স্টোর থেকে পণ্য কিনে জিতে নিন চমৎকার ক্যাশব্যাক ও কুপন ডিসকাউন্ট কোড। আজই আপনার পছন্দের অর্ডার প্লেস করুন।\n\nধন্যবাদান্তে,\nব্যবসায়িক শপ টিম' 
        : 'Dear Customer,\n\nAvail exclusive discounts and guaranteed vouchers on your purchase today at our outlet.\n\nWarm Regards,\nRetail Suite Team'
    },
    payment_notice: {
      subject: isBn ? 'বকেয়া তাগাদা নোটিশ এবং পেমেন্ট রিমাইন্ডার' : 'Friendly Outstanding Balances Statement',
      body: isBn 
        ? 'সম্মানিত গ্রাহক,\n\nআপনার অ্যাকাউন্টে বিগত সেলস এর বকেয়া পরিশোধ করার অনুরোধ জানানো যাচ্ছে। নিরাপদ লেনদেনের জন্য যোগাযোগ করুন বা পিওএস-এ নগদ/বিকাশ পেমেন্ট করে দিন।\n\nধন্যবাদান্তে,\nম্যানেজার' 
        : 'Dear Customer,\n\nWe kindly request to clear outstanding dues on your ledger profile at your earliest convenience. Thank you for your continued partnership.\n\nSincerely,\nAccounts Team'
    },
    maintenance: {
      subject: isBn ? 'নতুন আপডেট এবং সিস্টেম পরিবর্তন বিজ্ঞপ্তি' : 'Important System Integration Update Notification',
      body: isBn 
        ? 'সম্মানিত পার্টনার,\n\nআমাদের সার্ভার ডাটাবেজ আরো দ্রুত এবং শক্তিশালী করার জন্য আজ রাতে আমাদের ডিজিটাল বিলিং প্যানেল সাময়িক সময়ের জন্য বন্ধ থাকবে। সকাল ১০টা থেকে পুনরায় পুরো বিলিং পোর্টাল যথারীতি চালু হবে।\n\nসাময়িক অসুবিধার জন্য দুঃখিত।' 
        : 'Dear Staff & Partners,\n\nOur system inventory synchronizer database is undergoing core updates tonight. Application may face transient downtimes. Normal cloud billing restarts by morning.'
    }
  };

  const handleApplyTemplate = (type: string) => {
    setSelectedTemplate(type);
    if (type in mailTemplates) {
      setMailSubject(mailTemplates[type as keyof typeof mailTemplates].subject);
      setMailBody(mailTemplates[type as keyof typeof mailTemplates].body);
    }
  };

  const handleStartEmailBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailSubject.trim() || !mailBody.trim()) return;

    // Simulate batch sending to customers
    const targetCustomers = customers.length > 0 ? customers : [
      { name: 'Kamil Ahmed', email: 'kamil@gmail.com' },
      { name: 'Javed Islam', email: 'javed.it@outlook.com' },
      { name: 'Sabina Sultana', email: 'sabina@yahoo.com' },
      { name: 'Adnan Sami', email: 'adnansami@gmail.com' },
    ];

    setMailBatchProgress({
      active: true,
      currentCount: 0,
      totalCount: targetCustomers.length,
      statusLog: [`[${new Date().toLocaleTimeString()}] Batch broadcast initialized...`]
    });

    let index = 0;
    const interval = setInterval(() => {
      if (index >= targetCustomers.length) {
        setMailBatchProgress(prev => ({
          ...prev,
          active: false,
          statusLog: [...prev.statusLog, `[${new Date().toLocaleTimeString()}] Broadcast finished! Total ${targetCustomers.length} emails dispatched completely via ${smtpSettings.smtpHost}.`]
        }));
        clearInterval(interval);
        return;
      }

      const client = targetCustomers[index];
      const clientEmail = client.email || `${client.name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`;
      
      setMailBatchProgress(prev => ({
        ...prev,
        currentCount: index + 1,
        statusLog: [
          ...prev.statusLog,
          `[${new Date().toLocaleTimeString()}] Email successfully delivered to: ${client.name} (${clientEmail})`
        ]
      }));

      index++;
    }, 1200);
  };

  return (
    <div className="w-full space-y-6 animate-fadeIn select-none p-4 lg:p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      
      {/* Upper header section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none">
            <Sliders className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                {isBn ? 'পৃষ্ঠা এবং মিডিয়া ব্যবস্থাপনা হাব' : 'Page & Media Management Hub'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/30">
                OWNER ONLY
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium">
              {isBn 
                ? 'অনলাইন স্টোরের কাস্টম কমিউনিটি পোস্ট, কন্টাক্ট মেসেজ, লাইভ ভিডিও ফিড এবং কাস্টমার নোটিফিকেশন মেইলিং সিস্টেম নিয়ন্ত্রণ।' 
                : 'Configure direct customer communication, live television feeds, community announcements, support ticket portals & newsletters.'}
            </p>
          </div>
        </div>

        {/* System Locked Alert Tag */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 text-amber-700 dark:text-amber-400 font-bold text-xs">
          <ShieldAlert className="w-4 h-4" />
          <span>{isBn ? 'ম্যানেজার ও কর্মীরা অ্যাক্সেস পাবে না' : 'Staff Access Restricted'}</span>
        </div>
      </div>

      {/* Main Grid: Sub-navigation Menu + Sub-page render */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sub Navigation Container */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-fit lg:sticky lg:top-6">
          <div className="space-y-1.5">
            <div className="px-3 pb-3 border-b border-gray-50 dark:border-slate-800/60 flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-wider uppercase">{isBn ? 'সিস্টেম মডিউলসমূহ' : 'MANAGE SECTIONS'}</span>
              <Award className="w-4 h-4 text-violet-500" />
            </div>

            {/* Tap Items */}
            {[
              { id: 'community', label: isBn ? 'কমিউনিটি হাব' : 'Community Hub', icon: Users, color: 'text-blue-500 bg-blue-50/60 dark:bg-blue-950/30' },
              { id: 'livetv', label: isBn ? 'লাইভ টিভি' : 'Live TV Broadcast', icon: Tv, color: 'text-rose-500 bg-rose-50/60 dark:bg-rose-950/30' },
              { id: 'contact', label: isBn ? 'যোগাযোগ পৃষ্ঠা' : 'Contact Support Inbox', icon: Phone, color: 'text-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30' },
              { id: 'release', label: isBn ? 'রিলিজ সংস্করণ' : 'App Releases & Notes', icon: FileText, color: 'text-amber-500 bg-amber-50/60 dark:bg-amber-950/30' },
              { id: 'mail', label: isBn ? 'ব্যবসায়িক মেইল' : 'Business Newsletter', icon: Mail, color: 'text-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer group ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-xs shadow-indigo-600/25 translate-x-0.5' 
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 hover:text-gray-950 dark:hover:text-white hover:translate-x-0.5'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-white/20 text-white' : tab.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 truncate tracking-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 mt-6 border-t border-gray-50 dark:border-slate-800/60 text-center select-none">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{isBn ? 'সিস্টেম ভার্শন' : 'Build Environment'}</span>
            <p className="text-[13px] font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">{currentVersion}-STABLE</p>
          </div>
        </div>

        {/* Content Dynamic Screen Render */}
        <div className="lg:col-span-3 space-y-6">

          {/* 1. COMMUNITY TAB */}
          {activeTab === 'community' && (
            <div className="space-y-6">
              
              {/* Stats Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{isBn ? 'কমিউনিটি মেম্বার' : 'Subscribed Members'}</span>
                    <p className="text-lg font-black text-gray-900 dark:text-slate-100">{Math.max(customers.length, 1) * 12 + 184}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{isBn ? 'মোট পাবলিশড পোস্ট' : 'Published Announcements'}</span>
                    <p className="text-lg font-black text-gray-900 dark:text-slate-100">{communityPosts.length}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{isBn ? 'এনগেজমেন্ট হার' : 'Avg Engagement'}</span>
                    <p className="text-lg font-black text-gray-900 dark:text-slate-100">89.4%</p>
                  </div>
                </div>
              </div>

              {/* Set Links Section */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-indigo-500" />
                  {isBn ? 'সামাজিক যোগাযোগ লিংক কনফিগার করুন' : 'Social Channels Links Settings'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Facebook Group URL</label>
                    <input 
                      type="text" 
                      value={communityLinks.facebookGroup}
                      onChange={(e) => {
                        setCommunityLinks({...communityLinks, facebookGroup: e.target.value});
                        localStorage.setItem('pm_fb_group', e.target.value);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-xs text-gray-800 dark:text-slate-200 font-mono focus:border-indigo-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">WhatsApp Community Link</label>
                    <input 
                      type="text" 
                      value={communityLinks.whatsappCommunity}
                      onChange={(e) => {
                        setCommunityLinks({...communityLinks, whatsappCommunity: e.target.value});
                        localStorage.setItem('pm_wa_comm', e.target.value);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-xs text-gray-800 dark:text-slate-200 font-mono focus:border-indigo-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Telegram Update Feed</label>
                    <input 
                      type="text" 
                      value={communityLinks.telegramChannel}
                      onChange={(e) => {
                        setCommunityLinks({...communityLinks, telegramChannel: e.target.value});
                        localStorage.setItem('pm_tele_channel', e.target.value);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-xs text-gray-800 dark:text-slate-200 font-mono focus:border-indigo-500 focus:bg-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Official YouTube Channel</label>
                    <input 
                      type="text" 
                      value={communityLinks.youtubeChannel}
                      onChange={(e) => {
                        setCommunityLinks({...communityLinks, youtubeChannel: e.target.value});
                        localStorage.setItem('pm_yt_channel', e.target.value);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-xs text-gray-800 dark:text-slate-200 font-mono focus:border-indigo-500 focus:bg-white outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Publisher form and post list */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Publisher */}
                <div className="xl:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm h-fit">
                  <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                    <Plus className="w-4 h-4 text-emerald-500" />
                    {isBn ? 'কমিউনিটিতে নতুন পোস্ট লিখুন' : 'Compose Live Feed Update'}
                  </h3>

                  <form onSubmit={handleCreatePost} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'পোস্ট শিরোনাম' : 'Post Header'}</label>
                      <input 
                        required
                        type="text" 
                        placeholder={isBn ? 'যেমন: ঈদ ডে স্পেশাল অফার!' : 'e.g., Weekly Store Special...'}
                        value={newPostTitle}
                        onChange={(e) => setNewPostTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'পোস্টের ধরন বা ক্যাটাগরি' : 'Post Category Label'}</label>
                      <select 
                        value={newPostTag}
                        onChange={(e) => setNewPostTag(e.target.value as any)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none font-bold text-gray-700 dark:text-slate-300"
                      >
                        <option value="PROMOTION">PROMOTION (প্রোমোশন)</option>
                        <option value="OFFER">OFFER (অফার)</option>
                        <option value="ANNOUNCEMENT">ANNOUNCEMENT (ঘোষণা)</option>
                        <option value="NOTICE">NOTICE (বিশেষ বিজ্ঞপ্তি)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'বিস্তারিত পোস্ট মেসেজ' : 'Detailed Post Body'}</label>
                      <textarea 
                        required
                        rows={4}
                        placeholder={isBn ? 'কাস্টমারদের জন্য আকর্ষণীয় পোস্ট বর্ণনা লিখুন...' : 'Write custom announcements details...'}
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none font-medium resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isBn ? 'কমিউনিটি ফিডে পাবলিশ করুন' : 'Broadcast to Community Feed'}
                    </button>
                  </form>
                </div>

                {/* Posts preview */}
                <div className="xl:col-span-2 space-y-4">
                  <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-500 hidden" />
                    <span>{isBn ? 'কমিউনিটি ফিড প্রিভিউ (লাইভ আপডেট)' : 'Live Store Community Feed'}</span>
                  </h3>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {communityPosts.length === 0 ? (
                      <div className="bg-white dark:bg-slate-900 border border-dashed rounded-3xl p-12 text-center text-gray-400">
                        {isBn ? 'কোনো কাস্টম পোস্ট নেই। উপরের ফরম থেকে প্রথম পোস্টটি লিখুন।' : 'Zero posts found. Publish your first social post using form.'}
                      </div>
                    ) : (
                      communityPosts.map((post) => (
                        <div key={post.id} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm relative group overflow-hidden">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black tracking-wide ${
                              post.tag === 'OFFER' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' :
                              post.tag === 'ANNOUNCEMENT' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400' :
                              post.tag === 'NOTICE' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400' :
                              'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400'
                            }`}>
                              {post.tag}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 font-mono font-bold">{post.timestamp}</span>
                              <button 
                                onClick={() => handleDeletePost(post.id)}
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4 className="text-sm font-black text-gray-900 dark:text-slate-100 leading-snug">{post.title}</h4>
                          <p className="text-xs text-gray-500 mt-2 font-medium leading-relaxed bg-slate-50/50 dark:bg-slate-950/30 p-3.5 rounded-xl border border-gray-50 dark:border-slate-800/40">{post.content}</p>

                          <div className="mt-4 pt-3.5 border-t border-gray-50 dark:border-slate-800/60 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => handleLikePost(post.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  post.isLikedByUser 
                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 scale-102' 
                                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span>👍</span>
                                <span className="font-mono">{post.likes}</span>
                              </button>
                              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                                <span>💬</span>
                                <span className="font-mono">{post.commentsCount || Math.floor(post.likes * 0.2)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleCopy(`${post.title}\n\n${post.content}`, post.id)}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg transition-all"
                                title="Copy Text"
                              >
                                {copiedText === post.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <button 
                                onClick={() => alert(isBn ? 'সোশ্যাল মিডিয়া শেয়ার লিংক জেনারেট হয়েছে!' : 'Social redirect share coordinates compiled!')}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg transition-all"
                                title="Share"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}


          {/* 2. LIVE TV TAB */}
          {activeTab === 'livetv' && (
            <div className="space-y-6">

              {/* Embed TV Controller Header */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                      <Tv className="w-4 h-4 text-rose-500 animate-pulse" />
                      {isBn ? 'লাইভ টিভি ব্রডকাস্ট কনফিগারেশন' : 'Live Broadcaster Panel Configuration'}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 font-medium">{isBn ? 'আপনার ইউটিউব লাইভ বা কাস্টম স্ট্রিম সরাসরি স্টোর পেইজে শো করুন।' : 'Directly serve interactive broadcasts and promotional TV streams inside online catalogs.'}</p>
                  </div>

                  {/* On Air Switch Status */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400">{isBn ? 'স্ট্রিমিং স্ট্যাটাস:' : 'Stream Status:'}</span>
                    <button
                      onClick={() => setIsLive(!isLive)}
                      className={`px-4 py-2 rounded-2xl font-black text-[10px] tracking-wider uppercase transition-all flex items-center gap-2 border cursor-pointer ${
                        isLive 
                          ? 'bg-rose-100 dark:bg-rose-950/20 border-rose-200 text-rose-600 dark:text-rose-400' 
                          : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 text-slate-500'
                      }`}
                    >
                      <Radio className={`w-3.5 h-3.5 ${isLive ? 'animate-pulse text-rose-600' : ''}`} />
                      {isLive ? '🔴 ON AIR' : '⚫ OFFLINE'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'লাইভ টাইটেল বা বর্ণনা' : 'Broadcast Content Title'}</label>
                      <input 
                        type="text" 
                        value={liveTitle}
                        onChange={(e) => setLiveTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-rose-500 outline-none font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'স্ট্রিমিং প্ল্যাটফর্ম' : 'Source Protocol'}</label>
                        <select 
                          value={livePlatform}
                          onChange={(e) => {
                            setLivePlatform(e.target.value as any);
                            if (e.target.value === 'youtube') {
                              setLiveStreamUrl('https://www.youtube.com/embed/5Eqb_-j3FDA');
                            } else {
                              setLiveStreamUrl('https://sample-m3u8-source.m3u8');
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-rose-300 outline-none font-bold"
                        >
                          <option value="youtube">YouTube Embed Stream Link</option>
                          <option value="custom">HLS Stream (M3U8 Source URL)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'স্ট্রিমিং সোর্স URL' : 'Embedded Stream IFrame source'}</label>
                        <input 
                          type="text" 
                          value={liveStreamUrl}
                          onChange={(e) => setLiveStreamUrl(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-mono bg-white dark:bg-slate-950 focus:border-rose-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/40 rounded-3xl p-5 border border-gray-150/40 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black text-gray-400 block tracking-widest uppercase mb-1">{isBn ? 'লাইভ মিটার' : 'Simulation Gauge'}</span>
                      <p className="text-xs text-gray-500 font-medium leading-relaxed">
                        {isBn ? 'লাইভ টিভি প্যানেল চালু থাকার সময় আপনার স্টোরে আগত কাস্টমাররা উপরে চ্যাট ও লাইভ স্ট্রিম উপভোগ করতে পারবে।' : 'Active broadcast embeds directly to client-facing store catalog dashboards dynamically.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200/50">
                      <div className="flex-1">
                        <span className="text-[10px] font-bold text-gray-400 block">{isBn ? 'দর্শক সংখ্যা' : 'Simulated Viewers'}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                          <span className="font-mono text-sm font-black">{liveViewers}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setLiveViewers(v => v + 30)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] rounded-xl transition-all"
                      >
                        +30 Viewers
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Embedded Player Simulator layout */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Simulated Stream Player Box */}
                <div className="xl:col-span-2 bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl relative">
                  
                  {/* Top floating bar inside player */}
                  <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="px-2.5 py-0.5 bg-rose-600 text-white font-mono font-black text-[9px] rounded uppercase tracking-wider animate-pulse">
                        LIVE
                      </div>
                      <span className="font-bold text-xs text-white truncate max-w-[280px] sm:max-w-md">{liveTitle}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="px-2 py-0.5 bg-black/60 rounded text-[9px] text-white font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        {liveViewers} {isBn ? 'দর্শক' : 'watching'}
                      </div>
                    </div>
                  </div>

                  {/* Stream Media Container */}
                  <div className="w-full aspect-video bg-black flex items-center justify-center relative">
                    {isLive ? (
                      <iframe 
                        className="w-full h-full"
                        src={liveStreamUrl}
                        title="Live Stream Broadcast"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <div className="text-center p-8 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                          <Tv className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">{isBn ? 'লাইভ টিভি অফলাইন' : 'Live Broadcast Offline'}</h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-[280px] mx-auto">{isBn ? 'ড্যাশবোর্ড থেকে অন এয়ার বাটনটি অন করলেই স্ট্রিম চালু হবে।' : 'Toggle stream ON AIR button in upper controller to broadcast instantly.'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom timeline simulation bar */}
                  <div className="p-3.5 bg-slate-900 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <div className="flex items-center gap-3">
                      <button className="text-white hover:text-rose-500 transition-colors">
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <span>HD 1080p Stream</span>
                    </div>

                    <div className="text-[10px] text-right font-medium">
                      Latency: <span className="text-emerald-400">1.2s (Ultra-Low)</span>
                    </div>
                  </div>
                </div>

                {/* Simulated Live Chat widget */}
                <div className="xl:col-span-1 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 flex flex-col justify-between h-[360px] xl:h-auto shadow-sm overflow-hidden">
                  
                  {/* Title Bar */}
                  <div className="p-4 border-b border-gray-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">{isBn ? 'লাইভ চ্যাট ফিডলুপ' : 'Live Stream Chat log'}</h4>
                    </div>
                    <span className="text-[9px] font-mono text-gray-400">{isBn ? 'সক্রিয়' : 'Streaming...'}</span>
                  </div>

                  {/* Stream chat body scroll */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 scroll-smooth">
                    {liveComments.map((comment) => (
                      <div key={comment.id} className="text-xs space-y-0.5 animate-slideUp">
                        <span className={`font-black uppercase tracking-tight block ${
                          comment.user.includes('Merchant') ? 'text-indigo-600 dark:text-indigo-400 text-[10px]' : 'text-slate-500 dark:text-slate-400 text-[9px]'
                        }`}>
                          {comment.user}
                        </span>
                        <p className="text-gray-900 dark:text-slate-200 font-medium leading-relaxed bg-slate-50/60 dark:bg-slate-950 p-2 rounded-lg border border-gray-50 dark:border-slate-800/40">
                          {comment.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Comment submit bar */}
                  <form onSubmit={handleSendLiveComment} className="p-3 border-t border-gray-50 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950 flex gap-2">
                    <input 
                      type="text" 
                      placeholder={isLive ? (isBn ? 'লাইভ চ্যাটে কিছু লিখুন...' : 'Type feedback message...') : (isBn ? 'লাইভ বন্ধ রয়েছে' : 'Broadcaster offline')}
                      disabled={!isLive}
                      value={newLiveComment}
                      onChange={(e) => setNewLiveComment(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-xs border border-gray-200 dark:border-slate-800 focus:border-rose-500 outline-none font-medium text-gray-800 dark:text-slate-100"
                    />
                    <button 
                      type="submit"
                      disabled={!isLive}
                      className="p-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl transition-all shadow cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

              </div>

            </div>
          )}


          {/* 3. CONTACT PAGE TAB */}
          {activeTab === 'contact' && (
            <div className="space-y-6">

              {/* Contact Configuration Card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-emerald-500" />
                  {isBn ? 'যোগাযোগ পেজের স্থায়ী আউটলেট সেটিংস' : 'Constant Store Location Contact Details'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'হটলাইন মোবাইল নম্বর' : 'Hotline Phone Number'}</label>
                        <input 
                          type="text" 
                          value={contactSettings.hotline}
                          onChange={(e) => {
                            setContactSettings({...contactSettings, hotline: e.target.value});
                            localStorage.setItem('pm_contact', JSON.stringify({...contactSettings, hotline: e.target.value}));
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-emerald-500 outline-none font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'হোয়াটসঅ্যাপ সংযোগ নম্বর' : 'Contact WhatsApp'}</label>
                        <input 
                          type="text" 
                          value={contactSettings.whatsapp}
                          onChange={(e) => {
                            setContactSettings({...contactSettings, whatsapp: e.target.value});
                            localStorage.setItem('pm_contact', JSON.stringify({...contactSettings, whatsapp: e.target.value}));
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-emerald-500 outline-none font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'আউটলেট সাপোর্ট ইমেইল' : 'Store E-Mail Address'}</label>
                        <input 
                          type="text" 
                          value={contactSettings.email}
                          onChange={(e) => {
                            setContactSettings({...contactSettings, email: e.target.value});
                            localStorage.setItem('pm_contact', JSON.stringify({...contactSettings, email: e.target.value}));
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-emerald-500 outline-none font-bold font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'সাপোর্ট বা খোলা থাকার সময়' : 'Working / Support Hours'}</label>
                        <input 
                          type="text" 
                          value={contactSettings.supportHours}
                          onChange={(e) => {
                            setContactSettings({...contactSettings, supportHours: e.target.value});
                            localStorage.setItem('pm_contact', JSON.stringify({...contactSettings, supportHours: e.target.value}));
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-emerald-500 outline-none font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'আউটলেটের পূর্ণ ঠিকানা' : 'Outlet Physical Coordinates'}</label>
                      <input 
                        type="text" 
                        value={contactSettings.address}
                        onChange={(e) => {
                          setContactSettings({...contactSettings, address: e.target.value});
                          localStorage.setItem('pm_contact', JSON.stringify({...contactSettings, address: e.target.value}));
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-emerald-500 outline-none font-medium"
                      />
                    </div>
                  </div>

                  {/* Google maps Preview */}
                  <div className="bg-slate-50 dark:bg-slate-950/40 rounded-3xl p-4 border border-gray-150/40 dark:border-slate-800 flex flex-col gap-3">
                    <span className="text-[10px] font-black text-gray-400 block tracking-wider uppercase">{isBn ? 'ডিজিটাল ম্যাপ প্রিভিউ' : 'Interactive Map Overlay'}</span>
                    <div className="flex-1 min-h-[140px] bg-slate-200 rounded-xl overflow-hidden relative">
                      <iframe 
                        className="w-full h-full border-0"
                        src={contactSettings.gmapUrl} 
                        allowFullScreen 
                        loading="lazy"
                      ></iframe>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Google maps embed link"
                      value={contactSettings.gmapUrl}
                      onChange={(e) => {
                        setContactSettings({...contactSettings, gmapUrl: e.target.value});
                        localStorage.setItem('pm_contact', JSON.stringify({...contactSettings, gmapUrl: e.target.value}));
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-[10px] font-mono outline-none"
                    />
                  </div>
                </div>

              </div>

              {/* Feedback inbox inquiries */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span>{isBn ? 'ইনবক্স কন্টাক্ট ইনফো ও মেসেজ লগ' : 'Store Feedback Inbox & Support Tickets'}</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black text-gray-400 tracking-wider uppercase border-b border-gray-100 dark:border-slate-800">
                        <th className="p-4">{isBn ? 'প্রেরক ও ইমেইল' : 'Client coordinates'}</th>
                        <th className="p-4">{isBn ? 'মেসেজ বিষয় ও টেক্সট' : 'Details & Message'}</th>
                        <th className="p-4 text-center">{isBn ? 'লেনদেন স্ট্যাটাস' : 'Ticket status'}</th>
                        <th className="p-4 text-center">{isBn ? 'অ্যাকশন' : 'Management'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
                      {contactQueries.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-xs text-gray-400 font-bold">
                            {isBn ? 'কোনো ইনবক্স কন্টাক্ট মেসেজ পাওয়া যায়নি।' : 'Zero customer queries inside feedback database.'}
                          </td>
                        </tr>
                      ) : (
                        contactQueries.map((query) => (
                          <tr key={query.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-xs">
                            <td className="p-4 space-y-1 select-all font-medium">
                              <p className="font-extrabold text-gray-950 dark:text-slate-100">{query.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono font-bold leading-none">{query.phone}</p>
                              <p className="text-[10px] text-indigo-500 font-mono font-bold leading-none">{query.email}</p>
                            </td>
                            <td className="p-4 max-w-sm select-all">
                              <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-slate-100 dark:bg-slate-950 block w-fit mb-1">{query.subject}</span>
                              <p className="text-gray-500 leading-relaxed font-semibold">{query.message}</p>
                              <span className="text-[9px] text-slate-400 font-mono mt-1 font-bold block">{query.timestamp}</span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleResolveQuery(query.id)}
                                className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                                  query.status === 'resolved' 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200' 
                                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200'
                                }`}
                              >
                                {query.status === 'resolved' ? (isBn ? '✅ সমাধান হয়েছে' : 'RESOLVED') : (isBn ? '⏳ পেন্ডিং' : 'PENDING')}
                              </button>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={async () => {
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

                                    const createdDate = (shopSettings as any)?.createdAt ? safeDate((shopSettings as any).createdAt) : new Date();
                                    const trialEnd = new Date(createdDate.getTime() + 90 * 24 * 60 * 60 * 1000);
                                    const isPremium = (() => {
                                      const s = shopSettings as any;
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

                                    const payload = {
                                      shopId: (shopSettings as any)?.id || 'pos-merchant',
                                      sale: {
                                        id: 'query-' + query.id,
                                        customerPhone: query.phone.replace(/[^0-9]/g, ''),
                                        message: `Hi ${query.name}, we received your query: "${query.subject}"\nOur team is reviewing it.`
                                      },
                                      gatewayConfig: {
                                        default_route: 'whatsapp',
                                        waGatewayType: (shopSettings as any)?.waGatewayType || 'baileys',
                                        meta_phone_number_id: (shopSettings as any)?.meta_phone_number_id || (shopSettings as any)?.metaPhoneNumberId || '',
                                        meta_access_token: (shopSettings as any)?.meta_access_token || (shopSettings as any)?.metaAccessToken || '',
                                        meta_waba_id: (shopSettings as any)?.meta_waba_id || (shopSettings as any)?.metaWabaId || '',
                                        baileys_phone: (shopSettings as any)?.baileys_phone || (shopSettings as any)?.baileysPhone || '',
                                        zender_api_key: (shopSettings as any)?.waLinkSecret || (shopSettings as any)?.zender_api_key || (shopSettings as any)?.waToken || '4fe17fcfe73d5035f55b9144fa10e07443659005',
                                        zender_whatsapp_device_id: (shopSettings as any)?.zender_whatsapp_device_id || (shopSettings as any)?.zender_device_id || '',
                                        zender_endpoint_url: 'https://app.sellerscampus.com/api/v1'
                                      }
                                    };
                                    try {
                                      alert("মেসেজ পাঠানো হচ্ছে...");
                                      const response = await fetch('/api/gateways/dispatch', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                      });
                                      if(response.ok) {
                                        const dt = await response.json();
                                        if(dt.success) alert('বার্তা পাঠানো হয়েছে!');
                                        else alert(dt.error || 'Failed');
                                      }
                                    } catch(e) {
                                      alert('বার্তা পাঠানো সম্ভব হয়নি।');
                                    }
                                  }}
                                  className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                  title="WhatsApp Reply"
                                >
                                  📨 <span className="text-[9px] font-black uppercase">REPLY</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteQuery(query.id)}
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Message"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>
          )}


          {/* 4. RELEASE VERSION TAB */}
          {activeTab === 'release' && (
            <div className="space-y-6">

              {/* Publisher version block */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Release form box */}
                <div className="xl:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm h-fit">
                  <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                    <Plus className="w-4 h-4 text-indigo-500" />
                    {isBn ? 'নতুন সংস্করণ রেজিস্টার করুন' : 'Push New Build Release'}
                  </h3>

                  <form onSubmit={handlePublishRelease} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'সংস্করণ টাইটেল কোড' : 'Release Version Code'}</label>
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. v4.3.0"
                        value={newVersionInput}
                        onChange={(e) => setNewVersionInput(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none text-xs font-bold font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'আপডেটের ধরন' : 'Upgrade Type Level'}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'patch', label: 'PATCH' },
                          { id: 'minor', label: 'MINOR' },
                          { id: 'major', label: 'MAJOR' },
                        ].map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setNewVersionType(type.id as any)}
                            className={`py-2 rounded-xl text-[10px] font-black transition-all border ${
                              newVersionType === type.id 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200 dark:bg-slate-950 dark:border-slate-800'
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-500 block">{isBn ? 'পরিবর্তনসমূহ (চেঞ্জলগ)' : 'Changelog changes list'}</label>
                        <button
                          type="button"
                          onClick={handleAddChangeRow}
                          className="text-[10px] text-indigo-600 font-extrabold hover:underline"
                        >
                          + {isBn ? 'লাইন যোগ করুন' : 'Add line'}
                        </button>
                      </div>

                      {newVersionChanges.map((change, index) => (
                        <div key={index} className="flex gap-2 items-center animate-fadeIn">
                          <select
                            value={change.category}
                            onChange={(e) => {
                              const updated = [...newVersionChanges];
                              updated[index].category = e.target.value as any;
                              setNewVersionChanges(updated);
                            }}
                            className="bg-white dark:bg-slate-950 px-2 py-2 rounded-xl text-[9px] font-black border border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            <option value="new">🆕 NEW</option>
                            <option value="fix">🛠️ FIX</option>
                            <option value="perf">⚡ PERF</option>
                          </select>
                          <input 
                            required
                            type="text" 
                            placeholder={isBn ? 'পরিবর্তনের বিস্তারিত...' : 'Feature info...'}
                            value={change.text}
                            onChange={(e) => {
                              const updated = [...newVersionChanges];
                              updated[index].text = e.target.value;
                              setNewVersionChanges(updated);
                            }}
                            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveChangeRow(index)}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5 text-white" />
                      {isBn ? 'রিলিজ ও ডাটাবেজ আপডেট' : 'Register Version Release'}
                    </button>
                  </form>
                </div>

                {/* Release list list */}
                <div className="xl:col-span-2 space-y-4">
                  <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>{isBn ? 'সিস্টেম চেঞ্জলগ এবং সংস্করণ তালিকা' : 'Active System Releases and Changelogs'}</span>
                  </h3>

                  <div className="space-y-4">
                    {releaseNotes.map((release) => (
                      <div key={release.id} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                        
                        {/* Top corner gradient border hover effect */}
                        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-indigo-800"></div>

                        <div className="flex items-center justify-between gap-4 mb-4 pl-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-black text-indigo-600 dark:text-indigo-400">{release.version}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                              release.type === 'major' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30' :
                              release.type === 'minor' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {release.type}
                            </span>
                          </div>

                          <span className="text-[10px] text-gray-400 font-mono font-bold">{release.date}</span>
                        </div>

                        {/* Changelog bullet items list */}
                        <div className="space-y-2 pl-2">
                          {release.changes.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-xs">
                              <span className={`px-2 py-0.5 mt-0.5 rounded text-[8px] font-black tracking-wide leading-none ${
                                item.category === 'new' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                item.category === 'fix' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-950/10 dark:text-blue-450'
                              }`}>
                                {item.category.toUpperCase()}
                              </span>
                              <p className="text-gray-500 dark:text-slate-300 font-bold leading-relaxed">{item.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}


          {/* 5. BUSINESS MAIL TAB */}
          {activeTab === 'mail' && (
            <div className="space-y-6">

              {/* SMTP setup Configuration */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-indigo-500" />
                  {isBn ? 'ব্যবসায়িক SMTP গেটওয়ে লিংক সেটিংস' : 'Professional SMTP Mailing Gateway credentials'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'প্রেরক মেইল অ্যাড্রেস' : 'Sender Email'}</label>
                      <input 
                        type="text" 
                        value={smtpSettings.outgoingEmail}
                        onChange={(e) => setSmtpSettings({...smtpSettings, outgoingEmail: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">SMTP Host</label>
                      <input 
                        type="text" 
                        value={smtpSettings.smtpHost}
                        onChange={(e) => setSmtpSettings({...smtpSettings, smtpHost: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none font-bold font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">SMTP Port Code</label>
                      <input 
                        type="text" 
                        value={smtpSettings.smtpPort}
                        onChange={(e) => setSmtpSettings({...smtpSettings, smtpPort: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none font-bold font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">Google App Password / SMTP Security Keyword</label>
                      <input 
                        type="password" 
                        value={smtpSettings.apiKey}
                        onChange={(e) => setSmtpSettings({...smtpSettings, apiKey: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none font-bold"
                      />
                    </div>
                  </div>

                  <div className="bg-indigo-50/40 dark:bg-indigo-950/10 rounded-3xl p-5 border border-indigo-100/50 dark:border-indigo-950/40 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black text-indigo-500 block tracking-wider uppercase mb-1">{isBn ? 'মেইলিং ইন্টিগ্রেশন' : 'Newsletter sync'}</span>
                      <p className="text-xs text-gray-500 font-medium leading-relaxed">
                        {isBn ? 'এই মেইলিং গেটওয়ে দ্বারা সিস্টেমে থাকা সকল কাস্টমার ডাটাবেজের নিকট এক ক্লিকের মাধ্যমে মেইল সেন্ডিং ও ডিস্ট্রিবিউশন করা যাবে।' : 'Allows broadcasting bulk newsletter updates, transaction statements, or outstanding receipts to customers.'}
                      </p>
                    </div>

                    <div className="text-[10px] font-mono text-right text-indigo-500 font-extrabold">
                      Gateway: <span className="text-emerald-500">READY</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Composer newsletter dispatch panel */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Mail composer */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-tight">
                      {isBn ? 'নিউজলেটার এবং বালক মেইল কম্পোজার' : 'Direct Newsletter Composer'}
                    </h3>

                    {/* Pre-designed templates list picker */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApplyTemplate('promotional')}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all ${
                          selectedTemplate === 'promotional' 
                            ? 'bg-indigo-100 dark:bg-indigo-950/20 text-indigo-700 border border-indigo-200' 
                            : 'bg-gray-52 hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isBn ? 'ঈদ অফার' : 'OFFERS'}
                      </button>
                      <button
                        onClick={() => handleApplyTemplate('payment_notice')}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all ${
                          selectedTemplate === 'payment_notice' 
                            ? 'bg-rose-100 dark:bg-rose-950/20 text-rose-700 border border-rose-200' 
                            : 'bg-gray-52 hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isBn ? 'বকেয়া নোটিশ' : 'OUTSTANDINGS'}
                      </button>
                      <button
                        onClick={() => handleApplyTemplate('maintenance')}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black transition-all ${
                          selectedTemplate === 'maintenance' 
                            ? 'bg-amber-100 dark:bg-amber-950/20 text-amber-700 border border-amber-200' 
                            : 'bg-gray-52 hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isBn ? 'সেন্টেন্স আপডেট' : 'MAINTENANCE'}
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleStartEmailBroadcast} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'মেইল বিষয় (Subject)' : 'E-Mail Subject'}</label>
                      <input 
                        required
                        type="text" 
                        placeholder={isBn ? 'যেমন: ঈদ ক্যাশব্যাক ডিসকাউন্ট!' : 'e.g. Special Deal...'}
                        value={mailSubject}
                        onChange={(e) => setMailSubject(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs text-gray-900 dark:text-white font-bold bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">{isBn ? 'মেইল বডি কন্টেন্ট' : 'E-Mail Message Body'}</label>
                      <textarea 
                        required
                        rows={6}
                        placeholder={isBn ? 'মেইলের বিস্তারিত টেক্সট ম্যাটেরিয়াল কম্পোজ করুন...' : 'Write email body...'}
                        value={mailBody}
                        onChange={(e) => setMailBody(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-950 focus:border-indigo-500 outline-none font-medium resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={mailBatchProgress.active}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isBn ? 'কাস্টমারদের নিকট বালক মেইল পাঠান' : 'Initialize Batch Mail Broadcast'}
                    </button>
                  </form>
                </div>

                {/* Mailing progress queue output */}
                <div className="xl:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col h-[350px] xl:h-auto overflow-hidden text-xs">
                  <div className="pb-3 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between mb-4">
                    <span className="font-black text-gray-950 dark:text-white uppercase tracking-tight">{isBn ? 'মেইলিং প্রগ্রেস ও লাইভ লগ' : 'Mailing Queue Logs'}</span>
                    {mailBatchProgress.active && (
                      <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                    )}
                  </div>

                  {/* Progress Indicator */}
                  {mailBatchProgress.totalCount > 0 && (
                    <div className="mb-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-100/60 dark:border-slate-850">
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 mb-1.5 animate-pulse">
                        <span>{isBn ? 'মেইল ডেলিভারি' : 'Batch sending'}</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">{mailBatchProgress.currentCount}/{mailBatchProgress.totalCount}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${(mailBatchProgress.currentCount / mailBatchProgress.totalCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Log list info */}
                  <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-2xl border border-slate-900 font-mono text-[10px] text-zinc-300 space-y-2.5">
                    {mailBatchProgress.statusLog.length === 0 ? (
                      <p className="text-zinc-500 italic text-center pt-8">{isBn ? 'সিস্টেম মডিউল রেডি, এখনো কোনো ক্যাম্পেইন চালানো হয়নি।' : 'Ready to monitor mail gateway. Compose a newsletter above to launch a broadcast.'}</p>
                    ) : (
                      mailBatchProgress.statusLog.map((log, index) => (
                        <p key={index} className="leading-relaxed leading-3 select-all hover:text-white">
                          {log}
                        </p>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
