'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, type HopeLog } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Lottie from 'lottie-react';
import dogAnimation from '@/public/dog-animation.json';

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
    initUser();
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

  async function initUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      setLoading(false);
    } else {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error) setUser(data.user);
      setLoading(false);
    }
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
    const clicked = new Date(date);
    clicked.setHours(0, 0, 0, 0);
    if (clicked <= today) {
      setSelectedDay(date);
      setShowModal(true);
    }
  }

  async function saveWalkLog(pooped: boolean, peed: boolean) {
    if (!user || !selectedDay) return;
    try {
      const { error } = await supabase.from('hope_logs').insert([{
        type: 'walk',
        pooped,
        peed,
        user_id: user.id,
        person: 'Hope',
        created_at: new Date().toISOString()
      }]);
      if (error) throw error;
      await fetchLogs();
    } catch (err) {
      console.error('Save error:', err);
      alert('Could not save: ' + (err as Error).message);
    }
  }

  async function deleteLog(id: string) {
    try {
      const { error } = await supabase.from('hope_logs').delete().eq('id', id);
      if (error) throw error;
      await fetchLogs();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Could not delete: ' + (err as Error).message);
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

  const dogState = useMemo(() => {
    const today = new Date().toDateString();
    const todayWalks = logs.filter(l => l.type === 'walk' && new Date(l.created_at).toDateString() === today);

    if (todayWalks.length > 0 && walkStreak >= 7) {
      return 'proud'; // Long streak + walked today
    } else if (todayWalks.length > 0) {
      return 'happy'; // Walked today
    } else if (walkStreak > 0) {
      return 'waiting'; // Has streak but no walk today
    } else {
      return 'expectant'; // No streak, no walk today
    }
  }, [logs, walkStreak]);

  const hasWalkedToday = useMemo(() => {
    const today = new Date().toDateString();
    return logs.some(l => l.type === 'walk' && new Date(l.created_at).toDateString() === today);
  }, [logs]);

  const [weather, setWeather] = useState<{
    temp: number;
    condition: string;
    icon: string;
    feelsLike: number;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    if (!weather && !weatherLoading && !locationError) {
      fetchWeather();
    }
  }, [weather, weatherLoading, locationError]);

  async function fetchWeather() {
    const debug: string[] = [];
    debug.push('🌤️ Starting weather fetch (Weather.gov)...');
    debug.push(`Has walked today? ${hasWalkedToday}`);
    setDebugInfo([...debug]);

    setWeatherLoading(true);
    try {
      debug.push('📍 Requesting location...');
      setDebugInfo([...debug]);

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 1800000 // 30 min cache
        });
      });

      const { latitude, longitude } = position.coords;
      debug.push(`📍 Location: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
      setDebugInfo([...debug]);

      // Step 1: Get weather station metadata from Weather.gov
      debug.push('🌐 Fetching weather station...');
      setDebugInfo([...debug]);

      const pointsUrl = `https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      const pointsResponse = await fetch(pointsUrl);
      debug.push(`📥 Points response: ${pointsResponse.status}`);
      setDebugInfo([...debug]);

      if (!pointsResponse.ok) {
        throw new Error(`Weather.gov points failed: ${pointsResponse.status}`);
      }

      const pointsData = await pointsResponse.json();
      const observationStationsUrl = pointsData.properties.observationStations;

      // Step 2: Get nearest observation station
      debug.push('🌐 Finding nearest station...');
      setDebugInfo([...debug]);

      const stationsResponse = await fetch(observationStationsUrl);
      if (!stationsResponse.ok) {
        throw new Error(`Stations fetch failed: ${stationsResponse.status}`);
      }

      const stationsData = await stationsResponse.json();
      const nearestStation = stationsData.features[0].id;

      // Step 3: Get current observations
      debug.push('🌐 Getting current weather...');
      setDebugInfo([...debug]);

      const observationUrl = `${nearestStation}/observations/latest`;
      const obsResponse = await fetch(observationUrl);
      debug.push(`📥 Weather response: ${obsResponse.status}`);
      setDebugInfo([...debug]);

      if (!obsResponse.ok) {
        throw new Error(`Observation fetch failed: ${obsResponse.status}`);
      }

      const obsData = await obsResponse.json();
      const props = obsData.properties;

      // Convert Celsius to Fahrenheit
      const tempC = props.temperature.value;
      const tempF = tempC !== null ? Math.round((tempC * 9/5) + 32) : null;
      const feelsLikeC = props.heatIndex.value || props.windChill.value || tempC;
      const feelsLikeF = feelsLikeC !== null ? Math.round((feelsLikeC * 9/5) + 32) : tempF;

      const condition = props.textDescription || 'Clear';

      debug.push(`✅ Got weather: ${tempF}°F, ${condition}`);
      setDebugInfo([...debug]);

      if (tempF === null) {
        throw new Error('Temperature data unavailable');
      }

      setWeather({
        temp: tempF,
        condition: condition,
        icon: '', // Weather.gov doesn't provide icons
        feelsLike: feelsLikeF || tempF
      });
      setLocationError(false);
      debug.push('✅ Weather displayed!');
      setDebugInfo([...debug]);
    } catch (err) {
      debug.push(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      setDebugInfo([...debug]);
      setLocationError(true);
    } finally {
      setWeatherLoading(false);
    }
  }

  function getWeatherRecommendation(temp: number, condition: string): { emoji: string; text: string; gradient: string } {
    const lowerCondition = condition.toLowerCase();

    if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) {
      return {
        emoji: '🌧️',
        text: 'Rainy — Hope might be quick today',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      };
    }

    if (lowerCondition.includes('snow')) {
      return {
        emoji: '❄️',
        text: 'Snowy — Bundle up for a short walk',
        gradient: 'linear-gradient(135deg, #e0f7fa 0%, #80deea 100%)'
      };
    }

    if (lowerCondition.includes('thunder') || lowerCondition.includes('storm')) {
      return {
        emoji: '⛈️',
        text: 'Stormy — Maybe wait a bit',
        gradient: 'linear-gradient(135deg, #434343 0%, #000000 100%)'
      };
    }

    if (temp < 40) {
      return {
        emoji: '🥶',
        text: 'Cold outside! Bundle up for a short walk',
        gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
      };
    }

    if (temp > 85) {
      return {
        emoji: '🥵',
        text: 'Hot outside! Bring water for Hope',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
      };
    }

    if (temp >= 60 && temp <= 75 && (lowerCondition.includes('clear') || lowerCondition.includes('sun'))) {
      return {
        emoji: '☀️',
        text: 'Perfect walking weather!',
        gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
      };
    }

    if (lowerCondition.includes('cloud')) {
      return {
        emoji: '☁️',
        text: 'Cloudy but good for walking',
        gradient: 'linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%)'
      };
    }

    return {
      emoji: '🌤️',
      text: 'Good day for a walk!',
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
    };
  }

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
      </header>

      {/* Streak */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div className="streak-badge">
          <span>🔥</span>
          <span>{walkStreak} day{walkStreak !== 1 ? 's' : ''} walking streak</span>
        </div>
      </div>

      {/* Debug Panel - Persistent */}
      {debugInfo.length > 0 && showDebug && (
        <div style={{
          margin: '0 auto 1rem',
          maxWidth: '600px',
          padding: '1rem',
          background: '#fff3cd',
          border: '2px solid #856404',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontFamily: 'monospace',
          position: 'relative'
        }}>
          <button
            onClick={() => setShowDebug(false)}
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: '#856404',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
          <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem' }}>
            Weather Debug:
          </strong>
          {debugInfo.map((info, i) => (
            <div key={i} style={{
              marginTop: '0.5rem',
              padding: '0.25rem',
              background: i === debugInfo.length - 1 ? '#fffaeb' : 'transparent',
              fontWeight: i === debugInfo.length - 1 ? 'bold' : 'normal'
            }}>
              {info}
            </div>
          ))}
        </div>
      )}

      {/* Weather Banner - always visible */}
      <>
        {weatherLoading && (
            <div className="weather-banner" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
              <div className="weather-info">
                <span className="weather-emoji">🌤️</span>
                <div className="weather-details">
                  <span className="weather-temp">Loading...</span>
                </div>
              </div>
            </div>
          )}

          {weather && (
            <div
              className="weather-banner"
              style={{
                background: getWeatherRecommendation(weather.temp, weather.condition).gradient
              }}
            >
              <div className="weather-info">
                <span className="weather-emoji">
                  {getWeatherRecommendation(weather.temp, weather.condition).emoji}
                </span>
                <div className="weather-details">
                  <span className="weather-temp">{weather.temp}°F</span>
                  <span className="weather-condition">{weather.condition}</span>
                </div>
              </div>
              <div className="weather-recommendation">
                {getWeatherRecommendation(weather.temp, weather.condition).text}
              </div>
            </div>
          )}

          {locationError && !weather && (
            <div className="weather-banner" style={{ background: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)' }}>
              <div className="weather-info">
                <span className="weather-emoji">⚠️</span>
                <div className="weather-details">
                  <span className="weather-temp">Weather unavailable</span>
                  <span className="weather-condition" style={{ fontSize: '0.75rem' }}>Check console for errors</span>
                </div>
              </div>
              <button
                onClick={fetchWeather}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                Retry
              </button>
            </div>
          )}
      </>

      {/* Contextual Dog */}
      <div className="dog-track">
        <div className={`dog-companion dog-${dogState}`}>
          <Lottie
            animationData={dogAnimation}
            loop={true}
            className="lottie-dog"
          />
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
          onSave={saveWalkLog}
          onDelete={deleteLog}
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
    const dayLogs = logs.filter(l =>
      l.type === 'walk' && new Date(l.created_at).toDateString() === dateStr
    );

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const isPast = checkDate < today;
    const isToday = checkDate.getTime() === today.getTime();
    const isFuture = checkDate > today;

    return {
      dayLogs,
      poopCount: dayLogs.filter(l => l.pooped).length,
      peeCount: dayLogs.filter(l => l.peed).length,
      isPast,
      isToday,
      isFuture,
      isMissed: isPast && dayLogs.length === 0
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
                    {Array.from({ length: Math.min(status.poopCount, 3) }).map((_, i) => (
                      <span key={`poop-${i}`} style={{ fontSize: '0.85rem', lineHeight: 1 }}>💩</span>
                    ))}
                    {Array.from({ length: Math.min(status.peeCount, 3) }).map((_, i) => (
                      <span key={`pee-${i}`} style={{ fontSize: '0.85rem', lineHeight: 1 }}>💧</span>
                    ))}
                    {status.isMissed && <span style={{ color: 'var(--error)', fontSize: '0.875rem' }}>✕</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

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

function DayModal({ date, logs, onClose, onSave, onDelete }: {
  date: Date,
  logs: HopeLog[],
  onClose: () => void,
  onSave: (pooped: boolean, peed: boolean) => void,
  onDelete: (id: string) => void
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const clicked = new Date(date);
  clicked.setHours(0, 0, 0, 0);
  const isToday = clicked.getTime() === today.getTime();

  const dateStr = date.toDateString();
  const dayLogs = logs
    .filter(l => l.type === 'walk' && new Date(l.created_at).toDateString() === dateStr)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const [pooped, setPooped] = useState(false);
  const [peed, setPeed] = useState(false);

  function handleSave() {
    onSave(pooped, peed);
    setPooped(false);
    setPeed(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--ink)' }}>
          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
        </h3>

        {/* Existing walk logs */}
        {dayLogs.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {dayLogs.length} walk{dayLogs.length !== 1 ? 's' : ''} logged
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {dayLogs.map((log, i) => (
                <div key={log.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Walk {i + 1}
                    </span>
                    <span style={{ fontSize: '1rem' }}>
                      {log.pooped ? '💩' : ''}{log.peed ? '💧' : ''}
                      {!log.pooped && !log.peed && <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>no output</span>}
                    </span>
                  </div>
                  {isToday && (
                    <button
                      onClick={() => onDelete(log.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--error)',
                        fontSize: '1rem',
                        padding: '0.25rem',
                        lineHeight: 1,
                        touchAction: 'manipulation'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {dayLogs.length === 0 && !isToday && (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            No walks logged this day.
          </p>
        )}

        {/* Log new walk — today only */}
        {isToday && (
          <>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Log a walk
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
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
              <button onClick={onClose} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn btn-primary">Log Walk</button>
            </div>
          </>
        )}

        {!isToday && (
          <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%' }}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
