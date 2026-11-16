export interface StoryTemplate {
  id: string;
  name: string;
  nameAr: string;
  prompt: string;
  promptAr: string;
  category: 'add_yours' | 'mood' | 'daily' | 'qa' | 'comparison';
  categoryLabelAr: string;
  bgGradient: string;
  stickerStyle: {
    textColor: string;
    badgeBg: string;
    borderStyle: string;
  };
  sampleParticipantCount: number;
}

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'add-yours-recent',
    name: 'Add Yours: Best Recent Pic',
    nameAr: 'أضف خاصتك: أفضل صورة بهاتفك',
    prompt: 'Drop your best photo from this month 📸',
    promptAr: 'شارك أفضل صورة التقطتها في هاتفك هذا الشهر 📸',
    category: 'add_yours',
    categoryLabelAr: 'أضف خاصتك',
    bgGradient: 'from-purple-900/90 via-slate-900 to-black',
    stickerStyle: {
      textColor: 'text-white',
      badgeBg: 'bg-white/20 backdrop-blur-md',
      borderStyle: 'border-white/30',
    },
    sampleParticipantCount: 1420,
  },
  {
    id: 'add-yours-view',
    name: 'Add Yours: Favorite View',
    nameAr: 'أضف خاصتك: إطلالة تحبها',
    prompt: 'Show your current view or a place you miss 🌅',
    promptAr: 'شارك منظراً طبيعياً أو إطلالة تحبها 🌅',
    category: 'add_yours',
    categoryLabelAr: 'أضف خاصتك',
    bgGradient: 'from-amber-900/90 via-rose-950 to-black',
    stickerStyle: {
      textColor: 'text-white',
      badgeBg: 'bg-amber-500/25 backdrop-blur-md',
      borderStyle: 'border-amber-400/40',
    },
    sampleParticipantCount: 890,
  },
  {
    id: 'mood-today',
    name: 'Today Mood',
    nameAr: 'مزاج اليوم',
    prompt: 'Current mood in one shot ✨',
    promptAr: 'مزاجي وطاقتي اليوم في صورة واحدة ✨',
    category: 'mood',
    categoryLabelAr: 'مزاج وتعبير',
    bgGradient: 'from-indigo-900 via-slate-950 to-black',
    stickerStyle: {
      textColor: 'text-amber-300',
      badgeBg: 'bg-indigo-950/70 backdrop-blur-md',
      borderStyle: 'border-indigo-400/40',
    },
    sampleParticipantCount: 654,
  },
  {
    id: 'moment-daily',
    name: 'Moment from My Day',
    nameAr: 'لحظة من يومي',
    prompt: 'Little things making today special ☕',
    promptAr: 'تفاصيل صغيرة تصنع بهجة اليوم ☕',
    category: 'daily',
    categoryLabelAr: 'يوميات',
    bgGradient: 'from-stone-900 via-zinc-900 to-black',
    stickerStyle: {
      textColor: 'text-white',
      badgeBg: 'bg-black/60 backdrop-blur-md',
      borderStyle: 'border-white/20',
    },
    sampleParticipantCount: 412,
  },
  {
    id: 'before-after',
    name: 'Before & After',
    nameAr: 'قبل وبعد',
    prompt: 'Before & After comparison 🔄',
    promptAr: 'مقارنة قبل وبعد (إنجاز، ترتيب، تعديل) 🔄',
    category: 'comparison',
    categoryLabelAr: 'مقارنة',
    bgGradient: 'from-emerald-950 via-slate-950 to-black',
    stickerStyle: {
      textColor: 'text-emerald-300',
      badgeBg: 'bg-emerald-900/40 backdrop-blur-md',
      borderStyle: 'border-emerald-500/40',
    },
    sampleParticipantCount: 318,
  },
  {
    id: 'quote-day',
    name: 'Inspiring Quote',
    nameAr: 'اقتباس يلهمك',
    prompt: 'Words to live by today 💭',
    promptAr: 'كلمات أثرت بك وتود مشاركتها 💭',
    category: 'qa',
    categoryLabelAr: 'إلهام وحكمة',
    bgGradient: 'from-blue-950 via-slate-900 to-black',
    stickerStyle: {
      textColor: 'text-white',
      badgeBg: 'bg-white/15 backdrop-blur-md',
      borderStyle: 'border-white/25',
    },
    sampleParticipantCount: 520,
  },
];
