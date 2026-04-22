import { promises as fs } from 'fs'
import path from 'path'

const ENV_FILE_PATH = path.join(process.cwd(), '.env.local')

export async function GET() {
  try {
    // Check if API key exists
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    return Response.json({
      hasApiKey: !!apiKey,
      // Show masked key for confirmation
      maskedKey: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : null,
    })
  } catch {
    return Response.json({ hasApiKey: false, maskedKey: null })
  }
}

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json()

    if (!apiKey || typeof apiKey !== 'string') {
      return Response.json({ error: 'APIキーが必要です' }, { status: 400 })
    }

    // Write to .env.local file
    const envContent = `GOOGLE_GENERATIVE_AI_API_KEY=${apiKey}\n`
    await fs.writeFile(ENV_FILE_PATH, envContent, 'utf-8')

    return Response.json({ 
      success: true, 
      message: 'APIキーを保存しました。アプリを再起動してください。' 
    })
  } catch (error) {
    console.error('Failed to save API key:', error)
    return Response.json(
      { error: 'APIキーの保存に失敗しました' },
      { status: 500 }
    )
  }
}
