export type StoryAudience = 'everyone' | 'close_friends';

export type StoryTextFontStyle = 'classic' | 'modern' | 'neon' | 'typewriter' | 'bold';
export type StoryTextBgStyle = 'none' | 'solid' | 'translucent' | 'outline';

export interface StoryTextOverlay {
  id: string;
  text: string;
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  color: string;
  bgStyle: StoryTextBgStyle;
  fontStyle: StoryTextFontStyle;
  scale?: number;
}

export interface StorySticker {
  id: string;
  type: 'emoji' | 'location' | 'time' | 'mood';
  value: string;
  label?: string;
  x: number; // percentage 0..100
  y: number; // percentage 0..100
}

export interface StoryMention {
  uid: string;
  username: string;
  photoURL?: string;
  x: number; // percentage 0..100
  y: number; // percentage 0..100
}

export interface StoryPartnership {
  isPaid: boolean;
  allowAds?: boolean;
  partnerId?: string;
  partnerUsername?: string;
}

export interface StoryPromotion {
  isPromoted: boolean;
  goal: 'profile_visits' | 'messages' | 'engagement';
  dailyBudget: number;
  durationDays: number;
  promotedAt: string;
}

export interface StorySettings {
  defaultAudience: StoryAudience;
  repliesPermission: 'everyone' | 'followers' | 'off';
  autoSaveArchive: boolean;
  allowStorySharing: boolean;
  allowExternalSharing: boolean;
}

export interface DrawStroke {
  id: string;
  color: string;
  width: number; // relative to 360px base canvas width
  isGlow?: boolean;
  isEraser?: boolean;
  points: { x: number; y: number }[]; // normalized 0..1
}

export interface CloseFriendUser {
  friendId: string;
  username: string;
  photoURL?: string;
}
