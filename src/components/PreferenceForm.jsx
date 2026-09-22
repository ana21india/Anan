import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

const MOODS = ['Light & fun', 'Intense & gripping', 'Scary', 'Romantic']
const LANGUAGES = ['Hindi', 'English', 'Tamil', 'Telugu', 'Kannada']
const ERAS = ['Classic (pre-2000)', '2000–2020', 'Recent (2021–2026)']
const RATINGS = ['6+', '7+', '8+', '9+']

function Chip({ label, active, onClick, caveat }) {
  return (
    <button
      onClick={onClick}
      className={`chip ${active ? 'chip-active' : 'chip-inactive'}`}
    >
      {label}
      {caveat && active && (
        <span className="text-[10px] text-yellow-400/70 font-normal">{caveat}</span>
      )}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-white/50 text-xs uppercase tracking-widest font-medium">{title}</p>
      {children}
    </div>
  )
}

export default function PreferenceForm({ onSubmit, partnerLabel = 'You' }) {
  const [moodTags, setMoodTags] = useState([])
  const [moodText, setMoodText] = useState('')
  const [languages, setLanguages] = useState([])
  const [anyLanguage, setAnyLanguage] = useState(false)
  const [contentType, setContentType] = useState('movies')
  const [minRating, setMinRating] = useState('7+')
  const [era, setEra] = useState([])
  const [anyEra, setAnyEra] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const toggleMood = (mood) => {
    setMoodTags(prev => prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood])
  }

  const toggleLanguage = (lang) => {
    setAnyLanguage(false)
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang])
  }

  const selectAnyLanguage = () => {
    setAnyLanguage(true)
    setLanguages([])
  }

  const toggleEra = (e) => {
    setAnyEra(false)
    setEra(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])
  }

  const selectAnyEra = () => {
    setAnyEra(true)
    setEra([])
  }

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        moodTags,
        moodText,
        languages: anyLanguage ? [] : languages,
        contentType,
        minRating: parseInt(minRating),
        era: anyEra ? [] : era,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = moodTags.length > 0 && (anyLanguage || languages.length > 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md mx-auto space-y-7 pb-8"
    >
      <Section title="What's the mood tonight?">
        <div className="flex flex-wrap gap-2">
          {MOODS.map(m => (
            <Chip
              key={m}
              label={m}
              active={moodTags.includes(m)}
              onClick={() => toggleMood(m)}
            />
          ))}
        </div>
        <textarea
          value={moodText}
          onChange={e => setMoodText(e.target.value)}
          placeholder="Anything specific? (optional — e.g. 'something with twists' or 'no subtitles please')"
          rows={2}
          maxLength={300}
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-primary/50 transition-colors"
        />
      </Section>

      <Section title="Language">
        <div className="flex flex-wrap gap-2">
          <Chip label="Any" active={anyLanguage} onClick={selectAnyLanguage} />
          {LANGUAGES.map(l => (
            <Chip
              key={l}
              label={l}
              active={!anyLanguage && languages.includes(l)}
              onClick={() => toggleLanguage(l)}
            />
          ))}
        </div>
      </Section>

      <Section title="What are you up for?">
        <div className="flex gap-2">
          <Chip
            label="Movies only"
            active={contentType === 'movies'}
            onClick={() => setContentType('movies')}
          />
          <Chip
            label="Include series"
            active={contentType === 'all'}
            onClick={() => setContentType('all')}
          />
        </div>
      </Section>

      <Section title="Minimum IMDb rating">
        <div className="flex gap-2 flex-wrap">
          {RATINGS.map(r => (
            <Chip
              key={r}
              label={r}
              active={minRating === r}
              onClick={() => setMinRating(r)}
              caveat={r === '9+' ? '· very few titles' : null}
            />
          ))}
        </div>
      </Section>

      <Section title="Era">
        <div className="flex flex-wrap gap-2">
          <Chip label="Any" active={anyEra} onClick={selectAnyEra} />
          {ERAS.map(e => (
            <Chip
              key={e}
              label={e}
              active={!anyEra && era.includes(e)}
              onClick={() => toggleEra(e)}
            />
          ))}
        </div>
      </Section>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-all ${
          canSubmit && !submitting
            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/30 active:scale-[0.98]'
            : 'bg-surface text-white/25 cursor-not-allowed'
        }`}
      >
        {submitting ? (
          <span className="flex gap-1.5">
            <span className="loading-dot w-2 h-2 rounded-full bg-white/50" />
            <span className="loading-dot w-2 h-2 rounded-full bg-white/50" />
            <span className="loading-dot w-2 h-2 rounded-full bg-white/50" />
          </span>
        ) : (
          <>
            Lock in my picks
            <ChevronRight size={18} />
          </>
        )}
      </button>
      {!canSubmit && (
        <p className="text-center text-white/25 text-xs -mt-5">
          Pick a mood and at least one language to continue
        </p>
      )}
    </motion.div>
  )
}
