const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{ id: 'visual_hook_pro'[\s\S]*?d: 'release_logs', label: 'Release Logs', label_bn: 'রিলিজ লগ', iconName: 'Activity', roles: \['admin'\] \},/;

const replacementString = `{ id: 'visual_hook_pro', label: 'Visual Hook Pro', label_bn: 'ভিজ্যুয়াল হুক প্রো', iconName: 'ImageIcon', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
      { id: 'content_writer_pro', label: 'Content Writer Pro', label_bn: 'কনটেন্ট রাইটার প্রো', iconName: 'FileEdit', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
      { id: 'story_maker', label: 'Story Maker (OVC)', label_bn: 'স্টোরি মেকার ওভিসি', iconName: 'Video', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] },
      { id: 'brand_memory', label: 'Brand Memory', label_bn: 'ব্র্যান্ড মেমোরি', iconName: 'Brain', roles: ['admin', 'manager', 'assistant_manager', 'sales_manager', 'sales_team'] }
    ]
  },
  {
    id: 'management_section',
    label: 'Management',
    label_bn: 'ব্যবস্থাপনা',
    isLocked: false,
    isDeleted: false,
    visibleToRoles: ['admin'],
    items: [
      { id: 'management_dashboard', label: 'Management Dashboard', label_bn: 'ম্যানেজমেন্ট ড্যাশবোর্ড', iconName: 'LayoutDashboard', roles: ['admin'] },
      { id: 'membership', label: 'Membership', label_bn: 'মেম্বারশিপ', iconName: 'Award', roles: ['admin', 'manager'] },
      { id: 'jarvis', label: 'Jarvis AI', label_bn: 'জারভিস এআই', iconName: 'Bot', roles: ['admin'] },
      { id: 'payment_method', label: 'Payment Method', label_bn: 'পেমেন্ট মেথড', iconName: 'CreditCard', roles: ['admin'] },
      { id: 'loan_management', label: 'Loan Management', label_bn: 'ঋণ ব্যবস্থাপনা', iconName: 'Banknote', roles: ['admin'] },
      { id: 'community_hub', label: 'Community Hub', label_bn: 'কমিউনিটি হাব', iconName: 'Users', roles: ['admin'] },
      { id: 'live_tv', label: 'Live TV', label_bn: 'লাইভ টিভি', iconName: 'Tv', roles: ['admin'] },
      { id: 'business_bio', label: 'Business Bio', label_bn: 'বিজনেস বায়ো', iconName: 'User', roles: ['admin'] },
      { id: 'contact_us', label: 'Contact Us', label_bn: 'যোগাযোগ করুন', iconName: 'Phone', roles: ['admin'] },
      { id: 'business_mail', label: 'Business Mail', label_bn: 'বিজনেস মেইল', iconName: 'Mail', roles: ['admin'] },
      { id: 'meet_scheduler', label: 'Meet Scheduler', label_bn: 'মিটিং সিডিউলার', iconName: 'Calendar', roles: ['admin'] },
      { id: 'release_logs', label: 'Release Logs', label_bn: 'রিলিজ লগ', iconName: 'Activity', roles: ['admin'] },`;

code = code.replace(regex, replacementString);
fs.writeFileSync('src/App.tsx', code);
