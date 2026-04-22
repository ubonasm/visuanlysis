'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Key, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

export function SettingsDialog() {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [maskedKey, setMaskedKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (open) {
      checkApiKey()
    }
  }, [open])

  const checkApiKey = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setHasApiKey(data.hasApiKey)
      setMaskedKey(data.maskedKey)
    } catch {
      setHasApiKey(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'APIキーを入力してください' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: data.message })
        setApiKey('')
        await checkApiKey()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch {
      setMessage({ type: 'error', text: '保存に失敗しました' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API設定
          </DialogTitle>
          <DialogDescription>
            Gemini APIキーを設定してください。行動分析機能に必要です。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            {hasApiKey ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">APIキー設定済み</p>
                  <p className="text-xs text-muted-foreground">{maskedKey}</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium">APIキー未設定</p>
                  <p className="text-xs text-muted-foreground">行動分析を使用するにはAPIキーが必要です</p>
                </div>
              </>
            )}
          </div>

          {/* API Key input */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {hasApiKey ? '新しいAPIキー（変更する場合）' : 'Gemini APIキー'}
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Help link */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Google AI StudioでAPIキーを取得
          </a>

          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-red-500/10 text-red-600'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !apiKey.trim()}>
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
