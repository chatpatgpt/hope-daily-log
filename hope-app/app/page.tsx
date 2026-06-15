'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, type HopeLog } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<HopeLog[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'log' | 'stats'>('home');
  const [darkMode, setDarkMode] = useState(false);
  const [showModal, setShowModal] = useState<'walk' | 'accident' | null>(null);

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
      }
    });
    if (error) alert('Oops! Could not sign in: ' + error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setLogs([]);
  }

  async function fetchLogs() {
    const { data, error } = await supabase
      .from('hope_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setLogs(data || []);
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
    const { error } = await supabase.from('hope_logs').insert([{
      ...logData,
      user_id: user.id,
      user_email: user.email,
      person: user.user_metadata.full_name || user.email?.split('@')[0] || 'Friend'
    }]);
    if (error) {
      alert('Oops! Could not save: ' + error.message);
    } else {
      setShowModal(null);
    }
  }

  const streakData = useMemo(() => {
    // Walk Streak: consecutive days with at least one walk
    const walkDays = [...logs]
      .filter(l => l.type === 'walk')
      .map(l => new Date(l.created_at).toDateString());
    const walkDaysSet = new Set(walkDays);

    let walkStreak = 0;
    let maxWalkStreak = 0;
    let tempWalkStreak = 0;

    for (let i = 0; i < 365; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      if (walkDaysSet.has(dateStr)) {
        tempWalkStreak++;
        if (i === 0) walkStreak = tempWalkStreak;
      } else {
        maxWalkStreak = Math.max(maxWalkStreak, tempWalkStreak);
        tempWalkStreak = 0;
        if (i === 0) walkStreak = 0;
      }
    }
    maxWalkStreak = Math.max(maxWalkStreak, tempWalkStreak);

    // Clean Streak: consecutive days without accidents
    const accidentDays = [...logs]
      .filter(l => l.type === 'accident')
      .map(l => new Date(l.created_at).toDateString());
    const accidentDaysSet = new Set(accidentDays);

    let cleanStreak = 0;
    let maxCleanStreak = 0;
    let tempCleanStreak = 0;

    for (let i = 0; i < 365; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      if (!accidentDaysSet.has(dateStr)) {
        tempCleanStreak++;
        if (i === 0) cleanStreak = tempCleanStreak;
      } else {
        maxCleanStreak = Math.max(maxCleanStreak, tempCleanStreak);
        tempCleanStreak = 0;
        if (i === 0) cleanStreak = 0;
      }
    }
    maxCleanStreak = Math.max(maxCleanStreak, tempCleanStreak);

    return {
      walkStreak,
      maxWalkStreak,
      cleanStreak,
      maxCleanStreak
    };
  }, [logs]);

  if (loading) {
    return (
      <div className={darkMode ? 'dark' : ''} style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '10rem',
            height: '10rem',
            borderRadius: '50%',
            border: '6px solid var(--primary)',
            overflow: 'hidden',
            margin: '0 auto 1.5rem',
            boxShadow: 'var(--shadow-lg)'
          }} className="hop">
            <img src="/hope.jpg" alt="Hope" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-bubblegum)',
            fontSize: '2.5rem',
            color: 'var(--ink)',
            marginBottom: '0.5rem'
          }}>
            Loading Hope...
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.25rem', fontWeight: 600 }}>
            Woof woof! 🦴
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={darkMode ? 'dark' : ''} style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '2rem'
      }}>
        <div className="card slide-in" style={{
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          padding: '3rem 2rem'
        }}>
          <div style={{
            width: '12rem',
            height: '12rem',
            borderRadius: '50%',
            border: '6px solid var(--primary)',
            overflow: 'hidden',
            margin: '0 auto 1.5rem',
            boxShadow: 'var(--shadow-lg)'
          }} className="hop">
            <img src="/hope.jpg" alt="Hope" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-bubblegum)',
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            color: 'var(--ink)',
            marginBottom: '1rem',
            lineHeight: 1.2
          }}>
            Hope&apos;s Tracker!
          </h1>
          <p style={{
            color: 'var(--muted)',
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '2.5rem'
          }}>
            Track walks, earn stars, and help Hope be the best pup! ⭐
          </p>
          <button
            onClick={signInWithGoogle}
            className="btn-primary"
            style={{ width: '100%', fontSize: '1.375rem', padding: '1.25rem 2rem' }}
          >
            <span style={{ fontSize: '1.5rem', marginRight: '0.75rem' }}>🚀</span>
            Let&apos;s Start!
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '100px',
              border: '3px solid var(--ink)',
              background: 'transparent',
              color: 'var(--ink)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''} style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      paddingBottom: '8rem'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <header className="card" style={{
          margin: '1rem',
          borderRadius: '0 0 24px 24px',
          borderTop: 'none',
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                border: '4px solid var(--primary)',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                <img src="/hope.jpg" alt="Hope" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <h1 style={{
                fontFamily: 'var(--font-bubblegum)',
                fontSize: '2rem',
                color: 'var(--ink)',
                lineHeight: 1
              }}>
                Hope&apos;s Tracker
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {user.user_metadata.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="You"
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    border: '2px solid var(--muted)',
                    opacity: 0.7
                  }}
                />
              )}
              <button
                onClick={() => setDarkMode(!darkMode)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '50%',
                  border: '2px solid var(--ink)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  lineHeight: 1
                }}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ padding: '1rem' }}>
          {activeTab === 'home' && <HomeTab logs={logs} streakData={streakData} />}
          {activeTab === 'log' && <LogTab onShowModal={setShowModal} />}
          {activeTab === 'stats' && <StatsTab logs={logs} />}
        </main>

        {/* Bottom Navigation */}
        <nav className="card" style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: '24px 24px 0 0',
          borderBottom: 'none',
          padding: '1.25rem',
          zIndex: 10
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0.75rem'
          }}>
            {(['home', 'log', 'stats'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? 'btn-primary' : ''}
                style={activeTab === tab ? {
                  padding: '1rem'
                } : {
                  padding: '1rem',
                  borderRadius: '20px',
                  border: '3px solid var(--ink)',
                  background: 'transparent',
                  color: 'var(--ink)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                {tab === 'home' && '🏠 Home'}
                {tab === 'log' && '➕ Add'}
                {tab === 'stats' && '📊 Stats'}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {showModal && (
        <LogModal
          type={showModal}
          onClose={() => setShowModal(null)}
          onSubmit={addLog}
        />
      )}
    </div>
  );
}

function HomeTab({ logs, streakData }: {
  logs: HopeLog[],
  streakData: { walkStreak: number, maxWalkStreak: number, cleanStreak: number, maxCleanStreak: number }
}) {
  const todayLogs = logs.filter(l =>
    new Date(l.created_at).toDateString() === new Date().toDateString()
  );
  const todayWalks = todayLogs.filter(l => l.type === 'walk').length;
  const todayAccidents = todayLogs.filter(l => l.type === 'accident').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Streak Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card-primary slide-in" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
          <div style={{ fontSize: '3.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {streakData.walkStreak}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, opacity: 0.9 }}>
            Walk Streak 🔥
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.7, marginTop: '0.25rem' }}>
            Best: {streakData.maxWalkStreak}
          </div>
        </div>
        <div className="card-accent slide-in delay-1" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
          <div style={{ fontSize: '3.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {streakData.cleanStreak}
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, opacity: 0.9 }}>
            Clean Streak ⭐
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.7, marginTop: '0.25rem' }}>
            Best: {streakData.maxCleanStreak}
          </div>
        </div>
      </div>

      {/* Today Stats */}
      <div className="card slide-in delay-2">
        <h2 style={{
          fontFamily: 'var(--font-bubblegum)',
          fontSize: '2rem',
          color: 'var(--ink)',
          marginBottom: '1.5rem'
        }}>
          Today&apos;s Adventure
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="card-primary" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🦴</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {todayWalks}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, opacity: 0.9 }}>
              Walks
            </div>
          </div>
          <div className={todayAccidents === 0 ? 'card-blue' : 'card-accent'}
            style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              {todayAccidents === 0 ? '🎉' : '⚠️'}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {todayAccidents}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, opacity: 0.9 }}>
              Oopsies
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {todayLogs.length > 0 ? (
        <div className="card slide-in delay-3">
          <h3 style={{
            fontFamily: 'var(--font-bubblegum)',
            fontSize: '1.5rem',
            color: 'var(--ink)',
            marginBottom: '1rem'
          }}>
            What We Did
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {todayLogs.slice(0, 5).map(log => (
              <div
                key={log.id}
                style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  background: log.type === 'walk' ? 'oklch(0.62 0.18 145 / 0.15)' : 'oklch(0.70 0.21 38 / 0.15)',
                  border: '3px solid',
                  borderColor: log.type === 'walk' ? 'var(--primary)' : 'var(--accent)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: log.type === 'walk' && (log.pooped || log.peed) ? '0.5rem' : 0 }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    {log.type === 'walk' ? '🦴 Walk' : `⚠️ ${log.subtype === 'pee' ? 'Pee' : 'Poop'} Inside`}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted)' }}>
                    {new Date(log.created_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                {log.type === 'walk' && (log.pooped || log.peed) && (
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                    {log.pooped && <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '100px',
                      background: 'var(--primary)',
                      color: 'white'
                    }}>💩 Pooped</span>}
                    {log.peed && <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '100px',
                      background: 'var(--primary)',
                      color: 'white'
                    }}>💧 Peed</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card slide-in delay-3" style={{
          textAlign: 'center',
          padding: '3rem 2rem'
        }}>
          <div style={{
            width: '8rem',
            height: '8rem',
            borderRadius: '50%',
            border: '5px solid var(--accent)',
            overflow: 'hidden',
            margin: '0 auto 1.5rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <img src="/hope.jpg" alt="Hope" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h3 style={{
            fontFamily: 'var(--font-bubblegum)',
            fontSize: '1.75rem',
            color: 'var(--ink)',
            marginBottom: '0.5rem'
          }}>
            Ready for Adventure!
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: '1.125rem', fontWeight: 600 }}>
            Let&apos;s take Hope outside! 🐕
          </p>
        </div>
      )}
    </div>
  );
}

function LogTab({ onShowModal }: { onShowModal: (type: 'walk' | 'accident') => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-bubblegum)',
          fontSize: '2.5rem',
          color: 'var(--ink)',
          marginBottom: '0.5rem'
        }}>
          What Happened?
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '1.125rem', fontWeight: 600 }}>
          Tell us about Hope&apos;s day!
        </p>
      </div>

      <button
        onClick={() => onShowModal('walk')}
        className="btn-primary slide-in"
        style={{
          width: '100%',
          padding: '2.5rem 2rem',
          fontSize: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}
      >
        <span style={{ fontSize: '4rem' }}>🦴</span>
        <span>Walk Time!</span>
      </button>

      <button
        onClick={() => onShowModal('accident')}
        className="btn-secondary slide-in delay-1"
        style={{
          width: '100%',
          padding: '2.5rem 2rem',
          fontSize: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}
      >
        <span style={{ fontSize: '4rem' }}>⚠️</span>
        <span>Had an Oopsie</span>
      </button>
    </div>
  );
}

function StatsTab({ logs }: { logs: HopeLog[] }) {
  const dailyData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const dayLogs = logs.filter(l => new Date(l.created_at).toDateString() === dateStr);
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        walks: dayLogs.filter(l => l.type === 'walk').length,
        accidents: dayLogs.filter(l => l.type === 'accident').length
      });
    }
    return days;
  }, [logs]);

  return (
    <div className="card slide-in">
      <h2 style={{
        fontFamily: 'var(--font-bubblegum)',
        fontSize: '2rem',
        color: 'var(--ink)',
        marginBottom: '2rem'
      }}>
        This Week&apos;s Stats
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {dailyData.map((day, i) => (
          <div
            key={i}
            className="slide-in"
            style={{
              animationDelay: `${i * 0.1}s`,
              opacity: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}
          >
            <div style={{
              width: '4rem',
              fontWeight: 700,
              color: 'var(--ink)',
              fontSize: '1rem'
            }}>
              {day.day}
            </div>
            <div style={{
              flex: 1,
              padding: '1.25rem',
              borderRadius: '16px',
              background: day.walks > 0 && day.accidents === 0
                ? 'var(--primary)'
                : day.accidents > 0 && day.walks === 0
                  ? 'var(--accent)'
                  : day.walks > 0
                    ? 'var(--purple)'
                    : 'var(--surface)',
              color: day.walks > 0 || day.accidents > 0 ? 'white' : 'var(--muted)',
              border: '3px solid',
              borderColor: day.walks > 0 || day.accidents > 0 ? 'oklch(0.25 0.015 279 / 0.2)' : 'var(--ink)',
              fontWeight: 700,
              fontSize: '1.125rem',
              textAlign: 'center'
            }}
          >
            {day.walks > 0 && `🦴 ${day.walks}`}
            {day.walks > 0 && day.accidents > 0 && ' · '}
            {day.accidents > 0 && `⚠️ ${day.accidents}`}
            {day.walks === 0 && day.accidents === 0 && '—'}
          </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogModal({ type, onClose, onSubmit }: {
  type: 'walk' | 'accident',
  onClose: () => void,
  onSubmit: (data: Partial<HopeLog>) => void
}) {
  const [subtype, setSubtype] = useState<'pee' | 'poop'>('pee');
  const [duration, setDuration] = useState('');
  const [pooped, setPooped] = useState(false);
  const [peed, setPeed] = useState(false);

  function handleSubmit() {
    const logData: Partial<HopeLog> = {
      type,
      created_at: new Date().toISOString()
    };
    if (type === 'accident') {
      logData.subtype = subtype;
    } else {
      // For walks
      if (duration) {
        logData.duration = parseInt(duration);
      }
      logData.pooped = pooped;
      logData.peed = peed;
    }
    onSubmit(logData);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(0.25 0.015 279 / 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        zIndex: 100
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card pop-in"
        style={{
          maxWidth: '500px',
          width: '100%',
          padding: '2rem'
        }}
      >
        <h3 style={{
          fontFamily: 'var(--font-bubblegum)',
          fontSize: '2rem',
          color: 'var(--ink)',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '2.5rem' }}>
            {type === 'walk' ? '🦴' : '⚠️'}
          </span>
          {type === 'walk' ? 'Walk Time!' : 'Oopsie Happened'}
        </h3>

        {type === 'accident' && (
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontWeight: 700,
              fontSize: '1.125rem',
              color: 'var(--ink)',
              marginBottom: '1rem'
            }}>
              What kind?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {(['pee', 'poop'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSubtype(s)}
                  className={subtype === s ? 'btn-secondary' : ''}
                  style={subtype === s ? {
                    padding: '1.5rem'
                  } : {
                    padding: '1.5rem',
                    borderRadius: '20px',
                    border: '3px solid var(--ink)',
                    background: 'transparent',
                    color: 'var(--ink)',
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    cursor: 'pointer'
                  }}
                >
                  {s === 'pee' ? '💧 Pee' : '💩 Poop'}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'walk' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--ink)',
                marginBottom: '1rem'
              }}>
                What did Hope do? (check all)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={() => setPooped(!pooped)}
                  style={{
                    padding: '1rem 1.5rem',
                    borderRadius: '16px',
                    border: '3px solid',
                    borderColor: pooped ? 'var(--primary)' : 'var(--ink)',
                    background: pooped ? 'var(--primary)' : 'transparent',
                    color: pooped ? 'white' : 'var(--ink)',
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>💩 Pooped outside</span>
                  <span style={{ fontSize: '1.5rem' }}>{pooped ? '✓' : '○'}</span>
                </button>
                <button
                  onClick={() => setPeed(!peed)}
                  style={{
                    padding: '1rem 1.5rem',
                    borderRadius: '16px',
                    border: '3px solid',
                    borderColor: peed ? 'var(--primary)' : 'var(--ink)',
                    background: peed ? 'var(--primary)' : 'transparent',
                    color: peed ? 'white' : 'var(--ink)',
                    fontWeight: 700,
                    fontSize: '1.125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>💧 Peed outside</span>
                  <span style={{ fontSize: '1.5rem' }}>{peed ? '✓' : '○'}</span>
                </button>
              </div>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--ink)',
                marginBottom: '1rem'
              }}>
                How long? (minutes, optional)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Like 15"
                style={{
                  width: '100%',
                  padding: '1rem 1.5rem',
                  borderRadius: '16px',
                  border: '3px solid var(--ink)',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                  fontWeight: 700,
                  fontSize: '1.125rem',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '1rem',
              borderRadius: '20px',
              border: '3px solid var(--ink)',
              background: 'transparent',
              color: 'var(--ink)',
              fontWeight: 700,
              fontSize: '1.125rem',
              cursor: 'pointer'
            }}
          >
            Nevermind
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary"
            style={{ padding: '1rem', fontSize: '1.125rem' }}
          >
            ✓ Save It!
          </button>
        </div>
      </div>
    </div>
  );
}
