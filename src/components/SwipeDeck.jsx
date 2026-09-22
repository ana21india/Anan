import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SwipeCard from './SwipeCard.jsx'
import { recordSwipe, checkForMatch, setMatch, updateSessionStatus } from '../lib/supabase.js'

export default function SwipeDeck({
  titles,
  sessionId,
  partner,
  round,
  onAllSwiped,
  onMatch,
}) {
  const [cards, setCards] = useState(() => shuffleArray([...titles]))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [swipedCount, setSwipedCount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSwipe = useCallback(async (direction) => {
    if (isProcessing || currentIndex >= cards.length) return

    const card = cards[currentIndex]
    const liked = direction === 'right'

    setIsProcessing(true)

    try {
      await recordSwipe(sessionId, partner, card.id, liked)

      if (liked) {
        const isMatch = await checkForMatch(sessionId, card.id)
        if (isMatch) {
          await setMatch(sessionId, card.id)
          onMatch(card)
          return
        }
      }

      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setSwipedCount(prev => prev + 1)

      if (nextIndex >= cards.length) {
        onAllSwiped()
      }
    } catch (err) {
      console.error('Swipe error:', err)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, currentIndex, cards, sessionId, partner, onMatch, onAllSwiped])

  const remaining = cards.length - currentIndex
  const progress = Math.round((currentIndex / cards.length) * 100)

  const visibleCards = cards.slice(currentIndex, currentIndex + 3)

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 flex-shrink-0">
        <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-white/30 text-xs tabular-nums flex-shrink-0">
          {remaining} left
        </span>
      </div>

      {/* Round badge */}
      {round > 1 && (
        <div className="text-center pb-1">
          <span className="text-xs text-violet-400/70 font-medium">Round {round}</span>
        </div>
      )}

      {/* Card stack */}
      <div className="flex-1 relative mx-4 mb-20" style={{ minHeight: 0 }}>
        <AnimatePresence>
          {remaining === 0 ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center px-8"
            >
              <div className="text-5xl mb-4">🎬</div>
              <p className="text-white font-semibold text-lg">All done!</p>
              <p className="text-white/40 text-sm mt-1">Waiting to see if you matched…</p>
            </motion.div>
          ) : (
            visibleCards.map((card, stackIndex) => (
              <SwipeCard
                key={card.id}
                card={card}
                isTop={stackIndex === 0}
                onSwipe={handleSwipe}
                style={{
                  zIndex: 10 - stackIndex,
                  scale: 1 - stackIndex * 0.04,
                  y: stackIndex * 12,
                  transformOrigin: 'bottom center',
                  pointerEvents: stackIndex === 0 ? 'auto' : 'none',
                }}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Swipe hint (shown on first card only) */}
      {currentIndex === 0 && remaining > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center gap-8 text-white/20 text-xs pointer-events-none">
          <span className="flex items-center gap-1">← Pass</span>
          <span className="flex items-center gap-1">Like →</span>
        </div>
      )}
    </div>
  )
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
