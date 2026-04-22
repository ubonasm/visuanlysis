'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FolderOpen, Trash2, Calendar, Clock, Image as ImageIcon, Plus } from 'lucide-react'

export interface Project {
  id: string
  name: string
  createdAt: string
  frameCount: number
  duration: number
  trackedPersons: { label: string; role: string }[]
}

interface ProjectManagerProps {
  onSelectProject: (projectId: string) => void
  onNewProject: (name: string) => void
  currentProjectId: string | null
}

export function ProjectManager({
  onSelectProject,
  onNewProject,
  currentProjectId,
}: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.sessions || [])
      }
    } catch {
      // Ignore errors
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleDelete = async (projectId: string) => {
    if (!confirm('このプロジェクトを削除しますか？')) return

    try {
      await fetch(`/api/sessions/${projectId}`, { method: 'DELETE' })
      loadProjects()
    } catch {
      // Ignore errors
    }
  }

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onNewProject(newProjectName.trim())
      setNewProjectName('')
      setShowNewDialog(false)
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}時間${minutes % 60}分`
    }
    return `${minutes}分${seconds % 60}秒`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            プロジェクト
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewDialog(true)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            新規
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">プロジェクトがありません</p>
            <p className="text-xs mt-1">新規ボタンで作成できます</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentProjectId === project.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/30 hover:bg-muted/50 border-transparent'
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {project.name}
                        </span>
                        {currentProjectId === project.id && (
                          <Badge variant="default" className="text-xs">
                            選択中
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(project.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(project.duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {project.frameCount}枚
                        </span>
                      </div>
                      {project.trackedPersons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {project.trackedPersons.slice(0, 3).map((p, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className={`text-xs ${
                                p.role === '教師'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {p.label}
                            </Badge>
                          ))}
                          {project.trackedPersons.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{project.trackedPersons.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(project.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規プロジェクト</DialogTitle>
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
                  handleCreateProject()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
