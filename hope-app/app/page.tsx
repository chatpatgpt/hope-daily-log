'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, type HopeLog } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<HopeLog[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'log' | 'trends'>('home');
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showLogModal, setShowLogModal] = useState<'walk' | 'accident' | null>(null);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (typeof document !== 'undefined') {
      document.body.className = savedDarkMode ? 'dark' : '';
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    if (typeof document !== 'undefined') {
      document.body.className = darkMode ? 'dark' : '';
    }
  }, [darkMode]);

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchLogs();
      subscribeToLogs();
    }
  }, [user]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    setLoading(false);
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
      }
    });

    if (error) {
      console.error('Login error:', error);
      alert('Failed to login: ' + error.message);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    } else {
      setLogs([]);
    }
  }

  async function fetchLogs() {
    try {
      const { data, error } = await supabase
        .from('hope_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
      setIsOnline(true);
    } catch (err) {
      console.error('Fetch error:', err);
      setIsOnline(false);
    }
  }

  function subscribeToLogs() {
    const channel = supabase
      .channel('hope_logs_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'hope_logs' },
        () => fetchLogs()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  async function addLog(logData: Partial<HopeLog>) {
    if (!user) return;

    try {
      const { error } = await supabase.from('hope_logs').insert([{
        ...logData,
        user_id: user.id,
        user_email: user.email,
        person: user.user_metadata.full_name || user.email?.split('@')[0] || 'Unknown'
      }]);
      if (error) throw error;
      setShowLogModal(null);
    } catch (err) {
      console.error('Insert error:', err);
      alert('Failed to log: ' + (err as Error).message);
    }
  }

  const streakData = useMemo(() => {
    const sortedDays = [...logs]
      .filter(l => l.type === 'accident')
      .map(l => new Date(l.created_at).toDateString());

    const accidentDays = new Set(sortedDays);
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < 365; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();

      if (!accidentDays.has(dateStr)) {
        tempStreak++;
        if (i === 0) currentStreak = tempStreak;
      } else {
        maxStreak = Math.max(maxStreak, tempStreak);
        tempStreak = 0;
        if (i === 0) currentStreak = 0;
      }
    }
    maxStreak = Math.max(maxStreak, tempStreak);

    return { currentStreak, maxStreak };
  }, [logs]);

  if (loading) {
    return (
      <div className={`${darkMode ? 'dark' : ''} min-h-screen flex items-center justify-center bg-hope-gradient`}>
        <div className="text-center">
          <div className="text-8xl mb-6 hop">🐕</div>
          <div className="text-2xl font-serif font-bold" style={{ color: 'var(--text-primary)' }}>
            Getting Hope ready...
          </div>
          <div className="text-lg mt-2" style={{ color: 'var(--text-secondary)' }}>
            🦴 Woof woof! 🦴
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${darkMode ? 'dark' : ''} min-h-screen flex items-center justify-center p-4 bg-hope-gradient relative overflow-hidden`}>
        {/* Decorative blobs */}
        <div className="blob" style={{
          width: '300px',
          height: '300px',
          background: 'var(--accent-pink)',
          top: '10%',
          left: '10%'
        }} />
        <div className="blob" style={{
          width: '400px',
          height: '400px',
          background: 'var(--accent-gold)',
          bottom: '10%',
          right: '10%',
          animationDelay: '5s'
        }} />

        <div className="glass-card rounded-3xl p-10 max-w-md w-full text-center relative z-10 slide-up">
          <div className="text-8xl mb-6 hop">🐕</div>
          <h1 className="text-5xl font-serif font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Hope&apos;s Adventure! 🌟
          </h1>
          <p className="text-xl mb-8" style={{ color: 'var(--text-secondary)' }}>
            Help Hope become the best pup!<br />
            Track walks, celebrate wins! 🎉
          </p>
          <button
            onClick={signInWithGoogle}
            className="btn-hope w-full py-4 px-6 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-all"
            style={{
              background: 'var(--gradient-warm)',
              color: 'white',
              boxShadow: '0 8px 24px var(--shadow-soft)'
            }}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="mt-6 px-6 py-2 rounded-full transition-all font-medium"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)'
            }}
          >
            {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-[430px] mx-auto ${darkMode ? 'dark' : ''} min-h-screen pb-24 relative`}
      style={{ background: 'var(--bg-primary)' }}>

      {/* Decorative background blob */}
      <div className="blob" style={{
        width: '250px',
        height: '250px',
        background: 'var(--accent-warm)',
        top: '5%',
        right: '5%',
        opacity: 0.15
      }} />

      <header className="glass-card rounded-b-3xl p-5 mb-4 shadow-lg"
        style={{ background: 'linear-gradient(135deg, rgba(255, 217, 61, 0.1) 0%, rgba(255, 107, 53, 0.1) 100%)' }}>
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <span className="text-4xl hop">🐕</span> Hope&apos;s Tracker!
          </h1>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${isOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
              {isOnline ? '✓ Ready!' : '✗ Offline'}
            </span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-3 rounded-full transition-all transform hover:scale-110"
              style={{ background: 'var(--gradient-warm)' }}
            >
              <span className="text-xl">{darkMode ? '☀️' : '🌙'}</span>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {user.user_metadata.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-8 h-8 rounded-full wiggle"
                style={{ border: '3px solid var(--accent-warm)' }}
              />
            )}
            <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>
              👋 {user.user_metadata.full_name || user.email}
            </span>
          </div>
          <button
            onClick={signOut}
            className="text-xs font-bold px-3 py-1.5 rounded-full hover:opacity-80 transition-all"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
          >
            Leave
          </button>
        </div>
      </header>

      <main className="px-4">
        {activeTab === 'home' && <HomeTab logs={logs} streakData={streakData} darkMode={darkMode} />}
        {activeTab === 'log' && <LogTab onLog={addLog} setShowLogModal={setShowLogModal} showLogModal={showLogModal} darkMode={darkMode} />}
        {activeTab === 'trends' && <TrendsTab logs={logs} darkMode={darkMode} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass-card rounded-t-3xl shadow-2xl"
        style={{ background: 'var(--bg-card)', borderTop: '3px solid var(--accent-warm)' }}>
        <div className="max-w-[430px] mx-auto flex justify-around p-4 gap-3">
          {(['home', 'log', 'trends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="btn-hope flex-1 py-4 rounded-2xl font-bold text-base transition-all transform hover:scale-105"
              style={activeTab === tab ? {
                background: 'var(--gradient-warm)',
                color: 'white',
                boxShadow: '0 6px 20px var(--shadow-soft)',
                border: '2px solid rgba(255, 255, 255, 0.4)'
              } : {
                background: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                border: '2px solid transparent'
              }}
            >
              {tab === 'home' && '🏠 Home'}
              {tab === 'log' && '✏️ Add'}
              {tab === 'trends' && '📊 Stats'}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function HomeTab({ logs, streakData, darkMode }: { logs: HopeLog[], streakData: { currentStreak: number, maxStreak: number }, darkMode: boolean }) {
  const todayLogs = logs.filter(l => {
    const logDate = new Date(l.created_at).toDateString();
    return logDate === new Date().toDateString();
  });

  const todayWalks = todayLogs.filter(l => l.type === 'walk');
  const todayAccidents = todayLogs.filter(l => l.type === 'accident');

  return (
    <div className="space-y-5">
      {/* Streak Tracker - Hero Card */}
      <div className="glass-card rounded-3xl p-6 slide-up relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
          style={{ background: 'var(--accent-gold)' }} />

        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl hop">🔥</span>
          <h2 className="text-2xl font-serif font-bold" style={{ color: 'var(--text-primary)' }}>
            Streak Power!
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-6 relative z-10">
          <div className="text-center">
            <div className={`text-6xl font-bold mb-3 ${streakData.currentStreak > 0 ? 'pulse-warm' : ''}`}
              style={{ color: 'var(--accent-green)' }}>
              {streakData.currentStreak}
            </div>
            <div className="text-base font-bold" style={{ color: 'var(--text-secondary)' }}>
              Days Strong! 💪
            </div>
            <div className="mt-3 text-sm font-medium px-3 py-2 rounded-full"
              style={{
                background: streakData.currentStreak > 0 ? 'var(--gradient-success)' : 'var(--bg-secondary)',
                color: streakData.currentStreak > 0 ? 'white' : 'var(--text-muted)'
              }}>
              {streakData.currentStreak > 0 ? '🎉 Amazing!' : '🌟 Let\'s start!'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-6xl font-bold mb-3" style={{ color: 'var(--accent-gold)' }}>
              {streakData.maxStreak}
            </div>
            <div className="text-base font-bold" style={{ color: 'var(--text-secondary)' }}>
              Best Ever! 🏆
            </div>
            <div className="mt-3 text-sm font-medium px-3 py-2 rounded-full"
              style={{
                background: streakData.maxStreak > 0 ? 'var(--gradient-warm)' : 'var(--bg-secondary)',
                color: streakData.maxStreak > 0 ? 'white' : 'var(--text-muted)'
              }}>
              {streakData.maxStreak > 0 ? '⭐ Champion!' : '🎯 New goal!'}
            </div>
          </div>
        </div>

        {/* Achievement badges */}
        {streakData.currentStreak >= 7 && (
          <div className="mt-6 p-4 rounded-2xl text-center slide-up"
            style={{ background: 'var(--gradient-purple)' }}>
            <div className="text-3xl mb-1">🌟</div>
            <div className="text-white font-bold text-sm">
              {streakData.currentStreak >= 30 ? 'SUPER CHAMPION! 30+ Days!' :
               streakData.currentStreak >= 14 ? 'INCREDIBLE! 2 Weeks Strong!' :
               'AWESOME! 1 Week Complete!'}
            </div>
          </div>
        )}
      </div>

      {/* Today's Summary */}
      <div className="glass-card rounded-3xl p-6 slide-up stagger-1">
        <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span className="text-3xl">📅</span> Today&apos;s Adventures!
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl p-6 text-center relative overflow-hidden wiggle"
            style={{ background: 'var(--gradient-success)', boxShadow: '0 8px 20px rgba(0, 217, 163, 0.3)' }}>
            <div className="text-5xl font-bold text-white mb-2">{todayWalks.length}</div>
            <div className="text-base text-white font-bold">Walks! 🚶</div>
            <div className="mt-2 text-xs text-white/80 font-medium">
              {todayWalks.length === 0 ? 'Ready to go!' :
               todayWalks.length === 1 ? 'Great start!' :
               todayWalks.length === 2 ? 'Doing awesome!' : 'Super star! 🌟'}
            </div>
            <div className="absolute -bottom-4 -right-4 text-7xl opacity-20">🦴</div>
          </div>
          <div className="rounded-2xl p-6 text-center relative overflow-hidden"
            style={{
              background: todayAccidents.length === 0
                ? 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)'
                : 'linear-gradient(135deg, var(--accent-amber) 0%, var(--accent-warm) 100%)',
              boxShadow: todayAccidents.length === 0
                ? '0 8px 20px rgba(52, 152, 219, 0.3)'
                : '0 8px 20px rgba(255, 167, 38, 0.3)'
            }}>
            <div className="text-5xl font-bold text-white mb-2">{todayAccidents.length}</div>
            <div className="text-base text-white font-bold">Oopsies</div>
            <div className="mt-2 text-xs text-white/80 font-medium">
              {todayAccidents.length === 0 ? '🎉 Perfect day!' : 'Learning time! 📚'}
            </div>
            <div className="absolute -bottom-4 -right-4 text-7xl opacity-20">
              {todayAccidents.length === 0 ? '🎯' : '⚠️'}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="text-xl">⚡</span> What We Did Today
          </h3>
          {todayLogs.slice(0, 5).map((log, idx) => (
            <div key={log.id} className={`p-4 rounded-2xl slide-up stagger-${idx + 2}`}
              style={{
                background: log.type === 'walk'
                  ? 'linear-gradient(135deg, rgba(0, 217, 163, 0.15) 0%, rgba(0, 200, 150, 0.15) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 167, 38, 0.15) 0%, rgba(255, 107, 53, 0.15) 100%)',
                border: '2px solid',
                borderColor: log.type === 'walk' ? 'var(--accent-green)' : 'var(--accent-amber)'
              }}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  {log.type === 'walk' ? '🦴 Walk Time!' : `${log.subtype === 'pee' ? '💧' : '💩'} Oopsie`}
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{
                    background: log.type === 'walk' ? 'var(--gradient-success)' : 'var(--gradient-warm)',
                    color: 'white'
                  }}>
                  {new Date(log.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-sm flex items-center gap-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                <span>👤 {log.person}</span>
                {log.duration && <span>• ⏱️ {log.duration} min</span>}
              </div>
            </div>
          ))}
          {todayLogs.length === 0 && (
            <div className="text-center py-10 rounded-2xl" style={{
              background: 'var(--gradient-sunrise)',
              border: '3px dashed var(--accent-gold)'
            }}>
              <div className="text-6xl mb-3 hop">🌅</div>
              <p className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Ready for an Adventure!
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Let&apos;s take Hope for a walk! 🐕
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogTab({ onLog, setShowLogModal, showLogModal, darkMode }: {
  onLog: (data: Partial<HopeLog>) => void,
  setShowLogModal: (val: 'walk' | 'accident' | null) => void,
  showLogModal: 'walk' | 'accident' | null,
  darkMode: boolean
}) {
  return (
    <div className="space-y-6 py-4">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-serif font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          What Happened? 📝
        </h2>
        <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
          Tell us about Hope&apos;s adventure!
        </p>
      </div>

      <button
        onClick={() => setShowLogModal('walk')}
        className="btn-hope w-full p-10 rounded-3xl font-bold text-2xl shadow-2xl relative overflow-hidden slide-up transform hover:scale-105 transition-transform"
        style={{
          background: 'var(--gradient-success)',
          color: 'white',
          border: '4px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        <div className="absolute top-2 right-2 text-8xl opacity-15">🦴</div>
        <div className="relative z-10 flex items-center justify-center gap-4 mb-2">
          <span className="text-5xl">🚶</span>
          <span>Walk Time!</span>
        </div>
        <div className="text-base mt-3 opacity-95 font-semibold">
          Hope went on a walk! 🎉
        </div>
      </button>

      <button
        onClick={() => setShowLogModal('accident')}
        className="btn-hope w-full p-10 rounded-3xl font-bold text-2xl shadow-2xl relative overflow-hidden slide-up stagger-1 transform hover:scale-105 transition-transform"
        style={{
          background: 'linear-gradient(135deg, var(--accent-amber) 0%, var(--accent-warm) 100%)',
          color: 'white',
          border: '4px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        <div className="absolute top-2 right-2 text-8xl opacity-15">💧</div>
        <div className="relative z-10 flex items-center justify-center gap-4 mb-2">
          <span className="text-5xl">⚠️</span>
          <span>Oopsie!</span>
        </div>
        <div className="text-base mt-3 opacity-95 font-semibold">
          Little accident - that&apos;s okay! 💪
        </div>
      </button>

      {showLogModal && (
        <LogModal
          type={showLogModal}
          onClose={() => setShowLogModal(null)}
          onSubmit={onLog}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

function LogModal({ type, onClose, onSubmit, darkMode }: {
  type: 'walk' | 'accident',
  onClose: () => void,
  onSubmit: (data: Partial<HopeLog>) => void,
  darkMode: boolean
}) {
  const [subtype, setSubtype] = useState<'pee' | 'poop'>('pee');
  const [duration, setDuration] = useState('');

  function handleSubmit() {
    const logData: Partial<HopeLog> = {
      type,
      created_at: new Date().toISOString(),
    };

    if (type === 'accident') {
      logData.subtype = subtype;
    } else if (duration) {
      logData.duration = parseInt(duration);
    }

    onSubmit(logData);
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <div className="glass-card rounded-3xl p-8 w-full max-w-sm slide-up"
        style={{
          border: '3px solid',
          borderColor: type === 'walk' ? 'var(--accent-green)' : 'var(--accent-amber)'
        }}
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-3xl font-serif font-bold mb-6 flex items-center gap-3 hop"
          style={{ color: 'var(--text-primary)' }}>
          {type === 'walk' ? '🦴 Walk Time!' : '⚠️ Oopsie Happened'}
        </h3>

        {type === 'accident' && (
          <div className="mb-6">
            <label className="block text-base font-bold mb-4"
              style={{ color: 'var(--text-primary)' }}>
              What kind of oopsie? 🤔
            </label>
            <div className="grid grid-cols-2 gap-4">
              {(['pee', 'poop'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSubtype(s)}
                  className="btn-hope p-6 rounded-2xl font-bold text-xl transition-all transform hover:scale-105"
                  style={subtype === s ? {
                    background: 'linear-gradient(135deg, var(--accent-amber) 0%, var(--accent-warm) 100%)',
                    color: 'white',
                    boxShadow: '0 6px 20px var(--shadow-soft)',
                    border: '3px solid rgba(255, 255, 255, 0.4)'
                  } : {
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    border: '2px solid var(--bg-secondary)'
                  }}
                >
                  {s === 'pee' ? '💧 Pee' : '💩 Poop'}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'walk' && (
          <div className="mb-6">
            <label className="block text-base font-bold mb-4"
              style={{ color: 'var(--text-primary)' }}>
              How long was the walk? ⏱️
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Minutes (like 15)"
              className="w-full p-5 rounded-2xl border-3 font-bold text-lg transition-all focus:outline-none focus:ring-4"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--accent-green)',
                color: 'var(--text-primary)',
                '--tw-ring-color': 'var(--accent-green)'
              } as React.CSSProperties}
            />
            <p className="text-sm mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>
              💡 You can skip this if you want!
            </p>
          </div>
        )}

        <div className="flex gap-4 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-5 rounded-2xl font-bold text-lg transition-all transform hover:scale-105"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '2px solid var(--text-muted)'
            }}
          >
            Nevermind
          </button>
          <button
            onClick={handleSubmit}
            className="btn-hope flex-1 py-5 rounded-2xl font-bold text-lg shadow-xl transform hover:scale-105"
            style={{
              background: type === 'walk' ? 'var(--gradient-success)' : 'var(--gradient-warm)',
              color: 'white',
              border: '3px solid rgba(255, 255, 255, 0.4)'
            }}
          >
            ✅ Save It!
          </button>
        </div>
      </div>
    </div>
  );
}

function TrendsTab({ logs, darkMode }: { logs: HopeLog[], darkMode: boolean }) {
  const [view, setView] = useState<'daily' | 'heatmap'>('daily');

  const dailyData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();

      const dayLogs = logs.filter(l => new Date(l.created_at).toDateString() === dateStr);
      const walks = dayLogs.filter(l => l.type === 'walk').length;
      const accidents = dayLogs.filter(l => l.type === 'accident').length;

      days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        walks,
        accidents,
      });
    }
    return days;
  }, [logs]);

  const heatmapData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();

      const dayLogs = logs.filter(l => new Date(l.created_at).toDateString() === dateStr);
      const walks = dayLogs.filter(l => l.type === 'walk').length;
      const accidents = dayLogs.filter(l => l.type === 'accident').length;

      let color = 'var(--bg-secondary)';
      let gradient = '';
      if (accidents > 0 && walks === 0) {
        gradient = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      } else if (accidents > 0) {
        gradient = 'linear-gradient(135deg, var(--accent-amber) 0%, var(--accent-warm) 100%)';
      } else if (walks > 0) {
        gradient = 'var(--gradient-success)';
      }

      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        color,
        gradient,
        walks,
        accidents,
      });
    }
    return days;
  }, [logs, darkMode]);

  return (
    <div className="space-y-5 py-2">
      {/* View Toggle */}
      <div className="glass-card rounded-2xl p-2 flex gap-3">
        <button
          onClick={() => setView('daily')}
          className="btn-hope flex-1 py-4 rounded-xl font-bold text-base transition-all transform hover:scale-105"
          style={view === 'daily' ? {
            background: 'var(--gradient-warm)',
            color: 'white',
            boxShadow: '0 4px 16px var(--shadow-soft)',
            border: '2px solid rgba(255, 255, 255, 0.4)'
          } : {
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            border: '2px solid transparent'
          }}
        >
          📊 Chart
        </button>
        <button
          onClick={() => setView('heatmap')}
          className="btn-hope flex-1 py-4 rounded-xl font-bold text-base transition-all transform hover:scale-105"
          style={view === 'heatmap' ? {
            background: 'var(--gradient-warm)',
            color: 'white',
            boxShadow: '0 4px 16px var(--shadow-soft)',
            border: '2px solid rgba(255, 255, 255, 0.4)'
          } : {
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            border: '2px solid transparent'
          }}
        >
          🗓️ Calendar
        </button>
      </div>

      {view === 'daily' && (
        <div className="glass-card rounded-3xl p-6 slide-up">
          <h3 className="font-serif font-bold text-2xl mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="text-3xl">📈</span> This Week&apos;s Stats!
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyData}>
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                style={{ fontSize: '12px', fontWeight: 500 }}
              />
              <YAxis
                stroke="var(--text-muted)"
                style={{ fontSize: '12px', fontWeight: 500 }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: 'none',
                  borderRadius: '16px',
                  color: 'var(--text-primary)',
                  boxShadow: '0 8px 24px var(--shadow-soft)',
                  padding: '12px 16px',
                  fontWeight: 600
                }}
                cursor={{ fill: 'var(--bg-secondary)', opacity: 0.3 }}
              />
              <Bar dataKey="walks" fill="var(--accent-green)" radius={[12, 12, 0, 0]} />
              <Bar dataKey="accidents" fill="var(--accent-amber)" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'heatmap' && (
        <div className="glass-card rounded-3xl p-6 slide-up">
          <h3 className="font-serif font-bold text-2xl mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="text-3xl">🗓️</span> Week at a Glance!
          </h3>
          <div className="space-y-3 mb-6">
            {heatmapData.map((day, i) => (
              <div key={i} className={`flex items-center gap-3 slide-up stagger-${i + 1}`}>
                <div className="text-sm font-bold w-24" style={{ color: 'var(--text-primary)' }}>
                  {day.day}
                </div>
                <div
                  className="flex-1 h-16 rounded-2xl flex items-center justify-center font-bold text-base shadow-lg transition-all transform hover:scale-105"
                  style={{
                    background: day.gradient || day.color,
                    color: day.gradient ? 'white' : 'var(--text-muted)',
                    border: day.gradient ? '3px solid rgba(255, 255, 255, 0.3)' : '2px dashed var(--text-muted)'
                  }}
                >
                  {day.walks > 0 && <span className="text-lg">🦴 {day.walks}</span>}
                  {day.walks > 0 && day.accidents > 0 && <span className="mx-2">•</span>}
                  {day.accidents > 0 && <span className="text-lg">⚠️ {day.accidents}</span>}
                  {day.walks === 0 && day.accidents === 0 && <span className="text-2xl">💤</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-3 text-sm justify-center flex-wrap pt-5 border-t-2"
            style={{ borderColor: 'var(--accent-gold)' }}>
            <div className="flex items-center gap-2 font-bold">
              <div className="w-6 h-6 rounded-lg shadow-md" style={{ background: 'var(--gradient-success)' }}></div>
              <span style={{ color: 'var(--text-primary)' }}>🦴 Walks</span>
            </div>
            <div className="flex items-center gap-2 font-bold">
              <div className="w-6 h-6 rounded-lg shadow-md" style={{
                background: 'linear-gradient(135deg, var(--accent-amber) 0%, var(--accent-warm) 100%)'
              }}></div>
              <span style={{ color: 'var(--text-primary)' }}>📝 Both</span>
            </div>
            <div className="flex items-center gap-2 font-bold">
              <div className="w-6 h-6 rounded-lg shadow-md" style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              }}></div>
              <span style={{ color: 'var(--text-primary)' }}>⚠️ Oopsies</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
