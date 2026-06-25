import { useEffect, useRef, useState } from 'react'

export function IntroSplashScreen() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('has-seen-deskcloud-intro')
    }
    return true
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!isVisible) return

    const timer = setTimeout(() => {
      setIsVisible(false)
      sessionStorage.setItem('has-seen-deskcloud-intro', 'true')
    }, 3000)

    return () => clearTimeout(timer)
  }, [isVisible])

  // SaaS Grid and Data Packet Transmission Canvas Animation
  useEffect(() => {
    if (!isVisible) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    // Data packet transmission particles flowing along grid lines
    const packets: Array<{
      x: number
      y: number
      targetX: number
      targetY: number
      speed: number
      radius: number
      color: string
      axis: 'x' | 'y'
      progress: number
    }> = []

    const colors = [
      'rgba(56, 189, 248, ', // Sky 400
      'rgba(99, 102, 241, ', // Indigo 500
      'rgba(168, 85, 247, ', // Purple 500
    ]

    const gridSpacing = 60

    const createPacket = () => {
      const isVertical = Math.random() > 0.5
      let x: number
      let y: number
      let targetX: number
      let targetY: number

      if (isVertical) {
        x = Math.floor((Math.random() * width) / gridSpacing) * gridSpacing
        y = Math.random() > 0.5 ? 0 : height
        targetX = x
        targetY = y === 0 ? height : 0
      } else {
        x = Math.random() > 0.5 ? 0 : width
        y = Math.floor((Math.random() * height) / gridSpacing) * gridSpacing
        targetX = x === 0 ? width : 0
        targetY = y
      }

      packets.push({
        x,
        y,
        targetX,
        targetY,
        speed: Math.random() * 2 + 1.5,
        radius: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)] ?? 'rgba(56, 189, 248, ',
        axis: isVertical ? 'y' : 'x',
        progress: 0,
      })
    }

    // Initialize initial packets
    for (let i = 0; i < 25; i++) {
      createPacket()
    }

    const draw = () => {
      ctx.fillStyle = '#0a0d16' // Rich deep navy-black
      ctx.fillRect(0, 0, width, height)

      // Draw elegant grid lines representing the SaaS network connections
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.02)'
      ctx.lineWidth = 1

      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Draw floating grid intersection glow points
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'
      for (let x = gridSpacing; x < width; x += gridSpacing * 2) {
        for (let y = gridSpacing; y < height; y += gridSpacing * 2) {
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Update and draw packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]
        if (!p) continue

        if (p.axis === 'y') {
          const dy = p.targetY - p.y
          if (Math.abs(dy) < p.speed) {
            packets.splice(i, 1)
            createPacket()
            continue
          }
          p.y += Math.sign(dy) * p.speed
        } else {
          const dx = p.targetX - p.x
          if (Math.abs(dx) < p.speed) {
            packets.splice(i, 1)
            createPacket()
            continue
          }
          p.x += Math.sign(dx) * p.speed
        }

        // Draw packet glow
        ctx.shadowBlur = 10
        ctx.shadowColor = p.color + '0.5)'
        ctx.fillStyle = p.color + '0.8)'

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()

        ctx.shadowBlur = 0 // Reset
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="dc-splash-overlay">
      <canvas ref={canvasRef} className="dc-splash-canvas" />

      <div className="dc-splash-content">
        {/* Glowing Desk Symbol */}
        <div className="dc-splash-logo-wrapper">
          <div className="dc-splash-logo-border" />
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dc-splash-icon"
          >
            {/* Box/Layout / Multi-desk layout concept */}
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
        </div>

        {/* Text */}
        <h1 className="dc-splash-title">
          DeskCloud<span className="dc-splash-beta">Beta</span>
        </h1>
        <p className="dc-splash-subtitle">Multi-Tenant SaaS Integration Console</p>

        {/* Grid Node Status Info */}
        <div className="dc-splash-status font-mono">
          <span>Bootstrapping SaaS Integration Core...</span>
        </div>
      </div>

      <style>{`
        .dc-splash-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: #0a0d16;
          overflow: hidden;
          user-select: none;
          animation: dcFadeOut 0.8s cubic-bezier(0.16, 1, 0.3, 1) 2.7s forwards;
        }

        .dc-splash-canvas {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .dc-splash-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .dc-splash-logo-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 88px;
          height: 88px;
          background: rgba(13, 17, 28, 0.95);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(56, 189, 248, 0.1);
          animation: dcPopIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .dc-splash-logo-border {
          position: absolute;
          inset: -1px;
          border-radius: 21px;
          background: linear-gradient(135deg, #38bdf8, #6366f1);
          z-index: -1;
          opacity: 0.4;
          animation: dcPulse 2.4s infinite ease-in-out;
        }

        .dc-splash-icon {
          color: #38bdf8;
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.7));
          animation: dcIconSpin 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .dc-splash-title {
          margin-top: 1.75rem;
          font-size: 2.25rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          opacity: 0;
          transform: translateY(10px);
          animation: dcTextReveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards;
        }

        .dc-splash-beta {
          padding: 1px 6px;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0;
          color: #6366f1;
          border: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 999px;
          text-transform: uppercase;
        }

        .dc-splash-subtitle {
          margin-top: 0.5rem;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.22em;
          color: #94a3b8;
          text-transform: uppercase;
          opacity: 0;
          transform: translateY(10px);
          animation: dcTextReveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards;
        }

        .dc-splash-status {
          margin-top: 2rem;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          color: rgba(56, 189, 248, 0.45);
          opacity: 0;
          animation: dcFadeIn 1s ease-in 1.2s forwards;
        }

        @keyframes dcPopIn {
          0% { transform: scale(0.75); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes dcIconSpin {
          0% { transform: scale(0.8) rotate(-90deg); }
          100% { transform: scale(1) rotate(0); }
        }

        @keyframes dcPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.06); opacity: 0.6; }
        }

        @keyframes dcTextReveal {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes dcFadeIn {
          to { opacity: 1; }
        }

        @keyframes dcFadeOut {
          to { opacity: 0; visibility: hidden; filter: blur(15px); }
        }
      `}</style>
    </div>
  )
}
