import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Search as SearchIcon, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function GlobalSearch({ onSelectProfile }: { onSelectProfile: (uid: string) => void }) {
  const { user, blockedUsers, language, t } = useAuth();
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!queryText.trim() || queryText.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const searchText = queryText.toLowerCase();
        const q = query(
          collection(db, 'users'),
          where('username', '>=', searchText),
          where('username', '<=', searchText + '\uf8ff'),
          limit(8)
        );
        const snapshot = await getDocs(q);
        const users = snapshot.docs
          .map(doc => doc.data())
          .filter(u => u.uid !== user?.uid && !blockedUsers.includes(u.uid));

        setResults(users);
        setIsOpen(true);
      } catch (error) {
        console.error('Global Search Error:', error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 400);
    return () => clearTimeout(timeoutId);
  }, [queryText, user, blockedUsers]);

  const handleSelect = (uid: string) => {
    onSelectProfile(uid);
    setQueryText('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-xs group" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onFocus={() => queryText.length >= 2 && setIsOpen(true)}
          placeholder={t('search')}
          className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg py-2 ps-9 pe-9 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-700 transition-all border-none"
        />
        <SearchIcon className="absolute start-3 top-2.5 text-slate-400" size={16} />
        {loading ? (
          <Loader2 className="absolute end-3 top-2.5 animate-spin text-slate-400" size={16} />
        ) : queryText && (
          <button
            type="button"
            onClick={() => setQueryText('')}
            className="absolute end-3 top-2.5 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && (results.length > 0 || (queryText.length >= 2 && !loading)) && (
        <div className="absolute top-full inset-x-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={result.uid}
                  type="button"
                  onClick={() => handleSelect(result.uid)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-start"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0">
                    <img
                      src={result.photoURL || '/placeholder-avatar.jpg'}
                      alt={result.username || ''}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate">{result.username}</p>
                    <p className="text-[11px] text-slate-500 truncate">{result.fullName}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? `لم يتم العثور على نتائج لـ "${queryText}"`
                  : `No results found for "${queryText}"`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
