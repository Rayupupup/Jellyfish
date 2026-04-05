import React, { useState } from 'react'
import { Button, Card, Input, Steps, message, Tag, Collapse, Spin } from 'antd'
import {
  BookOutlined,
  ScissorOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { ScriptProcessingService, StudioChaptersService } from '../../../services/generated'

const { TextArea } = Input
const { Panel } = Collapse

interface ChapterDraft {
  index: number
  title: string
  summary: string
  script_text: string
  estimated_duration_seconds: number
  key_characters: string[]
  key_scenes: string[]
}

const StoryInput: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [storyText, setStoryText] = useState('')
  const [chapters, setChapters] = useState<ChapterDraft[]>([])
  const [dividing, setDividing] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleDivide = async () => {
    if (!storyText.trim()) {
      message.warning('请先输入故事内容')
      return
    }
    setDividing(true)
    try {
      const res = await (ScriptProcessingService as any).divideStoryApiV1ScriptProcessingDivideStoryPost({
        requestBody: { story_text: storyText },
      })
      if (res?.data?.chapters?.length > 0) {
        setChapters(res.data.chapters)
        setStep(1)
        message.success(`成功拆分为 ${res.data.chapters.length} 个章节`)
      } else {
        message.error('拆分失败，请重试')
      }
    } catch (e: any) {
      message.error(e?.message || '拆分失败')
    } finally {
      setDividing(false)
    }
  }

  const handleCreateChapters = async () => {
    if (!projectId) return
    setCreating(true)
    try {
      let created = 0
      for (const ch of chapters) {
        const chapterId = `chapter_${Date.now()}_${ch.index}`
        await (StudioChaptersService as any).createChapterApiV1StudioChaptersPost({
          requestBody: {
            id: chapterId,
            project_id: projectId,
            title: ch.title,
            index: ch.index,
            raw_text: ch.script_text,
            summary: ch.summary,
          },
        })
        created++
      }
      message.success(`成功创建 ${created} 个章节！`)
      setStep(2)
      // 跳转到项目工作台的章节列表
      setTimeout(() => {
        navigate(`/projects/${projectId}?tab=chapters`)
      }, 1500)
    } catch (e: any) {
      message.error(e?.message || '创建章节失败')
    } finally {
      setCreating(false)
    }
  }

  const totalDuration = chapters.reduce((sum, ch) => sum + ch.estimated_duration_seconds, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Card title={<span><BookOutlined className="mr-2" />故事输入</span>}>
        <Steps
          current={step}
          className="mb-6"
          items={[
            { title: '输入故事', icon: <BookOutlined /> },
            { title: '确认章节', icon: <ScissorOutlined /> },
            { title: '开始制作', icon: <CheckCircleOutlined /> },
          ]}
        />

        {/* Step 0: 输入故事 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500 mb-2">
              输入完整故事，AI 会自动将其拆分成多个章节，每个章节约 30-180 秒
            </div>
            <TextArea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="在这里输入你的故事...

例如：
清晨，阳光透过窗帘洒进房间。小明的闹钟响起，他揉着眼睛从床上坐起来，打了个哈欠。

小明穿好校服，背上书包，走出家门。街道上晨光明媚，鸟儿在树上欢快地歌唱。

走到路口时，小明看到了同学小红。两人互相打招呼，一起走向学校..."
              rows={12}
              className="font-mono text-sm"
            />
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">{storyText.length} 字</span>
              <Button
                type="primary"
                icon={<ScissorOutlined />}
                loading={dividing}
                onClick={handleDivide}
                disabled={!storyText.trim()}
                size="large"
              >
                AI 拆分章节
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: 确认章节 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-600">
                共 <strong>{chapters.length}</strong> 个章节，预估总时长 <strong>{Math.round(totalDuration / 60)} 分 {totalDuration % 60} 秒</strong>
              </div>
              <Button size="small" onClick={() => setStep(0)}>重新输入</Button>
            </div>

            <Collapse>
              {chapters.map((ch) => (
                <Panel
                  key={ch.index}
                  header={
                    <div className="flex items-center gap-3">
                      <Tag color="blue">第 {ch.index} 章</Tag>
                      <span className="font-medium">{ch.title}</span>
                      <span className="text-gray-400 text-xs ml-auto">{ch.estimated_duration_seconds}秒</span>
                    </div>
                  }
                >
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      <strong>摘要：</strong>{ch.summary}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {ch.key_characters.map((c) => (
                        <Tag key={c} color="green">{c}</Tag>
                      ))}
                      {ch.key_scenes.map((s) => (
                        <Tag key={s} color="orange">{s}</Tag>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2 max-h-24 overflow-y-auto">
                      {ch.script_text}
                    </div>
                  </div>
                </Panel>
              ))}
            </Collapse>

            <div className="flex justify-end mt-4">
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                loading={creating}
                onClick={handleCreateChapters}
                size="large"
              >
                确认并创建章节
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: 完成 */}
        {step === 2 && (
          <div className="text-center py-8">
            <CheckCircleOutlined className="text-5xl text-green-500 mb-4" />
            <div className="text-lg font-medium mb-2">章节创建成功！</div>
            <div className="text-gray-500">正在跳转到项目工作台...</div>
            <Spin className="mt-4" />
          </div>
        )}
      </Card>
    </div>
  )
}

export default StoryInput
