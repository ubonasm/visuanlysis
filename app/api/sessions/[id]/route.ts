import { NextResponse } from 'next/server'
import { readFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionDir = path.join(process.cwd(), 'public', 'images', id)
    
    if (!existsSync(sessionDir)) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const sessionInfoPath = path.join(sessionDir, 'session.json')
    const metadataPath = path.join(sessionDir, 'metadata.json')

    let sessionInfo: { name: string; createdAt: string; trackedPersons?: { label: string; role: string }[] } = { name: id, createdAt: '' }
    let metadata = { frames: [] as { timestamp: number; filename: string; trackedPersons: unknown[] }[] }

    if (existsSync(sessionInfoPath)) {
      const data = await readFile(sessionInfoPath, 'utf-8')
      sessionInfo = JSON.parse(data)
    }

    if (existsSync(metadataPath)) {
      const data = await readFile(metadataPath, 'utf-8')
      metadata = JSON.parse(data)
    }

    // Create full image paths
    const frames = metadata.frames.map(frame => ({
      ...frame,
      imagePath: `/images/${id}/${frame.filename}`,
    }))

    return NextResponse.json({
      id,
      name: sessionInfo.name,
      createdAt: sessionInfo.createdAt,
      trackedPersons: sessionInfo.trackedPersons || [],
      frames,
    })
  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionDir = path.join(process.cwd(), 'public', 'images', id)
    
    if (!existsSync(sessionDir)) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    await rm(sessionDir, { recursive: true, force: true })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete session error:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
