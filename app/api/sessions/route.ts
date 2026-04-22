import { NextResponse } from 'next/server'
import { readdir, readFile, mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// GET: List all sessions
export async function GET() {
  try {
    const imagesDir = path.join(process.cwd(), 'public', 'images')
    
    if (!existsSync(imagesDir)) {
      return NextResponse.json({ sessions: [] })
    }

    const dirs = await readdir(imagesDir, { withFileTypes: true })
    const sessions = []

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const metadataPath = path.join(imagesDir, dir.name, 'metadata.json')
        const sessionInfoPath = path.join(imagesDir, dir.name, 'session.json')
        
        let sessionInfo: {
          name: string
          createdAt: string
          trackedPersons?: { label: string; role: string }[]
        } = { name: dir.name, createdAt: '' }
        let frameCount = 0
        let duration = 0
        let trackedPersons: { label: string; role: string }[] = []

        if (existsSync(sessionInfoPath)) {
          const data = await readFile(sessionInfoPath, 'utf-8')
          sessionInfo = JSON.parse(data)
          trackedPersons = sessionInfo.trackedPersons || []
        }

        if (existsSync(metadataPath)) {
          const data = await readFile(metadataPath, 'utf-8')
          const metadata = JSON.parse(data)
          const frames = metadata.frames || []
          frameCount = frames.length
          
          if (frames.length > 1) {
            duration = frames[frames.length - 1].timestamp - frames[0].timestamp
          }
        }

        // Only include sessions with data
        if (sessionInfo.createdAt) {
          sessions.push({
            id: dir.name,
            name: sessionInfo.name,
            createdAt: sessionInfo.createdAt,
            frameCount,
            duration,
            trackedPersons,
          })
        }
      }
    }

    // Sort by creation date (newest first)
    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Get sessions error:', error)
    return NextResponse.json({ sessions: [] })
  }
}

// POST: Create a new session
export async function POST(req: Request) {
  try {
    const { name, trackedPersons } = await req.json()
    
    const sessionId = `session_${Date.now()}`
    const imagesDir = path.join(process.cwd(), 'public', 'images', sessionId)
    
    await mkdir(imagesDir, { recursive: true })

    const sessionInfo = {
      name: name || `録画 ${new Date().toLocaleString('ja-JP')}`,
      createdAt: new Date().toISOString(),
      trackedPersons: trackedPersons || [],
    }

    await writeFile(
      path.join(imagesDir, 'session.json'),
      JSON.stringify(sessionInfo, null, 2)
    )

    await writeFile(
      path.join(imagesDir, 'metadata.json'),
      JSON.stringify({ frames: [] }, null, 2)
    )

    return NextResponse.json({
      success: true,
      sessionId,
      ...sessionInfo,
    })
  } catch (error) {
    console.error('Create session error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
