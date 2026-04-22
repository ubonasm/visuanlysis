'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { DetectedHead, TrackedPerson } from '@/types/detection'

interface CapturedFrame {
  timestamp: number
  imageData: string
  trackedPositions: { id: string; x: number; y: number; label: string; role: string }[]
}

interface HeadDetectorProps {
  isRunning: boolean
  onHeadsDetected: (heads: DetectedHead[]) => void
  trackedPersons: TrackedPerson[]
  onUpdatePosition: (personId: string, x: number, y: number) => void
  onFrameCaptured: (frame: CapturedFrame) => void
  captureInterval: number
  sessionId: string | null
}

export function HeadDetector({
  isRunning,
  onHeadsDetected,
  trackedPersons,
  onUpdatePosition,
  onFrameCaptured,
  captureInterval,
  sessionId,
}: HeadDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevFrameRef = useRef<ImageData | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null)
  const animationRef = useRef<number>(0)
  const lastCaptureRef = useRef<number>(0)
  
  // Store smoothed positions locally for drawing
  const smoothedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectionMethod, setDetectionMethod] = useState<string>('初期化中...')

  // Store refs for callbacks
  const onHeadsDetectedRef = useRef(onHeadsDetected)
  const onUpdatePositionRef = useRef(onUpdatePosition)
  const onFrameCapturedRef = useRef(onFrameCaptured)
  const captureIntervalRef = useRef(captureInterval)
  const trackedPersonsRef = useRef(trackedPersons)
  const sessionIdRef = useRef(sessionId)

  useEffect(() => {
    onHeadsDetectedRef.current = onHeadsDetected
    onUpdatePositionRef.current = onUpdatePosition
    onFrameCapturedRef.current = onFrameCaptured
    captureIntervalRef.current = captureInterval
    trackedPersonsRef.current = trackedPersons
    sessionIdRef.current = sessionId
  }, [onHeadsDetected, onUpdatePosition, onFrameCaptured, captureInterval, trackedPersons, sessionId])

  // Initialize smoothed positions when tracked persons change
  useEffect(() => {
    trackedPersons.forEach((person) => {
      if (!smoothedPositionsRef.current.has(person.id)) {
        smoothedPositionsRef.current.set(person.id, { ...person.headPosition })
      }
    })
    // Remove deleted persons
    const personIds = new Set(trackedPersons.map(p => p.id))
    smoothedPositionsRef.current.forEach((_, key) => {
      if (!personIds.has(key)) {
        smoothedPositionsRef.current.delete(key)
      }
    })
  }, [trackedPersons])

  // Initialize camera
  useEffect(() => {
    let isMounted = true

    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
        })

        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // Try FaceDetector API
        if (typeof window !== 'undefined' && 'FaceDetector' in window) {
          try {
            // @ts-expect-error FaceDetector is not in TypeScript types
            const faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 20 })
            if (isMounted) {
              detectorRef.current = faceDetector
              setDetectionMethod('顔検出API')
            }
          } catch {
            setDetectionMethod('背景差分法')
          }
        } else {
          setDetectionMethod('背景差分法')
        }

        if (isMounted) {
          setIsInitialized(true)
        }
      } catch {
        if (isMounted) {
          setError('カメラの初期化に失敗しました。カメラへのアクセスを許可してください。')
        }
      }
    }

    initializeCamera()

    return () => {
      isMounted = false
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Background subtraction - returns center of motion regions
  const detectMotion = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number): { x: number; y: number }[] => {
    const currentFrame = ctx.getImageData(0, 0, width, height)
    const results: { x: number; y: number; weight: number }[] = []

    if (prevFrameRef.current) {
      const gridSize = 80
      const threshold = 35
      const motionThreshold = 0.20

      // Accumulate motion by grid
      const gridMotion: Map<string, { x: number; y: number; motion: number }> = new Map()

      for (let gy = 0; gy < height; gy += gridSize) {
        for (let gx = 0; gx < width; gx += gridSize) {
          let changedPixels = 0
          let totalPixels = 0

          for (let y = gy; y < Math.min(gy + gridSize, height); y += 6) {
            for (let x = gx; x < Math.min(gx + gridSize, width); x += 6) {
              const i = (y * width + x) * 4
              const dr = Math.abs(currentFrame.data[i] - prevFrameRef.current!.data[i])
              const dg = Math.abs(currentFrame.data[i + 1] - prevFrameRef.current!.data[i + 1])
              const db = Math.abs(currentFrame.data[i + 2] - prevFrameRef.current!.data[i + 2])
              
              if ((dr + dg + db) / 3 > threshold) {
                changedPixels++
              }
              totalPixels++
            }
          }

          const motionRatio = totalPixels > 0 ? changedPixels / totalPixels : 0
          if (motionRatio > motionThreshold) {
            gridMotion.set(`${gx},${gy}`, {
              x: gx + gridSize / 2,
              y: gy + gridSize / 2,
              motion: motionRatio,
            })
          }
        }
      }

      // Cluster nearby grids
      const clusters: { x: number; y: number; weight: number }[] = []
      const processed = new Set<string>()

      gridMotion.forEach((grid, key) => {
        if (processed.has(key)) return
        
        let sumX = grid.x * grid.motion
        let sumY = grid.y * grid.motion
        let totalWeight = grid.motion
        processed.add(key)

        // Find neighbors
        gridMotion.forEach((other, otherKey) => {
          if (processed.has(otherKey)) return
          const dist = Math.sqrt(Math.pow(grid.x - other.x, 2) + Math.pow(grid.y - other.y, 2))
          if (dist < gridSize * 2) {
            sumX += other.x * other.motion
            sumY += other.y * other.motion
            totalWeight += other.motion
            processed.add(otherKey)
          }
        })

        if (totalWeight > 0.5) { // Only significant clusters
          clusters.push({
            x: sumX / totalWeight,
            y: sumY / totalWeight,
            weight: totalWeight,
          })
        }
      })

      // Sort by weight and return top clusters
      clusters.sort((a, b) => b.weight - a.weight)
      clusters.slice(0, 5).forEach(c => {
        results.push({ x: c.x, y: c.y, weight: c.weight })
      })
    }

    prevFrameRef.current = currentFrame
    return results
  }, [])

  // Capture frame
  const captureFrame = useCallback(async () => {
    if (!canvasRef.current || !videoRef.current || !sessionIdRef.current) return

    const now = Date.now()
    const intervalMs = captureIntervalRef.current * 1000
    if (now - lastCaptureRef.current < intervalMs) return
    lastCaptureRef.current = now

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = videoRef.current.videoWidth
    tempCanvas.height = videoRef.current.videoHeight
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCtx.drawImage(videoRef.current, 0, 0)

    // Draw markers for tracked persons
    trackedPersonsRef.current.forEach((person) => {
      const pos = smoothedPositionsRef.current.get(person.id) || person.headPosition
      
      tempCtx.beginPath()
      tempCtx.arc(pos.x, pos.y, 25, 0, Math.PI * 2)
      tempCtx.strokeStyle = person.role === '教師' ? '#ef4444' : '#22c55e'
      tempCtx.lineWidth = 4
      tempCtx.stroke()
      
      tempCtx.font = 'bold 18px sans-serif'
      tempCtx.fillStyle = 'yellow'
      tempCtx.strokeStyle = 'black'
      tempCtx.lineWidth = 3
      tempCtx.strokeText(person.label, pos.x - 25, pos.y - 35)
      tempCtx.fillText(person.label, pos.x - 25, pos.y - 35)
    })

    const imageData = tempCanvas.toDataURL('image/jpeg', 0.7)

    // Save to server
    try {
      await fetch('/api/save-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          sessionId: sessionIdRef.current,
          timestamp: now,
          trackedPersons: trackedPersonsRef.current.map((p) => ({
            id: p.id,
            label: p.label,
            role: p.role,
            position: smoothedPositionsRef.current.get(p.id) || p.headPosition,
          })),
        }),
      })
    } catch {
      // Ignore save errors
    }

    onFrameCapturedRef.current({
      timestamp: now,
      imageData,
      trackedPositions: trackedPersonsRef.current.map((p) => {
        const pos = smoothedPositionsRef.current.get(p.id) || p.headPosition
        return { id: p.id, x: pos.x, y: pos.y, label: p.label, role: p.role }
      }),
    })
  }, [])

  // Handle click to select head
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const clickedHead: DetectedHead = {
      id: `manual-${Date.now()}`,
      x,
      y,
      width: 60,
      height: 80,
      confidence: 1.0,
    }

    onHeadsDetectedRef.current([clickedHead])
  }, [])

  // Main render loop
  useEffect(() => {
    if (!isInitialized) return

    let isActive = true

    const render = async () => {
      if (!isActive || !videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      if (!ctx || video.readyState < 2) {
        animationRef.current = requestAnimationFrame(render)
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      // Detect faces or motion
      const detectedPoints: { x: number; y: number }[] = []

      // Face detection (if available)
      if (detectorRef.current) {
        try {
          const faces = await detectorRef.current.detect(video)
          faces.forEach((face: { boundingBox: DOMRectReadOnly }) => {
            const box = face.boundingBox
            detectedPoints.push({
              x: box.x + box.width / 2,
              y: box.y + box.height / 2,
            })
          })
        } catch {
          // Ignore
        }
      }

      // Background subtraction for motion
      const motionPoints = detectMotion(ctx, canvas.width, canvas.height)
      
      // Add motion points that don't overlap with faces
      motionPoints.forEach((mp) => {
        const overlaps = detectedPoints.some((dp) => {
          const dist = Math.sqrt(Math.pow(dp.x - mp.x, 2) + Math.pow(dp.y - mp.y, 2))
          return dist < 100
        })
        if (!overlaps) {
          detectedPoints.push({ x: mp.x, y: mp.y })
        }
      })

      // Update tracked persons - find closest detection to each tracked person
      trackedPersonsRef.current.forEach((person) => {
        if (!person.isTracking) return

        const currentPos = smoothedPositionsRef.current.get(person.id) || person.headPosition
        
        if (detectedPoints.length > 0) {
          // Find closest detection
          let closestPoint = detectedPoints[0]
          let minDist = Infinity

          detectedPoints.forEach((point) => {
            const dist = Math.sqrt(
              Math.pow(point.x - currentPos.x, 2) +
              Math.pow(point.y - currentPos.y, 2)
            )
            if (dist < minDist) {
              minDist = dist
              closestPoint = point
            }
          })

          // Update if close enough (within 250px)
          if (minDist < 250) {
            // Apply smoothing
            const smoothing = 0.15 // Higher = faster tracking
            const newX = currentPos.x + (closestPoint.x - currentPos.x) * smoothing
            const newY = currentPos.y + (closestPoint.y - currentPos.y) * smoothing
            
            // Only update if movement is significant (> 5px)
            const movement = Math.sqrt(
              Math.pow(newX - currentPos.x, 2) +
              Math.pow(newY - currentPos.y, 2)
            )
            
            if (movement > 5) {
              smoothedPositionsRef.current.set(person.id, { x: newX, y: newY })
              onUpdatePositionRef.current(person.id, newX, newY)
            }
          }
        }

        // Draw marker for this tracked person
        const drawPos = smoothedPositionsRef.current.get(person.id) || person.headPosition

        ctx.beginPath()
        ctx.arc(drawPos.x, drawPos.y, 18, 0, Math.PI * 2)
        ctx.fillStyle = person.role === '教師' ? '#ef4444' : '#22c55e'
        ctx.fill()
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 3
        ctx.stroke()

        ctx.font = 'bold 14px sans-serif'
        ctx.fillStyle = 'white'
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 3
        ctx.strokeText(person.label, drawPos.x - 20, drawPos.y - 28)
        ctx.fillText(person.label, drawPos.x - 20, drawPos.y - 28)
      })

      // Capture frame when running
      if (isRunning && trackedPersonsRef.current.length > 0) {
        captureFrame()
      }

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      isActive = false
      cancelAnimationFrame(animationRef.current)
    }
  }, [isInitialized, isRunning, detectMotion, captureFrame])

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas
        ref={canvasRef}
        className="w-full max-h-[60vh] rounded-lg bg-muted cursor-crosshair"
        onClick={handleCanvasClick}
      />
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-lg">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-muted-foreground">カメラを初期化中...</p>
          </div>
        </div>
      )}
      {isInitialized && (
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {detectionMethod}
        </div>
      )}
    </div>
  )
}
