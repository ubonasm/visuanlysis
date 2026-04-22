'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, User, GraduationCap } from 'lucide-react'
import type { TrackedPerson } from '@/types/detection'

interface TrackingPanelProps {
  trackedPersons: TrackedPerson[]
  behaviorRecords: { personId: string; behavior: string }[]
  onRemovePerson: (id: string) => void
}

export function TrackingPanel({
  trackedPersons,
  onRemovePerson,
}: TrackingPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">追跡中の人物</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {trackedPersons.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            映像をクリックして
            <br />
            追跡する人物を選択してください
          </p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {trackedPersons.map((person) => (
                <div
                  key={person.id}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div
                    className={`p-2 rounded-full ${
                      person.role === '教師'
                        ? 'bg-red-500/20 text-red-500'
                        : 'bg-green-500/20 text-green-500'
                    }`}
                  >
                    {person.role === '教師' ? (
                      <GraduationCap className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{person.role}: {person.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {person.isTracking ? '追跡中' : '停止'}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onRemovePerson(person.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
