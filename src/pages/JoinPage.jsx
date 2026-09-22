import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getSession } from '../lib/supabase.js'
import { Film, Users } from 'lucide-react'
import LoadingScreen from '../components/LoadingScreen.jsx'

export default function JoinPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const s = await getSession(code)
        if (!s) throw new Error('Session not found')
        setSession(s)
      } catch (err) {
        setError('Session not found. Ask your partner to share the link again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [code])

  const handleJoin = () => {
    if (joining || !session) return
    setJoining(true)

    localStorage.setItem(`role_${code.toUpperCase()}`, 'B')
    localStorage.setItem(`session_${code.toUpperCase()}`, session.id)
    navigate(`/session/${code.toUpperCase()}`)
  }

  if (loading) return <LoadingScreen message="Checking session…" />

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h2 className="text-white font-semibold text-lg mb-2">Can't find this session</h2>
        <p className="text-white/40 text-sm mb-6">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-surface border border-border rounded-xl text-white/60 hover:text-white text-sm transition-colors"
        >
          Go home
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Icon */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
              <Film size={36} className="text-white" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-like flex items-center justify-center border-2 border-bg">
              <Users size={14} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">You're invited</h1>
            <p className="text-white/40 mt-1 text-sm">
              Your partner is waiting to find a movie together
            </p>
          </div>
        </div>

        {/* Session code badge */}
        <div className="bg-surface border border-border rounded-2xl px-6 py-4">
          <p className="text-white/30 text-xs mb-1">Session</p>
          <p className="text-white font-mono font-bold text-2xl tracking-widest">{code?.toUpperCase()}</p>
        </div>

        {/* What happens next */}
        <div className="text-left space-y-2.5">
          {[
            'Set your own preferences (your partner can\'t see them)',
            'Swipe through 30 curated picks',
            'Match when you both like the same one',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-white/50 text-sm">{step}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-violet-900/40 active:scale-[0.98] transition-all"
        >
          Join the session
        </button>
      </motion.div>
    </div>
  )
}
