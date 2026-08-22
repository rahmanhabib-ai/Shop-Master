import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, limit, setDoc } from '../firebase';
import { User } from 'firebase/auth';
import { MessageSquare, Link as LinkIcon, Image as ImageIcon, Send, Clock, Trash2, Heart, MessageCircle, MoreVertical, Edit2, ShieldAlert, Search, Filter, Tag, Pin, ChevronLeft, ChevronRight, X, Maximize2, Minimize2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export type ReactionType = 'like' | 'love' | 'haha' | 'sad';

export interface ReactionRecord {
  [userId: string]: ReactionType;
}

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  sad: '😢',
};

interface Comment {
  id: string;
  text: string;
  merchantName: string;
  merchantId: string;
  createdAt: number;
  parentId?: string; // For replies
  reactions?: ReactionRecord;
}

interface Post {
  id: string;
  text: string;
  merchantName: string;
  shopName: string;
  merchantId: string;
  shopId: string;
  createdAt: any;
  likes?: number;
  reactions?: ReactionRecord;
  isAd?: boolean;
  comments?: Comment[];
  attachmentUrl?: string;
  tag?: string;
  isPinned?: boolean;
}

const TAGS = ['Discussion', 'Tips', 'Q&A', 'New Product', 'Urgent Help'];

interface CommunityHubPageProps {
  user: User;
  shopSettings: any;
}

// Helper to extract URLs
const extractIframeSrc = (text: string) => {
  const match = text.match(/<iframe.*?src=["'](.*?)["']/i);
  return match ? match[1] : null;
};

const extractUrls = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return (text.match(urlRegex) || []) as string[];
};

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const isImageUrl = (url: string) => {
  const urlWithoutQuery = url.split('?')[0];
  if (/\.(jpeg|jpg|gif|png|webp|svg|bmp|avif)$/i.test(urlWithoutQuery)) return true;
  if (url.includes('scontent') && url.includes('fbcdn.net')) return true;
  if (url.includes('fbcdn.net/v/')) return true;
  if (url.includes('googleusercontent.com')) return true;
  if (url.includes('imgur.com') || url.includes('drive.google.com')) return true;
  if (url.match(/images?\/.*|photos?\/.*|\/p\/.*|static.*\/images?.*/i)) return true;
  return false;
};

const renderMentions = (text: string) => {
  return text.split(/(@\S+)/g).map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="text-indigo-600 dark:text-indigo-400 font-semibold">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
};

const ReactionPicker = ({ onSelect }: { onSelect: (r: ReactionType) => void }) => {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-full flex gap-1 p-1.5 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all pointer-events-none group-hover:pointer-events-auto z-50">
      {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map(r => (
        <button
          key={r}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(r); }}
          className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-lg hover:scale-125 transition-transform"
          title={r}
        >
          {REACTION_EMOJIS[r]}
        </button>
      ))}
    </div>
  );
};

const LinkPreview: React.FC<{ url: string; className?: string; onClickImage?: () => void }> = ({ url, className = "mt-3", onClickImage }) => {
  const ytId = getYoutubeId(url);
  if (ytId) {
    return (
      <div className={`${className} relative w-full pt-[56.25%] rounded-xl overflow-hidden shadow-md`}>
        <iframe
          className="absolute top-0 left-0 w-full h-full border-0"
          src={`https://www.youtube.com/embed/${ytId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    );
  }

  let finalUrl = url;
  if (finalUrl.includes('facebook.com') && (finalUrl.includes('/posts/') || finalUrl.includes('/videos/') || finalUrl.includes('/photo'))) {
    if (!finalUrl.includes('plugins/post.php') && !finalUrl.includes('plugins/video.php')) {
        const type = finalUrl.includes('/videos/') ? 'video.php' : 'post.php';
        finalUrl = `https://www.facebook.com/plugins/${type}?href=${encodeURIComponent(finalUrl)}&show_text=true&width=500`;
    }
  }

  if (finalUrl.includes('facebook.com/plugins/')) {
    return (
      <div className={`${className} relative w-full overflow-hidden shadow-md rounded-xl flex justify-center bg-slate-50 dark:bg-slate-900/50 pt-4`}>
        <iframe
          src={finalUrl}
          width="100%"
          height="500"
          style={{ border: 'none', overflow: 'hidden', maxWidth: '500px' }}
          allowFullScreen={true}
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        ></iframe>
      </div>
    );
  }

  if (isImageUrl(finalUrl)) {
    return (
      <div 
        onClick={onClickImage} 
        className={`${className} rounded-xl overflow-hidden shadow-md max-h-96 cursor-pointer group relative`}
      >
        <img 
          src={finalUrl} 
          alt="Shared content" 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
        />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/35 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="text-white bg-black/60 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 font-sans">
            🔍 View / দেখতে ক্লিক করুন
          </span>
        </div>
      </div>
    );
  }

  // Fallback for normal links
  return (
    <a href={finalUrl} target="_blank" rel="noopener noreferrer" className={`${className === 'mt-3' ? 'mt-2' : ''} flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-indigo-600 hover:underline break-all text-sm group h-full`}>
      <LinkIcon className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-indigo-600" />
      <span className="truncate line-clamp-2 whitespace-normal break-all">{finalUrl}</span>
    </a>
  );
};

const CommentNode: React.FC<{
  comment: Comment;
  allComments: Comment[];
  post: Post;
  user: User;
  depth?: number;
  onReply: (commentId: string, merchantName: string) => void;
  onDelete: (postId: string, commentId: string) => void;
  onReact: (postId: string, commentId: string, reaction: ReactionType) => void;
  onEdit: (postId: string, commentId: string, text: string) => void;
  onViewProfile: (merchantId: string) => void;
}> = ({
  comment,
  allComments,
  post,
  user,
  depth = 0,
  onReply,
  onDelete,
  onReact,
  onEdit,
  onViewProfile
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  useEffect(() => {
    if (!showReactionPicker) return;
    const handleOutsideClick = () => setShowReactionPicker(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showReactionPicker]);
  
  const replies = allComments.filter(c => c.parentId === comment.id);
  const isOwner = comment.merchantId === user.uid;
  const userReaction = comment.reactions?.[user.uid];
  
  const uniqueReactions = Array.from(new Set(Object.values(comment.reactions || {}))) as ReactionType[];
  const totalReactions = Object.keys(comment.reactions || {}).length;

  return (
    <div className={`space-y-3 ${depth > 0 ? 'ml-6 sm:ml-10 border-l-2 border-slate-100 dark:border-slate-800/50 pl-3 sm:pl-4 mt-3' : ''}`}>
      <div className="flex gap-3 group/comment">
        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0 mt-0.5">
          {comment.merchantName[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl rounded-tl-sm px-4 py-3 relative">
            <div className="flex items-baseline justify-between gap-2">
              <button onClick={() => onViewProfile(comment.merchantId)} className="font-bold text-gray-900 dark:text-gray-100 text-[13px] hover:underline hover:text-indigo-600 dark:hover:text-indigo-400">{comment.merchantName}</button>
              {isOwner && (
                <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                  {isDeleting ? (
                    <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-lg">
                      <button onClick={() => setIsDeleting(false)} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">No</button>
                      <button onClick={() => onDelete(post.id, comment.id)} className="text-[10px] font-bold text-rose-600 hover:text-rose-800 dark:hover:text-rose-400">Yes</button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => { setIsEditing(true); setEditText(comment.text); }} className="text-slate-400 hover:text-indigo-600 p-1">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => setIsDeleting(true)} className="text-slate-400 hover:text-rose-500 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-[13px] focus:ring-2 focus:ring-indigo-500 outline-none min-h-[60px]"
                />
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setIsEditing(false)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
                  <button onClick={() => { onEdit(post.id, comment.id, editText); setIsEditing(false); }} className="text-[11px] font-bold text-white bg-indigo-600 px-3 py-1 rounded hover:bg-indigo-700">Save</button>
                </div>
              </div>
            ) : (
              <p className="text-gray-700 dark:text-gray-300 text-[13px] mt-0.5 whitespace-pre-wrap word-break break-words">
                {renderMentions(comment.text)}
              </p>
            )}
            
            {totalReactions > 0 && !isEditing && (
              <div className="absolute -bottom-2 right-2 flex items-center gap-1 bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5 text-[10px] z-10">
                {uniqueReactions.slice(0, 3).map(r => REACTION_EMOJIS[r])}
                <span className="font-semibold text-slate-500 ml-0.5">{totalReactions}</span>
              </div>
            )}
          </div>
          
          {!isEditing && (
            <div className="flex items-center gap-4 mt-1.5 ml-2">
              <span className="text-[11px] font-medium text-slate-400">
                {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
              </span>
              <div className="relative inline-block">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowReactionPicker(!showReactionPicker);
                  }}
                  className={`text-[11px] font-bold transition-colors ${userReaction ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
                >
                   {userReaction ? REACTION_EMOJIS[userReaction] + ' ' + (userReaction.charAt(0).toUpperCase() + userReaction.slice(1)) : 'React'}
                </button>
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-full flex gap-1 p-1.5 transition-all z-50 ${showReactionPicker ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                  {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map(r => (
                    <button
                      key={r}
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        onReact(post.id, comment.id, r); 
                        setShowReactionPicker(false); 
                      }}
                      className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-lg hover:scale-125 transition-transform"
                      title={r}
                    >
                      {REACTION_EMOJIS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => onReply(comment.id, comment.merchantName)} className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
      
      {replies.length > 0 && (
        <div className="space-y-3 mt-2">
          {replies.map(reply => (
            <CommentNode
              key={reply.id}
              comment={reply}
              allComments={allComments}
              post={post}
              user={user}
              depth={depth + 1}
              onReply={onReply}
              onDelete={onDelete}
              onReact={onReact}
              onEdit={onEdit}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const BAD_WORDS_PATTERN = /\b(fuck|shit|bitch|asshole|porn|sex|bastard|cunt|dick|pussy|nude|naked|sexual|choda|chodi|chud|khanki|magi|gandu|harami|haramsala|sala|bhal|gand)\b|চোদ|চুদি|চুদ|খানকি|মাগী|বাল|পোদ|যৌন|বেশ্যা|হারামজাদা|হারামি/i;

const checkContentSafety = (text: string): { isSafe: boolean; warning?: string } => {
  if (BAD_WORDS_PATTERN.test(text)) {
    return {
      isSafe: false,
      warning: "আপনার পোস্টে বা কমেন্টে আপত্তিকর বা অশালীন ভাষা (অশ্লীল, গালিগালাজ বা যৌন শব্দ) সনাক্ত করা হয়েছে। দয়া করে ভদ্র ও পেশাদার ভাষা ব্যবহার করুন।"
    };
  }
  return { isSafe: true };
};

export default function CommunityHubPage({ user, shopSettings }: CommunityHubPageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [postLimit, setPostLimit] = useState(15);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [newPostText, setNewPostText] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isAd, setIsAd] = useState(false);
  const [newPostTag, setNewPostTag] = useState(TAGS[0]);

  // Lightbox Gallery states
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeLightboxUrls, setActiveLightboxUrls] = useState<string[] | null>(null);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Helper to send real-time notification to Firestore
  const sendNotification = async (recipientId: string, title: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (!recipientId || recipientId === user.uid) return;
    try {
      await addDoc(collection(db, 'community_notifications'), {
        recipientId,
        title,
        read: false,
        type,
        createdAt: Date.now()
      });
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  };

  // Helper to find a user's UID based on name (with spaces removed, matching mention style)
  const getUidFromMention = (mentionName: string): string | null => {
    const cleanMention = mentionName.toLowerCase().replace(/\s+/g, '');
    for (const post of posts) {
      if (post.merchantName.toLowerCase().replace(/\s+/g, '') === cleanMention) {
        return post.merchantId;
      }
      if (post.comments) {
        for (const c of post.comments) {
          if (c.merchantName.toLowerCase().replace(/\s+/g, '') === cleanMention) {
            return c.merchantId;
          }
        }
      }
    }
    return null;
  };

  // Extract mention tags e.g. @SazzadHossain from text
  const scanMentions = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_\-]+)/g;
    const matches: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  };

  // Scan mentions and trigger actual notifications for each mentioned user
  const notifyMentions = async (text: string, authorName: string, snippet: string, isPost: boolean = false) => {
    const mentions = scanMentions(text);
    const notifiedUids = new Set<string>();
    for (const name of mentions) {
      const uid = getUidFromMention(name);
      if (uid && uid !== user.uid && !notifiedUids.has(uid)) {
        notifiedUids.add(uid);
        await sendNotification(
          uid,
          `${authorName} আপনাকে একটি ${isPost ? 'পোস্টে' : 'কমেন্টে'} মেনশন করেছেন: "${snippet.substring(0, 50)}${snippet.length > 50 ? '...' : ''}"`,
          'info'
        );
      }
    }
  };
  
  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string>('All');
  const [filterType, setFilterType] = useState<'All' | 'Ad' | 'Standard'>('All');
  
  // Edit state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState('');
  const [editPostAttachmentUrl, setEditPostAttachmentUrl] = useState('');
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Comment state
  const [commentText, setCommentText] = useState<{ [postId: string]: string }>({});
  const [replyingTo, setReplyingTo] = useState<{ postId: string, commentId: string, merchantName: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<{ postId: string, query: string, position: number } | null>(null);

  // Master Admin & Moderation states
  const isMasterAdmin = user?.email?.toLowerCase().trim() === 'stratproamz@gmail.com';
  const [activeView, setActiveView] = useState<'feed' | 'reports'>('feed');
  const [reports, setReports] = useState<any[]>([]);
  const [bannedUids, setBannedUids] = useState<string[]>([]);
  
  // Reaction picker state
  const [activePostPickerId, setActivePostPickerId] = useState<string | null>(null);

  // Reporting states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportPost, setSelectedReportPost] = useState<Post | null>(null);
  const [reportReason, setReportReason] = useState('Offensive Language');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Load banned users
  useEffect(() => {
    const q = query(collection(db, 'community_banned_users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const uids = snapshot.docs.map(doc => doc.id);
      setBannedUids(uids);
    }, (err) => {
      console.error("Error loading banned uids:", err);
    });
    return () => unsubscribe();
  }, []);

  // Load reports for Master Admin
  useEffect(() => {
    if (!isMasterAdmin) return;
    const q = query(collection(db, 'community_reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReports(reportsData);
    }, (err) => {
      console.error("Error loading reports:", err);
    });
    return () => unsubscribe();
  }, [isMasterAdmin]);

  // Handle outside clicks to close picker
  useEffect(() => {
    if (!activePostPickerId) return;
    const handleOutsideClick = () => setActivePostPickerId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activePostPickerId]);

  const getAllUsers = () => {
    const users = new Map<string, string>();
    posts.forEach(post => {
      users.set(post.merchantName, post.merchantName);
      post.comments?.forEach(c => {
        users.set(c.merchantName, c.merchantName);
      });
    });
    return Array.from(users.values());
  };

  useEffect(() => {
    const q = query(collection(db, 'community_posts'), orderBy('createdAt', 'desc'), limit(postLimit));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      setPosts(postsData);
      setHasMore(snapshot.docs.length === postLimit);
    }, (err) => {
      console.error("Community Hub - Posts sync error:", err);
    });
    return () => unsubscribe();
  }, [postLimit]);

  const handleInitiateReply = (postId: string, commentId: string, merchantName: string) => {
    setReplyingTo({ postId, commentId, merchantName });
    const mention = `@${merchantName.replace(/\s+/g, '')} `;
    setCommentText(prev => {
      const current = prev[postId] || '';
      if (!current.includes(mention)) {
        return { ...prev, [postId]: mention + current };
      }
      return prev;
    });
    setTimeout(() => {
      document.getElementById(`comment-${postId}`)?.focus();
    }, 10);
  };

  const handlePost = async () => {
    if (bannedUids.includes(user.uid)) {
      alert("আপনার অ্যাকাউন্টটি এই কমুনিটি থেকে সাময়িকভাবে ব্লক করা হয়েছে। আপনি কোনো পোস্ট করতে পারবেন না।");
      return;
    }
    if (!newPostText.trim() && !newAttachmentUrl.trim()) return;

    const safety = checkContentSafety(newPostText);
    if (!safety.isSafe) {
      alert(safety.warning);
      return;
    }

    setIsPosting(true);
    
    let processedText = newPostText.trim();
    let finalAttachmentUrl = newAttachmentUrl.trim();

    // Check if attachment URL is actually an iframe embed code
    const embedSrcAttachment = extractIframeSrc(finalAttachmentUrl);
    if (embedSrcAttachment) {
      finalAttachmentUrl = embedSrcAttachment;
    }

    // Process all iframes in the text
    const iframeRegex = /<iframe[^>]*><\/iframe>|<iframe[^>]*\/>/gi;
    let textHasIframe = false;
    
    // Check if text contains an iframe embed code
    const embedSrcText = extractIframeSrc(processedText);
    if (embedSrcText) {
      textHasIframe = true;
      if (!finalAttachmentUrl) finalAttachmentUrl = embedSrcText;
      processedText = processedText.replace(/<iframe[\s\S]*?<\/iframe>/gi, '').trim();
    }

    // In case there is no text left but there is an attachment
    if (!processedText && finalAttachmentUrl) {
      processedText = ''; // Allow empty text if attachment exists
    }

    try {
      const authorName = shopSettings.ownerName || user.displayName || user.email?.split('@')[0] || 'Unknown Merchant';
      await addDoc(collection(db, 'community_posts'), {
        text: processedText,
        attachmentUrl: finalAttachmentUrl || null,
        merchantName: authorName,
        shopName: shopSettings.name || 'Unknown Shop',
        merchantId: user.uid,
        shopId: shopSettings.id || 'global',
        createdAt: serverTimestamp(),
        likes: 0,
        isAd,
        tag: newPostTag,
        isPinned: false,
        comments: []
      });

      // Notify mentioned merchants in the post text
      if (processedText) {
        await notifyMentions(processedText, authorName, processedText, true);
      }

      setNewPostText('');
      setNewAttachmentUrl('');
      setIsAd(false);
      setNewPostTag(TAGS[0]);
    } catch (error) {
      console.error('Error posting:', error);
      alert('Failed to post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'community_posts', postId));
      setDeletingPostId(null);
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleTogglePin = async (postId: string, currentPinStatus: boolean) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const isOwner = post.merchantId === user.uid;
    if (!isOwner && !isMasterAdmin) {
      alert("আপনি শুধুমাত্র নিজের তৈরি পোস্ট পিন বা আনপিন করতে পারবেন।");
      return;
    }
    try {
      await updateDoc(doc(db, 'community_posts', postId), {
        isPinned: !currentPinStatus
      });
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleEditPost = async (postId: string) => {
    if (bannedUids.includes(user.uid)) {
      alert("আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে।");
      return;
    }
    if (!editPostText.trim() && !editPostAttachmentUrl.trim()) return;

    const safety = checkContentSafety(editPostText);
    if (!safety.isSafe) {
      alert(safety.warning);
      return;
    }

    let processedText = editPostText.trim();
    let finalAttachmentUrl = editPostAttachmentUrl.trim();

    // Check if attachment URL is actually an iframe embed code
    const embedSrcAttachment = extractIframeSrc(finalAttachmentUrl);
    if (embedSrcAttachment) {
      finalAttachmentUrl = embedSrcAttachment;
    }

    // Process all iframes in the text
    const embedSrcText = extractIframeSrc(processedText);
    if (embedSrcText) {
      if (!finalAttachmentUrl) finalAttachmentUrl = embedSrcText;
      processedText = processedText.replace(/<iframe[\s\S]*?<\/iframe>/gi, '').trim();
    }

    try {
      await updateDoc(doc(db, 'community_posts', postId), {
        text: processedText,
        attachmentUrl: finalAttachmentUrl || null
      });
      setEditingPostId(null);
      setEditPostText('');
      setEditPostAttachmentUrl('');
    } catch (error) {
      console.error('Error editing post:', error);
    }
  };

  const handleComment = async (postId: string) => {
    if (bannedUids.includes(user.uid)) {
      alert("আপনার অ্যাকাউন্টটি এই কমুনিটি থেকে সাময়িকভাবে ব্লক করা হয়েছে। আপনি কোনো মন্তব্য করতে পারবেন না।");
      return;
    }
    const txt = commentText[postId];
    if (!txt?.trim()) return;

    const safety = checkContentSafety(txt);
    if (!safety.isSafe) {
      alert(safety.warning);
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const authorName = shopSettings.ownerName || user.displayName || user.email?.split('@')[0] || 'Unknown';
      const newComment: Comment = {
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        text: txt.trim(),
        merchantName: authorName,
        merchantId: user.uid,
        createdAt: Date.now(),
        ...(replyingTo?.postId === postId ? { parentId: replyingTo.commentId } : {})
      };

      const updatedComments = [...(post.comments || []), newComment];

      await updateDoc(doc(db, 'community_posts', postId), {
        comments: updatedComments
      });

      // Send real-time notifications
      if (replyingTo?.postId === postId) {
        // Reply notification
        const parentComment = post.comments?.find(c => c.id === replyingTo.commentId);
        if (parentComment && parentComment.merchantId !== user.uid) {
          await sendNotification(
            parentComment.merchantId,
            `${authorName} আপনার মন্তব্যের উত্তর দিয়েছেন: "${txt.trim().substring(0, 40)}${txt.trim().length > 40 ? '...' : ''}"`,
            'info'
          );
        }
      } else {
        // Standard comment notification to post owner
        if (post.merchantId !== user.uid) {
          await sendNotification(
            post.merchantId,
            `${authorName} আপনার পোস্টে একটি মন্তব্য করেছেন: "${txt.trim().substring(0, 40)}${txt.trim().length > 40 ? '...' : ''}"`,
            'info'
          );
        }
      }

      // Notify mentioned merchants in the comment text
      await notifyMentions(txt.trim(), authorName, txt.trim(), false);

      setCommentText(prev => ({ ...prev, [postId]: '' }));
      setReplyingTo(null);
      setMentionQuery(null);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };
  
  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      
      const getDescendantIds = (parentId: string): string[] => {
        const children = (post.comments || []).filter(c => c.parentId === parentId);
        return [
          ...children.map(c => c.id),
          ...children.flatMap(c => getDescendantIds(c.id))
        ];
      };
      
      const idsToRemove = new Set([commentId, ...getDescendantIds(commentId)]);
      
      const updatedComments = (post.comments || []).filter(c => !idsToRemove.has(c.id));
      await updateDoc(doc(db, 'community_posts', postId), {
        comments: updatedComments
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleEditComment = async (postId: string, commentId: string, newText: string) => {
    if (bannedUids.includes(user.uid)) {
      alert("আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে।");
      return;
    }
    const safety = checkContentSafety(newText);
    if (!safety.isSafe) {
      alert(safety.warning);
      return;
    }
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      const updatedComments = (post.comments || []).map(c => 
        c.id === commentId ? { ...c, text: newText } : c
      );
      await updateDoc(doc(db, 'community_posts', postId), {
        comments: updatedComments
      });
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  // Admin report actions
  const handleSendReport = async () => {
    if (!selectedReportPost) return;
    setIsSubmittingReport(true);
    try {
      await addDoc(collection(db, 'community_reports'), {
        postId: selectedReportPost.id,
        postText: selectedReportPost.text,
        reportedMerchantId: selectedReportPost.merchantId,
        reportedMerchantName: selectedReportPost.merchantName,
        reportedShopName: selectedReportPost.shopName,
        reporterId: user.uid,
        reporterName: shopSettings.ownerName || user.displayName || user.email?.split('@')[0] || 'Unknown',
        reason: reportReason,
        details: reportDetails,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('রিপোর্টটি সফলভাবে জমা দেওয়া হয়েছে। এডমিন দ্রুত ব্যবস্থা গ্রহণ করবেন।');
      setIsReportModalOpen(false);
      setReportDetails('');
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleAdminDeletePost = async (postId: string, reportId: string, reportedMerchantId: string, reason: string) => {
    try {
      await deleteDoc(doc(db, 'community_posts', postId));
      await updateDoc(doc(db, 'community_reports', reportId), { status: 'resolved_deleted' });
      
      // Send warning notification to the merchant
      if (reportedMerchantId) {
        await sendNotification(
          reportedMerchantId,
          `[Warning/সতর্কবার্তা] আপনার পোস্টটি নীতিমালার পরিপন্থী হওয়ায় ডিলিট করা হয়েছে। কারণ: ${reason} / Your post was deleted for violating guidelines. Reason: ${reason}`,
          'warning'
        );
      }

      alert('পোস্টটি সফলভাবে ডিলিট করা হয়েছে এবং রিপোর্টটি সমাধান করা হয়েছে।');
    } catch (error) {
      console.error("Error deleting post via admin:", error);
      alert('Failed to delete post.');
    }
  };

  const handleAdminDismissReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'community_reports', reportId), { status: 'dismissed' });
      alert('রিপোর্টটি খারিজ করা হয়েছে।');
    } catch (error) {
      console.error("Error dismissing report:", error);
      alert('Failed to dismiss report.');
    }
  };

  const handleReactPost = async (postId: string, reaction: ReactionType) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      
      const reactions = { ...(post.reactions || {}) };
      let addedReaction = false;
      if (reactions[user.uid] === reaction) {
        delete reactions[user.uid]; // Toggle off if clicking the same
      } else {
        reactions[user.uid] = reaction;
        addedReaction = true;
      }

      await updateDoc(doc(db, 'community_posts', postId), { reactions });

      if (addedReaction && post.merchantId !== user.uid) {
        const authorName = shopSettings.ownerName || user.displayName || user.email?.split('@')[0] || 'Someone';
        const emoji = REACTION_EMOJIS[reaction] || '👍';
        await sendNotification(
          post.merchantId,
          `${authorName} আপনার পোস্টে রিঅ্যাক্ট করেছেন ${emoji}`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error reacting to post:', error);
    }
  };

  const handleReactComment = async (postId: string, commentId: string, reaction: ReactionType) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      
      let targetCommentOwnerId = '';
      let addedReaction = false;
      
      const updatedComments = (post.comments || []).map(c => {
        if (c.id === commentId) {
          targetCommentOwnerId = c.merchantId;
          const reactions = { ...(c.reactions || {}) };
          if (reactions[user.uid] === reaction) {
            delete reactions[user.uid];
          } else {
            reactions[user.uid] = reaction;
            addedReaction = true;
          }
          return { ...c, reactions };
        }
        return c;
      });

      await updateDoc(doc(db, 'community_posts', postId), { comments: updatedComments });

      if (addedReaction && targetCommentOwnerId && targetCommentOwnerId !== user.uid) {
        const authorName = shopSettings.ownerName || user.displayName || user.email?.split('@')[0] || 'Someone';
        const emoji = REACTION_EMOJIS[reaction] || '👍';
        await sendNotification(
          targetCommentOwnerId,
          `${authorName} আপনার মন্তব্যে রিঅ্যাক্ট করেছেন ${emoji}`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error reacting to comment:', error);
    }
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urls = extractUrls(text);
    if (!urls.length) return <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{text}</p>;

    let processedText = text;
    let parts: React.ReactNode[] = [];
    
    // Simple naive splitting - replace urls with links
    const splitByUrl = text.split(/(https?:\/\/[^\s]+)/g);
    
    return (
      <div>
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-2">
          {splitByUrl.map((part, i) => {
            if (part.match(/(https?:\/\/[^\s]+)/)) {
              return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{part}</a>;
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
        
        {urls.length > 0 && (
          <div className={`mt-3 ${urls.length > 1 ? 'grid gap-2 grid-cols-2' : ''}`}>
            {urls.map((url, i) => (
               <LinkPreview key={i} url={url} className={urls.length > 1 ? "mt-0" : "mt-3"} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const filteredPosts = posts.filter(post => {
    // Profile Filter
    if (selectedMerchantId && post.merchantId !== selectedMerchantId) return false;

    // Search Query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        post.text.toLowerCase().includes(searchLower) || 
        post.merchantName.toLowerCase().includes(searchLower) ||
        post.shopName.toLowerCase().includes(searchLower) ||
        (post.tag && post.tag.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }
    
    // Tag Filter
    if (filterTag !== 'All' && post.tag !== filterTag) return false;
    
    // Type Filter
    if (filterType === 'Ad' && !post.isAd) return false;
    if (filterType === 'Standard' && post.isAd) return false;
    
    return true;
  });

  const selectedMerchantPost = posts.find(p => p.merchantId === selectedMerchantId);
  const selectedMerchantName = selectedMerchantId === user.uid ? (shopSettings.ownerName || user.displayName || user.email?.split('@')[0] || 'Me') : selectedMerchantPost?.merchantName || 'Unknown Merchant';
  const selectedMerchantShopName = selectedMerchantId === user.uid ? shopSettings.name : selectedMerchantPost?.shopName || 'Unknown Shop';

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-150 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg text-white">
            <MessageSquare className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              {selectedMerchantId ? `${selectedMerchantName}'s Profile` : activeView === 'reports' ? 'Reports Dashboard' : 'Community Hub'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {selectedMerchantId ? `Viewing posts from ${selectedMerchantShopName}` : activeView === 'reports' ? 'Manage reported posts, comments, and merchants.' : 'Share ideas, products, and updates with fellow merchants.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {isMasterAdmin && (
            <button
              onClick={() => {
                setActiveView(activeView === 'feed' ? 'reports' : 'feed');
                setSelectedMerchantId(null);
              }}
              className={`px-4 py-2 font-bold text-sm rounded-xl transition-colors flex items-center gap-2 ${
                activeView === 'reports' 
                  ? 'bg-amber-600 text-white hover:bg-amber-750' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-250 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              {activeView === 'reports' ? 'Back to Feed' : `Reports Dashboard (${reports.filter(r => r.status === 'pending').length})`}
            </button>
          )}
          {selectedMerchantId ? (
            <button
              onClick={() => setSelectedMerchantId(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-colors"
            >
              Back to Hub
            </button>
          ) : (
            activeView === 'feed' && (
              <button
                onClick={() => setSelectedMerchantId(user.uid)}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-sm rounded-xl transition-colors"
              >
                My Profile
              </button>
            )
          )}
        </div>
      </div>

      {activeView === 'reports' && isMasterAdmin ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-gray-150 dark:border-slate-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">কমিউনিটি রিপোর্টসমূহ / Active Reports</h2>
            
            {reports.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                কোনো রিপোর্ট পেন্ডিং নেই! / No pending reports.
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => {
                  const isBanned = bannedUids.includes(report.reportedMerchantId);
                  
                  return (
                    <div key={report.id} className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm transition-shadow">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[11px] font-bold rounded-full font-mono">
                            Reason: {report.reason}
                          </span>
                          <span className="text-xs text-slate-400">
                            {report.createdAt ? formatDistanceToNow(report.createdAt.toDate(), { addSuffix: true }) : ''}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-150 text-green-800'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                        
                        <div className="text-sm">
                          <strong>Reported User:</strong> <span className="text-indigo-600 dark:text-indigo-400">@{report.reportedMerchantName}</span> (Shop: {report.reportedShopName})
                        </div>
                        
                        <div className="text-sm">
                          <strong>Reporter:</strong> {report.reporterName}
                        </div>

                        {report.postText && (
                          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 text-xs text-slate-750 dark:text-slate-350 max-h-24 overflow-y-auto italic">
                            "{report.postText}"
                          </div>
                        )}

                        {report.details && (
                          <div className="text-xs text-slate-500">
                            <strong>Additional details:</strong> {report.details}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap md:flex-col gap-2 shrink-0 w-full md:w-auto">
                        {report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAdminDeletePost(report.postId, report.id, report.reportedMerchantId, report.reason)}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                            >
                              Delete Reported Post
                            </button>
                            <button
                              onClick={() => handleAdminDismissReport(report.id)}
                              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
                            >
                              Dismiss Report
                            </button>
                            <button
                              onClick={async () => {
                                const customMsg = prompt("সতর্কবার্তা লিখুন / Enter custom warning message:", `নীতিমালার পরিপন্থী পোস্ট করার জন্য আপনাকে সতর্ক করা হচ্ছে। / You are being warned for posting content violating community rules.`);
                                if (customMsg) {
                                  await sendNotification(
                                    report.reportedMerchantId,
                                    `[Warning/সতর্কবার্তা] ${customMsg}`,
                                    'warning'
                                  );
                                  alert('মার্চেন্টকে সতর্কবার্তা পাঠানো হয়েছে।');
                                }
                              }}
                              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                            >
                              Warn Merchant
                            </button>
                          </>
                        )}
                        
                        {isBanned ? (
                          <button
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'community_banned_users', report.reportedMerchantId));
                                alert('মার্চেন্টকে সফলভাবে আনব্লক করা হয়েছে।');
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                          >
                            Unblock Merchant
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              if (confirm(`আপনি কি নিশ্চিতভাবে @${report.reportedMerchantName} কে কমুনিটি থেকে ব্লক করতে চান?`)) {
                                try {
                                  await setDoc(doc(db, 'community_banned_users', report.reportedMerchantId), {
                                    bannedAt: Date.now(),
                                    shopName: report.reportedShopName,
                                    merchantName: report.reportedMerchantName
                                  });
                                  
                                  // Send warning/error notification to the merchant
                                  await sendNotification(
                                    report.reportedMerchantId,
                                    `[Blocked/ব্লকড] আপনাকে কমুনিটি হাব থেকে ব্লক করা হয়েছে। / You have been blocked from the community hub.`,
                                    'error'
                                  );

                                  alert('মার্চেন্টকে সফলভাবে ব্লক করা হয়েছে।');
                                } catch (e) {
                                  console.error(e);
                                }
                              }
                            }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                          >
                            Block Merchant
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Banned Merchants List */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-gray-150 dark:border-slate-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">ব্লক করা মার্চেন্টদের তালিকা / Banned Merchants</h2>
            <div className="space-y-2">
              {bannedUids.length === 0 ? (
                <div className="text-sm text-slate-500 py-4 text-center">কোনো মার্চেন্ট ব্লক করা নেই।</div>
              ) : (
                bannedUids.map(bannedUid => (
                  <div key={bannedUid} className="flex justify-between items-center p-3 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/40 rounded-xl">
                    <span className="text-sm font-semibold text-rose-800 dark:text-rose-300">UID: {bannedUid}</span>
                    <button
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'community_banned_users', bannedUid));
                          alert('মার্চেন্টকে সফলভাবে আনব্লক করা হয়েছে।');
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {!selectedMerchantId && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 font-bold shrink-0">
              {(user.displayName || user.email || 'M')[0].toUpperCase()}
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="What's on your mind? Share a product link or YouTube video..."
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 min-h-[120px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all"
              />
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                <LinkIcon className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={newAttachmentUrl}
                  onChange={(e) => setNewAttachmentUrl(e.target.value)}
                  placeholder="Optional: Paste a URL or embed code (YouTube, Facebook, etc.)"
                  className="w-full bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200"
                />
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <select
                      value={newPostTag}
                      onChange={(e) => setNewPostTag(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none font-medium"
                    >
                      {TAGS.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
                    <input type="checkbox" checked={isAd} onChange={(e) => setIsAd(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                    <span className="flex items-center gap-1"><ShieldAlert className="w-4 h-4" /> Mark as Ad/Offer</span>
                  </label>
                </div>
                <button
                  onClick={handlePost}
                  disabled={(!newPostText.trim() && !newAttachmentUrl.trim()) || isPosting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPosting ? 'Posting...' : 'Post'}
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search posts, merchants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
          />
        </div>
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none font-medium"
            >
              <option value="All">All Posts</option>
              <option value="Standard">Discussions</option>
              <option value="Ad">Ads & Offers</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400" />
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none font-medium"
            >
              <option value="All">All Tags</option>
              {TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">No posts yet</h3>
            <p className="text-slate-500 max-w-md mx-auto mt-2">Be the first to share something with the community! Drop a product link or a YouTube video above.</p>
          </div>
        ) : (
          filteredPosts
            .sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return 0; // The original query already sorts by createdAt desc
            })
            .map(post => {
            const isOwner = post.merchantId === user.uid;
            const comments = post.comments || [];
            const topLevelComments = comments.filter(c => !c.parentId);
            
            return (
              <div key={post.id} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm relative">
                    {post.shopName[0].toUpperCase()}
                    {post.isAd && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-900">
                        AD
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 relative group/header">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <button onClick={() => setSelectedMerchantId(post.merchantId)} className="font-bold text-gray-900 dark:text-white text-[15px] hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 text-left">{post.shopName}</button>
                           {post.isAd && (
                             <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md">Promoted</span>
                           )}
                           {post.tag && (
                             <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 text-[10px] font-bold rounded-md flex items-center gap-1">
                               {post.tag}
                             </span>
                           )}
                           {post.isPinned && (
                             <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-md flex items-center gap-1">
                               <Pin className="w-3 h-3" /> Pinned
                             </span>
                           )}
                        </div>
                        <button onClick={() => setSelectedMerchantId(post.merchantId)} className="text-[13px] text-slate-500 font-medium hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 text-left">{post.merchantName}</button>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                        </span>
                        {(isOwner || isMasterAdmin) && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleTogglePin(post.id, post.isPinned || false)} className={`p-1.5 rounded-lg transition-colors ${post.isPinned ? 'text-rose-600 bg-rose-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`} title={post.isPinned ? 'Unpin Post' : 'Pin Post'}>
                              <Pin className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {!isOwner && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setSelectedReportPost(post);
                                setIsReportModalOpen(true);
                              }} 
                              className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors" 
                              title="Report Post"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isOwner && (
                          <div className="opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center gap-1">
                            {deletingPostId === post.id ? (
                              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg">
                                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Delete?</span>
                                <button onClick={() => setDeletingPostId(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">No</button>
                                <button onClick={() => handleDeletePost(post.id)} className="text-xs font-bold text-rose-600 hover:text-rose-800 dark:hover:text-rose-400">Yes</button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => { setEditingPostId(post.id); setEditPostText(post.text); setEditPostAttachmentUrl(post.attachmentUrl || ''); }} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeletingPostId(post.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      {editingPostId === post.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editPostText}
                            onChange={(e) => setEditPostText(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 min-h-[100px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all"
                          />
                          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                            <LinkIcon className="w-5 h-5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={editPostAttachmentUrl}
                              onChange={(e) => setEditPostAttachmentUrl(e.target.value)}
                              placeholder="Optional: Paste a URL or embed code (YouTube, Facebook, etc.)"
                              className="w-full bg-transparent outline-none text-sm text-gray-800 dark:text-gray-200"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setEditingPostId(null)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
                            <button onClick={() => handleEditPost(post.id)} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Changes</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {renderTextWithLinks(post.text)}
                          {post.attachmentUrl && (
                            <div className={`mt-3 ${post.attachmentUrl.split(/[\s,]+/).filter(Boolean).length > 1 ? 'grid gap-2 grid-cols-2' : ''}`}>
                              {post.attachmentUrl.split(/[\s,]+/).filter(Boolean).map((u, i, arr) => {
                                const allImageUrls = arr.filter(url => isImageUrl(url));
                                const imageIndex = allImageUrls.indexOf(u);
                                return (
                                  <LinkPreview 
                                    key={i} 
                                    url={u} 
                                    className={arr.length > 1 ? "mt-0 h-48" : "mt-3"} 
                                    onClickImage={() => {
                                      if (imageIndex !== -1) {
                                        setActiveLightboxUrls(allImageUrls);
                                        setActiveLightboxIndex(imageIndex);
                                        setIsLightboxOpen(true);
                                        setIsZoomed(false);
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Footer actions */}
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-6">
                      <div className="relative inline-block">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActivePostPickerId(activePostPickerId === post.id ? null : post.id);
                          }}
                          className={`flex items-center gap-2 font-semibold text-sm transition-colors ${post.reactions?.[user.uid] ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
                        >
                          <div className="p-2 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                            <Heart className="w-5 h-5" />
                          </div>
                          {post.reactions?.[user.uid] ? REACTION_EMOJIS[post.reactions[user.uid]] + ' ' + post.reactions[user.uid].charAt(0).toUpperCase() + post.reactions[user.uid].slice(1) : 'React'} 
                          {Object.keys(post.reactions || {}).length > 0 && ` (${Object.keys(post.reactions || {}).length})`}
                        </button>
                        <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-full flex gap-1 p-1.5 transition-all z-50 ${activePostPickerId === post.id ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                          {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map(r => (
                            <button
                              key={r}
                              onClick={(e) => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                                handleReactPost(post.id, r); 
                                setActivePostPickerId(null); 
                              }}
                              className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-lg hover:scale-125 transition-transform"
                              title={r}
                            >
                              {REACTION_EMOJIS[r]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label htmlFor={`comment-${post.id}`} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-semibold text-sm transition-colors group cursor-pointer">
                        <div className="p-2 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        Comment ({comments.length})
                      </label>
                    </div>

                    {/* Comments Section */}
                    <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50 space-y-4">
                      {topLevelComments.map(comment => (
                        <CommentNode
                          key={comment.id}
                          comment={comment}
                          allComments={comments}
                          post={post}
                          user={user}
                          onReply={(commentId, merchantName) => handleInitiateReply(post.id, commentId, merchantName)}
                          onDelete={handleDeleteComment}
                          onReact={handleReactComment}
                          onEdit={handleEditComment}
                          onViewProfile={setSelectedMerchantId}
                        />
                      ))}

                      {/* Comment Input */}
                      <div className="flex gap-3 items-end mt-2">
                         <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0 mb-1">
                          {(user.displayName || user.email || 'M')[0].toUpperCase()}
                         </div>
                         <div className="flex-1 flex flex-col gap-2">
                           {replyingTo?.postId === post.id && (
                             <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300">
                               <span>Replying to {replyingTo.merchantName}...</span>
                               <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Cancel</button>
                             </div>
                           )}
                           <div className="relative">
                              {mentionQuery?.postId === post.id && (
                                <div className="absolute bottom-full left-0 mb-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                                  {getAllUsers()
                                    .filter(u => u.toLowerCase().includes(mentionQuery.query.toLowerCase()))
                                    .slice(0, 5)
                                    .map(u => (
                                    <button
                                      key={u}
                                      onClick={() => {
                                         const text = commentText[post.id];
                                         const before = text.slice(0, mentionQuery.position - mentionQuery.query.length - 1);
                                         const after = text.slice(mentionQuery.position);
                                         setCommentText(prev => ({ ...prev, [post.id]: before + '@' + u.replace(/\s+/g, '') + ' ' + after }));
                                         setMentionQuery(null);
                                         setTimeout(() => {
                                           const textarea = document.getElementById(`comment-${post.id}`) as HTMLTextAreaElement;
                                           if (textarea) {
                                             textarea.focus();
                                           }
                                         }, 10);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 border-b border-slate-100 dark:border-slate-800/50 last:border-0 font-medium truncate"
                                    >
                                      {u}
                                    </button>
                                  ))}
                                  {getAllUsers().filter(u => u.toLowerCase().includes(mentionQuery.query.toLowerCase())).length === 0 && (
                                    <div className="px-4 py-3 text-xs text-slate-500 text-center">No matching users</div>
                                  )}
                                </div>
                              )}
                              <textarea
                                id={`comment-${post.id}`}
                                value={commentText[post.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCommentText(prev => ({ ...prev, [post.id]: val }));
                                  
                                  const cursorPosition = e.target.selectionStart;
                                  const textBeforeCursor = val.slice(0, cursorPosition);
                                  // Match @ followed by letters/numbers without spaces
                                  const match = textBeforeCursor.match(/@([\w-]*)$/);
                                  
                                  if (match) {
                                    setMentionQuery({ postId: post.id, query: match[1], position: cursorPosition });
                                  } else {
                                    setMentionQuery(null);
                                  }
                                }}
                                placeholder={replyingTo?.postId === post.id ? `Write a reply...` : "Write a comment..."}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm py-2.5 pl-4 pr-12 min-h-[44px] max-h-[120px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all text-[13px]"
                                rows={1}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleComment(post.id);
                                  }
                                }}
                              />
                              <button 
                                onClick={() => handleComment(post.id)}
                                disabled={!commentText[post.id]?.trim()}
                                className="absolute right-2 bottom-2 p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors disabled:opacity-40"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasMore && filteredPosts.length > 0 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setPostLimit(prev => prev + 15)}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-colors"
          >
            Load More Posts
          </button>
        </div>
      )}
        </>
      )}

      {/* Report Modal */}
      {isReportModalOpen && selectedReportPost && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">রিপোর্ট করুন / Report Content</h3>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-slate-400">
              আপনি <span className="font-bold text-slate-700 dark:text-slate-250">@{selectedReportPost.merchantName}</span> (শপ: {selectedReportPost.shopName})-এর পোস্ট বা অ্যাকাউন্টের বিরুদ্ধে রিপোর্ট করছেন।
            </p>

            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-750 dark:text-gray-300">রিপোর্টের কারণ নির্বাচন করুন / Select Reason:</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium text-sm text-slate-900 dark:text-slate-150"
              >
                <option value="Offensive Language">অশালীন বা কটু ভাষা / Offensive Language</option>
                <option value="Sexual Content">যৌন বা অশালীন কন্টেন্ট / Sexual Content</option>
                <option value="Spam / Promo Key Abuse">স্প্যাম বা অবৈধ প্রমো কোড / Spam / Promo Key Abuse</option>
                <option value="Harassment / Bullying">হয়রানি বা উস্কানিমূলক / Harassment / Bullying</option>
                <option value="Fake Account / Scam">ভুয়া অ্যাকাউন্ট বা প্রতারণা / Fake Account / Scam</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-750 dark:text-gray-300">বিস্তারিত লিখুন (ঐচ্ছিক) / Describe details:</label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="এ বিষয়ে বিস্তারিত লিখুন..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 min-h-[80px] focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsReportModalOpen(false);
                  setReportDetails('');
                }}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                বাতিল / Cancel
              </button>
              <button
                onClick={handleSendReport}
                disabled={isSubmittingReport}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                {isSubmittingReport ? 'জমা হচ্ছে...' : 'রিপোর্ট জমা দিন / Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Slideshow Gallery Modal */}
      {isLightboxOpen && activeLightboxUrls && activeLightboxUrls.length > 0 && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 select-none animate-fadeIn transition-colors">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-4 md:p-6 text-white bg-gradient-to-b from-black/60 to-transparent absolute top-0 left-0 w-full z-10">
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wider font-sans">
                {activeLightboxUrls.length > 1 
                  ? `ইমেজ ${activeLightboxIndex + 1} / ${activeLightboxUrls.length}` 
                  : 'ইমেজ গ্যালারি / Image Viewer'}
              </span>
              <span className="text-[10px] text-gray-300">
                ডাবল ক্লিক করুন বড় করে দেখতে / Double click to zoom
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all"
                title={isZoomed ? "Zoom Out / ছোট করুন" : "Zoom In / বড় করুন"}
              >
                {isZoomed ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => {
                  setIsLightboxOpen(false);
                  setIsZoomed(false);
                }}
                className="p-2.5 rounded-full bg-rose-600/80 hover:bg-rose-600 transition-all shadow-lg"
                title="Close / বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Stage */}
          <div className="flex-1 flex items-center justify-center relative p-4 overflow-hidden">
            {/* Previous Button */}
            {activeLightboxUrls.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveLightboxIndex(prev => (prev - 1 + activeLightboxUrls.length) % activeLightboxUrls.length);
                  setIsZoomed(false);
                }}
                className="absolute left-4 md:left-8 p-3 md:p-4 rounded-full bg-black/50 hover:bg-black/80 hover:scale-105 border border-white/10 text-white transition-all z-20 cursor-pointer shadow-2xl"
                title="Previous / পূর্ববর্তী"
              >
                <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
              </button>
            )}

            {/* Active Image Canvas */}
            <div 
              className="max-w-full max-h-[80vh] flex items-center justify-center transition-all duration-300"
              onDoubleClick={() => setIsZoomed(!isZoomed)}
            >
              <img 
                src={activeLightboxUrls[activeLightboxIndex]} 
                alt={`Gallery index ${activeLightboxIndex}`} 
                referrerPolicy="no-referrer"
                className={`max-w-full max-h-[75vh] md:max-h-[80vh] object-contain select-none transition-transform duration-300 ease-out shadow-2xl rounded-lg ${
                  isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                }`}
              />
            </div>

            {/* Next Button */}
            {activeLightboxUrls.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveLightboxIndex(prev => (prev + 1) % activeLightboxUrls.length);
                  setIsZoomed(false);
                }}
                className="absolute right-4 md:right-8 p-3 md:p-4 rounded-full bg-black/50 hover:bg-black/80 hover:scale-105 border border-white/10 text-white transition-all z-20 cursor-pointer shadow-2xl"
                title="Next / পরবর্তী"
              >
                <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Navigation (Only if > 1 images) */}
          {activeLightboxUrls.length > 1 && (
            <div className="p-4 md:p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-3">
              <div className="flex gap-2 max-w-full overflow-x-auto py-2 custom-scrollbar justify-center">
                {activeLightboxUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveLightboxIndex(index);
                      setIsZoomed(false);
                    }}
                    className={`w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      index === activeLightboxIndex 
                        ? 'border-indigo-500 scale-110 opacity-100 shadow-md shadow-indigo-500/50' 
                        : 'border-white/20 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${index}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

