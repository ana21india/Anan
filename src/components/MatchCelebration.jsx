import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { OTTPlatformList } from './OTTPlatformBadge.jsx'
import { Star, ExternalLink } from 'lucide-react'

export default function MatchCelebration({ title, onRateWatch, onNewSession }) {
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    const fire = (particleRatio, opts) => {
      confetti({
        origin: { y: 0.7 },
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
      })
    }

    setTimeout(() => {
      fire(0.25, { spread: 26, startVelocity: 55, colors: ['#7c3aed', '#6366f1', '#a78bfa'] })
      fire(0.2, { spread: 60, colors: ['#10b981', '#34d399'] })
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#f59e0b', '#fbbf24'] })
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
      fire(0.1, { spread: 120, startVelocity: 45 })
    }, 300)
  }, [])

  const handleRate = async (r) => {
    setRating(r)
    if (onRateWatch) await onRateWatch(r)
    setTimeout(() => setShowRating(false), 800)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-bg flex flex-col"
    >
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center pt-10 pb-6 px-6"
      >
        <div className="text-4xl mb-2">🎉</div>
        <h1 className="text-3xl font-bold text-white">It's a match!</h1>
        <p className="text-white/40 mt-1 text-sm">You both liked this one</p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 200 }}
        className="flex-1 flex flex-col mx-4"
      >
        <div className="relative rounded-3xl overflow-hidden card-shadow" style={{ height: '50vh', maxHeight: 400 }}>
          {title.poster_url && (
            <img
              src={title.poster_url}
              alt={title.title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          {/* Ring decoration */}
          <div className="absolute inset-0 rounded-3xl border-2 border-violet-500/40" />

          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="text-white font-bold text-2xl leading-tight">{title.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-white/60 text-sm">
              {title.year && <span>{title.year}</span>}
              {title.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={12} fill="currentColor" className="text-yellow-400" />
                  <span className="text-white/80">{title.rating?.toFixed(1)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Synopsis */}
        {title.synopsis && (
          <p className="text-white/50 text-sm leading-relaxed mt-4 px-1 line-clamp-3">
            {title.synopsis}
          </p>
        )}

        {/* OTT platforms */}
        <div className="mt-4 p-4 bg-surface rounded-2xl border border-border">
          <OTTPlatformList
            platforms={title.ott_platforms || []}
          />
        </div>

        {/* Rating prompt */}
        {!showRating ? (
          <button
            onClick={() => setShowRating(true)}
            className="mt-3 text-white/30 text-xs text-center hover:text-white/50 transition-colors py-2"
          >
            Watched it? Rate the night →
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-4 bg-surface rounded-2xl border border-border text-center"
          >
            <p className="text-white/60 text-sm mb-3">How was it?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => handleRate(n)}
                  className="text-2xl transition-transform hover:scale-125 active:scale-110"
                >
                  {n <= (hovered || rating) ? '⭐' : '☆'}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="px-4 pb-8 pt-4 flex-shrink-0">
        <button
          onClick={onNewSession}
          className="w-full py-3.5 rounded-2xl border border-border text-white/50 text-sm hover:text-white hover:border-white/30 transition-all"
        >
          Start a new session
        </button>
      </div>
    </motion.div>
  )
}
