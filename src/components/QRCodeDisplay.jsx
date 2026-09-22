import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Share2, Copy, Download } from 'lucide-react'
import { motion } from 'framer-motion'

export default function QRCodeDisplay({ joinUrl, sessionCode }) {
  const canvasRef = useRef(null)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
    } catch {
      prompt('Copy this link:', joinUrl)
    }
  }

  const shareOrDownload = () => {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return copyLink()

    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'watchmatch-invite.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Join my WatchMatch session',
            text: `Scan the QR or tap the link to join: ${joinUrl}`,
            files: [file],
          })
          return
        } catch {}
      }

      // Fallback: download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'watchmatch-invite.png'
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-5"
    >
      <div className="text-center">
        <p className="text-white/60 text-sm">Share this with your partner</p>
        <p className="text-white/30 text-xs mt-0.5">They scan the QR or tap the link</p>
      </div>

      <div
        ref={canvasRef}
        className="p-4 bg-white rounded-2xl"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)' }}
      >
        <QRCodeCanvas
          value={joinUrl}
          size={200}
          bgColor="#ffffff"
          fgColor="#0a0a12"
          level="M"
          imageSettings={{
            src: '/icon.svg',
            height: 36,
            width: 36,
            excavate: true,
          }}
        />
      </div>

      <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-xl border border-border w-full max-w-xs">
        <code className="text-white/60 text-xs flex-1 truncate">{joinUrl}</code>
      </div>

      <div className="flex gap-3">
        <button
          onClick={copyLink}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-surfaceHover border border-border rounded-xl text-sm text-white/70 hover:text-white transition-all"
        >
          <Copy size={14} />
          Copy link
        </button>
        <button
          onClick={shareOrDownload}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primaryHover rounded-xl text-sm text-white font-medium transition-all"
        >
          <Share2 size={14} />
          Share QR
        </button>
      </div>
    </motion.div>
  )
}
