'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, type HopeLog } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<HopeLog[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    document.body.className = savedDarkMode ? 'dark' : '';
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    document.body.className = darkMode ? 'dark' : '';
  }, [darkMode]);

  useEffect(() => {
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => authListener.subscription.unsubscribe();
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
    if (error) alert('Could not sign in: ' + error.message);
  }

  async function signInAnonymously() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) alert('Could not continue as guest: ' + error.message);
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

  function handleDayClick(date: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const clickedDate = new Date(date);
    clickedDate.setHours(0, 0, 0, 0);

    if (clickedDate.getTime() === today.getTime()) {
      setSelectedDay(date);
      setShowModal(true);
    }
  }

  async function saveDayLog(pooped: boolean, peed: boolean) {
    if (!user || !selectedDay) return;

    const dayStr = selectedDay.toDateString();
    const existingLog = logs.find(l =>
      l.type === 'walk' && new Date(l.created_at).toDateString() === dayStr
    );

    try {
      if (existingLog) {
        // Update existing walk
        const { error } = await supabase
          .from('hope_logs')
          .update({ pooped, peed })
          .eq('id', existingLog.id);

        if (error) throw error;
      } else {
        // Create new walk
        const { error } = await supabase.from('hope_logs').insert([{
          type: 'walk',
          pooped,
          peed,
          user_id: user.id,
          user_email: user.email,
          person: user.user_metadata.full_name || user.email?.split('@')[0] || 'User',
          created_at: selectedDay.toISOString()
        }]);

        if (error) throw error;
      }

      // Refresh logs immediately
      await fetchLogs();
      setShowModal(false);
    } catch (err) {
      console.error('Save error:', err);
      alert('Could not save: ' + (err as Error).message);
    }
  }

  const walkStreak = useMemo(() => {
    const walkDays = [...logs]
      .filter(l => l.type === 'walk')
      .map(l => new Date(l.created_at).toDateString());
    const walkDaysSet = new Set(walkDays);

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      if (walkDaysSet.has(date.toDateString())) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [logs]);

  if (loading) {
    return (
      <div className={darkMode ? 'dark' : ''} style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            border: '3px solid var(--primary)',
            overflow: 'hidden',
            margin: '0 auto 1rem'
          }}>
            <img src="/hope.jpg" alt="Hope" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <p style={{ color: 'var(--muted)', fontWeight: 500 }}>Loading...</p>
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
        padding: '2rem'
      }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{
            width: '6rem',
            height: '6rem',
            borderRadius: '50%',
            border: '3px solid var(--primary)',
            overflow: 'hidden',
            margin: '0 auto 1.5rem'
          }}>
            <img src="/hope.jpg" alt="Hope" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: 'var(--ink)'
          }}>
            Hope&apos;s Walk Tracker
          </h1>
          <p style={{
            color: 'var(--muted)',
            marginBottom: '2rem',
            fontSize: '0.875rem'
          }}>
            Track daily walks and bathroom habits
          </p>
          <button onClick={signInWithGoogle} className="btn btn-primary" style={{ width: '100%' }}>
            Sign in with Google
          </button>
          <button onClick={signInAnonymously} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.75rem' }}>
            Continue as Guest
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''} style={{
      minHeight: '100vh',
      padding: '1rem',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            border: '2px solid var(--primary)',
            overflow: 'hidden'
          }}>
            <img src="/hope.jpg" alt="Hope" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>
            Hope&apos;s Walks
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {user.user_metadata.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt="User"
              style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '50%',
                border: '1px solid var(--border)'
              }}
            />
          )}
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem'
            }}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Streak */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div className="streak-badge">
          <span>🔥</span>
          <span>{walkStreak} day{walkStreak !== 1 ? 's' : ''} walking streak</span>
        </div>
      </div>

      {/* Calendar */}
      <CalendarView
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        logs={logs}
        onDayClick={handleDayClick}
      />

      {/* Day Modal */}
      {showModal && selectedDay && (
        <DayModal
          date={selectedDay}
          logs={logs}
          onClose={() => setShowModal(false)}
          onSave={saveDayLog}
        />
      )}
    </div>
  );
}

function CalendarView({ currentMonth, setCurrentMonth, logs, onDayClick }: {
  currentMonth: Date,
  setCurrentMonth: (date: Date) => void,
  logs: HopeLog[],
  onDayClick: (date: Date) => void
}) {
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function getDayStatus(date: Date) {
    const dateStr = date.toDateString();
    const dayLog = logs.find(l =>
      l.type === 'walk' && new Date(l.created_at).toDateString() === dateStr
    );

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const isPast = checkDate < today;
    const isToday = checkDate.getTime() === today.getTime();
    const isFuture = checkDate > today;

    return {
      dayLog,
      isPast,
      isToday,
      isFuture,
      isMissed: isPast && !dayLog
    };
  }

  function prevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  }

  return (
    <div className="card">
      {/* Month Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem'
      }}>
        <button onClick={prevMonth} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
          ←
        </button>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--ink)' }}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={nextMonth} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem' }}>
          →
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="calendar-grid" style={{ marginBottom: '0.5rem' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--muted)',
            padding: '0.5rem 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {days.map(date => {
          const status = getDayStatus(date);
          const isOtherMonth = date.getMonth() !== currentMonth.getMonth();

          return (
            <div
              key={date.toISOString()}
              className={`calendar-day ${status.isToday ? 'today' : ''} ${status.isFuture || isOtherMonth ? 'disabled' : ''} ${isOtherMonth ? 'other-month' : ''}`}
              onClick={() => !status.isFuture && !isOtherMonth && onDayClick(date)}
            >
              <div className="day-number" style={{ color: isOtherMonth ? 'var(--light-text)' : 'var(--ink)' }}>
                {date.getDate()}
              </div>
              <div className="day-indicators">
                {!isOtherMonth && !status.isFuture && (
                  <>
                    {status.dayLog && (
                      <>
                        {status.dayLog.pooped && <span>💩</span>}
                        {status.dayLog.peed && <span>💧</span>}
                      </>
                    )}
                    {status.isMissed && <span style={{ color: 'var(--error)', fontSize: '1.25rem' }}>✕</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        fontSize: '0.75rem',
        color: 'var(--muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>💩</span> Pooped
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>💧</span> Peed
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ color: 'var(--error)' }}>✕</span> Missed
        </div>
      </div>
    </div>
  );
}

function DayModal({ date, logs, onClose, onSave }: {
  date: Date,
  logs: HopeLog[],
  onClose: () => void,
  onSave: (pooped: boolean, peed: boolean) => void
}) {
  const dateStr = date.toDateString();
  const existingLog = logs.find(l =>
    l.type === 'walk' && new Date(l.created_at).toDateString() === dateStr
  );

  const [pooped, setPooped] = useState(existingLog?.pooped ?? false);
  const [peed, setPeed] = useState(existingLog?.peed ?? false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          marginBottom: '1.5rem',
          color: 'var(--ink)'
        }}>
          {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setPooped(!pooped)}
            className={`toggle-btn ${pooped ? 'active' : ''}`}
          >
            <span>💩 Pooped outside</span>
            <span style={{ fontSize: '1.25rem' }}>{pooped ? '✓' : '○'}</span>
          </button>
          <button
            onClick={() => setPeed(!peed)}
            className={`toggle-btn ${peed ? 'active' : ''}`}
          >
            <span>💧 Peed outside</span>
            <span style={{ fontSize: '1.25rem' }}>{peed ? '✓' : '○'}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={() => onSave(pooped, peed)} className="btn btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
