import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function POST(req: Request) {
  try {
    const { imageData, sessionId, timestamp, trackedPersons } = await req.json()

    // Create images directory if it doesn't exist
    const imagesDir = path.join(process.cwd(), 'public', 'images', sessionId)
    if (!existsSync(imagesDir)) {
      await mkdir(imagesDir, { recursive: true })
    }

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Create filename with timestamp
    const filename = `frame_${timestamp}.jpg`
    const filepath = path.join(imagesDir, filename)

    // Save image
    await writeFile(filepath, buffer)

    // Save metadata
    const metadataPath = path.join(imagesDir, 'metadata.json')
    let metadata: { frames: { timestamp: number; filename: string; trackedPersons: unknown[] }[] } = { frames: [] }
    
    if (existsSync(metadataPath)) {
      const existingData = await import('fs').then(fs => 
        fs.promises.readFile(metadataPath, 'utf-8')
      )
      metadata = JSON.parse(existingData)
    }

    metadata.frames.push({
      timestamp,
      filename,
      trackedPersons,
    })

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2))

    return NextResponse.json({
      success: true,
      path: `/images/${sessionId}/${filename}`,
    })
  } catch (error) {
    console.error('Save frame error:', error)
    return NextResponse.json(
      { error: 'Failed to save frame' },
      { status: 500 }
    )
  }
}
