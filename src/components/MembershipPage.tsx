import React, { useState } from 'react';
import { motion } from 'motion/react';
import { db, doc, updateDoc, serverTimestamp, getDoc } from '../firebase';
import { Sparkles, ShieldCheck, Lock, CheckCircle, HelpCircle, Flame, Calendar, Award, RotateCcw, CreditCard, ChevronRight, Check } from 'lucide-react';

interface MembershipPageProps {
  shopSettings: any;
  user: any;
  onRefreshSettings?: () => void;
  setNotification: (n: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

interface PremiumPackage {
  name: string;
  price: number;
  bdt: string;
  rawMonths: number;
  desc: string;
  popular?: boolean;
  lifetime?: boolean;
}

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

export default function MembershipPage({ shopSettings, user, onRefreshSettings, setNotification }: MembershipPageProps) {
  const [activeTab, setActiveTab] = useState<'packages' | 'status'>('packages');
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<'6m' | '1y' | '2y' | '5y' | 'lifetime'>(() => {
    if (shopSettings?.packageType) return shopSettings.packageType;
    if (shopSettings?.lifetime) return 'lifetime';
    return '1y';
  });
  const [activating, setActivating] = useState(false);

  const packs: Record<string, PremiumPackage> = {
    '6m': { name: '6 Months Premium', price: 2499, bdt: '৳২,৪৯৯', rawMonths: 6, desc: 'Short-term premium access with full business suite features.' },
    '1y': { name: '1 Year Premium', price: 4499, bdt: '৳৪,৪৯৯', rawMonths: 12, desc: 'Most popular option. Optimize and scale your store operations.', popular: true },
    '2y': { name: '2 Years Premium', price: 7999, bdt: '৳৭,৯৯৯', rawMonths: 24, desc: 'Great value for stable, growing store operations.' },
    '5y': { name: '5 Years Premium', price: 17999, bdt: '৳১৭,৯৯৯', rawMonths: 60, desc: 'Enterprise-tier term commitment. Worry-free business suite.' },
    'lifetime': { name: 'Lifetime Premium', price: 24999, bdt: '৳২৪,৯৯৯', rawMonths: 999, desc: 'Ultimate permanent freedom. Free updates and Jarvis AI forever.', lifetime: true }
  };

  const currentSelection: PremiumPackage = packs[selectedDuration];

  const handleApplyPremium = async (pkgKey: keyof typeof packs) => {
    try {
      setActivating(true);
      const chosen = packs[pkgKey];
      const now = new Date();
      let formulaDate = new Date();
      
      if (chosen.lifetime) {
        formulaDate.setFullYear(now.getFullYear() + 50); // 50 years (close enough to lifetime)
      } else {
        formulaDate.setMonth(now.getMonth() + chosen.rawMonths);
      }

      const shopId = user?.shopId;
      if (!shopId) {
        throw new Error("No Shop ID linked to this account.");
      }

      const settingsRef = doc(db, 'settings', shopId);
      await updateDoc(settingsRef, {
        premiumActive: true,
        premiumUntil: formulaDate.toISOString(),
        packageType: pkgKey,
        packageActivatedAt: serverTimestamp(),
        plan: chosen.name,
        lifetime: chosen.lifetime || false
      });

      setNotification({
        message: `Successfully activated ${chosen.name}! Enjoy endless business power.`,
        type: 'success'
      });
      if (onRefreshSettings) onRefreshSettings();
    } catch (err: any) {
      setNotification({
        message: err.message || "Failed to update package.",
        type: 'error'
      });
    } finally {
      setActivating(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    
    try {
      const code = couponCode.toUpperCase().trim();
      
      // Legacy codes check
      if (code === 'VIP777' || code === 'PROAMZ') {
        const matched = selectedDuration === 'lifetime' ? 'lifetime' : selectedDuration;
        await handleApplyPremium(matched);
        setIsApplyingCoupon(false);
        setCouponCode('');
        return;
      }
      
      // Real database validation
      const promoRef = doc(db, 'promo_keys', code);
      const promoSnap = await getDoc(promoRef);
      
      if (!promoSnap.exists()) {
        throw new Error("Invalid promo / activation code. If you purchased via bKash, please allow 10-15 mins for the code delivery.");
      }
      
      const promoData = promoSnap.data();
      if (promoData.isUsed) {
        throw new Error("This activation key has already been used.");
      }
      
      // Determine which package to apply based on plan string
      const planStr = promoData.plan || '';
      let matchedPkg: keyof typeof packs = '1y'; // default
      if (planStr.includes('6 Months')) matchedPkg = '6m';
      else if (planStr.includes('1 Year')) matchedPkg = '1y';
      else if (planStr.includes('2 Years')) matchedPkg = '2y';
      else if (planStr.includes('5 Years')) matchedPkg = '5y';
      else if (planStr.includes('Lifetime')) matchedPkg = 'lifetime';
      
      // 1. Mark as used
      await updateDoc(promoRef, {
        isUsed: true,
        usedBy: user?.shopId || 'unknown',
        usedAt: new Date().toISOString()
      });
      
      // 2. Grant premium
      await handleApplyPremium(matchedPkg);
      
    } catch (err: any) {
      setNotification({
        message: err.message || "Error validating code. Please try again.",
        type: 'error'
      });
    } finally {
      setIsApplyingCoupon(false);
      setCouponCode('');
    }
  };

  // Check current status
  const createdDate = shopSettings.createdAt ? safeDate(shopSettings.createdAt) : new Date();
  const trialEndDate = new Date(createdDate.getTime() + 90 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const isTrialActive = trialEndDate.getTime() > now.getTime();
  const daysOfTrialLeft = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const hasSpecificPremium = shopSettings.premiumUntil && safeDate(shopSettings.premiumUntil).getTime() > now.getTime();
  
  const hasActivePaidPackage = (shopSettings.plan && shopSettings.plan !== 'free') || 
    shopSettings.lifetime || 
    shopSettings.packageType === 'lifetime' || 
    shopSettings.premiumActive || 
    hasSpecificPremium;

  const isCurrentlyPremium = hasActivePaidPackage || isTrialActive;

  // Active package details display
  let activePackageName = 'Normal Package';
  if (shopSettings.lifetime || shopSettings.packageType === 'lifetime' || shopSettings.plan?.toLowerCase().includes('lifetime')) {
    activePackageName = 'Lifetime Premium';
  } else if (shopSettings.packageType && packs[shopSettings.packageType]) {
    activePackageName = packs[shopSettings.packageType].name;
  } else if (shopSettings.plan && shopSettings.plan !== 'free') {
    activePackageName = shopSettings.plan;
  } else if (hasActivePaidPackage) {
    activePackageName = 'Premium Active';
  } else if (isTrialActive) {
    activePackageName = '90-Day Free Trial';
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/20 p-4 lg:p-8" id="membership-main-container">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 lg:p-12 text-white shadow-2xl mb-8 border border-indigo-900/40">
        <div className="absolute inset-x-0 bottom-0 top-0 bg-[radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.15),transparent_50%)]"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-350 text-xs font-black tracking-wider uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Dynamic Subscriptions & Packages
            </div>
            <h1 className="text-4xl font-black tracking-tight mb-3">ShopMaster Premium Hub</h1>
            <p className="text-slate-400 text-sm max-w-xl font-medium leading-relaxed">
              Unlock our complete ecosystem of analytical modules, robotic AI Assistants, multi-channel payment method setups, loan directories, online storefront configurations, and structured accounting trackers.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-6 md:w-80 flex flex-col justify-between">
            <div>
              <p className="text-xs text-indigo-300 font-black tracking-wider uppercase mb-1">Your Store Status</p>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {isCurrentlyPremium ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 font-black text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {activePackageName}
                  </span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-1.5 font-black text-sm">
                    <Lock className="w-4 h-4" />
                    Normal Package
                  </span>
                )}
              </h2>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-slate-400 font-semibold leading-relaxed">
              {hasActivePaidPackage ? (
                shopSettings.premiumUntil ? (
                  <span>Your Premium package is active until: <strong>{safeDate(shopSettings.premiumUntil).toLocaleDateString()}</strong>.</span>
                ) : (
                  <span>Your Lifetime Premium access is active. Core updates & Jarvis AI are permanently free!</span>
                )
              ) : isTrialActive ? (
                <span>Your full premium preview (90-Day Free Trial) expires in <strong>{daysOfTrialLeft} days</strong>. Activate Premium now to avoid service lock.</span>
              ) : (
                <span>Currently on the lifetime <strong>Normal Package</strong>. Core features remain free forever.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 gap-6 mb-8 text-sm">
        <button
          onClick={() => setActiveTab('packages')}
          className={`pb-4 px-1 font-bold transition-all relative ${activeTab === 'packages' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-gray-450 hover:text-gray-900 dark:hover:text-slate-200'}`}
        >
          Premium Packages
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`pb-4 px-1 font-bold transition-all relative ${activeTab === 'status' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-gray-450 hover:text-gray-900 dark:hover:text-slate-200'}`}
        >
          Premium vs Normal List
        </button>
      </div>

      {activeTab === 'packages' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Packages selection */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Select Your Duration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(packs) as Array<keyof typeof packs>).map((key) => {
                const item = packs[key];
                const isSelected = selectedDuration === key;
                const isActivePlan = (shopSettings?.packageType === key) || 
                                     (key === 'lifetime' && (shopSettings?.lifetime || shopSettings?.plan?.toLowerCase().includes('lifetime')));
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDuration(key as any)}
                    className={`relative cursor-pointer transition-all duration-300 rounded-2xl p-5 border text-left flex flex-col justify-between h-48 group overflow-hidden ${
                      isSelected
                        ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20 ring-1 ring-indigo-500 shadow-md'
                        : isActivePlan
                        ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50/10 dark:bg-emerald-950/10 shadow'
                        : 'border-slate-200/90 hover:border-slate-350 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow'
                    }`}
                  >
                    {isActivePlan ? (
                      <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                        Active / সক্রিয়
                      </div>
                    ) : item.popular ? (
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-pink-500 to-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                        Popular
                      </div>
                    ) : item.lifetime ? (
                      <div className="absolute top-3 right-3 bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                        Best Value
                      </div>
                    ) : null}
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="flex items-baseline justify-between mt-4">
                      <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">{item.bdt}</span>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                        isSelected 
                          ? 'bg-indigo-600 border-indigo-600 text-white' 
                          : isActivePlan 
                          ? 'bg-emerald-600 border-emerald-600 text-white' 
                          : 'border-slate-300'
                      }`}>
                        {(isSelected || isActivePlan) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkout column */}
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Package Activation</h3>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{currentSelection.name}</p>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">{currentSelection.bdt}</p>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3.5">
              <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Instant activation of AI assistant (Jarvis AI)</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Full access to accounting system (Hishab Nikash)</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Enable custom digital storefront & online checkout</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Unlimited warranty modules & scheduled closing logs</span>
              </div>
            </div>

            {/* Simulated manual payment detail key */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs font-semibold leading-relaxed">
              <span className="block text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wider mb-2">Purchase System (3 Methods)</span>
              <p className="text-slate-500 dark:text-slate-400 mb-2">1) Connect with Stratproamz for manual assignment.</p>
              <p className="text-slate-500 dark:text-slate-400 mb-2">2) Pay via bKash/Nagad and get a Redeem code.</p>
              <p className="text-slate-500 dark:text-slate-400 mb-3">3) We generate Promo/Activation Keys for your shop.</p>
              <div className="space-y-1.5 text-slate-705 dark:text-slate-350 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50">
                <p>📞 BKash Merchant (Send Money): <strong className="font-mono text-indigo-700 dark:text-indigo-400">017XXXXXXXX</strong></p>
                <p>📞 Nagad Merchant (Send Money): <strong className="font-mono text-indigo-700 dark:text-indigo-400">018XXXXXXXX</strong></p>
                <div className="text-[10px] text-slate-500 mt-2 italic">* After sending money, send a WhatsApp message to get your Activation Key.</div>
              </div>
            </div>

            {/* Code Activation form */}
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Redeem Activation / Promo Key</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter VIP key, e.g. PROAMZ"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-sm uppercase tracking-wide focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 text-gray-900 dark:text-white"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={isApplyingCoupon || !couponCode.trim()}
                  className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
                >
                  {isApplyingCoupon ? 'Verifying...' : 'Redeem'}
                </button>
              </div>
            </div>

            <button
              onClick={() => handleApplyPremium(selectedDuration)}
              disabled={activating}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/20 text-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              {activating ? 'Applying Setup...' : `Activate ${currentSelection.name}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-201 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-6">Package Features Allocation Grid</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-semibold border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400 text-left">
                  <th className="py-4 pr-4">Module/Features</th>
                  <th className="py-4 px-4 text-center">Normal Package (Basic)</th>
                  <th className="py-4 px-4 text-center">Premium Package</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">POS (Point Of Sale)</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Basic invoice billing, receipt printing, cash processing.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">Inventory Dashboard & List</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Stock registration, quantity trackers, supplier list, warehouse location maps.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">Jarvis AI Assistant</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Generative insights page powered by modern Gemini AI SDK.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-500">🔒 Locked (requires subscription)</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">Accounting / Hishab Nikash</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Expense trackers, salaries ledger, cash flow dashboards.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-500">🔒 Locked (requires subscription)</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">Daily Closing Reports</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Historical shift closure ledgers, print & save daily ledger counts.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-500">🔒 Locked (requires subscription)</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">Live TV Integration</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Stream live television feeds inside a persistent floating picture-in-picture frame.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-500">🔒 Locked (requires subscription)</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">Business Bio & Identity branding</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Custom platform title prefixes, custom base64 favicon, signature.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-500">🔒 Locked (requires subscription)</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">Online Store & Digital Checkout</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Sync digital products list, receive pending storefront customer orders.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-500">🔒 Locked (requires subscription)</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
                <tr>
                  <td className="py-3.5 pr-4">
                    <span className="block font-bold text-slate-850 dark:text-slate-200">Payment Gateway/Method settings</span>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">Node-specific network endpoint and API secret settings.</span>
                  </td>
                  <td className="py-3.5 px-4 text-center text-rose-500">🔒 Locked (requires subscription)</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500">🔓 Unlocked</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
