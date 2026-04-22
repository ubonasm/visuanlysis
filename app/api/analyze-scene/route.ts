import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

interface FrameData {
  imageData: string
  timestamp: number
  trackedPersons: { id: string; label: string; role: string }[]
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Support both single frame and multiple frames
    const frames: FrameData[] = body.frames || [{ 
      imageData: body.imageData, 
      timestamp: Date.now(),
      trackedPersons: body.trackedPersons || []
    }]
    const model = body.model

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

    if (!apiKey) {
      return Response.json({
        scene: '(APIキー未設定)',
        timestamp: new Date().toISOString(),
      })
    }

    const google = createGoogleGenerativeAI({ apiKey })
    const modelId = model || 'gemini-3-flash-preview'

    // Build person list
    const personList = frames[0]?.trackedPersons
      ?.map((p) => `${p.role}: ${p.label}`)
      .join('、') || '(追跡対象なし)'

    // For single frame analysis
    if (frames.length === 1) {
      const result = await generateText({
        model: google(modelId),
        maxRetries: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `この教室映像を分析してください。
追跡中の人物: ${personList}

以下の点について、50文字以内で簡潔に説明してください：
1. 教室全体の状況（授業中、休憩中、グループ活動など）
2. 追跡中の人物それぞれの行動`,
              },
              {
                type: 'image',
                image: frames[0].imageData,
              },
            ],
          },
        ],
      })

      return Response.json({
        scene: result.text,
        timestamp: new Date().toISOString(),
      })
    }

    // For multiple frames analysis (time range)
    const imageContents = frames.slice(0, 5).map((frame) => ({
      type: 'image' as const,
      image: frame.imageData,
    }))

    const startTime = new Date(frames[0].timestamp).toLocaleTimeString('ja-JP')
    const endTime = new Date(frames[frames.length - 1].timestamp).toLocaleTimeString('ja-JP')

    const result = await generateText({
      model: google(modelId),
      maxRetries: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `この教室映像の時系列（${startTime}〜${endTime}）を分析してください。
追跡中の人物: ${personList}

以下の点について、100文字以内で説明してください：
1. この時間帯の教室全体の状況
2. 追跡中の人物の主な活動や変化

簡潔に要約してください。`,
            },
            ...imageContents,
          ],
        },
      ],
    })

    return Response.json({
      scene: result.text,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    let shortError = 'API Error'
    if (errorMessage.includes('quota') || errorMessage.includes('exceeded')) {
      shortError = 'クォータ超過 - しばらく待ってから再試行してください'
    } else if (errorMessage.includes('rate')) {
      shortError = 'レート制限'
    }

    return Response.json({
      scene: `(${shortError})`,
      timestamp: new Date().toISOString(),
      error: errorMessage,
    })
  }
}
