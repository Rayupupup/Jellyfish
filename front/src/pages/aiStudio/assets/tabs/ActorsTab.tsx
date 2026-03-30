import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, Input, InputNumber, Modal, Pagination, Space, Tag, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { StudioEntitiesApi } from '../../../../services/studioEntities'
import { useNavigate } from 'react-router-dom'
import { resolveAssetUrl } from '../utils'
import { DisplayImageCard } from '../components/DisplayImageCard'
import { PROJECT_STYLE_OPTIONS_BY_VISUAL, ProjectVisualStyleAndStyleFields } from '../../project/ProjectVisualStyleAndStyleFields'

export function ActorsTab() {
  const navigate = useNavigate()
  const [actors, setActors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const [total, setTotal] = useState(0)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formViewCount, setFormViewCount] = useState<number | null>(null)
  const [formVisualStyle, setFormVisualStyle] = useState<'现实' | '动漫'>('现实')
  const [formStyle, setFormStyle] = useState<string>(PROJECT_STYLE_OPTIONS_BY_VISUAL['现实'][0]?.value ?? '真人都市')

  const load = async (opts?: { page?: number; pageSize?: number; q?: string }) => {
    setLoading(true)
    try {
      const nextPage = opts?.page ?? page
      const nextPageSize = opts?.pageSize ?? pageSize
      const q = typeof opts?.q === 'string' ? opts.q : search.trim() || undefined
      const res = await StudioEntitiesApi.list('actor', {
        page: nextPage,
        pageSize: nextPageSize,
        q: q ?? null,
        order: 'updated_at',
        isDesc: true,
      })
      const items = res.data?.items ?? []
      setActors(items)
      setTotal(res.data?.pagination.total ?? 0)
    } catch {
      message.error('加载演员失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const filtered = useMemo(() => actors, [actors])

  const normalizeTags = (input: string) =>
    input
      .split(/[,，\n]/g)
      .map((t) => t.trim())
      .filter(Boolean)

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormDesc('')
    setFormTags('')
    setFormViewCount(null)
    setFormVisualStyle('现实')
    setFormStyle(PROJECT_STYLE_OPTIONS_BY_VISUAL['现实'][0]?.value ?? '真人都市')
    setEditOpen(true)
  }

  const openEdit = (a: any) => {
    setEditing(a)
    setFormName(a.name)
    setFormDesc(a.description ?? '')
    setFormTags((a.tags ?? []).join(', '))
    setFormViewCount(a.view_count ?? null)
    setFormVisualStyle((a.visual_style as '现实' | '动漫' | undefined) ?? '现实')
    {
      const nextVisual = ((a.visual_style as '现实' | '动漫' | undefined) ?? '现实') as '现实' | '动漫'
      setFormStyle((a.style as string | undefined) ?? PROJECT_STYLE_OPTIONS_BY_VISUAL[nextVisual]?.[0]?.value ?? '真人都市')
    }
    setEditOpen(true)
  }

  const submit = async () => {
    const name = formName.trim()
    if (!name) {
      message.warning('请输入名称')
      return
    }
    try {
      if (!editing) {
        const created = await StudioEntitiesApi.create('actor', {
          id: crypto?.randomUUID?.() ?? `actor_${Date.now()}`,
          name,
          description: formDesc.trim() || undefined,
          tags: normalizeTags(formTags),
          view_count: formViewCount ?? undefined,
          visual_style: formVisualStyle,
          style: formStyle,
          prompt_template_id: null,
        })
        message.success('创建成功')
        const createdItem = created.data as any
        if (createdItem && page === 1 && !search.trim()) {
          setActors((prev) => [createdItem, ...prev.filter((it) => it.id !== createdItem.id)])
          setTotal((prev) => prev + 1)
        }
      } else {
        await StudioEntitiesApi.update('actor', editing.id, {
          name,
          description: formDesc.trim() || null,
          tags: normalizeTags(formTags),
          view_count: formViewCount ?? null,
          visual_style: formVisualStyle,
          style: formStyle,
        })
        message.success('更新成功')
      }
      setEditOpen(false)
      await load({ page: 1 })
      setPage(1)
    } catch {
      message.error(editing ? '更新失败' : '创建失败')
    }
  }

  return (
    <Card
      title="演员"
      extra={
        <Space>
          <Input.Search
            placeholder="搜索演员"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => {
              setPage(1)
              void load({ q: v, page: 1 })
            }}
            style={{ width: 240 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建
          </Button>
        </Space>
      }
    >
      {filtered.length === 0 && !loading ? (
        <Empty description="暂无演员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.map((a) => (
            <DisplayImageCard
              key={a.id}
              title={<div className="truncate">{a.name}</div>}
              imageUrl={resolveAssetUrl(a.thumbnail)}
              imageAlt={a.name}
              extra={
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(a)}>
                    编辑
                  </Button>
                  <Button size="small" onClick={() => navigate(`/assets/actors/${a.id}/edit`)}>
                    详情
                  </Button>
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: `删除演员「${a.name}」？`,
                        okText: '删除',
                        cancelText: '取消',
                        okButtonProps: { danger: true },
                        onOk: async () => {
                          try {
                            await StudioEntitiesApi.remove('actor', a.id)
                            message.success('已删除')
                            void load()
                          } catch {
                            message.error('删除失败')
                          }
                        },
                      })
                    }}
                  />
                </Space>
              }
              meta={
                <div>
                  {a.description && <div className="text-xs text-gray-600 line-clamp-2">{a.description}</div>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(a.tags ?? []).slice(0, 6).map((t: string) => (
                      <Tag key={t} className="m-0">
                        {t}
                      </Tag>
                    ))}
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger={false}
          onChange={(p, ps) => {
            setPage(p)
            setPageSize(ps)
          }}
        />
      </div>

      <Modal
        title={editing ? '编辑演员' : '新建演员'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={submit}
        okText={editing ? '保存' : '创建'}
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-gray-600 mb-1">名称</div>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">描述</div>
            <Input.TextArea rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">标签（逗号分隔）</div>
            <Input value={formTags} onChange={(e) => setFormTags(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">视角数（可选）</div>
            <InputNumber className="w-full" min={1} max={4} value={formViewCount} onChange={(v) => setFormViewCount(v ?? null)} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">视觉风格</div>
            <ProjectVisualStyleAndStyleFields
              visual_style={formVisualStyle}
              style={formStyle}
              onChange={(next) => {
                setFormVisualStyle(next.visual_style)
                setFormStyle(next.style)
              }}
            />
          </div>
        </div>
      </Modal>
    </Card>
  )
}
