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
    location?: string;
    upcomingCondition?: string;
    upcomingTime?: string;
    recommendation?: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [weatherFetchTime, setWeatherFetchTime] = useState<number>(0);

  useEffect(() => {
    // Fetch weather on mount or if stale (>15 min old)
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    const isStale = now - weatherFetchTime > fifteenMinutes;

    if ((isStale || !weather) && !weatherLoading) {
      fetchWeather();
    }
  }, []); // Empty deps = runs only on mount (app open/refresh)

  async function fetchWeather() {
    setWeatherLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 1800000 // 30 min cache
        });
      });

      const { latitude, longitude } = position.coords;

      // Step 1: Get weather station metadata from Weather.gov
      const pointsUrl = `https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      const pointsResponse = await fetch(pointsUrl);

      if (!pointsResponse.ok) {
        throw new Error(`Weather.gov points failed: ${pointsResponse.status}`);
      }

      const pointsData = await pointsResponse.json();
      const forecastHourlyUrl = pointsData.properties.forecastHourly;

      // Extract location info
      const city = pointsData.properties.relativeLocation?.properties?.city || '';
      const state = pointsData.properties.relativeLocation?.properties?.state || '';
      const locationName = city && state ? `${city}, ${state}` : 'Your Location';

      // Step 2: Get hourly forecast (forward-looking)
      const forecastResponse = await fetch(forecastHourlyUrl);

      if (!forecastResponse.ok) {
        throw new Error(`Forecast fetch failed: ${forecastResponse.status}`);
      }

      const forecastData = await forecastResponse.json();
      const periods = forecastData.properties.periods;

      if (!periods || periods.length === 0) {
        throw new Error('No forecast data available');
      }

      // Use first period (current/next hour) for temperature and condition
      const currentPeriod = periods[0];
      const tempF = currentPeriod.temperature;
      const condition = currentPeriod.shortForecast;

      // Analyze next 3 hours for upcoming changes
      const nextThreeHours = periods.slice(0, 3);
      let upcomingCondition = '';
      let upcomingTime = '';
      let recommendation = '';

      // Look for significant weather changes in next 3 hours
      const hasRain = nextThreeHours.some((p: any) =>
        p.shortForecast.toLowerCase().includes('rain') ||
        p.shortForecast.toLowerCase().includes('shower') ||
        p.shortForecast.toLowerCase().includes('storm')
      );

      const hasSnow = nextThreeHours.some((p: any) =>
        p.shortForecast.toLowerCase().includes('snow')
      );

      if (hasRain) {
        const rainPeriod = nextThreeHours.find((p: any) =>
          p.shortForecast.toLowerCase().includes('rain') ||
          p.shortForecast.toLowerCase().includes('shower')
        );
        if (rainPeriod) {
          const rainTime = new Date(rainPeriod.startTime);
          const now = new Date();
          const hoursUntil = Math.round((rainTime.getTime() - now.getTime()) / (1000 * 60 * 60));

          if (hoursUntil <= 0) {
            upcomingCondition = 'Rain now';
            recommendation = 'Quick walk recommended';
          } else if (hoursUntil === 1) {
            upcomingCondition = 'Rain in 1 hour';
            recommendation = 'Walk soon!';
          } else {
            upcomingCondition = `Rain in ${hoursUntil} hours`;
            recommendation = 'Good time to walk';
          }
          upcomingTime = rainTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
      } else if (hasSnow) {
        upcomingCondition = 'Snow expected';
        recommendation = 'Bundle up!';
      } else {
        // Check temperature trend
        const lastPeriod = nextThreeHours[nextThreeHours.length - 1];
        const tempChange = lastPeriod.temperature - tempF;

        if (tempChange > 10) {
          upcomingCondition = `Warming to ${lastPeriod.temperature}°F`;
          recommendation = 'Walk now while cooler';
        } else if (tempChange < -10) {
          upcomingCondition = `Cooling to ${lastPeriod.temperature}°F`;
          recommendation = 'Walk now while warmer';
        } else {
          upcomingCondition = 'Clear for 3 hours';
          recommendation = 'Great time to walk!';
        }
      }

      setWeather({
        temp: tempF,
        condition: condition,
        icon: '',
        feelsLike: currentPeriod.windChill || currentPeriod.heatIndex || tempF,
        location: locationName,
        upcomingCondition,
        upcomingTime,
        recommendation
      });
      setWeatherFetchTime(Date.now());
      setLocationError(false);
    } catch (err) {
      console.error('Weather error:', err);
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
      padding: '0.75rem 1rem 5rem',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.5rem',
        flexShrink: 0
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

      {/* Info bar: streak + weather compact */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.5rem',
        flexShrink: 0,
        flexWrap: 'wrap'
      }}>
        <div className="streak-badge">
          <span>🔥</span>
          <span>{walkStreak} day{walkStreak !== 1 ? 's' : ''} streak</span>
        </div>
        {weatherLoading && (
          <div className="weather-badge">🌤️ Loading...</div>
        )}
        {weather && (
          <div className="weather-badge">
            {getWeatherRecommendation(weather.temp, weather.condition).emoji} {weather.temp}°F
            {weather.upcomingCondition && ` · ${weather.upcomingCondition}`}
            {weather.recommendation && ` · ${weather.recommendation}`}
          </div>
        )}
        {locationError && !weather && (
          <div className="weather-badge" style={{ cursor: 'pointer' }} onClick={fetchWeather}>
            ⚠️ Tap for weather
          </div>
        )}
      </div>

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

      {/* Sticky log button */}
      <button
        onClick={() => { setSelectedDay(new Date()); setShowModal(true); }}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: '100px',
          padding: '0.875rem 2rem',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 50,
          touchAction: 'manipulation',
          whiteSpace: 'nowrap'
        }}
      >
        🐾 Log today&apos;s walk
      </button>
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
    <div className="card" style={{ padding: '0.75rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.5rem'
      }}>
        <button onClick={prevMonth} className="btn btn-secondary" style={{ padding: '0.375rem 0.625rem', fontSize: '0.8rem' }}>
          ←
        </button>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink)' }}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={nextMonth} className="btn btn-secondary" style={{ padding: '0.375rem 0.625rem', fontSize: '0.8rem' }}>
          →
        </button>
      </div>

      <div className="calendar-grid" style={{ marginBottom: '0.25rem' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--muted)',
            padding: '0.2rem 0',
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
                    {status.poopCount > 0 && (
                      <span style={{ fontSize: '0.6rem', lineHeight: 1, whiteSpace: 'nowrap' }}>
                        💩×{status.poopCount}
                      </span>
                    )}
                    {status.peeCount > 0 && (
                      <span style={{ fontSize: '0.6rem', lineHeight: 1, whiteSpace: 'nowrap' }}>
                        💧×{status.peeCount}
                      </span>
                    )}
                    {status.isMissed && <span style={{ color: 'var(--error)', fontSize: '0.875rem' }}>✕</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: '0.375rem',
        paddingTop: '0.375rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '0.75rem',
        fontSize: '0.7rem',
        color: 'var(--muted)',
      }}>
        <span>💩 Pooped</span>
        <span>💧 Peed</span>
        <span style={{ color: 'var(--error)' }}>✕ Missed</span>
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
