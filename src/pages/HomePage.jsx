import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { createSession } from '../lib/supabase.js'
import { useState } from 'react'
import { Film, Zap, AlertTriangle } from 'lucide-react'

const missingConfig =
  !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY.includes('placeholder')

export default function HomePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const session = await createSession()
      localStorage.setItem(`role_${session.code}`, 'A')
      localStorage.setItem(`session_${session.code}`, session.id)
      navigate(`/session/${session.code}`)
    } catch (err) {
      console.error(err)
      setError('Could not create session — check your Supabase credentials in .env')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
            <Film size={28} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          Watch<span className="gradient-text">Match</span>
        </h1>
        <p className="text-white/40 mt-2 text-base max-w-xs mx-auto">
          Stop scrolling. Find what you both actually want to watch — tonight.
        </p>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="space-y-3 mb-10 w-full max-w-sm"
      >
        {[
          { emoji: '🎛️', text: 'Set your mood and preferences' },
          { emoji: '📱', text: 'Share the QR with your partner' },
          { emoji: '👆', text: 'Swipe through 30 curated picks' },
          { emoji: '🎬', text: 'Match = watch it now, right here in India' },
        ].map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.07 }}
            className="flex items-center gap-3 text-left"
          >
            <span className="text-xl w-8 text-center flex-shrink-0">{step.emoji}</span>
            <span className="text-white/60 text-sm">{step.text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55 }}
        className="w-full max-w-sm space-y-3"
      >
        {/* Config warning */}
        {missingConfig && (
          <div className="flex items-start gap-2.5 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-left">
            <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 text-xs font-medium">Setup required</p>
              <p className="text-yellow-400/70 text-xs mt-0.5">
                Copy <code className="font-mono bg-yellow-500/10 px-1 rounded">.env.example</code> to <code className="font-mono bg-yellow-500/10 px-1 rounded">.env</code> and add your Supabase, TMDB, Anthropic, and RapidAPI keys.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-violet-900/40 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="loading-dot w-2 h-2 rounded-full bg-white/60" />
              ))}
            </div>
          ) : (
            <>
              <Zap size={18} fill="white" />
              Create a session
            </>
          )}
        </button>

        {/* Inline error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-red-400 text-xs text-center px-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <p className="text-white/20 text-xs text-center">
          Free · No sign-up required
        </p>
      </motion.div>
    </div>
  )
}
