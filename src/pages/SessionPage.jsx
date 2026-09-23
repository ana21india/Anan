import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, getSession, submitPreferences, getPreferences, storeTitles, getTitles, updateSessionStatus, getMatchTitle, getSwipes } from '../lib/supabase.js'
import { generateTitles, generateRound2Titles } from '../lib/api.js'
import PreferenceForm from '../components/PreferenceForm.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import QRCodeDisplay from '../components/QRCodeDisplay.jsx'
import MatchCelebration from '../components/MatchCelebration.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'
import { OTTPlatformList } from '../components/OTTPlatformBadge.jsx'
import { Star, Users } from 'lucide-react'

const VIEW = {
  LOADING: 'loading',
  PARTNER_A_WAITING: 'partner_a_waiting',     // A filling prefs + showing QR
  PARTNER_A_SUBMITTED: 'a_submitted',          // A submitted, waiting for B to join
  PARTNER_B_PREFS: 'partner_b_prefs',          // B filling preferences
  GENERATING: 'generating',                    // Claude + TMDB working
  SWIPING: 'swiping',
  WAITING_FOR_PARTNER: 'waiting_for_partner',  // I'm done swiping, waiting for them
  MATCHED: 'matched',
  ROUND2_GENERATING: 'round2_generating',
  ROUND2_SWIPING: 'round2_swiping',
  FINAL: 'final',
  ERROR: 'error',
}

export default function SessionPage() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [view, setView] = useState(VIEW.LOADING)
  const [session, setSession] = useState(null)
  const [titles, setTitles] = useState([])
  const [matchTitle, setMatchTitle] = useState(null)
  const [topTitles, setTopTitles] = useState([])
  const [brief, setBrief] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [myPrefsSubmitted, setMyPrefsSubmitted] = useState(false)
  const [finishedSwiping, setFinishedSwiping] = useState(false)

  const generatingRef = useRef(false)
  const upperCode = code?.toUpperCase()
  const role = localStorage.getItem(`role_${upperCode}`) // 'A' or 'B'
  const sessionId = localStorage.getItem(`session_${upperCode}`)
  const joinUrl = `${window.location.origin}/join/${upperCode}`

  // Redirect if no role (direct URL access without going through home/join)
  useEffect(() => {
    if (!role) navigate('/', { replace: true })
  }, [role, navigate])

  const determineView = useCallback(async (sess, prefs) => {
    const hasA = prefs.some(p => p.partner === 'A')
    const hasB = prefs.some(p => p.partner === 'B')

    if (sess.status === 'matched') {
      const t = await getMatchTitle(sess.id)
      if (t) {
        setMatchTitle(t)
        setView(VIEW.MATCHED)
        return
      }
    }

    if (sess.status === 'final') {
      await loadTopTitles(sess.id)
      setView(VIEW.FINAL)
      return
    }

    if (sess.status === 'swiping' || sess.status === 'swiping_r2') {
      const round = sess.status === 'swiping_r2' ? 2 : 1
      const storedTitles = await getTitles(sess.id, round)
      if (storedTitles.length > 0) {
        setTitles(storedTitles)
        setView(sess.status === 'swiping_r2' ? VIEW.ROUND2_SWIPING : VIEW.SWIPING)
        return
      }
    }

    // Role-specific logic
    if (role === 'A') {
      if (!hasA) {
        setView(VIEW.PARTNER_A_WAITING)
      } else if (!hasB) {
        setView(VIEW.PARTNER_A_SUBMITTED)
      } else {
        // Both submitted — trigger generation if not done
        triggerGeneration(sess, prefs)
      }
    } else {
      // Partner B
      if (!hasB) {
        setView(VIEW.PARTNER_B_PREFS)
      } else if (!hasA) {
        setView(VIEW.WAITING_FOR_PARTNER)
      } else {
        // Only A generates. If B generated too, each partner would swipe a
        // separate set of rows and could never land on the same one.
        setView(VIEW.GENERATING)
      }
    }
  }, [role])

  const triggerGeneration = useCallback(async (sess, prefs) => {
    if (generatingRef.current) {
      setView(VIEW.GENERATING)
      return
    }

    // Check if titles already exist
    const existing = await getTitles(sess.id, 1)
    if (existing.length > 0) {
      setTitles(existing)
      setView(VIEW.SWIPING)
      return
    }

    generatingRef.current = true
    setView(VIEW.GENERATING)

    try {
      const prefA = prefs.find(p => p.partner === 'A')
      const prefB = prefs.find(p => p.partner === 'B')

      const mappedA = mapPrefs(prefA)
      const mappedB = mapPrefs(prefB)

      const { titles: raw, brief: b } = await generateTitles(mappedA, mappedB)
      setBrief(b)

      const stored = await storeTitles(sess.id, 1, raw)
      // Flip the status only once the rows exist — B is waiting on this
      // event to load the deck, and an early flip leaves it with nothing.
      await updateSessionStatus(sess.id, 'swiping')
      setTitles(stored)
      setView(VIEW.SWIPING)
    } catch (err) {
      console.error('Title generation failed:', err)
      setErrorMsg(`Could not generate titles: ${err.message}`)
      setView(VIEW.ERROR)
    } finally {
      generatingRef.current = false
    }
  }, [])

  const triggerRound2 = useCallback(async (sess, prefs) => {
    if (generatingRef.current) return
    generatingRef.current = true
    setView(VIEW.ROUND2_GENERATING)

    try {
      const prefA = prefs.find(p => p.partner === 'A')
      const prefB = prefs.find(p => p.partner === 'B')

      const [swipesA, swipesB] = await Promise.all([
        getSwipes(sess.id, 'A'),
        getSwipes(sess.id, 'B'),
      ])

      const likedA = swipesA.filter(s => s.liked).map(s => ({ title: s.session_titles?.title }))
      const likedB = swipesB.filter(s => s.liked).map(s => ({ title: s.session_titles?.title }))

      const seenIds = [...new Set([...swipesA, ...swipesB].map(s => s.session_titles?.tmdb_id).filter(Boolean))]

      const { titles: raw, brief: b } = await generateRound2Titles(mapPrefs(prefA), mapPrefs(prefB), likedA, likedB, seenIds)
      setBrief(b)

      const stored = await storeTitles(sess.id, 2, raw)
      await updateSessionStatus(sess.id, 'swiping_r2', { round: 2 })
      setTitles(stored)
      setView(VIEW.ROUND2_SWIPING)
    } catch (err) {
      console.error('Round 2 failed:', err)
      setErrorMsg(`Could not load round 2: ${err.message}`)
      setView(VIEW.ERROR)
    } finally {
      generatingRef.current = false
    }
  }, [])

  const loadTopTitles = async (sid) => {
    const { data } = await supabase
      .from('swipes')
      .select('title_id, session_titles(*)')
      .eq('session_id', sid)
      .eq('liked', true)

    if (!data) return

    const scores = {}
    data.forEach(s => {
      const id = s.title_id
      if (!scores[id]) scores[id] = { ...s.session_titles, score: 0 }
      scores[id].score++
    })

    const sorted = Object.values(scores).sort((a, b) => b.score - a.score).slice(0, 5)
    setTopTitles(sorted)
  }

  // Initial load
  useEffect(() => {
    if (!role || !upperCode) return

    const load = async () => {
      try {
        const sess = await getSession(upperCode)
        const prefs = await getPreferences(sess.id)
        setSession(sess)
        await determineView(sess, prefs)
      } catch (err) {
        setErrorMsg('Could not load session.')
        setView(VIEW.ERROR)
      }
    }
    load()
  }, [upperCode, role, determineView])

  // Realtime subscriptions
  useEffect(() => {
    if (!session?.id) return

    const channel = supabase
      .channel(`session:${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` }, async (payload) => {
        const updated = payload.new
        setSession(updated)

        if (updated.status === 'matched') {
          const t = await getMatchTitle(updated.id)
          if (t) { setMatchTitle(t); setView(VIEW.MATCHED) }
        } else if (updated.status === 'swiping' && view !== VIEW.SWIPING) {
          const storedTitles = await getTitles(updated.id, 1)
          if (storedTitles.length) { setTitles(storedTitles); setView(VIEW.SWIPING) }
        } else if (updated.status === 'swiping_r2') {
          const storedTitles = await getTitles(updated.id, 2)
          if (storedTitles.length) { setTitles(storedTitles); setView(VIEW.ROUND2_SWIPING) }
        } else if (updated.status === 'final') {
          await loadTopTitles(updated.id)
          setView(VIEW.FINAL)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'preferences', filter: `session_id=eq.${session.id}` }, async () => {
        const prefs = await getPreferences(session.id)
        const hasA = prefs.some(p => p.partner === 'A')
        const hasB = prefs.some(p => p.partner === 'B')

        if (role === 'A' && hasA && hasB && view !== VIEW.GENERATING && view !== VIEW.SWIPING) {
          const existing = await getTitles(session.id, 1)
          if (!existing.length) {
            triggerGeneration(session, prefs)
          }
        } else if (role === 'B' && hasA && hasB && view === VIEW.WAITING_FOR_PARTNER) {
          setView(VIEW.GENERATING)
        } else if (role === 'A' && hasB && view === VIEW.PARTNER_A_SUBMITTED) {
          setView(VIEW.GENERATING)
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session?.id, view, role, triggerGeneration])

  const handlePrefsSubmit = async (prefs) => {
    await submitPreferences(session.id, role, {
      mood_tags: prefs.moodTags,
      mood_text: prefs.moodText,
      languages: prefs.languages,
      content_type: prefs.contentType,
      min_rating: prefs.minRating,
      era: prefs.era,
    })

    setMyPrefsSubmitted(true)

    const allPrefs = await getPreferences(session.id)
    const hasOther = allPrefs.some(p => p.partner !== role)

    if (hasOther) {
      await triggerGeneration(session, allPrefs)
    } else {
      setView(role === 'A' ? VIEW.PARTNER_A_SUBMITTED : VIEW.WAITING_FOR_PARTNER)
    }
  }

  const handleMatch = (title) => {
    setMatchTitle(title)
    setView(VIEW.MATCHED)
  }

  const handleAllSwiped = async () => {
    setFinishedSwiping(true)
    const currentRound = session?.round || 1

    if (currentRound >= 2) {
      await updateSessionStatus(session.id, 'final')
    } else if (role === 'A') {
      const prefs = await getPreferences(session.id)
      await triggerRound2(session, prefs)
    } else {
      // B waits for A's round 2 deck, for the same reason as round 1.
      setView(VIEW.ROUND2_GENERATING)
    }
  }

  const handleNewSession = () => navigate('/')

  const renderView = () => {
    switch (view) {
      case VIEW.LOADING:
        return <LoadingScreen message="Loading your session…" />

      case VIEW.ERROR:
        return (
          <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-white font-semibold text-lg mb-2">Something went wrong</h2>
            <p className="text-white/40 text-sm mb-6 max-w-xs">{errorMsg}</p>
            <button onClick={handleNewSession} className="px-6 py-3 bg-surface border border-border rounded-xl text-white/60 hover:text-white text-sm">
              Go home
            </button>
          </div>
        )

      case VIEW.PARTNER_A_WAITING:
        return (
          <PageShell>
            <Header title="Your picks" subtitle="Tell us what you're in the mood for" />
            <PreferenceForm onSubmit={handlePrefsSubmit} />
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-white/30 text-xs text-center mb-4">Share with your partner while you fill this in</p>
              <QRCodeDisplay joinUrl={joinUrl} sessionCode={upperCode} />
            </div>
          </PageShell>
        )

      case VIEW.PARTNER_A_SUBMITTED:
        return (
          <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 w-full max-w-sm">
              <div className="text-5xl">✅</div>
              <div>
                <h2 className="text-white font-bold text-xl">Your picks are in</h2>
                <p className="text-white/40 mt-1 text-sm">Waiting for your partner to join and submit…</p>
              </div>
              <div className="p-4 bg-surface rounded-2xl border border-border space-y-4">
                <p className="text-white/50 text-sm">Share this with them</p>
                <QRCodeDisplay joinUrl={joinUrl} sessionCode={upperCode} />
              </div>
            </motion.div>
          </div>
        )

      case VIEW.PARTNER_B_PREFS:
        return (
          <PageShell>
            <Header title="Your picks" subtitle="Your preferences stay private — your partner can't see them" />
            <PreferenceForm onSubmit={handlePrefsSubmit} />
          </PageShell>
        )

      case VIEW.WAITING_FOR_PARTNER:
        return (
          <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Users size={40} className="text-violet-400 mx-auto" />
              <div>
                <h2 className="text-white font-bold text-xl">Waiting for your partner</h2>
                <p className="text-white/40 mt-1 text-sm">They're still picking their preferences</p>
              </div>
              <div className="flex gap-1.5 justify-center mt-4">
                {[0,1,2].map(i => (
                  <div key={i} className="loading-dot w-2.5 h-2.5 rounded-full bg-violet-500" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </motion.div>
          </div>
        )

      case VIEW.GENERATING:
        return (
          <LoadingScreen
            message="Finding the perfect 30 for you both…"
            submessage={brief || "Claude is reading your vibes"}
          />
        )

      case VIEW.ROUND2_GENERATING:
        return (
          <LoadingScreen
            message="Round 2 — getting sharper…"
            submessage="Based on what you both actually liked"
          />
        )

      case VIEW.SWIPING:
      case VIEW.ROUND2_SWIPING:
        return (
          <div className="h-screen bg-bg overflow-hidden">
            <SwipeDeck
              titles={titles}
              sessionId={session.id}
              partner={role}
              round={view === VIEW.ROUND2_SWIPING ? 2 : 1}
              onMatch={handleMatch}
              onAllSwiped={handleAllSwiped}
            />
          </div>
        )

      case VIEW.MATCHED:
        return matchTitle ? (
          <MatchCelebration
            title={matchTitle}
            onNewSession={handleNewSession}
          />
        ) : <LoadingScreen message="It's a match!" />

      case VIEW.FINAL:
        return <FinalResults titles={topTitles} onNewSession={handleNewSession} />

      default:
        return <LoadingScreen />
    }
  }

  return <AnimatePresence mode="wait">{renderView()}</AnimatePresence>
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-md mx-auto px-5 py-8">
        {children}
      </div>
    </div>
  )
}

function Header({ title, subtitle }) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-white/40 mt-1 text-sm">{subtitle}</p>}
    </div>
  )
}

function FinalResults({ titles, onNewSession }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-bg"
    >
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🤔</div>
          <h1 className="text-2xl font-bold text-white">No exact match</h1>
          <p className="text-white/40 mt-1 text-sm">Here are the top picks you both responded to — make the call together</p>
        </div>

        <div className="space-y-3">
          {titles.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex gap-3 p-3 bg-surface rounded-2xl border border-border"
            >
              {t.poster_url && (
                <img src={t.poster_url} alt={t.title} className="w-14 h-20 rounded-xl object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{t.title}</p>
                <div className="flex items-center gap-2 mt-0.5 text-white/40 text-xs">
                  {t.year && <span>{t.year}</span>}
                  {t.rating > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star size={10} fill="currentColor" className="text-yellow-400" />
                      {t.rating?.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-white/40 text-xs mt-1 line-clamp-2">{t.synopsis}</p>
                <div className="mt-1.5">
                  <OTTPlatformList platforms={t.ott_platforms || []} compact max={3} />
                </div>
              </div>
              {t.score && (
                <div className="flex-shrink-0 flex items-start">
                  <span className="text-xs text-violet-400 font-medium">
                    {t.score === 2 ? '❤️ Both' : '👆 One'}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <button
          onClick={onNewSession}
          className="w-full mt-6 py-3.5 rounded-2xl border border-border text-white/50 text-sm hover:text-white hover:border-white/30 transition-all"
        >
          Start over
        </button>
      </div>
    </motion.div>
  )
}

function mapPrefs(pref) {
  if (!pref) return {}
  return {
    moodTags: pref.mood_tags || [],
    moodText: pref.mood_text || '',
    languages: pref.languages || [],
    contentType: pref.content_type || 'movies',
    minRating: pref.min_rating || 6,
    era: pref.era || [],
  }
}
