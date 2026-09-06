import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';
import { 
  MessageSquare, 
  Send, 
  Smartphone, 
  Settings, 
  Bot, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Users, 
  Sparkles, 
  Copy, 
  Check, 
  FileText,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  QrCode,
  X,
  Unlink
} from 'lucide-react';

interface MessagingGatewayProps {
  shopSettings?: any;
  onSaveSettings?: (settings: any) => void;
  customers?: any[];
  currentUserEmail?: string;
}

export const MessagingGateway: React.FC<MessagingGatewayProps> = ({
  shopSettings,
  onSaveSettings = (_s: any) => {},
  customers = [],
  currentUserEmail = ''
}) => {
  const settings = shopSettings || {};
  const isMasterAdmin = currentUserEmail?.toLowerCase().trim() === 'stratproamz@gmail.com';
  
  const isTrialExpired = (() => {
    if (isMasterAdmin) return false;
    if (settings.premiumActive) return false;
    if (settings.plan && settings.plan !== 'free') return false;
    if (settings.packageType === 'lifetime' || settings.lifetime) return false;
    
    if (settings.premiumUntil) {
      const untilDate = new Date(settings.premiumUntil);
      if (!isNaN(untilDate.getTime()) && untilDate.getTime() > new Date().getTime()) return false;
    }
    
    // Check 90 days trial limit
    const createdDate = settings.createdAt ? new Date(settings.createdAt) : new Date();
    if (!isNaN(createdDate.getTime())) {
      const trialEnd = new Date(createdDate.getTime() + 90 * 24 * 60 * 60 * 1000);
      if (trialEnd.getTime() < new Date().getTime()) return true;
    }
    
    return false;
  })();

  const [activeSubTab, setActiveSubTab] = useState<'config' | 'templates' | 'broadcast' | 'logs'>('config');

  // Default Country Code Selection State
  const [defaultCountryCode, setDefaultCountryCode] = useState<string>(settings.defaultCountryCode || '880');
  const [defaultCountryName, setDefaultCountryName] = useState<string>(settings.defaultCountryName || 'Bangladesh (+880)');

  const shopId = settings.id || 'merchant';

  // WhatsApp Configuration State
  const [waType, setWaType] = useState<string>(settings.waGatewayType || 'baileys');
  const [waToken, setWaToken] = useState<string>(settings.waToken || '');
  const [waInstanceId, setWaInstanceId] = useState<string>(settings.waInstanceId || '');
  const [waLinkSecret, setWaLinkSecret] = useState<string>(settings.waLinkSecret || '4fe17fcfe73d5035f55b9144fa10e07443659005');

  // Meta Official Cloud API Config State
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState<string>(settings.meta_phone_number_id || '');
  const [metaAccessToken, setMetaAccessToken] = useState<string>(settings.meta_access_token || '');
  const [metaWabaId, setMetaWabaId] = useState<string>(settings.meta_waba_id || '');
  const [showMetaToken, setShowMetaToken] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<'baileys' | 'meta' | 'httpsms' | null>(null);

  // Seller SMS (In-House Android SIM Gateway) State
  const [pairedSmsDevice, setPairedSmsDevice] = useState<any>(null);
  const [isConnectingHttpSms, setIsConnectingHttpSms] = useState<boolean>(false);
  const [httpSmsTestPhone, setHttpSmsTestPhone] = useState<string>('');
  const [httpSmsTestSending, setHttpSmsTestSending] = useState<boolean>(false);
  const [httpSmsTestStatus, setHttpSmsTestStatus] = useState<string | null>(null);
  const [httpSmsTestError, setHttpSmsTestError] = useState<string | null>(null);
  const [httpSmsStatus, setHttpSmsStatus] = useState<'connected' | 'disconnected' | 'checking'>(settings.httpsms_status || 'disconnected');
  
  // Baileys & Zender SaaS Integration State
  const [baileysPhone, setBaileysPhone] = useState<string>(settings.baileys_phone || '');
  const [zenderWaDeviceId, setZenderWaDeviceId] = useState<string>(settings.zender_whatsapp_device_id || '');
  const [zenderSmsDeviceId, setZenderSmsDeviceId] = useState<string>(settings.zender_sms_device_id || '');
  const [whatsappStatus, setWhatsappStatus] = useState<'connected' | 'disconnected'>(settings.whatsapp_status || 'disconnected');
  const [smsStatus, setSmsStatus] = useState<'active' | 'disabled'>(settings.sms_status || 'disabled');
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(settings.whatsapp_enabled !== false);
  const [smsEnabled, setSmsEnabled] = useState<boolean>(settings.sms_enabled !== false);
  const [defaultRoute, setDefaultRoute] = useState<'whatsapp_sms_fallback' | 'whatsapp' | 'sms' | 'dual' | 'manual_redirect'>(
    (settings.default_route as any) || 'whatsapp_sms_fallback'
  );

  // Manual API Configuration Credentials
  const [zenderEndpointUrl, setZenderEndpointUrl] = useState<string>('https://app.sellerscampus.com/api/v1');
  const [zenderApiKey, setZenderApiKey] = useState<string>('4fe17fcfe73d5035f55b9144fa10e07443659005');
  const [zenderDeviceId, setZenderDeviceId] = useState<string>(settings.zender_device_id || settings.zender_whatsapp_device_id || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  const [isConnectingWa, setIsConnectingWa] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrString, setQrString] = useState('');
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessageDetails, setSuccessMessageDetails] = useState('');


  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [qrCountdown, setQrCountdown] = useState<number | null>(null);
  const setQrCodeData = setQrString;

  React.useEffect(() => {
    if (qrCountdown === null) return;
    if (qrCountdown <= 0) {
      setQrCodeData("");
      setQrCountdown(null);
      setShowQrModal(false);
      setConnectionError("⚠️ কিউআর কোডের মেয়াদ শেষ! সিকিউরিটির জন্য এটি অটো-ক্লোজ করা হয়েছে। অনুগ্রহ করে নতুন করে জেনারেট করুন।");
      return;
    }
    const timer = setTimeout(() => setQrCountdown(qrCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [qrCountdown]);

  // Test Connection States
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testMsgStatus, setTestMsgStatus] = useState<string | null>(null);
  const [testMsgError, setTestMsgError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync state from prop changes dynamically
  React.useEffect(() => {
    if (shopSettings) {
      setWaType(shopSettings.waGatewayType || 'zender');
      setWaToken(shopSettings.waToken || '');
      setWaInstanceId(shopSettings.waInstanceId || '');
      setZenderWaDeviceId(shopSettings.zender_whatsapp_device_id || '');
      setZenderSmsDeviceId(shopSettings.zender_sms_device_id || '');
      setWhatsappStatus(shopSettings.whatsapp_status || 'disconnected');
      setSmsStatus(shopSettings.sms_status || 'disabled');
      if (shopSettings.whatsapp_enabled !== undefined) setWhatsappEnabled(shopSettings.whatsapp_enabled);
      if (shopSettings.sms_enabled !== undefined) setSmsEnabled(shopSettings.sms_enabled);
      setDefaultRoute(shopSettings.default_route || 'whatsapp_sms_fallback');
      setSmsType(shopSettings.smsGatewayType || 'none');
      setSmsApiKey(shopSettings.smsApiKey || '');
      setSmsSenderId(shopSettings.smsSenderId || '');
      setSmsEndpoint(shopSettings.smsEndpoint || '');
      if (shopSettings.httpsms_status) setHttpSmsStatus(shopSettings.httpsms_status);
      
      // Manual Credentials Sync
      setZenderEndpointUrl('https://app.sellerscampus.com/api/v1');
      setZenderApiKey('4fe17fcfe73d5035f55b9144fa10e07443659005');
      setZenderDeviceId(prev => prev ? prev : (shopSettings.zender_device_id || shopSettings.zender_whatsapp_device_id || ''));
      setWaLinkSecret('4fe17fcfe73d5035f55b9144fa10e07443659005');
      setDefaultCountryCode(shopSettings.defaultCountryCode || '880');
      setDefaultCountryName(shopSettings.defaultCountryName || 'Bangladesh (+880)');
    }
  }, [shopSettings]);

  // Dynamic automatic status check on load
  const prevStatusRef = React.useRef(whatsappStatus);

  React.useEffect(() => {
    prevStatusRef.current = whatsappStatus;
  }, [whatsappStatus]);

  const fetchCurrentConnectionStatus = React.useCallback(async (forcedShopId?: string, forcedDeviceId?: string) => {
    const shopIdToCheck = forcedShopId || settings.id || 'merchant';
    
    // Check Baileys Multi-Device Status (Primary)
    if (waType === 'baileys') {
      try {
        const res = await fetch(`/api/whatsapp/baileys/status?merchant_id=${shopIdToCheck}`);
        const data = await res.json();
        if (data.success && data.status === 'connected') {
          setWhatsappStatus('connected');
          setBaileysPhone(data.phone || '');
          setConnectionError(null);
          if (settings.whatsapp_status !== 'connected' || settings.baileys_phone !== data.phone) {
            onSaveSettings({
              ...settings,
              waGatewayType: 'baileys',
              whatsapp_status: 'connected',
              baileys_phone: data.phone || '',
              default_route: 'whatsapp'
            });
          }
          if (showQrModal) setShowQrModal(false);
          return;
        } else {
          setWhatsappStatus('disconnected');
        }
      } catch (e) {
        console.warn("Baileys status sync warning:", e);
      }
      return;
    }

    // Check Meta Cloud API
    if (waType === 'meta_cloud') {
      if (metaPhoneNumberId && metaAccessToken) {
        setWhatsappStatus('connected');
      } else {
        setWhatsappStatus('disconnected');
      }
      return;
    }

    // Check Paired Android SMS Gateway Status
    try {
      const smsRes = await fetch(`/api/sms/paired-status?merchantId=${shopIdToCheck}`);
      const smsData = await smsRes.json();
      if (smsData.success && smsData.status === 'connected' && smsData.device) {
        setHttpSmsStatus('connected');
        setPairedSmsDevice(smsData.device);
        if (settings.httpsms_status !== 'connected') {
          onSaveSettings({
            ...settings,
            httpsms_status: 'connected',
            sms_status: 'active'
          });
        }
      } else {
        setHttpSmsStatus('disconnected');
        setPairedSmsDevice(null);
      }
    } catch (e) {
      console.warn("SMS Paired status sync warning:", e);
    }

    if (waType !== 'zender' && waType !== 'walink') return;
    
    const deviceIdToCheck = forcedDeviceId || zenderDeviceId || settings.zender_whatsapp_device_id || zenderWaDeviceId;
    
    if (!shopIdToCheck || !deviceIdToCheck) return;

    try {
      const res = await fetch(`/api/gateways/whatsapp/status?merchant_id=${shopIdToCheck}&device_session_id=${deviceIdToCheck}`);
      const data = await res.json();
      
      if (data.success && data.status === 'connected') {
        setWhatsappStatus('connected');
        setConnectionError(null);
        
        const finalId = data.device_id || deviceIdToCheck;
        if (finalId) {
          setZenderDeviceId(finalId);
          setZenderWaDeviceId(finalId);
          if (settings.whatsapp_status !== 'connected' || settings.zender_whatsapp_device_id !== finalId || settings.zender_device_id !== finalId) {
            onSaveSettings({ 
              ...settings, 
              whatsapp_status: 'connected', 
              zender_whatsapp_device_id: finalId, 
              zender_device_id: finalId 
            });
          }
        }
        if (showQrModal) {
          setShowQrModal(false);
        }
      } else {
        setWhatsappStatus('disconnected');
        if (settings.whatsapp_status !== 'disconnected') {
          onSaveSettings({ ...settings, whatsapp_status: 'disconnected' });
        }
      }
    } catch (e) {
      console.warn("Status Sync Temporary Warning (retrying):", e);
      // Do not demote status or mutate settings during temporary fetch failures (e.g., server restarts)
    }
  }, [waType, metaPhoneNumberId, metaAccessToken, settings, zenderWaDeviceId, zenderDeviceId, showQrModal, onSaveSettings]);

  React.useEffect(() => {
    fetchCurrentConnectionStatus();
    
    // Smart Adaptive Polling: Only poll when tab is visible to prevent unnecessary rate limiting and network load
    const statusInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchCurrentConnectionStatus();
    }, 15000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchCurrentConnectionStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(statusInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchCurrentConnectionStatus]);

  // Set up a useEffect interval that calls fetchCurrentConnectionStatus every 3 seconds ONLY while the QR modal is open
  React.useEffect(() => {
    let interval: any;
    if (qrString && whatsappStatus !== 'connected') {
      interval = setInterval(() => {
        fetchCurrentConnectionStatus(shopId, zenderDeviceId);
      }, 3000);
    }
    
    if (whatsappStatus === 'connected' && qrString) {
      setQrString('');
      setQrCountdown(null);
      setShowQrModal(false);
    }
    
    return () => clearInterval(interval);
  }, [qrString, whatsappStatus, shopId, zenderDeviceId, fetchCurrentConnectionStatus]);

  const handleWhatsAppConnected = (deviceId: string, apiPhone?: string) => {
    setWhatsappStatus('connected');
    setShowQrModal(false);
    setConnectionError(null);
    setZenderWaDeviceId(deviceId);
    setZenderDeviceId(deviceId);
    
    onSaveSettings({
      ...settings,
      waGatewayType: waType,
      waLinkSecret: waLinkSecret,
      zender_whatsapp_device_id: deviceId,
      zender_endpoint_url: zenderEndpointUrl,
      zender_api_key: zenderApiKey,
      zender_device_id: deviceId,
      whatsapp_status: 'connected',
      default_route: 'whatsapp'
    });

    const shopName = settings.shopName || settings.name || 'ShopMaster';
    const targetPhone = apiPhone || settings.phone;

    setSuccessMessageDetails(
      targetPhone 
        ? `🎉 অভিনন্দন! আপনার হোয়াটসঅ্যাপ সফলভাবে সংযুক্ত হয়েছে।\nআপনার নম্বর (${targetPhone})-এ একটি প্রফেশনাল কনফার্মেশন মেসেজ পাঠানো হচ্ছে।` 
        : `🎉 অভিনন্দন! আপনার হোয়াটসঅ্যাপ সফলভাবে সংযুক্ত হয়েছে।\nদয়া করে সেটিংসে আপনার নম্বর (Store Mobile) যোগ করুন কনফার্মেশন মেসেজের জন্য।`
    );
    setShowSuccessNotification(true);

    if (targetPhone) {
      fetch('/api/gateways/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayConfig: {
            default_route: 'whatsapp',
            zender_whatsapp_device_id: deviceId,
            zender_api_key: zenderApiKey || waLinkSecret,
            endpoint_url: zenderEndpointUrl
          },
          sale: {
            customerPhone: targetPhone,
            message: `🎉 *অভিনন্দন!*\n\n*${shopName}*-এর সাথে আপনার হোয়াটসঅ্যাপ সফলভাবে কানেক্ট হয়েছে। এখন থেকে আপনার ব্যবসার সমস্ত ইনভয়েস এবং নোটিফিকেশন স্বয়ংক্রিয়ভাবে গ্রাহকদের কাছে ডেলিভারি হবে।`
          }
        })
      }).catch(err => {
        console.error('Failed to send confirmation message', err);
      });
    }

    // Auto-hide success notification after 5 seconds
    setTimeout(() => {
      setShowSuccessNotification(false);
    }, 5000);
  };

  // Removed iframe messaging listener to prevent early false success
  // Real success is now strictly driven by the checkRealWhatsAppStatus polling

  // Status Polling helper
  const startStatusPolling = (deviceId: string) => {
    if ((window as any)._waPollInterval) {
      clearInterval((window as any)._waPollInterval);
    }

    const intervalId = setInterval(async () => {
      try {
        const queryParams = new URLSearchParams({
          endpoint_url: zenderEndpointUrl,
          api_key: waType === 'walink' ? waLinkSecret : zenderApiKey,
          device_id: deviceId
        });

        const res = await fetch(`/api/gateways/status?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'connected' || data.status === 'REAL_CONNECTED') {
            clearInterval(intervalId);
            handleWhatsAppConnected(data.real_device_id || deviceId, data.phone);
          }
        }
      } catch (err) {
        console.warn('Zender Polling expected retry warning:', err);
      }
    }, 4000);

    (window as any)._waPollInterval = intervalId;

    // Stop after 3 minutes
    setTimeout(() => {
      clearInterval(intervalId);
    }, 180000);
  };

  const handleResync = async () => {
    if (isTrialExpired) {
      setConnectionError(settings.systemLanguage === 'bn' 
        ? 'দয়া করে আগে আপনার সাবস্ক্রিপশন আপডেট করুন।' 
        : 'Please update your subscription package first to unlock WhatsApp connectivity.');
      return;
    }
    setConnectionError(null);
    await fetchCurrentConnectionStatus(shopId, zenderDeviceId);
  };


  const handleConnectWhatsApp = async () => {
    if (isTrialExpired) {
      setConnectionError(settings.systemLanguage === 'bn' 
        ? 'দয়া করে আগে আপনার সাবস্ক্রিপশন আপডেট করুন।' 
        : 'Please update your subscription package first to unlock WhatsApp connectivity.');
      return;
    }
    setIsConnectingWa(true);
    setConnectionError(null);

    // 1. BAILEYS MULTI-DEVICE (Primary & Default)
    if (waType === 'baileys') {
      try {
        const shopId = settings.id || 'merchant';
        const response = await fetch('/api/whatsapp/baileys/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchant_id: shopId, force: true })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          if (data.status === 'connected') {
            handleWhatsAppConnected('baileys_' + shopId, data.phone);
            return;
          }

          if (data.qrRaw) {
            setQrCodeData(data.qrRaw);
            setShowQrModal(true);
            setQrCountdown(60); // 60-second pairing timer

            // Start polling for Baileys connection status
            if ((window as any)._waPollInterval) clearInterval((window as any)._waPollInterval);
            const intervalId = setInterval(async () => {
              try {
                const checkRes = await fetch(`/api/whatsapp/baileys/status?merchant_id=${shopId}`);
                const checkData = await checkRes.json();
                if (checkData.success && checkData.status === 'connected') {
                  clearInterval(intervalId);
                  handleWhatsAppConnected('baileys_' + shopId, checkData.phone);
                } else if (checkData.qrRaw && checkData.qrRaw !== data.qrRaw) {
                  setQrCodeData(checkData.qrRaw);
                }
              } catch (e) {}
            }, 3000);
            (window as any)._waPollInterval = intervalId;
            setTimeout(() => clearInterval(intervalId), 180000);
          } else {
            // Poll for QR if not immediately returned
            setShowQrModal(true);
            setQrCountdown(60);
            if ((window as any)._waPollInterval) clearInterval((window as any)._waPollInterval);
            const intervalId = setInterval(async () => {
              try {
                const checkRes = await fetch(`/api/whatsapp/baileys/status?merchant_id=${shopId}`);
                const checkData = await checkRes.json();
                if (checkData.success && checkData.status === 'connected') {
                  clearInterval(intervalId);
                  handleWhatsAppConnected('baileys_' + shopId, checkData.phone);
                } else if (checkData.qrRaw) {
                  setQrCodeData(checkData.qrRaw);
                }
              } catch (e) {}
            }, 3000);
            (window as any)._waPollInterval = intervalId;
            setTimeout(() => clearInterval(intervalId), 180000);
          }
        } else {
          setConnectionError(data.error || 'Failed to initialize Baileys WhatsApp connection.');
        }
      } catch (err: any) {
        console.error('Baileys connect error:', err);
        setConnectionError('Baileys Socket connection error: ' + err.message);
      } finally {
        setIsConnectingWa(false);
      }
      return;
    }

    // 2. META CLOUD API (Alternative)
    if (waType === 'meta_cloud') {
      if (!metaPhoneNumberId || !metaAccessToken) {
        setConnectionError('Meta Phone Number ID এবং Permanent Access Token প্রদান করুন।');
        setIsConnectingWa(false);
        return;
      }
      setWhatsappStatus('connected');
      onSaveSettings({
        ...settings,
        waGatewayType: 'meta_cloud',
        meta_phone_number_id: metaPhoneNumberId,
        meta_access_token: metaAccessToken,
        meta_waba_id: metaWabaId,
        whatsapp_status: 'connected',
        default_route: 'whatsapp'
      });
      setShowSuccessNotification(true);
      setSuccessMessageDetails('Official Meta WhatsApp Cloud API সফলভাবে কনফিগার করা হয়েছে!');
      setIsConnectingWa(false);
      return;
    }

    // 3. Fallback Zender Connection
    try {
      const shopId = settings.id || 'merchant';
      const deviceSessionId = zenderDeviceId;

      // Always use the walink endpoint which extracts the raw payload and generates a REAL QR barcode
      const response = await fetch('/api/gateways/whatsapp/connect-walink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ merchant_id: shopId, device_session_id: deviceSessionId })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response (HTML fallback). API Route failed.");
      }

      const rawText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error(`Invalid JSON from server. Status: ${response.status}. Body: ${rawText.substring(0, 100)}...`);
      }
      
      if (response.ok) {
        if (data.success && data.rawQrString) {
          let rawStr = typeof data.rawQrString === 'string' ? data.rawQrString : JSON.stringify(data.rawQrString);
          
          const findQrInValue = (val: any): string | null => {
            if (typeof val === 'string') {
              const sIdx = val.search(/[1-9]@/);
              if (sIdx !== -1 && val.length > 20) {
                return val;
              }
            }
            if (val && typeof val === 'object') {
              const keys = ['qrcode', 'code', 'qr', 'data', 'message', 'text'];
              for (const key of keys) {
                if (key in val) {
                  const res = findQrInValue(val[key]);
                  if (res) return res;
                }
              }
              for (const key in val) {
                if (Object.prototype.hasOwnProperty.call(val, key)) {
                  const res = findQrInValue(val[key]);
                  if (res) return res;
                }
              }
            }
            return null;
          };

          // Step 1: If it is stringified JSON, parse it safely
          try {
            const jsonObj = JSON.parse(rawStr);
            const extracted = findQrInValue(jsonObj);
            rawStr = extracted || jsonObj.data || jsonObj.code || jsonObj.message || rawStr;
            if (typeof rawStr !== 'string') {
              rawStr = JSON.stringify(rawStr);
            }
          } catch(e) {}

          // Step 2: Decode URL encoding (Crucial for Base64 '+' symbols that became '%2B')
          try { rawStr = decodeURIComponent(rawStr); } catch(e) {}

          // Step 3: Find the starting point of the WhatsApp protocol (e.g., 1@, 2@)
          const startIdx = rawStr.search(/[1-9]@/);
          if (startIdx === -1) {
             throw new Error("API Error: No valid WhatsApp protocol found. Raw output: " + rawStr.substring(0, 40));
          }
          
          let cleanQR = rawStr.substring(startIdx);

          // Step 4: Safely cut off trailing JSON brackets, quotes, or whitespaces WITHOUT regex
          cleanQR = cleanQR.split('"')[0].split("'")[0].split('}')[0].split('\\')[0].trim();

          // Ensure no SellersCampus tracking tags are appended
          if(cleanQR.includes('_SellersCampus')) {
              cleanQR = cleanQR.split('_SellersCampus')[0];
          }

          console.log("FINAL PURE QR PAYLOAD:", cleanQR);
          setQrCodeData(cleanQR);
          setConnectionError(null);
          setQrCountdown(20); // Maintain the 20-second security timer
        } else {
          throw new Error(data.error || "Failed to generate QR. Backend returned false.");
        }

        setZenderWaDeviceId(data.device_id || deviceSessionId);
        setZenderDeviceId(data.device_id || deviceSessionId);
        setShowQrModal(true);
        setWhatsappStatus('disconnected');
        startStatusPolling(data.device_id || deviceSessionId);
      } else {
        if (data.status === 403 || response.status === 403) {
          setConnectionError(`SellersCampus API Error: ${data.message || data.error || 'Permission denied by provider'}`);
          setShowQrModal(false);
          setQrString('');
          setWhatsappStatus('disconnected');
        } else {
          setConnectionError('REAL API CONNECTION FAILED: ' + (data.message || data.error || 'Server error, check console.'));
        }
      }
    } catch (err: any) {
      console.error('Zender connect exception:', err);
      setConnectionError('Failed connecting Zender endpoint: ' + err.message);
    } finally {
      setIsConnectingWa(false);
    }
  };

  const handleUnlinkWhatsApp = async () => {
    try {
      setConnectionError('Disconnecting... Please wait.');

      if (waType === 'baileys') {
        const shopId = settings.id || 'merchant';
        await fetch('/api/whatsapp/baileys/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchant_id: shopId })
        });
        setWhatsappStatus('disconnected');
        setBaileysPhone('');
        onSaveSettings({
          ...settings,
          whatsapp_status: 'disconnected',
          baileys_phone: ''
        });
        setConnectionError('WhatsApp Baileys session disconnected.');
        return;
      }
      
      // Terminate Zender session
      const res = await fetch('/api/gateways/whatsapp/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchant_id: settings.id || 'merchant'
        })
      });

      const data = await res.json();
      if (!data.success && !res.ok) {
         throw new Error(data.message || 'Failed to unlink on server');
      }

      if ((window as any)._waPollInterval) {
        clearInterval((window as any)._waPollInterval);
        (window as any)._waPollInterval = null;
      }
      setWhatsappStatus('disconnected');
      setZenderWaDeviceId('');
      setZenderDeviceId('');
      setDefaultRoute('whatsapp');
      
      onSaveSettings({
        ...settings,
        zender_whatsapp_device_id: '',
        zender_device_id: '',
        whatsapp_status: 'disconnected'
      });
      
      setConnectionError('WhatsApp session unlinked successfully. You must scan again to re-link.');
    } catch (err) {
      console.error('Error during Zender unlink:', err);
      setConnectionError('Disconnection finalized locally.');
      
      setWhatsappStatus('disconnected');
      setZenderWaDeviceId('');
      setZenderDeviceId('');
      
      onSaveSettings({
        ...settings,
        zender_whatsapp_device_id: '',
        zender_device_id: '',
        whatsapp_status: 'disconnected'
      });
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone) {
      setTestMsgError('অনুগ্রহ করে টেস্ট করার জন্য একটি মোবাইল নম্বর প্রদান করুন');
      return;
    }
    
    if (whatsappStatus !== 'connected') {
       setTestMsgError('⚠️ হোয়াটসঅ্যাপ অ্যাকাউন্ট যুক্ত করা নেই। টেস্ট মেসেজ পাঠাতে আগে কানেক্ট করুন।');
       return;
    }
    
    setTestSending(true);
    setTestMsgStatus(null);
    setTestMsgError(null);

    try {
      const activeId = zenderDeviceId || zenderWaDeviceId || settings.zender_whatsapp_device_id || settings.zender_device_id;
      const response = await fetch('/api/gateways/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          gatewayConfig: {
            default_route: 'whatsapp',
            waGatewayType: waType,
            meta_phone_number_id: metaPhoneNumberId,
            meta_access_token: metaAccessToken,
            zender_whatsapp_device_id: activeId,
            zender_api_key: zenderApiKey || waLinkSecret || settings.zender_api_key || settings.waToken,
            endpoint_url: zenderEndpointUrl || 'https://app.sellerscampus.com/api/v1'
          },
          sale: {
            customerPhone: testPhone,
            message: `🧪 *হোয়াটসঅ্যাপ কানেকশন টেস্ট*\n\nঅভিনন্দন! আপনার স্টোরের হোয়াটসঅ্যাপ মেসেজিং গেটওয়ে সফলভাবে কাজ করছে। এটি একটি সফল টেস্ট মেসেজ ছিল।`
          }
        })
      });

      if (response.ok) {
        setTestMsgStatus('✓ টেস্ট মেসেজ সফলভাবে পাঠানো হয়েছে! আপনার মোবাইল ফোন চেক করুন।');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setTestMsgError(errorData.error || 'তাহলে ডিভাইস সংযুক্ত নেই। বা সেশন সচল নয়। অনুগ্রহ করে কানেক্ট করুন।');
      }
    } catch (err: any) {
      console.error('Test dispatch error:', err);
      setTestMsgError('কানেকশন ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setTestSending(false);
    }
  };

  // Seller SMS (In-House Android SIM Gateway) Handlers
  const handleTestHttpSmsConnection = async () => {
    setIsConnectingHttpSms(true);
    setHttpSmsTestError(null);
    setHttpSmsTestStatus(null);
    try {
      const res = await fetch(`/api/sms/paired-status?merchantId=${shopId}`);
      const data = await res.json();
      if (res.ok && data.success && data.status === 'connected') {
        setHttpSmsStatus('connected');
        setPairedSmsDevice(data.device);
        setHttpSmsTestStatus(`✓ আপনার ফোন (${data.device?.phoneModel || 'Android Phone'}) সফলভাবে কানেক্টেড রয়েছে!`);
        onSaveSettings({
          ...settings,
          httpsms_status: 'connected',
          sms_status: 'active'
        });
      } else {
        setHttpSmsStatus('disconnected');
        setPairedSmsDevice(null);
        setHttpSmsTestError('কোনো অ্যান্ড্রয়েড ফোন কানেক্টেড নেই। ফোনের Seller SMS অ্যাপ দিয়ে নিচের কিউআর কোডটি স্ক্যান করুন।');
      }
    } catch (e: any) {
      setHttpSmsStatus('disconnected');
      setHttpSmsTestError('কানেকশন এরর: ' + e.message);
    } finally {
      setIsConnectingHttpSms(false);
    }
  };

  const handleSendHttpSmsTestMessage = async () => {
    if (!httpSmsTestPhone) {
      setHttpSmsTestError('অনুগ্রহ করে টেস্ট করার জন্য একটি প্রাপকের মোবাইল নম্বর দিন।');
      return;
    }
    setHttpSmsTestSending(true);
    setHttpSmsTestStatus(null);
    setHttpSmsTestError(null);
    try {
      const res = await fetch('/api/sms/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: shopId,
          to: httpSmsTestPhone,
          content: '🧪 টেস্ট এসএমএস: আপনার নিজস্ব Seller SMS অ্যান্ড্রয়েড গেটওয়ে সফলভাবে কনফিগার হয়েছে এবং কাজ করছে!'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHttpSmsTestStatus(`✓ টেস্ট এসএমএস সফলভাবে ডিসপ্যাচ হয়েছে (সিম: ${data.senderPhone || 'SIM 1'})!`);
        // Add to logs table
        setLogs(prev => [
          {
            id: 'log-' + Date.now(),
            recipient: 'Test Recipient',
            phone: httpSmsTestPhone,
            content: '🧪 টেস্ট এসএমএস: আপনার নিজস্ব Seller SMS অ্যান্ড্রয়েড গেটওয়ে সফলভাবে কনফিগার হয়েছে!',
            gateway: 'sms',
            status: 'delivered',
            time: 'Just now'
          },
          ...prev
        ]);
      } else {
        setHttpSmsTestError(data.error || 'এসএমএস পাঠাতে ব্যর্থ হয়েছে। আপনার অ্যান্ড্রয়েড অ্যাপ এবং সিমে ব্যালেন্স চেক করুন।');
      }
    } catch (e: any) {
      setHttpSmsTestError('এসএমএস প্রেরণে সমস্যা: ' + e.message);
    } finally {
      setHttpSmsTestSending(false);
    }
  };

  const handleUnlinkSmsDevice = async () => {
    try {
      await fetch('/api/sms/unlink-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: shopId })
      });
      setHttpSmsStatus('disconnected');
      setPairedSmsDevice(null);
      onSaveSettings({
        ...settings,
        httpsms_status: 'disconnected'
      });
      setHttpSmsTestStatus(null);
    } catch (e: any) {
      console.error('Error unlinking SMS device:', e);
    }
  };

  // SMS Configuration State
  const [smsType, setSmsType] = useState<string>(settings.smsGatewayType || 'none');
  const [smsApiKey, setSmsApiKey] = useState<string>(settings.smsApiKey || '');
  const [smsSenderId, setSmsSenderId] = useState<string>(settings.smsSenderId || '');
  const [smsEndpoint, setSmsEndpoint] = useState<string>(settings.smsEndpoint || '');

  // Template State
  const [saleTemplate, setSaleTemplate] = useState<string>(
    settings.saleTemplate || 'Hi {{customerName}}, your purchase of {{subtotal}} is completed at {{shopName}}!'
  );
  const [dueTemplate, setDueTemplate] = useState<string>(
    settings.dueTemplate || 'Dear {{customerName}}, you have a pending due of {{dueAmount}} at {{shopName}}. Please clear it soon.'
  );
  const [globalTemplateEn, setGlobalTemplateEn] = useState<string>(
    settings.globalTemplateEn || 'Hello *{{customerName}}*, thank you for shopping at *{{shopName}}*! Your invoice #{{invoiceId}} total is {{currencySymbol}} {{totalAmount}}.'
  );
  const [globalTemplateBn, setGlobalTemplateBn] = useState<string>(
    settings.globalTemplateBn || 'প্রিয় *{{customerName}}*, *{{shopName}}*-এ কেনাকাটা করার জন্য ধন্যবাদ! আপনার ইনভয়েস #{{invoiceId}} এর মোট পরিমাণ {{currencySymbol}} {{totalAmount}} টাকা।'
  );

  // Broadcast Composer State
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'due' | 'selected'>('all');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastMethod, setBroadcastMethod] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<{ success: number; failed: number; message?: string } | null>(null);

  // Testing & Save Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);


  // Saved Logs (mock demo logs to keep user interaction functional and fully rich)
  const [logs, setLogs] = useState<Array<{
    id: string;
    recipient: string;
    phone: string;
    content: string;
    gateway: 'whatsapp' | 'sms';
    status: 'delivered' | 'failed' | 'pending';
    time: string;
  }>>([
    { id: 'msg-1', recipient: 'Abir Rahman', phone: '01712345678', content: 'Dear Abir Rahman, you have a pending due of 1500 BDT at My Shop. Please clear it soon.', gateway: 'whatsapp', status: 'delivered', time: 'Just now' },
    { id: 'msg-2', recipient: 'Farhana Kabir', phone: '01898765432', content: 'Hi Farhana Kabir, your purchase of 3400 BDT is completed at My Shop!', gateway: 'whatsapp', status: 'delivered', time: '10 mins ago' },
    { id: 'msg-3', recipient: 'Sajid Islam', phone: '01511223344', content: 'Big Discount! Get 10% off on all products this weekend. Visit My Shop!', gateway: 'sms', status: 'delivered', time: '1 hour ago' },
    { id: 'msg-4', recipient: 'Kamal Uddin', phone: '01933445566', content: 'Dear Kamal Uddin, you have a pending due of 450 BDT at My Shop.', gateway: 'sms', status: 'failed', time: '2 hours ago' }
  ]);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onSaveSettings({
        ...settings,
        waGatewayType: waType,
        waToken: waToken,
        waInstanceId: waInstanceId,
        meta_phone_number_id: metaPhoneNumberId,
        meta_access_token: metaAccessToken,
        meta_waba_id: metaWabaId,
        baileys_phone: baileysPhone,
        smsGatewayType: smsType,
        smsApiKey: smsApiKey,
        smsSenderId: smsSenderId,
        smsEndpoint: smsEndpoint,
        httpsms_status: httpSmsStatus,
        saleTemplate: saleTemplate,
        dueTemplate: dueTemplate,
        globalTemplateEn: globalTemplateEn,
        globalTemplateBn: globalTemplateBn,
        zender_whatsapp_device_id: zenderDeviceId || zenderWaDeviceId,
        zender_sms_device_id: zenderSmsDeviceId,
        whatsapp_status: whatsappStatus,
        sms_status: smsStatus,
        whatsapp_enabled: whatsappEnabled,
        sms_enabled: smsEnabled,
        default_route: defaultRoute,
        zender_endpoint_url: zenderEndpointUrl,
        zender_api_key: zenderApiKey,
        zender_device_id: zenderDeviceId || zenderWaDeviceId,
        defaultCountryCode: defaultCountryCode,
        defaultCountryName: defaultCountryName,
      });
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  const handleToggleCustomer = (id: string) => {
    if (selectedCustomers.includes(id)) {
      setSelectedCustomers(prev => prev.filter(item => item !== id));
    } else {
      setSelectedCustomers(prev => [...prev, id]);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;

    let targets: any[] = [];
    if (broadcastTarget === 'all') {
      targets = customers;
    } else if (broadcastTarget === 'due') {
      targets = customers.filter(c => (c.currentDue || 0) > 0);
    } else {
      targets = customers.filter(c => selectedCustomers.includes(c.id));
    }

    if (targets.length === 0) {
      setBroadcastStatus({
        success: 0,
        failed: 0,
        message: 'No recipients selected. Please select customers to send.'
      } as any);
      return;
    }

    setIsSending(true);
    setBroadcastStatus(null);

    let successfulCount = 0;
    let failedCount = 0;
    const newLogs: any[] = [];

    // Send broadcast sequentially or via Promise.all
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const parsedMessage = broadcastMessage.replace(/{{customerName}}/g, t.name || 'Customer');
      
      try {
        const response = await fetch('/api/gateways/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gatewayConfig: {
              default_route: broadcastMethod,
              smsGatewayType: smsType,
              smsApiKey: smsApiKey,
              smsSenderId: smsSenderId,
              smsEndpoint: smsEndpoint,
              zender_whatsapp_device_id: zenderDeviceId || zenderWaDeviceId || settings.zender_whatsapp_device_id,
              zender_sms_device_id: smsSenderId || settings.smsSenderId,
              zender_api_key: zenderApiKey || waLinkSecret || settings.zender_api_key || settings.smsApiKey || settings.waToken,
              endpoint_url: zenderEndpointUrl || smsEndpoint || settings.zender_endpoint_url
            },
            sale: {
              customerPhone: t.phone,
              message: parsedMessage
            }
          })
        });

        if (response.ok) {
          successfulCount++;
          newLogs.push({
            id: `msg-bcast-${Date.now()}-${i}`,
            recipient: t.name || 'Anonymous',
            phone: t.phone || '',
            content: parsedMessage,
            gateway: broadcastMethod,
            status: 'delivered' as const,
            time: 'Just now'
          });
        } else {
          failedCount++;
          let errorInfo = 'Delivery gateway rejected payload';
          try {
             const j = await response.json();
             if (j.error) errorInfo = j.error;
          } catch(e) {}
          
          if (i === 0) {
             setBroadcastStatus(prev => prev ? prev : ({
                success: 0,
                failed: targets.length,
                message: `Gateway Error: ${errorInfo}`
             } as any));
             break; // Stop bulk loop if gateway fundamentally rejects it
          }

          newLogs.push({
            id: `msg-bcast-${Date.now()}-${i}`,
            recipient: t.name || 'Anonymous',
            phone: t.phone || '',
            content: parsedMessage,
            gateway: broadcastMethod,
            status: 'failed' as const,
            time: 'Just now'
          });
        }
      } catch (e: any) {
        failedCount++;
        if (i === 0) {
             setBroadcastStatus(prev => prev ? prev : ({
                success: 0,
                failed: targets.length,
                message: `Network Error: ${e?.message}`
             } as any));
             break; // Stop bulk loop
        }
      }
    }

    setIsSending(false);
    setBroadcastStatus(prev => prev ? prev : {
      success: successfulCount,
      failed: failedCount
    } as any);

    setLogs(prev => [...newLogs, ...prev]);
    if (successfulCount > 0) {
      setBroadcastMessage('');
      setSelectedCustomers([]);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  return (
    <div id="messaging-gateway-view" className="w-full bg-slate-50/40 dark:bg-slate-950 p-1 md:p-4 rounded-3xl">
      {/* Dynamic Upper Stat Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/85 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Total Customers</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{customers.length}</span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/85 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Total Logs</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{logs.length} Sent</span>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Primary Container Layout */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-[2.5rem] shadow-sm overflow-hidden min-h-[550px] flex flex-col">
        {isTrialExpired && (
          <div className="mx-6 mt-6 p-5 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200/60 dark:border-amber-900/40 rounded-2xl flex items-start gap-4 shadow-sm animate-fade-in">
            <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {settings.systemLanguage === 'bn' ? 'হোয়াটসঅ্যাপ মেসেজিং লক করা আছে' : 'WhatsApp Messaging Service Locked'}
              </h4>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium leading-relaxed">
                {settings.systemLanguage === 'bn' 
                  ? 'আপনার ৯০ দিনের ফ্রি ট্রায়াল মেয়াদ শেষ হয়েছে। স্বয়ংক্রিয় হোয়াটসঅ্যাপ সার্ভিস ব্যবহার করতে অনুগ্রহ করে আপনার সাবস্ক্রিপশন প্ল্যান আপডেট করুন।'
                  : 'Your 90-day free trial period has expired. To continue using automated WhatsApp messaging services, please upgrade your subscription plan.'}
              </p>

            </div>
          </div>
        )}

        {/* Navigation Tabs Header */}
        <div className="px-6 pt-6 pb-2 border-b border-gray-100 dark:border-slate-850 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none">Gateway Preferences</h2>
              <p className="text-[11px] text-gray-500 font-medium mt-1">Configure automated communication endpoints</p>
            </div>
          </div>
          
          <div className="flex gap-1.5 p-1 bg-gray-100/70 dark:bg-slate-800 rounded-xl">
            {[
              { id: 'config', label: 'Gateways', icon: Settings },
              { id: 'templates', label: 'Templates', icon: MessageSquare },
              { id: 'broadcast', label: 'Bulk Composer', icon: Send },
              { id: 'logs', label: 'Delivery Logs', icon: FileText },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as any);
                  setBroadcastStatus(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeSubTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-100 dark:border-slate-800/50 scale-102'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Contents Frame */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {activeSubTab === 'config' && (
              <motion.div
                key="config-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                 {/* Default Country Code Setting Panel */}
                <div className="bg-gradient-to-r from-indigo-50/50 to-blue-50/50 dark:from-indigo-950/20 dark:to-blue-950/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-950 dark:text-gray-100 flex items-center gap-2">
                      🌍 Default Customer Country & Country Code
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                      প্রবাসী বা বিদেশি কাস্টমারদের জন্য স্বয়ংক্রিয় কান্ট্রি কোড প্রিফিক্স (যেমন: সৌদি আরব +966, দুবাই +971, বাংলাদেশ +880)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                      value={defaultCountryCode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDefaultCountryCode(val);
                        if (val === '880') setDefaultCountryName('Bangladesh (+880)');
                        else if (val === '966') setDefaultCountryName('Saudi Arabia (+966)');
                        else if (val === '971') setDefaultCountryName('UAE / Dubai (+971)');
                        else if (val === '974') setDefaultCountryName('Qatar (+974)');
                        else if (val === '60') setDefaultCountryName('Malaysia (+60)');
                        else if (val === '965') setDefaultCountryName('Kuwait (+965)');
                        else if (val === '968') setDefaultCountryName('Oman (+968)');
                        else if (val === '44') setDefaultCountryName('UK (+44)');
                        else if (val === '1') setDefaultCountryName('USA / Canada (+1)');
                      }}
                      className="px-3.5 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    >
                      <option value="880">🇧🇩 Bangladesh (+880)</option>
                      <option value="966">🇸🇦 Saudi Arabia (+966)</option>
                      <option value="971">🇦🇪 UAE / Dubai (+971)</option>
                      <option value="974">🇶🇦 Qatar (+974)</option>
                      <option value="60">🇲🇾 Malaysia (+60)</option>
                      <option value="965">🇰🇼 Kuwait (+965)</option>
                      <option value="968">🇴🇲 Oman (+968)</option>
                      <option value="44">🇬🇧 United Kingdom (+44)</option>
                      <option value="1">🇺🇸 USA / Canada (+1)</option>
                    </select>
                  </div>
                </div>

                {/* Primary Default Route Selection Indicator */}
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-slate-950/40 dark:to-indigo-950/20 p-6 rounded-3xl border border-indigo-100/80 dark:border-slate-800 mb-6 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/50 dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-gray-950 dark:text-gray-100">Primary Dispatch & Routing Method</h3>
                        <span className="text-[10px] bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Smart Dispatch Hub
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                        ইনভয়েস ও বকেয়া নোটিফিকেশন পাঠানোর প্রধান চ্যানেল ও অটো-ফলব্যাক মোড নির্ধারণ করুন
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      {
                        id: 'whatsapp_sms_fallback',
                        title: '🌟 স্মার্ট অটো-ফলব্যাক (WhatsApp ➔ SMS Fallback)',
                        badge: 'ডিফল্ট ও রিকমেন্ডেড',
                        badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                        desc: '১ম প্রায়োরিটি হোয়াটসঅ্যাপ। কাস্টমারের হোয়াটসঅ্যাপ না থাকলে বা কোনো কারণে ফেইল হলে স্বয়ংক্রিয়ভাবে ফোনের সিম থেকে SMS যাবে।',
                        activeBorder: 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500'
                      },
                      {
                        id: 'whatsapp',
                        title: '💬 শুধু হোয়াটসঅ্যাপ (WhatsApp Only)',
                        badge: '100% Free',
                        badgeColor: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
                        desc: 'ইনভয়েস ও রিমাইন্ডার শুধুমাত্র হোয়াটসঅ্যাপের (Baileys বা Meta API) মাধ্যমে পাঠানো হবে। সিম এসএমএস পাঠানো হবে না।',
                        activeBorder: 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500'
                      },
                      {
                        id: 'sms',
                        title: '📱 শুধু অ্যান্ড্রয়েড মোবাইল SMS (Android SMS Only)',
                        badge: 'Direct SIM SMS',
                        badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
                        desc: 'সরাসরি আপনার সংযুক্ত অ্যান্ড্রয়েড ফোনের সিম কার্ড থেকে কাস্টমারদের নম্বরে টেক্সট SMS চলে যাবে।',
                        activeBorder: 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500'
                      },
                      {
                        id: 'dual',
                        title: '🚀 ডুয়াল চ্যানেল (WhatsApp + SMS একসাথে)',
                        badge: 'Maximum Delivery',
                        badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
                        desc: 'একই সাথে ব্যাকগ্রাউন্ডে হোয়াটসঅ্যাপ এবং অ্যান্ড্রয়েড সিম SMS উভয়েই একসাথে মেসেজ ডেলিভার করবে।',
                        activeBorder: 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/30 text-purple-950 dark:text-purple-200 ring-2 ring-purple-500'
                      }
                    ].map(route => (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => {
                          setDefaultRoute(route.id as any);
                          onSaveSettings({
                            ...settings,
                            default_route: route.id,
                            whatsapp_enabled: whatsappEnabled,
                            sms_enabled: smsEnabled
                          });
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-sm ${
                          defaultRoute === route.id
                            ? route.activeBorder
                            : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-xs flex items-center gap-1.5">
                            {route.title}
                          </span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${route.badgeColor}`}>
                            {route.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                          {route.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-w-3xl mx-auto space-y-6">
                  {/* WhatsApp Hub Container */}
                  <div className="bg-slate-50/60 dark:bg-slate-950/30 p-6 rounded-3xl border border-gray-100 dark:border-slate-850 space-y-5">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm">
                          WA
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-base text-gray-900 dark:text-white">WhatsApp Messaging Gateway</h3>
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Chat & Invoices
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-medium">স্বয়ংক্রিয় হোয়াটসঅ্যাপ বার্তা প্রেরণের টেকনোলজি নির্বাচন করুন</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        {/* Independent Enable / Disable Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !whatsappEnabled;
                            setWhatsappEnabled(nextVal);
                            onSaveSettings({
                              ...settings,
                              whatsapp_enabled: nextVal,
                              whatsapp_status: nextVal ? whatsappStatus : 'disconnected'
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                            whatsappEnabled
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${whatsappEnabled ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></span>
                          {whatsappEnabled ? 'WhatsApp Active' : 'WhatsApp Disabled'}
                        </button>

                        {whatsappStatus === 'connected' ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Connected
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-400 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700">
                            Disconnected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dual Gateway Selector Tabs */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">নির্বাচন করুন</label>
                        <button
                          type="button"
                          onClick={() => setShowHelpModal(waType === 'meta_cloud' ? 'meta' : 'baileys')}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5 hover:underline cursor-pointer bg-indigo-50/50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg"
                        >
                          <HelpCircle className="w-4 h-4 text-indigo-500" /> How It Works / ব্যবহারের নিয়ম
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Option 1: Our Own Gateway */}
                        <button
                          type="button"
                          onClick={() => {
                            setWaType('baileys');
                            onSaveSettings({ ...settings, waGatewayType: 'baileys' });
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                            waType === 'baileys'
                              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-500 shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                              Our Own Gateway
                            </span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                              100% Free
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            সরাসরি কিউআর কোড স্ক্যান করে কানেক্ট করুন। কোনো প্রকার থার্ড-পার্টি সাবস্ক্রিপশন বা অতিরিক্ত খরচ নেই।
                          </p>
                        </button>

                        {/* Option 2: Official WhatsApp API */}
                        <button
                          type="button"
                          onClick={() => {
                            setWaType('meta_cloud');
                            onSaveSettings({ ...settings, waGatewayType: 'meta_cloud' });
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                            waType === 'meta_cloud'
                              ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500 shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                              Official WhatsApp API
                            </span>
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Meta Enterprise
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            Meta Business Platform-এর অফিশিয়াল ক্লাউড এপিআই। আনলিমিটেড ভেরিফাইড ব্র্যান্ড মেসেজিংয়ের জন্য।
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* 1. OUR OWN GATEWAY CONTROL PANEL */}
                    {waType === 'baileys' && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                          <div>
                            <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                              Our Own Gateway Configuration
                            </h4>
                            <p className="text-[11px] text-gray-400">Node.js ব্যাকগ্রাউন্ড সকেটের মাধ্যমে নিরবচ্ছিন্ন সংযোগ</p>
                          </div>
                          <span className={`text-[11px] uppercase font-bold px-2.5 py-1 rounded-full ${
                            whatsappStatus === 'connected' 
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}>
                            {whatsappStatus === 'connected' ? 'Connected & Active' : 'Disconnected'}
                          </span>
                        </div>

                        {whatsappStatus === 'connected' ? (
                          <div className="space-y-3">
                            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/50 rounded-2xl flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> WhatsApp সেশন সক্রিয় রয়েছে
                                </p>
                                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-mono">
                                  {baileysPhone ? `কানেক্টেড নম্বর: +${baileysPhone}` : 'সেশন প্রস্তুত এবং ব্যাকগ্রাউন্ডে সক্রিয়'}
                                </p>
                              </div>
                              <span className="p-2 bg-emerald-500/10 rounded-full text-emerald-600">
                                <CheckCircle2 className="w-6 h-6" />
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={handleUnlinkWhatsApp}
                              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              WhatsApp সেশন ডিসকানেক্ট করুন (Disconnect Session)
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                              💡 <strong>সহজ সংযোগ:</strong> নিচের বাটনে ক্লিক করে কিউআর কোডটি আপনার ফোনের WhatsApp অ্যাপ (Linked Devices) থেকে স্ক্যান করুন। কোনো বাড়তি সফটওয়্যার লাগবে না।
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2.5">
                              <button
                                type="button"
                                onClick={handleConnectWhatsApp}
                                disabled={isConnectingWa}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl text-xs text-white transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                              >
                                {isConnectingWa ? 'কিউআর তৈরি হচ্ছে...' : 'কিউআর কোড জেনারেট করুন (Generate QR)'}
                              </button>
                              <button
                                type="button"
                                onClick={handleResync}
                                disabled={isSyncing}
                                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                              >
                                Re-sync Status
                              </button>
                            </div>
                            {connectionError && (
                              <p className="text-xs text-rose-500 font-bold p-2.5 bg-rose-50 dark:bg-rose-950/20 rounded-lg">{connectionError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. OFFICIAL WHATSAPP API CONTROL PANEL */}
                    {waType === 'meta_cloud' && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                          <div>
                            <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                              Official Meta Cloud API Credentials
                            </h4>
                            <p className="text-[11px] text-gray-400">Meta Developer অ্যাকাউন্ট থেকে ক্রেডেনশিয়াল প্রদান করুন</p>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Phone Number ID *</label>
                            <input
                              type="text"
                              value={metaPhoneNumberId}
                              onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                              placeholder="e.g. 104829104810294"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Permanent Access Token *</label>
                            <div className="relative">
                              <input
                                type={showMetaToken ? "text" : "password"}
                                value={metaAccessToken}
                                onChange={(e) => setMetaAccessToken(e.target.value)}
                                placeholder="EAAG..."
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowMetaToken(!showMetaToken)}
                                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                              >
                                {showMetaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">WABA Account ID (Optional)</label>
                            <input
                              type="text"
                              value={metaWabaId}
                              onChange={(e) => setMetaWabaId(e.target.value)}
                              placeholder="e.g. 109283019283"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleConnectWhatsApp}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
                          >
                            Meta Cloud API সেটিংস সংরক্ষণ করুন
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Test Connection Section */}
                    <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-950/45 space-y-3">
                      <div>
                        <h6 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                          হোয়াটসঅ্যাপ টেস্ট মেসেজ প্রেরণ (Test Connection)
                        </h6>
                        <p className="text-[10px] text-gray-400 font-medium">আপনার গেটওয়ে সঠিকভাবে কাজ করছে কি না তা তাৎক্ষণিক পরীক্ষা করুন</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX)"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-200 transition-all shadow-inner"
                          />
                          <button
                            type="button"
                            onClick={handleSendTestMessage}
                            disabled={testSending || !testPhone}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            {testSending ? 'পাঠানো হচ্ছে...' : 'টেস্ট মেসেজ পাঠান'}
                          </button>
                        </div>

                        {testMsgStatus && (
                          <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 p-2.5 rounded-xl font-bold">
                            {testMsgStatus}
                          </p>
                        )}

                        {testMsgError && (
                          <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-2.5 rounded-xl font-bold">
                            {testMsgError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Seller SMS / Android SIM Gateway Container */}
                  <div className="bg-slate-50/60 dark:bg-slate-950/30 p-6 rounded-3xl border border-gray-100 dark:border-slate-850 space-y-5">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm">
                          SMS
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-base text-gray-900 dark:text-white">Android SIM Gateway (Seller SMS)</h3>
                            <span className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              In-House QR Pairing
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-medium">আপনার নিজস্ব অ্যান্ড্রয়েড ফোনের সিম কার্ড ব্যবহার করে সরাসরি কাস্টমারকে SMS পাঠান</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        {/* Independent Enable / Disable Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !smsEnabled;
                            setSmsEnabled(nextVal);
                            onSaveSettings({
                              ...settings,
                              sms_enabled: nextVal,
                              sms_status: nextVal ? 'active' : 'disabled',
                              httpsms_status: nextVal ? httpSmsStatus : 'disconnected'
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                            smsEnabled
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${smsEnabled ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></span>
                          {smsEnabled ? 'SMS Gateway Active' : 'SMS Gateway Disabled'}
                        </button>

                        {httpSmsStatus === 'connected' ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-200/50 dark:border-blue-800/40">
                            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span> Connected
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-400 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700">
                            Disconnected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100/60 dark:border-blue-900/30 flex items-start justify-between gap-4">
                      <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                          <span>📱</span> Seller SMS - নিজস্ব অ্যান্ড্রয়েড মোবাইল এসএমএস গেটওয়ে
                        </p>
                        <p className="text-blue-700/80 dark:text-blue-400/80 text-[11px] leading-relaxed">
                          আপনার অ্যান্ড্রয়েড ফোনে <strong>Seller SMS Gateway App</strong> চালু করে শুধু কিউআর কোডটি স্ক্যান করুন। কোনো থার্ড-পার্টি সাবস্ক্রিপশন বা কনফিগারেশন ছাড়াই সরাসরি সিম দিয়ে আনলিমিটেড SMS যাবে।
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowHelpModal('httpsms')}
                        className="text-xs text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1.5 hover:underline cursor-pointer bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 shrink-0 shadow-sm"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-blue-500" /> সেটআপ নির্দেশিকা
                      </button>
                    </div>

                    {/* QR Code Auto-Pairing Screen or Active Paired Phone Card */}
                    {httpSmsStatus === 'connected' && pairedSmsDevice ? (
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 text-xl font-bold">
                              📱
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-gray-900 dark:text-white">
                                  {pairedSmsDevice.phoneModel || 'Android Phone'}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  Live Connected
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                Android {pairedSmsDevice.androidVersion || '13+'} • ব্যাটারি: {pairedSmsDevice.battery || '100%'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleTestHttpSmsConnection}
                              disabled={isConnectingHttpSms}
                              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isConnectingHttpSms ? 'animate-spin' : ''}`} />
                              চেক স্ট্যাটাস
                            </button>
                            <button
                              type="button"
                              onClick={handleUnlinkSmsDevice}
                              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border border-rose-200 dark:border-rose-900/40 shadow-sm transition-all"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              আনলিঙ্ক / ডিসকানেক্ট
                            </button>
                          </div>
                        </div>

                        {/* SIM Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                                📶 সিম ১ (SIM Slot 1)
                              </span>
                              {pairedSmsDevice.activeSim === 1 && (
                                <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                                  Default Sender
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                              {pairedSmsDevice.sim1Number || 'Airtel / Grameenphone SIM'}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              অটোমেটিক কাস্টমার এসএমএস পাঠানোর জন্য সক্রিয়
                            </p>
                          </div>

                          {pairedSmsDevice.sim2Number && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                                  📶 সিম ২ (SIM Slot 2)
                                </span>
                                {pairedSmsDevice.activeSim === 2 && (
                                  <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                                    Default Sender
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                                {pairedSmsDevice.sim2Number}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                সেকেন্ডারি সিম স্লট
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                          {/* Left: Pairing QR Code Container */}
                          <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-gray-100 dark:border-slate-800">
                            <div className="p-3 bg-white rounded-2xl shadow-md border border-gray-100">
                              {/* Dynamic Stable Pairing QR Code */}
                              <QRCode
                                value={JSON.stringify({
                                  app: 'SellerSMS',
                                  serverUrl: typeof window !== 'undefined' ? window.location.origin : '',
                                  merchantId: shopId || 'default-tenant',
                                  action: 'pair'
                                })}
                                size={180}
                                level="M"
                              />
                            </div>
                            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                              স্ক্যানের জন্য প্রস্তুত (Static QR)
                            </div>
                          </div>

                          {/* Right: Step-by-Step Scan Instructions */}
                          <div className="md:col-span-7 space-y-4">
                            <div>
                              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                                1-Click Fast Auto-Pairing
                              </span>
                              <h4 className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                                Seller SMS অ্যাপ দিয়ে কিউআর কোড স্ক্যান করুন
                              </h4>
                            </div>

                            <ol className="space-y-2.5 text-xs text-gray-600 dark:text-slate-300 font-medium">
                              <li className="flex items-start gap-2.5">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">
                                  ১
                                </span>
                                <span>আপনার অ্যান্ড্রয়েড ফোনে <strong>Seller SMS Gateway</strong> অ্যাপটি চালু করুন।</span>
                              </li>
                              <li className="flex items-start gap-2.5">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">
                                  ২
                                </span>
                                <span>অ্যাপের <strong>"Scan QR to Pair"</strong> বাটনে ট্যাপ করে এই কিউআর কোডটি স্ক্যান করুন।</span>
                              </li>
                              <li className="flex items-start gap-2.5">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">
                                  ৩
                                </span>
                                <span>মুহূর্তের মধ্যে ফোনটি সংযুক্ত হয়ে যাবে এবং কাস্টমারদের আনলিমিটেড এসএমএস পাঠানো শুরু করবে।</span>
                              </li>
                            </ol>

                            <div className="pt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleTestHttpSmsConnection}
                                disabled={isConnectingHttpSms}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isConnectingHttpSms ? 'animate-spin' : ''}`} />
                                রিফ্রেশ / পেয়ার স্ট্যাটাস চেক
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Test SMS Section */}
                    <div className="bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100/50 dark:border-blue-950/45 space-y-3">
                      <div>
                        <h6 className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                          মোবাইল এসএমএস টেস্ট (Send Test SMS)
                        </h6>
                        <p className="text-[10px] text-gray-400 font-medium">আপনার ফোন থেকে কাস্টমারের নম্বরে সরাসরি এসএমএস পাঠানো পরীক্ষা করুন</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={httpSmsTestPhone}
                            onChange={(e) => setHttpSmsTestPhone(e.target.value)}
                            placeholder="মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX বা +88017XXXXXXXX)"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200 transition-all shadow-inner"
                          />
                          <button
                            type="button"
                            onClick={handleSendHttpSmsTestMessage}
                            disabled={httpSmsTestSending || !httpSmsTestPhone}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            {httpSmsTestSending ? 'পাঠানো হচ্ছে...' : 'টেস্ট এসএমএস পাঠান'}
                          </button>
                        </div>

                        {httpSmsTestStatus && (
                          <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 p-2.5 rounded-xl font-bold">
                            {httpSmsTestStatus}
                          </p>
                        )}

                        {httpSmsTestError && (
                          <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-2.5 rounded-xl font-bold">
                            {httpSmsTestError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>


              </motion.div>
            )}

            {activeSubTab === 'templates' && (
              <motion.div
                key="templates-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="bg-slate-50/60 dark:bg-slate-950/30 p-5 rounded-2xl border border-gray-100 dark:border-slate-850">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Global Message Templates
                  </h3>
                  <p className="text-[11px] text-gray-400 font-semibold mb-6">These global notification templates are sent automatically for general customer communication and receipts.</p>

                  {/* Responsive side-by-side layout matching screenshot */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">GLOBAL TEMPLATE (ENGLISH)</label>
                        <span className="text-[9px] font-bold text-indigo-500">Variables: &#123;&#123;customerName&#125;&#125;, &#123;&#123;shopName&#125;&#125;, &#123;&#123;invoiceId&#125;&#125;, &#123;&#123;currencySymbol&#125;&#125;, &#123;&#123;totalAmount&#125;&#125;</span>
                      </div>
                      <textarea
                        value={globalTemplateEn}
                        onChange={(e) => setGlobalTemplateEn(e.target.value)}
                        placeholder="Hello *{{customerName}}*, thank you for shopping at *{{shopName}}*!..."
                        className="w-full px-4 py-3 min-h-[105px] rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-mono leading-relaxed focus:ring-1 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">GLOBAL TEMPLATE (BENGALI)</label>
                        <span className="text-[9px] font-bold text-indigo-500">Variables: &#123;&#123;customerName&#125;&#125;, &#123;&#123;shopName&#125;&#125;, &#123;&#123;invoiceId&#125;&#125;, &#123;&#123;currencySymbol&#125;&#125;, &#123;&#123;totalAmount&#125;&#125;</span>
                      </div>
                      <textarea
                        value={globalTemplateBn}
                        onChange={(e) => setGlobalTemplateBn(e.target.value)}
                        placeholder="প্রিয় *{{customerName}}*, *{{shopName}}*-এ কেনাকাটা করার জন্য ধন্যবাদ!..."
                        className="w-full px-4 py-3 min-h-[105px] rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-mono leading-relaxed focus:ring-1 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-1 pt-6 border-t border-gray-100 dark:border-slate-850">
                    <MessageSquare className="w-4 h-4 text-teal-500" />
                    Additional System Message Templates
                  </h3>
                  <p className="text-[11px] text-gray-400 font-semibold mb-4">Define alternative formatting structures for custom actions and notifications.</p>

                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Receipt Sales Template</label>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Variables available: &#123;&#123;customerName&#125;&#125;, &#123;&#123;subtotal&#125;&#125;</span>
                      </div>
                      <textarea
                        value={saleTemplate}
                        onChange={(e) => setSaleTemplate(e.target.value)}
                        placeholder="Customize dynamic invoice confirmation..."
                        className="w-full px-4 py-3 min-h-[85px] rounded-xl border border-gray-200 dark:border-slate-800 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Due Reminder Template</label>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Variables available: &#123;&#123;customerName&#125;&#125;, &#123;&#123;dueAmount&#125;&#125;</span>
                      </div>
                      <textarea
                        value={dueTemplate}
                        onChange={(e) => setDueTemplate(e.target.value)}
                        placeholder="Customize due balance alerts..."
                        className="w-full px-4 py-3 min-h-[85px] rounded-xl border border-gray-200 dark:border-slate-800 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleSave}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition-all"
                  >
                    Save Templates
                  </button>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'broadcast' && (
              <motion.div
                key="broadcast-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Composer */}
                <div className="md:col-span-2 space-y-5">
                  <div className="bg-slate-50/60 dark:bg-slate-950/30 p-5 rounded-2xl border border-gray-100 dark:border-slate-850 space-y-4">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      <Send className="w-4 h-4 text-indigo-500" />
                      Bulk Message Composer
                    </h3>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Target Audience</label>
                      <select
                        value={broadcastTarget}
                        onChange={(e) => setBroadcastTarget(e.target.value as any)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="all">All Registered Customers ({customers.length})</option>
                        <option value="due">Due Customers Only ({customers.filter(c => (c.currentDue || 0) > 0).length})</option>
                        <option value="selected">Custom Selection ({selectedCustomers.length})</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5 ml-0.5">Broadcast Content</label>
                      <textarea
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Write something engaging... Tip: use {{customerName}} for personalized name lookup."
                        className="w-full px-4 py-3 min-h-[160px] rounded-2xl border-2 border-gray-100 dark:border-slate-800 text-sm font-semibold focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 outline-none bg-gray-50/50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-all shadow-sm placeholder:text-gray-300 dark:placeholder:text-gray-600 resize-y"
                      />
                    </div>
                  </div>

                  {broadcastStatus && (
                    <div className={`p-4 ${broadcastStatus.message ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-emerald-50 border-emerald-100 text-emerald-800'} dark:bg-opacity-20 rounded-2xl flex items-center gap-3`}>
                      {broadcastStatus.message ? <X className="w-5 h-5 flex-shrink-0 text-rose-500" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500 animate-pulse" />}
                      <div>
                        <p className="font-bold text-sm">{broadcastStatus.message ? 'Action Failed' : 'Campaign Broadcast Completed!'}</p>
                        <p className="text-xs opacity-90 mt-0.5">{broadcastStatus.message || `Dispatched ${broadcastStatus.success} messages successfully via ${broadcastMethod.toUpperCase()}. ${broadcastStatus.failed > 0 ? `(${broadcastStatus.failed} failed)` : ''}`}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={handleSendBroadcast}
                      disabled={isSending || !broadcastMessage.trim()}
                      className="px-8 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-sm shadow-xl shadow-gray-900/10 hover:shadow-gray-900/20 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {isSending ? 'Transmitting payload...' : 'Dispatch Campaign'}
                    </button>
                  </div>
                </div>

                {/* Audience Selection list if custom selected */}
                <div className="bg-slate-50/60 dark:bg-slate-950/30 p-5 rounded-2xl border border-gray-100 dark:border-slate-850 flex flex-col h-[350px]">
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-2">Recipient Selector</h4>
                  
                  <div className="relative mb-3 flex-shrink-0">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search name/phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {filteredCustomers.length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-400">No matching customers</div>
                    ) : (
                      filteredCustomers.map(c => {
                        const isChecked = selectedCustomers.includes(c.id);
                        const isSelectMode = broadcastTarget === 'selected';
                        return (
                          <div 
                            key={c.id}
                            onClick={() => isSelectMode && handleToggleCustomer(c.id)}
                            className={`p-2.5 rounded-xl border transition-all text-left flex items-center justify-between ${
                              !isSelectMode 
                                ? 'bg-white/40 border-gray-100/50 opacity-60 dark:bg-slate-900/40 dark:border-slate-850'
                                : isChecked
                                  ? 'bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400'
                                  : 'bg-white border-gray-150 hover:bg-gray-50 cursor-pointer dark:bg-slate-900 dark:border-slate-800 text-gray-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="font-bold text-xs truncate">{c.name || 'Anonymous'}</p>
                              <p className="text-[10px] font-mono text-gray-400 truncate">{c.phone || 'No phone'}</p>
                            </div>

                            {isSelectMode && (
                              <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                                isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 bg-white dark:border-slate-700'
                              }`}>
                                {isChecked && <Check className="w-3 h-3" />}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'logs' && (
              <motion.div
                key="logs-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="bg-slate-50/60 dark:bg-slate-950/30 rounded-2xl border border-gray-100 dark:border-slate-850 p-2 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800/80">
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Recipient</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Phone Number</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Gateway</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Message</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Time</th>
                        <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/40 dark:divide-slate-800/20">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/30 dark:hover:bg-slate-900/30">
                          <td className="p-3 font-bold text-gray-800 dark:text-slate-250 truncate max-w-[120px]">{log.recipient}</td>
                          <td className="p-3 font-mono text-gray-500 dark:text-slate-450">{log.phone}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${
                              log.gateway === 'whatsapp'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                : 'bg-blue-50 text-blue-600 border-blue-100/70 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
                            }`}>
                              {log.gateway}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-gray-600 dark:text-slate-350 truncate max-w-[280px]" title={log.content}>
                            {log.content}
                          </td>
                          <td className="p-3 text-gray-400 font-semibold">{log.time}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                              log.status === 'delivered'
                                ? 'text-emerald-600 dark:text-emerald-450'
                                : log.status === 'failed'
                                  ? 'text-rose-600 dark:text-rose-450'
                                  : 'text-amber-600 dark:text-amber-450'
                            }`}>
                              {log.status === 'delivered' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* How to Use Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-500" />
                {showHelpModal === 'baileys' 
                  ? 'Our Own Gateway — ব্যবহার নির্দেশিকা' 
                  : showHelpModal === 'meta' 
                  ? 'Official WhatsApp API — কনফিগার নির্দেশিকা'
                  : 'Android SMS Gateway (httpSMS) — ব্যবহার ও সেটআপ নির্দেশিকা'}
              </h3>
              <button onClick={() => setShowHelpModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-gray-700 dark:text-slate-300">
              {showHelpModal === 'baileys' && (
                <>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/50">
                    <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm mb-1">
                      ✨ Our Own Gateway (100% Free & Self-Hosted)
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-400">
                      কোনো থার্ড-পার্টি সার্ভিস বা অতিরিক্ত মাসিক খরচ ছাড়াই আপনার যেকোনো সাধারণ বা বিজনেস হোয়াটসঅ্যাপ নম্বর সরাসরি যুক্ত করতে পারবেন।
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">কিউআর কোড দিয়ে সংযোগ প্রক্রিয়া:</h4>
                    <ol className="list-decimal pl-4 space-y-2 font-medium">
                      <li><strong>কিউআর কোড জেনারেট করুন</strong>: ড্যাশবোর্ডে <em>"কিউআর কোড জেনারেট করুন"</em> বাটনে ক্লিক করুন।</li>
                      <li><strong>WhatsApp অ্যাপ খুলুন</strong>: আপনার স্মার্টফোনে WhatsApp অ্যাপ ওপেন করুন।</li>
                      <li><strong>Linked Devices-এ যান</strong>: উপরে ৩-ডট মেনু বা সেটিংস থেকে <em>Linked Devices (সংযুক্ত ডিভাইস)</em> অপশনে যান।</li>
                      <li><strong>Link a Device চাপুন</strong>: আপনার ফোনের ক্যামেরা দিয়ে স্ক্রিনের কিউআর কোডটি স্ক্যান করুন।</li>
                      <li><strong>স্বয়ংক্রিয় সংযোগ</strong>: স্ক্যান সম্পূর্ণ হওয়ামাত্র সেশনটি ব্যাকএন্ডে ২৪/৭ সকেটে সংরক্ষিত থাকবে।</li>
                    </ol>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200/50 text-blue-800 dark:text-blue-300">
                    <strong>💡 সুবিধা:</strong> এটি সরাসরি ব্যাকএন্ড সার্ভারে সকেট চালু রাখে, তাই POS সেল বা বকেয়া রিমাইন্ডার মেসেজ স্বয়ংক্রিয়ভাবে সেন্ড হবে।
                  </div>
                </>
              )}

              {showHelpModal === 'meta' && (
                <>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/50">
                    <p className="font-bold text-indigo-800 dark:text-indigo-300 text-sm mb-1">
                      🏢 Official WhatsApp Cloud API (Meta Enterprise)
                    </p>
                    <p className="text-indigo-700 dark:text-indigo-400">
                      বড় প্রতিষ্ঠান এবং আনলিমিটেড ভেরিফাইড ব্র্যান্ড মেসেজিংয়ের জন্য মেটার অফিসিয়াল ক্লাউড এপিআই ব্যবহার করুন।
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">সেটআপ করার নিয়ম:</h4>
                    <ol className="list-decimal pl-4 space-y-2 font-medium">
                      <li><strong>Meta Developer একাউন্ট</strong>: developers.facebook.com এ গিয়ে একটি App তৈরি করুন।</li>
                      <li><strong>WhatsApp প্রোডাক্ট যুক্ত করুন</strong>: অ্যাপের ড্যাশবোর্ড থেকে WhatsApp সিলেক্ট করুন।</li>
                      <li><strong>Phone Number ID সংগ্রহ করুন</strong>: Getting Started ট্যাব থেকে <em>Phone Number ID</em> কপি করে পেস্ট করুন।</li>
                      <li><strong>System User Access Token নিন</strong>: Business Settings &gt; System Users থেকে <em>Permanent Access Token</em> তৈরি করে এখানে দিন।</li>
                      <li><strong>সংরক্ষণ করুন</strong>: সেটিংস সংরক্ষণ বাটনে ক্লিক করলে তাৎক্ষণিক গেটওয়ে সক্রিয় হয়ে যাবে।</li>
                    </ol>
                  </div>
                </>
              )}

              {showHelpModal === 'httpsms' && (
                <>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200/50">
                    <p className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-1">
                      📱 Seller SMS Gateway (ইন-হাউস কিউআর পেয়ারিং)
                    </p>
                    <p className="text-blue-700 dark:text-blue-400">
                      আপনার নিজস্ব অ্যান্ড্রয়েড ফোনের সিম কার্ড ও এসএমএস প্যাক ব্যবহার করে সম্পূর্ণ বিনামূল্যে সরাসরি কাস্টমারদের মোবাইলে এসএমএস পাঠান।
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">সহজ ৩ ধাপে সেটআপ:</h4>
                    <ol className="list-decimal pl-4 space-y-2 font-medium">
                      <li><strong>Seller SMS অ্যাপ চালু করুন</strong>: আপনার ফোনে Seller SMS Gateway ক্লায়েন্ট অ্যাপটি ওপেন করুন।</li>
                      <li><strong>কিউআর কোড স্ক্যান</strong>: অ্যাপের "Scan QR to Pair" বাটনে ট্যাপ করে ড্যাশবোর্ডের কিউআর কোডটি স্ক্যান করুন।</li>
                      <li><strong>স্বয়ংক্রিয় পেয়ারিং</strong>: কোনো API Key বা ম্যানুয়াল সেটিংস ছাড়াই ফোনটি তৎক্ষণাৎ ড্যাশবোর্ডের সাথে সংযুক্ত হয়ে যাবে।</li>
                      <li><strong>টেস্ট এসএমএস পাঠান</strong>: নিচের 'মোবাইল এসএমএস টেস্ট' বক্সে নম্বর দিয়ে সরাসরি টেস্ট এসএমএস পাঠিয়ে যাচাই করুন।</li>
                    </ol>
                  </div>

                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/50 text-emerald-800 dark:text-emerald-300">
                    <strong>💡 সুবিধা:</strong> আপনার ফোনে যেকোনো লোকাল মোবাইল অপারেটরের (যেমন: GP, Robi, Banglalink, Teletalk) আনলিমিটেড বা বান্ডেল এসএমএস থাকলে প্রতি কাস্টমারকে স্বয়ংক্রিয় ইনভয়েস ও বকেয়া রিমাইন্ডার পৌঁছে যাবে।
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHelpModal(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                বুঝেছি, বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800 flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-500" />
                Link WhatsApp Device
              </h3>
              <button onClick={() => setShowQrModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center justify-center" id="qrcode">
              {qrString ? (
                <QRCode 
                  value={qrString}
                  size={256}
                  level="H"
                  className="bg-white p-2 rounded-xl"
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[320px] text-gray-400">
                  <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-sm font-semibold">Generating secure QR code...</p>
                </div>
              )}
              <p className="text-xs text-gray-500 font-medium text-center mt-6">
                Open WhatsApp on your phone &bull; Settings &bull; Linked Devices &bull; Link a Device &bull; Scan the QR above
              </p>
              
              {qrCountdown !== null && (
                <div className="mt-4 text-center">
                  <p className="text-red-600 font-bold text-lg animate-pulse">
                    ⏳ {qrCountdown} সেকেন্ডের মধ্যে স্ক্যান করুন!
                  </p>
                  <p className="text-sm text-gray-600 mt-2 font-medium">
                    আপনার মোবাইলের WhatsApp &gt; Linked Devices থেকে দ্রুত স্ক্যান করুন। মেয়াদ শেষ হলে এটি স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে।
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Modal */}
      <AnimatePresence>
        {showSuccessNotification && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[90%] mx-auto bg-green-500 text-white p-5 rounded-2xl shadow-xl shadow-green-500/20 text-center"
          >
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
            </div>
            <h4 className="font-bold text-lg mb-1">কানেকশন সফল!</h4>
            <p className="text-sm text-green-100 leading-relaxed max-w-[280px] mx-auto">
              আপনার হোয়াটসঅ্যাপ নম্বরটি সফলভাবে কানেক্ট হয়েছে।
            </p>
            <p className="text-xs text-green-200 mt-3 border-t border-green-400/30 pt-3 max-w-[280px] mx-auto">
              {successMessageDetails}
            </p>
            <button 
              onClick={() => setShowSuccessNotification(false)}
              className="absolute top-2 right-2 p-2 text-green-100 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

