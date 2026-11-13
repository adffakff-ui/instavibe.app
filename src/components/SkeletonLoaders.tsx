import React from 'react';

export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-slate-200 dark:bg-slate-800 ${className}`}
      aria-hidden="true"
    />
  );
}

export function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <SkeletonBox className="w-10 h-10 !rounded-full" />
          <div className="space-y-1.5">
            <SkeletonBox className="h-3.5 w-28" />
            <SkeletonBox className="h-2.5 w-16" />
          </div>
        </div>
        <SkeletonBox className="w-6 h-6 !rounded-full" />
      </div>

      {/* Media Image / Video Body */}
      <div className="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
        <SkeletonBox className="w-full h-full !rounded-none" />
      </div>

      {/* Action Row */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SkeletonBox className="w-6 h-6 !rounded-lg" />
            <SkeletonBox className="w-6 h-6 !rounded-lg" />
            <SkeletonBox className="w-6 h-6 !rounded-lg" />
          </div>
          <SkeletonBox className="w-6 h-6 !rounded-lg" />
        </div>

        {/* Likes Count */}
        <SkeletonBox className="h-3 w-24" />

        {/* Caption */}
        <div className="space-y-1.5 pt-1">
          <SkeletonBox className="h-3 w-4/5" />
          <SkeletonBox className="h-3 w-2/5" />
        </div>

        {/* Comments Link */}
        <SkeletonBox className="h-2.5 w-20 pt-1" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Story Bar Skeleton */}
      <div className="flex gap-4 overflow-hidden py-3 px-1 border-b border-slate-100 dark:border-slate-800">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="w-16 h-16 rounded-full p-0.5 border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center">
              <SkeletonBox className="w-full h-full !rounded-full" />
            </div>
            <SkeletonBox className="h-2.5 w-12" />
          </div>
        ))}
      </div>

      {/* Tab Switcher Skeleton */}
      <div className="flex items-center justify-center gap-8 border-b border-slate-100 dark:border-slate-800 pb-3">
        <SkeletonBox className="h-4 w-14" />
        <SkeletonBox className="h-4 w-20" />
      </div>

      {/* Discovery Banner Placeholder */}
      <SkeletonBox className="w-full h-14 !rounded-2xl" />

      {/* Post Creation Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <SkeletonBox className="w-10 h-10 !rounded-full" />
          <SkeletonBox className="h-3.5 w-32" />
        </div>
        <SkeletonBox className="w-full h-20 !rounded-xl" />
        <div className="flex justify-between items-center pt-1">
          <div className="flex gap-2">
            <SkeletonBox className="h-8 w-20 !rounded-lg" />
            <SkeletonBox className="h-8 w-20 !rounded-lg" />
          </div>
          <SkeletonBox className="h-8 w-24 !rounded-lg" />
        </div>
      </div>

      {/* Posts Skeleton Feed */}
      <div className="space-y-6 pb-12">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-screen-md mx-auto pb-20 space-y-8 animate-in fade-in duration-200">
      {/* Profile Header Skeleton */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-8 px-4 md:px-0">
        {/* Avatar */}
        <div className="w-24 h-24 md:w-36 md:h-36 rounded-full p-1 border-2 border-slate-200 dark:border-slate-800 shrink-0">
          <SkeletonBox className="w-full h-full !rounded-full" />
        </div>

        {/* User Info & Actions */}
        <div className="flex-1 space-y-4 w-full text-center md:text-start">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
            <SkeletonBox className="h-6 w-36" />
            <div className="flex gap-2">
              <SkeletonBox className="h-9 w-24 !rounded-xl" />
              <SkeletonBox className="h-9 w-24 !rounded-xl" />
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-center md:justify-start gap-8 pt-1">
            <div className="flex flex-col items-center md:items-start gap-1">
              <SkeletonBox className="h-4 w-8" />
              <SkeletonBox className="h-2.5 w-14" />
            </div>
            <div className="flex flex-col items-center md:items-start gap-1">
              <SkeletonBox className="h-4 w-8" />
              <SkeletonBox className="h-2.5 w-16" />
            </div>
            <div className="flex flex-col items-center md:items-start gap-1">
              <SkeletonBox className="h-4 w-8" />
              <SkeletonBox className="h-2.5 w-16" />
            </div>
          </div>

          {/* Bio text */}
          <div className="space-y-2 pt-1 max-w-sm mx-auto md:mx-0">
            <SkeletonBox className="h-3.5 w-28" />
            <SkeletonBox className="h-3 w-full" />
            <SkeletonBox className="h-3 w-4/5" />
          </div>
        </div>
      </div>

      {/* Story Highlights Bar Skeleton */}
      <div className="flex gap-4 overflow-hidden px-4 md:px-0 py-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 shrink-0">
            <div className="w-16 h-16 rounded-full p-0.5 border border-slate-200 dark:border-slate-800">
              <SkeletonBox className="w-full h-full !rounded-full" />
            </div>
            <SkeletonBox className="h-2.5 w-12" />
          </div>
        ))}
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex justify-around border-t border-slate-200 dark:border-slate-800 pt-3">
        <SkeletonBox className="h-5 w-16" />
        <SkeletonBox className="h-5 w-16" />
        <SkeletonBox className="h-5 w-16" />
        <SkeletonBox className="h-5 w-16" />
      </div>

      {/* 3-Column Media Grid Skeleton */}
      <div className="grid grid-cols-3 gap-1 md:gap-4 rounded-2xl overflow-hidden px-1 md:px-0">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="aspect-square bg-slate-100 dark:bg-slate-800/80 rounded-lg overflow-hidden">
            <SkeletonBox className="w-full h-full !rounded-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiscoverySkeleton() {
  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-200">
      {/* Smart Suggestions Header Banner Skeleton */}
      <div className="h-28 rounded-3xl overflow-hidden bg-slate-200/80 dark:bg-slate-800">
        <SkeletonBox className="w-full h-full !rounded-3xl" />
      </div>

      {/* Live Now Section Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-5 w-28" />
          <SkeletonBox className="h-4 w-16" />
        </div>
        <div className="flex gap-4 overflow-hidden py-1">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="w-64 shrink-0 space-y-2">
              <div className="aspect-video rounded-2xl overflow-hidden">
                <SkeletonBox className="w-full h-full !rounded-2xl" />
              </div>
              <SkeletonBox className="h-3.5 w-44" />
              <SkeletonBox className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Posts Section Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-5 w-40" />
          <SkeletonBox className="h-3.5 w-24" />
        </div>
        <div className="space-y-6">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      </div>
    </div>
  );
}

export function ExploreSkeleton() {
  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Search Input Skeleton */}
      <div className="flex gap-2">
        <SkeletonBox className="flex-1 h-12 !rounded-2xl" />
        <SkeletonBox className="w-24 h-12 !rounded-2xl" />
      </div>

      {/* Category Tag Chips */}
      <div className="flex gap-2 overflow-hidden pb-1">
        {[...Array(6)].map((_, i) => (
          <SkeletonBox key={i} className="h-8 w-20 shrink-0 !rounded-xl" />
        ))}
      </div>

      {/* Header and Count */}
      <div className="flex items-center justify-between px-1">
        <SkeletonBox className="h-5 w-32" />
        <SkeletonBox className="h-3 w-16" />
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-3 gap-1 md:gap-4 rounded-2xl overflow-hidden">
        <div className="aspect-square col-span-2 row-span-2 rounded-xl overflow-hidden">
          <SkeletonBox className="w-full h-full !rounded-none" />
        </div>
        <div className="aspect-square rounded-xl overflow-hidden">
          <SkeletonBox className="w-full h-full !rounded-none" />
        </div>
        <div className="aspect-square rounded-xl overflow-hidden">
          <SkeletonBox className="w-full h-full !rounded-none" />
        </div>
        <div className="aspect-square rounded-xl overflow-hidden">
          <SkeletonBox className="w-full h-full !rounded-none" />
        </div>
        <div className="aspect-square rounded-xl overflow-hidden">
          <SkeletonBox className="w-full h-full !rounded-none" />
        </div>
        <div className="aspect-square rounded-xl overflow-hidden">
          <SkeletonBox className="w-full h-full !rounded-none" />
        </div>
      </div>
    </div>
  );
}
