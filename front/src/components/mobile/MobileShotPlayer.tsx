import React, { useState, useRef, useEffect } from 'react'
import { Card, Button, Tabs, Tag, Spin, Drawer, List } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  MenuOutlined,
  SettingOutlined,
  LeftOutlined,
} from '@ant-design/icons'
import { useMobile } from '../../hooks/useMobile'
import type { ShotRead } from '../../services/generated'

interface MobileShotPlayerProps {
  shots: Array<ShotRead & { hidden?: boolean; status?: string }>
  selectedShotId: string | null
  onSelectShot: (id: string) => void
  currentVideoUrl: string
  isPlaying: boolean
  onTogglePlay: () => void
  projectId?: string
  chapterTitle?: string
  loading?: boolean
}

export const MobileShotPlayer: React.FC<MobileShotPlayerProps> = ({
  shots,
  selectedShotId,
  onSelectShot,
  currentVideoUrl,
  isPlaying,
  onTogglePlay,
  projectId,
  chapterTitle,
  loading = false,
}) => {
  const isMobile = useMobile()
  const [activeTab, setActiveTab] = useState('player')
  const [listDrawerOpen, setListDrawerOpen] = useState(false)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const selectedShot = shots.find((s) => s.id === selectedShotId)
  const visibleShots = shots.filter((s) => !s.hidden)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) {
      void v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [isPlaying, currentVideoUrl])

  if (!isMobile) return null

  return (
    <div className="mobile-shot-player flex flex-col h-full bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b">
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={() => {
            window.location.href = projectId ? `/projects/${projectId}?tab=chapters` : '/projects'
          }}
        >
          返回
        </Button>
        <div className="text-sm font-medium truncate max-w-[40vw]">{chapterTitle || '分镜播放'}</div>
        <Button type="text" icon={<MenuOutlined />} onClick={() => setListDrawerOpen(true)}>
          列表
        </Button>
      </div>

      {/* 主要内容区 */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="mobile-player-tabs h-full"
          items={[
            {
              key: 'player',
              label: '播放',
              children: (
                <div className="flex flex-col h-full p-3">
                  <Card className="flex-1 flex flex-col" bodyStyle={{ padding: 0, flex: 1 }}>
                    <div className="relative w-full h-full bg-black flex items-center justify-center">
                      {loading ? (
                        <Spin />
                      ) : currentVideoUrl ? (
                        <video
                          ref={videoRef}
                          src={currentVideoUrl}
                          className="w-full h-full object-contain"
                          playsInline
                          muted
                          controls={false}
                          onClick={onTogglePlay}
                        />
                      ) : (
                        <div className="text-white/60 text-sm">暂无视频</div>
                      )}
                      {!isPlaying && currentVideoUrl && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20" onClick={onTogglePlay}>
                          <PlayCircleOutlined className="text-5xl text-white/80" />
                        </div>
                      )}
                    </div>
                  </Card>

                  {selectedShot && (
                    <div className="mt-3 bg-white p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">
                          {String(selectedShot.index || 0).padStart(2, '0')} · {selectedShot.title}
                        </div>
                        <Tag
                          color={
                            selectedShot.status === 'ready' ? 'success' : selectedShot.status === 'generating' ? 'processing' : 'default'
                          }
                          
                        >
                          {selectedShot.status === 'ready' ? '已就绪' : selectedShot.status === 'generating' ? '生成中' : '待生成'}
                        </Tag>
                      </div>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'list',
              label: '分镜',
              children: (
                <div className="h-full overflow-y-auto p-3">
                  <List
                    dataSource={visibleShots}
                    renderItem={(shot) => (
                      <List.Item
                        key={shot.id}
                        className={`cursor-pointer hover:bg-gray-100 rounded-lg mb-2 px-3 ${
                          selectedShotId === shot.id ? 'bg-blue-50 border-blue-300' : 'bg-white'
                        }`}
                        onClick={() => onSelectShot(shot.id)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                            {String(shot.index || 0).padStart(2, '0')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{shot.title}</div>
                            <div className="text-xs text-gray-500">
                              {shot.status === 'ready' ? '已就绪' : shot.status === 'generating' ? '生成中' : '待生成'}
                            </div>
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* 底部播放控制栏 */}
      <div className="bg-white border-t px-4 py-3 flex items-center justify-between">
        <Button
          type="primary"
          shape="circle"
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={onTogglePlay}
          disabled={!currentVideoUrl}
          size="large"
        />
        <div className="text-sm text-gray-600">
          {selectedShot && `${String(selectedShot.index || 0).padStart(2, '0')} / ${String(visibleShots.length).padStart(2, '0')}`}
        </div>
        <Button type="text" icon={<SettingOutlined />} onClick={() => setSettingsDrawerOpen(true)}>
          设置
        </Button>
      </div>

      {/* 分镜列表抽屉 */}
      <Drawer title="分镜列表" placement="right" onClose={() => setListDrawerOpen(false)} open={listDrawerOpen} width="80vw">
        <List
          dataSource={visibleShots}
          renderItem={(shot) => (
            <List.Item
              key={shot.id}
              className={`cursor-pointer hover:bg-gray-100 ${selectedShotId === shot.id ? 'bg-blue-50' : ''}`}
              onClick={() => {
                onSelectShot(shot.id)
                setListDrawerOpen(false)
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-16 h-10 bg-gray-200 rounded flex items-center justify-center text-xs">
                  {String(shot.index || 0).padStart(2, '0')}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{shot.title}</div>
                  <Tag
                    
                    color={shot.status === 'ready' ? 'success' : shot.status === 'generating' ? 'processing' : 'default'}
                  >
                    {shot.status === 'ready' ? '已就绪' : shot.status === 'generating' ? '生成中' : '待生成'}
                  </Tag>
                </div>
              </div>
            </List.Item>
          )}
        />
      </Drawer>

      {/* 设置抽屉 */}
      <Drawer title="播放设置" placement="bottom" onClose={() => setSettingsDrawerOpen(false)} open={settingsDrawerOpen} height="50vh">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">播放速度</div>
            <div className="flex gap-2">
              {['0.5x', '1x', '1.5x', '2x'].map((rate) => (
                <Button key={rate} type="default" block>
                  {rate}
                </Button>
              ))}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-4">提示：左右滑动可快速切换分镜</div>
        </div>
      </Drawer>
    </div>
  )
}
