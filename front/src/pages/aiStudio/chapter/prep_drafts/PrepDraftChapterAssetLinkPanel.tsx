import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Input, Pagination, Spin, Tag, message } from 'antd'
import type {
  ImportDraftOccurrenceRead,
  ProjectCostumeLinkRead,
  ProjectPropLinkRead,
  ProjectSceneLinkRead,
} from '../../../../services/generated'
import { StudioShotLinksService } from '../../../../services/generated'
import { StudioEntitiesApi } from '../../../../services/studioEntities'
import { DisplayImageCard } from '../../assets/components/DisplayImageCard'
import { buildFileDownloadUrl, resolveAssetUrl } from '../../assets/utils'
import {
  makePrepDraftId,
  resolveCreatedEntityId,
  waitUntilStudioEntityReadable,
  type PrepDraftAssetCard,
  type PrepDraftStudioEntityType,
} from './prepDraftShared'

export type ChapterLinkableAssetKind = 'scene' | 'prop' | 'costume'

type PanelProps = {
  projectId?: string
  chapterId?: string
  name: string
  description?: string
  /** 草稿出现记录；用于在 shot-links 中写入对应镜头的 shot_id */
  occurrences?: Array<{ occurrence: ImportDraftOccurrenceRead }>
}

type AnyChapterAssetLink = ProjectSceneLinkRead | ProjectPropLinkRead | ProjectCostumeLinkRead

const PAGE_SIZE = 3

function toThumbUrl(thumbnail?: string) {
  const url = resolveAssetUrl(thumbnail)
  if (url) return url
  if (thumbnail && !thumbnail.includes('/') && !thumbnail.includes(':')) return buildFileDownloadUrl(thumbnail)
  return undefined
}

function getAssetIdFromLink(link: AnyChapterAssetLink, kind: ChapterLinkableAssetKind): string {
  switch (kind) {
    case 'scene':
      return (link as ProjectSceneLinkRead).scene_id
    case 'prop':
      return (link as ProjectPropLinkRead).prop_id
    case 'costume':
      return (link as ProjectCostumeLinkRead).costume_id
    default:
      return ''
  }
}

async function fetchAllChapterLinks(
  kind: ChapterLinkableAssetKind,
  projectId: string,
  chapterId: string,
): Promise<AnyChapterAssetLink[]> {
  const pageSize = 100
  let page = 1
  let total = 0
  const all: AnyChapterAssetLink[] = []
  const entityType: PrepDraftStudioEntityType = kind
  while (true) {
    const res = await StudioShotLinksService.listProjectEntityLinksApiV1StudioShotLinksEntityTypeGet({
      entityType,
      projectId,
      chapterId,
      shotId: null,
      assetId: null,
      order: null,
      isDesc: false,
      page,
      pageSize,
    })
    const items = (res.data?.items ?? []) as AnyChapterAssetLink[]
    all.push(...items)
    total = res.data?.pagination?.total ?? items.length
    if (page * pageSize >= total) break
    page += 1
  }
  return all
}

/** 每个出现镜头一条 link；无出现记录时退化为 chapter 级（shot_id 为空） */
async function createChapterAssetLinksForDraftShots(
  kind: ChapterLinkableAssetKind,
  projectId: string,
  chapterId: string,
  assetId: string,
  shotIds: string[],
): Promise<void> {
  const targets: (string | null)[] = shotIds.length > 0 ? [...shotIds] : [null]
  await Promise.all(
    targets.map(async (shot_id) => {
      const body = { project_id: projectId, chapter_id: chapterId, shot_id, asset_id: assetId }
      switch (kind) {
        case 'scene':
          await StudioShotLinksService.createProjectSceneLinkApiV1StudioShotLinksScenePost({ requestBody: body })
          return
        case 'prop':
          await StudioShotLinksService.createProjectPropLinkApiV1StudioShotLinksPropPost({ requestBody: body })
          return
        case 'costume':
          await StudioShotLinksService.createProjectCostumeLinkApiV1StudioShotLinksCostumePost({ requestBody: body })
          return
        default:
          return
      }
    }),
  )
}

function filterLinksForDraftOccurrences(links: AnyChapterAssetLink[], shotIds: string[]): AnyChapterAssetLink[] {
  if (shotIds.length === 0) return links
  const set = new Set(shotIds)
  return links.filter((l) => {
    const sid = l.shot_id ?? null
    return sid == null || sid === '' || set.has(sid)
  })
}

const KIND_UI: Record<
  ChapterLinkableAssetKind,
  {
    title: string
    filterPlaceholder: string
    emptyDescription: string
    loadError: string
    waitReadableError: string
    linkOk: string
    createOk: string
    linkFail: string
    createFail: string
    makeIdPrefix: string
  }
> = {
  scene: {
    title: '关联场景到本章',
    filterPlaceholder: '按名称过滤项目已关联场景',
    emptyDescription: '项目中暂无已关联场景，请先在工作台关联场景或点击「创建并关联」',
    loadError: '加载项目关联场景失败',
    waitReadableError: '场景创建后无法读取，请稍后重试',
    linkOk: '已关联场景到本章出现镜头',
    createOk: '已创建场景并关联到本章出现镜头',
    linkFail: '关联失败',
    createFail: '创建并关联失败',
    makeIdPrefix: 'scene',
  },
  prop: {
    title: '关联道具到本章',
    filterPlaceholder: '按名称过滤项目已关联道具',
    emptyDescription: '项目中暂无已关联道具，请先在工作台关联道具或点击「创建并关联」',
    loadError: '加载项目关联道具失败',
    waitReadableError: '道具创建后无法读取，请稍后重试',
    linkOk: '已关联道具到本章出现镜头',
    createOk: '已创建道具并关联到本章出现镜头',
    linkFail: '关联失败',
    createFail: '创建并关联失败',
    makeIdPrefix: 'prop',
  },
  costume: {
    title: '关联服装到本章',
    filterPlaceholder: '按名称过滤项目已关联服装',
    emptyDescription: '项目中暂无已关联服装，请先在工作台关联服装或点击「创建并关联」',
    loadError: '加载项目关联服装失败',
    waitReadableError: '服装创建后无法读取，请稍后重试',
    linkOk: '已关联服装到本章出现镜头',
    createOk: '已创建服装并关联到本章出现镜头',
    linkFail: '关联失败',
    createFail: '创建并关联失败',
    makeIdPrefix: 'costume',
  },
}

export function PrepDraftChapterAssetLinkPanel({
  kind,
  projectId,
  chapterId,
  name,
  description,
  occurrences = [],
}: PanelProps & { kind: ChapterLinkableAssetKind }) {
  const ui = KIND_UI[kind]
  const entityType: PrepDraftStudioEntityType = kind

  const shotIds = useMemo(
    () => Array.from(new Set(occurrences.map((o) => o.occurrence.shot_id).filter((id): id is string => Boolean(id)))),
    [occurrences],
  )
  const shotOccurrenceKey = useMemo(() => shotIds.slice().sort().join('\0'), [shotIds])

  const [linkBusy, setLinkBusy] = useState(false)
  const [linkedAssets, setLinkedAssets] = useState<PrepDraftAssetCard[]>([])
  const [linkedLoading, setLinkedLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listPage, setListPage] = useState(1)

  const [boundLink, setBoundLink] = useState<AnyChapterAssetLink | null>(null)
  const [boundAsset, setBoundAsset] = useState<PrepDraftAssetCard | null>(null)
  const [bindingRefreshBusy, setBindingRefreshBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return linkedAssets
    return linkedAssets.filter((a) => (a.name ?? '').toLowerCase().includes(q))
  }, [search, linkedAssets])

  const paged = useMemo(() => {
    const start = (listPage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [listPage, filtered])

  const loadProjectLinked = async () => {
    if (!projectId) return
    setLinkedLoading(true)
    try {
      const pageSize = 100
      let page = 1
      let total = 0
      const allLinks: AnyChapterAssetLink[] = []

      while (true) {
        const res = await StudioShotLinksService.listProjectEntityLinksApiV1StudioShotLinksEntityTypeGet({
          entityType: kind,
          projectId,
          chapterId: null,
          shotId: null,
          assetId: null,
          order: null,
          isDesc: false,
          page,
          pageSize,
        })
        const items = (res.data?.items ?? []) as AnyChapterAssetLink[]
        allLinks.push(...items)
        total = res.data?.pagination?.total ?? items.length
        if (page * pageSize >= total) break
        page += 1
      }

      const assetIds = Array.from(new Set(allLinks.map((l) => getAssetIdFromLink(l, kind)).filter(Boolean)))
      const fetched = await Promise.all(
        assetIds.map((id) =>
          StudioEntitiesApi.get(entityType, id)
            .then((r) => (r.data ?? null) as PrepDraftAssetCard | null)
            .catch(() => null),
        ),
      )
      const next = fetched.filter(Boolean) as PrepDraftAssetCard[]
      next.sort((a, b) => a.name.localeCompare(b.name))
      setLinkedAssets(next)
    } catch {
      message.error(ui.loadError)
      setLinkedAssets([])
    } finally {
      setLinkedLoading(false)
    }
  }

  const refreshChapterBinding = async (preferredAssetId?: string | null) => {
    if (!projectId || !chapterId || !name) {
      setBoundLink(null)
      setBoundAsset(null)
      return
    }
    setBindingRefreshBusy(true)
    try {
      setBoundLink(null)
      setBoundAsset(null)
      const links = await fetchAllChapterLinks(kind, projectId, chapterId)
      const scoped = filterLinksForDraftOccurrences(links, shotIds)
      if (scoped.length === 0) {
        setBoundLink(null)
        setBoundAsset(null)
        return
      }

      const ids = Array.from(new Set(scoped.map((l) => getAssetIdFromLink(l, kind))))
      const entries = await Promise.all(
        ids.map(async (id) => {
          const r = await StudioEntitiesApi.get(entityType, id).catch(() => null)
          const a = (r?.data ?? null) as PrepDraftAssetCard | null
          return [id, a] as const
        }),
      )
      const byId: Record<string, PrepDraftAssetCard> = {}
      entries.forEach(([id, a]) => {
        if (a) byId[id] = a
      })

      const prefer = preferredAssetId?.trim()
      if (prefer) {
        const hit = scoped.find((l) => getAssetIdFromLink(l, kind) === prefer)
        if (hit) {
          const aid = getAssetIdFromLink(hit, kind)
          setBoundLink(hit)
          setBoundAsset(byId[aid] ?? { id: aid, name: name })
          return
        }
      }

      const byDraftName = scoped.find((l) => byId[getAssetIdFromLink(l, kind)]?.name === name)
      if (byDraftName) {
        const aid = getAssetIdFromLink(byDraftName, kind)
        setBoundLink(byDraftName)
        setBoundAsset(byId[aid] ?? { id: aid, name })
        return
      }
    } catch {
      setBoundLink(null)
      setBoundAsset(null)
    } finally {
      setBindingRefreshBusy(false)
    }
  }

  useEffect(() => {
    if (!projectId || !chapterId) return
    setSearch('')
    setListPage(1)
    setSelectedId(null)
    void (async () => {
      await Promise.all([loadProjectLinked(), refreshChapterBinding()])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, chapterId, name, kind, shotOccurrenceKey])

  useEffect(() => {
    setListPage(1)
  }, [search])

  const runCreatePayload = (tmpId: string) => ({
    id: tmpId,
    name,
    description: description || '',
    tags: [],
    prompt_template_id: null,
    view_count: 1,
  })

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{ui.title}</div>

      {bindingRefreshBusy && !boundLink ? (
        <div style={{ padding: '8px 0' }}>
          <Spin size="small" />
        </div>
      ) : boundLink && boundAsset ? (
        <div className="space-y-3">
          <div className="max-w-sm">
            <DisplayImageCard
              title={<div className="truncate">{boundAsset.name}</div>}
              imageUrl={toThumbUrl(boundLink.thumbnail ?? boundAsset.thumbnail)}
              imageAlt={boundAsset.name}
              placeholder="未生成"
              enablePreview
              hoverable={false}
              extra={<Tag color="green">已关联本章</Tag>}
              meta={<div className="text-xs text-gray-500 line-clamp-2">{boundAsset.description || '—'}</div>}
            />
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <Input placeholder={ui.filterPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 280 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Button
                type="primary"
                disabled={!selectedId}
                loading={linkBusy}
                onClick={async () => {
                  if (!selectedId || !projectId || !chapterId) return
                  setLinkBusy(true)
                  try {
                    await createChapterAssetLinksForDraftShots(kind, projectId, chapterId, selectedId, shotIds)
                    message.success(ui.linkOk)
                    await refreshChapterBinding(selectedId)
                    setSelectedId(null)
                  } catch {
                    message.error(ui.linkFail)
                  } finally {
                    setLinkBusy(false)
                  }
                }}
              >
                关联到本章
              </Button>
              <Button
                type="default"
                loading={linkBusy}
                onClick={async () => {
                  if (!projectId || !chapterId) return
                  setLinkBusy(true)
                  try {
                    const tmpId = makePrepDraftId(ui.makeIdPrefix)
                    const created = await StudioEntitiesApi.create(entityType, runCreatePayload(tmpId))
                    const assetId = resolveCreatedEntityId(created, tmpId)
                    await waitUntilStudioEntityReadable(entityType, assetId, ui.waitReadableError)
                    await createChapterAssetLinksForDraftShots(kind, projectId, chapterId, assetId, shotIds)
                    message.success(ui.createOk)
                    await Promise.all([loadProjectLinked(), refreshChapterBinding(assetId)])
                    setSelectedId(null)
                  } catch {
                    message.error(ui.createFail)
                  } finally {
                    setLinkBusy(false)
                  }
                }}
              >
                创建并关联
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {linkedLoading ? (
              <div style={{ padding: '8px 0' }}>
                <Spin size="small" />
              </div>
            ) : filtered.length === 0 ? (
              <Empty description={ui.emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paged.map((a) => {
                    const selected = selectedId === a.id
                    return (
                      <div
                        key={a.id}
                        className={`cursor-pointer ${selected ? 'ring-2 ring-blue-500 rounded-md' : ''}`}
                        onClick={() => setSelectedId(a.id)}
                      >
                        <DisplayImageCard
                          title={<div className="truncate">{a.name}</div>}
                          imageUrl={toThumbUrl(a.thumbnail)}
                          imageAlt={a.name}
                          placeholder="未生成"
                          enablePreview={false}
                          meta={<div className="text-xs text-gray-500 line-clamp-2">{a.description || '—'}</div>}
                          extra={selected ? <Tag color="blue">已选</Tag> : undefined}
                        />
                      </div>
                    )
                  })}
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <Pagination
                    current={listPage}
                    pageSize={PAGE_SIZE}
                    total={filtered.length}
                    showSizeChanger={false}
                    onChange={(p) => setListPage(p)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
