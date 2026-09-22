import { useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Star, Clock } from 'lucide-react'

export default function SwipeCard({ card, isTop, onSwipe, style = {} }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rotate = useTransform(x, [-220, 220], [-22, 22])
  const likeOpacity = useTransform(x, [20, 120], [0, 1])
  const passOpacity = useTransform(x, [-120, -20], [1, 0])
  const cardOpacity = useTransform(x, [-300, -200, 0, 200, 300], [0, 1, 1, 1, 0])

  const handleDragEnd = async (_, info) => {
    const THRESHOLD = 110
    const VELOCITY = 600

    if (info.offset.x > THRESHOLD || info.velocity.x > VELOCITY) {
      await animate(x, 600, { duration: 0.25 })
      onSwipe('right')
    } else if (info.offset.x < -THRESHOLD || info.velocity.x < -VELOCITY) {
      await animate(x, -600, { duration: 0.25 })
      onSwipe('left')
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  const triggerSwipe = async (direction) => {
    const target = direction === 'right' ? 600 : -600
    await animate(x, target, { duration: 0.25 })
    onSwipe(direction)
  }

  const posterFallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80'

  return (
    <motion.div
      style={{
        x: isTop ? x : 0,
        y: isTop ? y : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? cardOpacity : 1,
        position: 'absolute',
        width: '100%',
        height: '100%',
        cursor: isTop ? 'grab' : 'default',
        ...style,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.85}
      onDragEnd={isTop ? handleDragEnd : undefined}
      whileDrag={{ cursor: 'grabbing' }}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden card-shadow bg-surface">
        {/* Poster */}
        <div className="absolute inset-0">
          <img
            src={card.poster_url || posterFallback}
            alt={card.title}
            className="w-full h-full object-cover"
            draggable={false}
            onError={e => { e.target.src = posterFallback }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        </div>

        {/* LIKE badge */}
        {isTop && (
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute top-8 left-8 px-4 py-2 border-4 border-like rounded-xl rotate-[-20deg]"
          >
            <span className="text-like font-black text-2xl tracking-widest">LIKE</span>
          </motion.div>
        )}

        {/* PASS badge */}
        {isTop && (
          <motion.div
            style={{ opacity: passOpacity }}
            className="absolute top-8 right-8 px-4 py-2 border-4 border-pass rounded-xl rotate-[20deg]"
          >
            <span className="text-pass font-black text-2xl tracking-widest">PASS</span>
          </motion.div>
        )}

        {/* Bottom content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-xl leading-tight line-clamp-2">
                {card.title}
              </h2>
              <div className="flex items-center gap-3 mt-1.5 text-white/60 text-sm">
                {card.year && <span>{card.year}</span>}
                {card.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star size={12} fill="currentColor" className="text-yellow-400" />
                    <span className="text-white/80">{card.rating?.toFixed(1)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {card.synopsis && (
            <p className="text-white/55 text-sm leading-relaxed line-clamp-3">
              {card.synopsis}
            </p>
          )}

          {card.ott_platforms?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap pt-1">
              {card.ott_platforms.slice(0, 4).map((p, i) => (
                <span
                  key={i}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
                >
                  {p.platform}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Swipe action buttons (shown only on top card) */}
        {isTop && (
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex justify-between pointer-events-none">
            <button
              onClick={() => triggerSwipe('left')}
              className="pointer-events-auto w-14 h-14 rounded-full bg-black/60 border-2 border-pass/60 flex items-center justify-center hover:bg-pass/20 hover:border-pass active:scale-90 transition-all"
            >
              <span className="text-pass text-xl font-bold">✕</span>
            </button>
            <button
              onClick={() => triggerSwipe('right')}
              className="pointer-events-auto w-14 h-14 rounded-full bg-black/60 border-2 border-like/60 flex items-center justify-center hover:bg-like/20 hover:border-like active:scale-90 transition-all"
            >
              <span className="text-like text-xl font-bold">♥</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
