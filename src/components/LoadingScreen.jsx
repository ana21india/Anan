import { motion } from 'framer-motion'

export default function LoadingScreen({ message = 'Finding your perfect match…', submessage }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg px-6 text-center">
      <div className="flex gap-2 mb-6">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="loading-dot w-3 h-3 rounded-full bg-primary"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-white text-lg font-medium"
      >
        {message}
      </motion.p>
      {submessage && (
        <p className="text-white/40 text-sm mt-2">{submessage}</p>
      )}
    </div>
  )
}
