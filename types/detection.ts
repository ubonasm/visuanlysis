export interface DetectedHead {
  id: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

export interface TrackedPerson {
  id: string
  headPosition: { x: number; y: number }
  isTracking: boolean
  label: string
  role: '教師' | '児童生徒'
}

export interface BehaviorRecord {
  timestamp: string
  personId: string
  role: string
  label: string
  behavior: string
  headPosition: { x: number; y: number }
}

export interface SceneAnalysis {
  timestamp: string
  scene: string
  trackedPersons: {
    id: string
    label: string
    role: string
    position: { x: number; y: number }
  }[]
}

export interface AnalysisResult {
  personId: string
  behavior: string
  timestamp: string
}
