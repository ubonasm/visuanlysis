'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { HeadDetector } from '@/components/head-detector'
import { TrackingPanel } from '@/components/tracking-panel'
import { TimelineAnalyzer } from '@/components/timeline-analyzer'
import { ProjectManager, type Project } from '@/components/project-manager'
import { SettingsDialog } from '@/components/settings-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Pause, RotateCcw, Video, Save } from 'lucide-react'
import type { DetectedHead, TrackedPerson } from '@/types/detection'

interface CapturedFrame {
  timestamp: number
  imageData: string
  trackedPositions: { id: string; x: number; y: number; label: string; role: string }[]
}

const GEMINI_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (推奨)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
]

export default function ClassroomAnalyzer() {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [detectedHeads, setDetectedHeads] = useState<DetectedHead[]>([])
  const [trackedPersons, setTrackedPersons] = useState<TrackedPerson[]>([])
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [showProjectNameDialog, setShowProjectNameDialog] = useState(false)
  const [selectedHead, setSelectedHead] = useState<DetectedHead | null>(null)
  const [personType, setPersonType] = useState<'teacher' | 'student'>('student')
  const [personLabel, setPersonLabel] = useState('')
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview')
  const [captureInterval, setCaptureInterval] = useState(10)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [currentProjectName, setCurrentProjectName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null)
  const [recordingEndTime, setRecordingEndTime] = useState<number | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const projectManagerRefreshRef = useRef<() => void>(() => {})

  const handleHeadsDetected = useCallback((heads: DetectedHead[]) => {
    setDetectedHeads(heads)
  }, [])

  const handleFrameCaptured = useCallback((frame: CapturedFrame) => {
    setCapturedFrames((prev) => [...prev, frame])
  }, [])

  const handleUpdatePersonPosition = useCallback((personId: string, x: number, y: number) => {
    setTrackedPersons((prev) =>
      prev.map((p) =>
        p.id === personId ? { ...p, headPosition: { x, y } } : p
      )
    )
  }, [])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const canvas = e.currentTarget.querySelector('canvas')
      if (!canvas) return

      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY

      // Find clicked head or use click position
      const clickedHead = detectedHeads.find((head) => {
        const distance = Math.sqrt(Math.pow(head.x - x, 2) + Math.pow(head.y - y, 2))
        return distance < 50
      })

      if (clickedHead) {
        setSelectedHead(clickedHead)
      } else {
        setSelectedHead({
          id: `manual-${Date.now()}`,
          x,
          y,
          width: 60,
          height: 80,
          confidence: 1.0,
        })
      }
      setPersonLabel('')
      setShowDialog(true)
    },
    [detectedHeads]
  )

  const handleAddTrackedPerson = () => {
    if (!selectedHead || !personLabel.trim()) return

    const newPerson: TrackedPerson = {
      id: `person-${Date.now()}`,
      headPosition: { x: selectedHead.x, y: selectedHead.y },
      isTracking: true,
      role: personType === 'teacher' ? '教師' : '児童生徒',
      label: personLabel,
    }

    setTrackedPersons((prev) => [...prev, newPerson])
    setShowDialog(false)
    setSelectedHead(null)
  }

  const handleRemovePerson = (id: string) => {
    setTrackedPersons((prev) => prev.filter((p) => p.id !== id))
  }

  const handleStartRecording = async () => {
    if (trackedPersons.length === 0) {
      alert('先に追跡対象を選択してください。映像をクリックして人物を登録できます。')
      return
    }

    // If resuming from pause
    if (isPaused && currentProjectId) {
      setIsRunning(true)
      setIsPaused(false)
      return
    }

    // Show project name dialog
    setNewProjectName(`録画 ${new Date().toLocaleString('ja-JP')}`)
    setShowProjectNameDialog(true)
  }

  const handleConfirmStart = async () => {
    if (!newProjectName.trim()) return

    // Create new session on server
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          trackedPersons: trackedPersons.map(p => ({
            label: p.label,
            role: p.role,
          })),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentProjectId(data.sessionId)
        setCurrentProjectName(data.name)
        setIsRunning(true)
        setIsPaused(false)
        setRecordingStartTime(Date.now())
        setRecordingEndTime(null)
        setCapturedFrames([])
        setShowProjectNameDialog(false)
      }
    } catch {
      alert('プロジェクトの作成に失敗しました')
    }
  }

  const handlePause = () => {
    setIsRunning(false)
    setIsPaused(true)
    setRecordingEndTime(Date.now())
  }

  const handleReset = () => {
    if (confirm('録画データをリセットしますか？')) {
      setIsRunning(false)
      setIsPaused(false)
      setCapturedFrames([])
      setRecordingStartTime(null)
      setRecordingEndTime(null)
      setCurrentProjectId(null)
      setCurrentProjectName('')
    }
  }

  const handleSelectProject = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/sessions/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        
        setCurrentProjectId(projectId)
        setCurrentProjectName(data.name || projectId)
        setIsRunning(false)
        setIsPaused(true)
        
        // Load frames
        const frames: CapturedFrame[] = (data.frames || []).map((f: {
          timestamp: number
          filename: string
          trackedPersons?: { id: string; label: string; role: string; position: { x: number; y: number } }[]
        }) => ({
          timestamp: f.timestamp,
          imageData: `/images/${projectId}/${f.filename}`,
          trackedPositions: (f.trackedPersons || []).map(p => ({
            id: p.id,
            x: p.position?.x || 0,
            y: p.position?.y || 0,
            label: p.label,
            role: p.role,
          })),
        }))
        
        setCapturedFrames(frames)
        
        if (frames.length > 0) {
          setRecordingStartTime(frames[0].timestamp)
          setRecordingEndTime(frames[frames.length - 1].timestamp)
        }

        // Restore tracked persons
        if (data.trackedPersons && data.trackedPersons.length > 0) {
          const restoredPersons: TrackedPerson[] = data.trackedPersons.map((p: { label: string; role: string }, i: number) => ({
            id: `restored-${i}`,
            headPosition: { x: 320, y: 240 },
            isTracking: true,
            role: p.role,
            label: p.label,
          }))
          setTrackedPersons(restoredPersons)
        }
      }
    } catch {
      alert('プロジェクトの読み込みに失敗しました')
    }
  }, [])

  const handleNewProject = useCallback((name: string) => {
    // Just set the name, actual creation happens on start
    setNewProjectName(name)
    setCurrentProjectId(null)
    setCurrentProjectName('')
    setCapturedFrames([])
    setIsRunning(false)
    setIsPaused(false)
  }, [])

  // Show timeline if we have frames and are paused or stopped
  const showTimeline = capturedFrames.length > 0 && !isRunning

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">教室映像分析システム</h1>
              {currentProjectName && (
                <span className="text-sm text-muted-foreground">
                  - {currentProjectName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <SettingsDialog />
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isRunning}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="モデルを選択" />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={captureInterval.toString()}
                onValueChange={(v) => setCaptureInterval(parseInt(v))}
                disabled={isRunning}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="キャプチャ間隔" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5秒間隔</SelectItem>
                  <SelectItem value="10">10秒間隔</SelectItem>
                  <SelectItem value="30">30秒間隔</SelectItem>
                  <SelectItem value="60">60秒間隔</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Control buttons */}
              {!isRunning ? (
                <Button onClick={handleStartRecording} className="gap-2">
                  <Play className="h-4 w-4" />
                  {isPaused ? '再開' : '録画開始'}
                </Button>
              ) : (
                <Button onClick={handlePause} variant="secondary" className="gap-2">
                  <Pause className="h-4 w-4" />
                  一時停止
                </Button>
              )}
              
              {(capturedFrames.length > 0 || isPaused) && (
                <Button onClick={handleReset} variant="outline" className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  リセット
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardContent className="p-4">
                <div
                  ref={canvasContainerRef}
                  onClick={handleCanvasClick}
                  className="cursor-crosshair"
                >
                  <HeadDetector
                    isRunning={isRunning}
                    onHeadsDetected={handleHeadsDetected}
                    trackedPersons={trackedPersons}
                    onUpdatePosition={handleUpdatePersonPosition}
                    onFrameCaptured={handleFrameCaptured}
                    captureInterval={captureInterval}
                    sessionId={currentProjectId}
                  />
                </div>
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>
                      追跡中: {trackedPersons.filter((p) => p.isTracking).length}人
                      {capturedFrames.length > 0 && ` | 保存済みフレーム: ${capturedFrames.length}`}
                    </span>
                    <span>
                      {isRunning ? (
                        <span className="text-green-600 font-medium">録画中...</span>
                      ) : isPaused ? (
                        <span className="text-yellow-600 font-medium">一時停止中</span>
                      ) : trackedPersons.length === 0 ? (
                        '映像をクリックして追跡対象を選択'
                      ) : (
                        '「録画開始」ボタンでプロジェクトを作成'
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline analyzer - shown when paused or stopped with frames */}
            {showTimeline && (
              <TimelineAnalyzer
                frames={capturedFrames}
                startTime={recordingStartTime}
                endTime={recordingEndTime}
                selectedModel={selectedModel}
                onAnalysisComplete={() => {}}
              />
            )}
          </div>

          <div className="space-y-6">
            <TrackingPanel
              trackedPersons={trackedPersons}
              behaviorRecords={[]}
              onRemovePerson={handleRemovePerson}
            />
            <ProjectManager
              currentProjectId={currentProjectId}
              onSelectProject={handleSelectProject}
              onNewProject={handleNewProject}
            />
          </div>
        </div>
      </main>

      {/* Person type dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>追跡対象の設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>人物の種類</Label>
              <RadioGroup
                value={personType}
                onValueChange={(v) => setPersonType(v as 'teacher' | 'student')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="teacher" id="teacher" />
                  <Label htmlFor="teacher" className="cursor-pointer">
                    教師
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="student" id="student" />
                  <Label htmlFor="student" className="cursor-pointer">
                    児童生徒
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">ラベル（名前や番号）</Label>
              <Input
                id="label"
                placeholder="例: 山田先生、生徒A、1番"
                value={personLabel}
                onChange={(e) => setPersonLabel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleAddTrackedPerson} disabled={!personLabel.trim()}>
              追跡対象に追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project name dialog */}
      <Dialog open={showProjectNameDialog} onOpenChange={setShowProjectNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プロジェクト名を入力</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="project-name">プロジェクト名</Label>
            <Input
              id="project-name"
              placeholder="例: 3年2組 数学授業"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirmStart()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectNameDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleConfirmStart} disabled={!newProjectName.trim()} className="gap-2">
              <Save className="h-4 w-4" />
              録画開始
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
