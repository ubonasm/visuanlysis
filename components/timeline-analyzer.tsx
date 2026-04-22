'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Loader2, Play, ImageIcon, Check } from 'lucide-react'

interface CapturedFrame {
  timestamp: number
  imageData: string
  trackedPositions: { id: string; x: number; y: number; label: string; role: string }[]
}

interface TimelineAnalyzerProps {
  frames: CapturedFrame[]
  startTime: number | null
  endTime: number | null
  selectedModel: string
  onAnalysisComplete: (results: AnalysisResult[]) => void
}

interface AnalysisResult {
  startTime: number
  endTime: number
  scene: string
  frames: CapturedFrame[]
}

export function TimelineAnalyzer({
  frames,
  startTime,
  endTime,
  selectedModel,
  onAnalysisComplete,
}: TimelineAnalyzerProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Group frames by 5-minute intervals for thumbnails
  const thumbnailGroups = useMemo(() => {
    if (!startTime || !endTime || frames.length === 0) return []

    const groups: { time: number; frame: CapturedFrame; label: string; index: number }[] = []
    const intervalMs = 5 * 60 * 1000 // 5 minutes

    let currentTime = startTime
    let groupIndex = 0
    while (currentTime <= endTime + intervalMs) {
      // Find the closest frame to this time
      const closestFrame = frames.reduce((closest, frame) => {
        const closestDiff = Math.abs(closest.timestamp - currentTime)
        const frameDiff = Math.abs(frame.timestamp - currentTime)
        return frameDiff < closestDiff ? frame : closest
      }, frames[0])

      const minutes = Math.floor((currentTime - startTime) / 60000)
      groups.push({
        time: currentTime,
        frame: closestFrame,
        label: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`,
        index: groupIndex,
      })

      currentTime += intervalMs
      groupIndex++
    }

    return groups
  }, [frames, startTime, endTime])

  // Duration info
  const durationInfo = useMemo(() => {
    if (!startTime || !endTime) return null
    const durationMs = endTime - startTime
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return {
      start: new Date(startTime).toLocaleTimeString('ja-JP'),
      end: new Date(endTime).toLocaleTimeString('ja-JP'),
      duration: `${minutes}分${seconds}秒`,
      totalFrames: frames.length,
    }
  }, [startTime, endTime, frames.length])

  // Selected range based on selected indices
  const selectedRange = useMemo(() => {
    if (selectedIndices.size === 0 || thumbnailGroups.length === 0) return null
    const indices = Array.from(selectedIndices).sort((a, b) => a - b)
    const minIdx = indices[0]
    const maxIdx = indices[indices.length - 1]
    return {
      start: thumbnailGroups[minIdx]?.time || startTime!,
      end: thumbnailGroups[Math.min(maxIdx + 1, thumbnailGroups.length - 1)]?.time || endTime!,
    }
  }, [selectedIndices, thumbnailGroups, startTime, endTime])

  const handleThumbnailClick = (index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
    setAnalysisError(null)
  }

  const handleSelectAll = () => {
    if (selectedIndices.size === thumbnailGroups.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(thumbnailGroups.map((_, i) => i)))
    }
  }

  const handleAnalyze = async () => {
    if (!selectedRange || selectedIndices.size === 0) {
      setAnalysisError('分析する区間を選択してください')
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    // Get frames in the selected range
    const rangeFrames = frames.filter(
      (f) => f.timestamp >= selectedRange.start && f.timestamp <= selectedRange.end
    )

    if (rangeFrames.length === 0) {
      setAnalysisError('選択した区間にフレームがありません')
      setIsAnalyzing(false)
      return
    }

    // Sample frames (max 5 for analysis to save API quota)
    const sampleCount = Math.min(5, rangeFrames.length)
    const step = Math.max(1, Math.floor(rangeFrames.length / sampleCount))
    const sampledFrames = rangeFrames.filter((_, i) => i % step === 0).slice(0, sampleCount)

    try {
      const response = await fetch('/api/analyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: sampledFrames.map((f) => ({
            imageData: f.imageData,
            timestamp: f.timestamp,
            trackedPersons: f.trackedPositions,
          })),
          model: selectedModel,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const result = await response.json()

      const newResult: AnalysisResult = {
        startTime: selectedRange.start,
        endTime: selectedRange.end,
        scene: result.scene || '分析結果なし',
        frames: rangeFrames,
      }

      if (result.error) {
        setAnalysisError(result.error)
      }

      setAnalysisResults((prev) => [...prev, newResult])
      onAnalysisComplete([...analysisResults, newResult])
      setSelectedIndices(new Set())
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'API接続エラー')
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (!startTime || !endTime || frames.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            タイムライン分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-4">
            録画を開始すると、ここにタイムラインが表示されます
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          タイムライン分析
        </CardTitle>
        {durationInfo && (
          <p className="text-sm text-muted-foreground">
            {durationInfo.start} 〜 {durationInfo.end} ({durationInfo.duration}) |{' '}
            {durationInfo.totalFrames}フレーム保存済み
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thumbnail timeline */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">サムネイル（5分間隔）- クリックで選択</p>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedIndices.size === thumbnailGroups.length ? '全解除' : '全選択'}
            </Button>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              {thumbnailGroups.map((group) => (
                <button
                  key={group.time}
                  onClick={() => handleThumbnailClick(group.index)}
                  className={`relative flex-shrink-0 border-2 rounded-lg overflow-hidden transition-all ${
                    selectedIndices.has(group.index)
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  <img
                    src={group.frame.imageData}
                    alt={`${group.label}`}
                    className="w-24 h-16 object-cover"
                  />
                  <p className="text-xs text-center py-1 bg-muted">{group.label}</p>
                  {selectedIndices.has(group.index) && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Range selection */}
        <div className="bg-muted/50 p-3 rounded-lg">
          {selectedRange ? (
            <>
              <p className="text-sm">
                選択区間:{' '}
                <span className="font-medium">
                  {new Date(selectedRange.start).toLocaleTimeString('ja-JP')} 〜{' '}
                  {new Date(selectedRange.end).toLocaleTimeString('ja-JP')}
                </span>
                <span className="text-muted-foreground ml-2">
                  ({selectedIndices.size}区間選択)
                </span>
              </p>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="mt-2 gap-2"
                size="sm"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    この区間を分析
                  </>
                )}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              サムネイルをクリックして分析する区間を選択してください
            </p>
          )}
          {analysisError && (
            <p className="text-sm text-destructive mt-2">{analysisError}</p>
          )}
        </div>

        {/* Analysis results */}
        {analysisResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">分析結果</p>
            {analysisResults.map((result, idx) => (
              <div key={idx} className="bg-primary/10 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  {new Date(result.startTime).toLocaleTimeString('ja-JP')} 〜{' '}
                  {new Date(result.endTime).toLocaleTimeString('ja-JP')}
                </p>
                <p className="text-sm whitespace-pre-wrap">{result.scene}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
