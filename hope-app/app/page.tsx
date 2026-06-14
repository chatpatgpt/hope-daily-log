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
      const unsubscribe = subscribeToLogs();
      return unsubscribe;
    }
  }, [user]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    setLoading(false);
  }

  async function signInWithGoogle() {
    console.log('🔵 Attempting Google sign-in...');
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Redirect to:', window.location.origin);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    console.log('🔵 OAuth Response:', { data, error });

    if (error) {
      console.error('❌ Login error:', error);
      alert('Failed to login: ' + error.message);
    } else if (data?.url) {
      console.log('✅ Redirecting to:', data.url);
      window.location.href = data.url;
    } else {
      console.warn('⚠️ No redirect URL returned');
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
      <div className={`${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'} min-h-screen flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-4xl mb-4">🐕</div>
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'} min-h-screen flex items-center justify-center p-4`}>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-xl p-8 max-w-md w-full text-center`}>
          <div className="text-6xl mb-4">🐕</div>
          <h1 className="text-3xl font-bold mb-2">Hope&apos;s Habit Tracker</h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-8`}>
            Track Hope&apos;s walks and accidents to build better habits together
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-3 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="mt-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-[430px] mx-auto ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'} min-h-screen pb-20`}>
      <header className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm p-4`}>
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold">🐕 Hope&apos;s Habit Tracker</h1>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
              {isOnline ? '● Synced' : '● Offline'}
            </span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {user.user_metadata.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="Profile"
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
              {user.user_metadata.full_name || user.email}
            </span>
          </div>
          <button
            onClick={signOut}
            className={`text-xs ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="p-4">
        {activeTab === 'home' && <HomeTab logs={logs} streakData={streakData} darkMode={darkMode} />}
        {activeTab === 'log' && <LogTab onLog={addLog} setShowLogModal={setShowLogModal} showLogModal={showLogModal} darkMode={darkMode} />}
        {activeTab === 'trends' && <TrendsTab logs={logs} darkMode={darkMode} />}
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
        <div className="max-w-[430px] mx-auto flex justify-around p-2">
          {(['home', 'log', 'trends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-center rounded-lg font-medium transition ${
                activeTab === tab
                  ? 'bg-green-500 text-white'
                  : darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'home' && '🏠 Home'}
              {tab === 'log' && '✏️ Log'}
              {tab === 'trends' && '📊 Trends'}
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
    <div className="space-y-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md p-6`}>
        <h2 className="text-lg font-bold mb-4">🔥 Streak Tracker</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-500">{streakData.currentStreak}</div>
            <div className="text-sm text-gray-500">Current Streak</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-500">{streakData.maxStreak}</div>
            <div className="text-sm text-gray-500">Best Streak</div>
          </div>
        </div>
      </div>

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md p-6`}>
        <h2 className="text-lg font-bold mb-4">📅 Today&apos;s Summary</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-4 bg-green-100 dark:bg-green-900 rounded-lg">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{todayWalks.length}</div>
            <div className="text-sm">Walks</div>
          </div>
          <div className="text-center p-4 bg-amber-100 dark:bg-amber-900 rounded-lg">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{todayAccidents.length}</div>
            <div className="text-sm">Accidents</div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400">Recent Activity</h3>
          {todayLogs.slice(0, 5).map(log => (
            <div key={log.id} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex justify-between items-center">
                <span className="font-medium">
                  {log.type === 'walk' ? '🚶 Walk' : `${log.subtype === 'pee' ? '💧' : '💩'} Accident`}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(log.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {log.person} {log.duration && `• ${log.duration} min`}
              </div>
            </div>
          ))}
          {todayLogs.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No activity yet today</p>
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
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">Quick Log</h2>

      <button
        onClick={() => setShowLogModal('walk')}
        className="w-full p-6 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-lg font-bold text-lg"
      >
        🚶 Log Walk
      </button>

      <button
        onClick={() => setShowLogModal('accident')}
        className="w-full p-6 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg font-bold text-lg"
      >
        ⚠️ Log Accident
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 w-full max-w-sm`}>
        <h3 className="text-xl font-bold mb-4">
          {type === 'walk' ? '🚶 Log Walk' : '⚠️ Log Accident'}
        </h3>

        {type === 'accident' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['pee', 'poop'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSubtype(s)}
                  className={`p-3 rounded-lg font-medium ${
                    subtype === s
                      ? 'bg-amber-500 text-white'
                      : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {s === 'pee' ? '💧 Pee' : '💩 Poop'}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'walk' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Duration (optional, minutes)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g., 15"
              className={`w-full p-3 rounded-lg border ${
                darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className={`flex-1 py-3 rounded-lg font-medium ${
              darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-lg font-medium bg-green-500 text-white hover:bg-green-600"
          >
            Save
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

      let color = darkMode ? '#374151' : '#f3f4f6';
      if (accidents > 0 && walks === 0) color = '#ef4444';
      else if (accidents > 0) color = '#f59e0b';
      else if (walks > 0) color = '#10b981';

      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        color,
        walks,
        accidents,
      });
    }
    return days;
  }, [logs, darkMode]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('daily')}
          className={`flex-1 py-2 rounded-lg font-medium ${
            view === 'daily'
              ? 'bg-blue-500 text-white'
              : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
          }`}
        >
          Daily Summary
        </button>
        <button
          onClick={() => setView('heatmap')}
          className={`flex-1 py-2 rounded-lg font-medium ${
            view === 'heatmap'
              ? 'bg-blue-500 text-white'
              : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
          }`}
        >
          Heatmap
        </button>
      </div>

      {view === 'daily' && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md p-4`}>
          <h3 className="font-bold mb-4">Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
              <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
              <Tooltip
                contentStyle={{
                  backgroundColor: darkMode ? '#1f2937' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  color: darkMode ? '#f3f4f6' : '#111',
                }}
              />
              <Bar dataKey="walks" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="accidents" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'heatmap' && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-md p-4`}>
          <h3 className="font-bold mb-4">7-Day Activity Map</h3>
          <div className="space-y-2">
            {heatmapData.map((day, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-sm font-medium w-24">{day.day}</div>
                <div
                  className="flex-1 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: day.color }}
                >
                  {day.walks > 0 && `${day.walks} walks`}
                  {day.accidents > 0 && ` • ${day.accidents} accidents`}
                  {day.walks === 0 && day.accidents === 0 && '—'}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-xs justify-center">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span>Walks only</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-amber-500"></div>
              <span>Both</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span>Accidents only</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
