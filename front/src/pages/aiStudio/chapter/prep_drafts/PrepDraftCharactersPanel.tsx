import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Input, Modal, Pagination, Select, Spin, Tag, message } from 'antd'
import type { ImportDraftOccurrenceRead, ShotDialogLineRead, ShotDialogLineUpdate } from '../../../../services/generated'
import { StudioEntitiesApi } from '../../../../services/studioEntities'
import {
  StudioShotCharacterLinksService,
  StudioShotDetailsService,
  StudioShotDialogLinesService,
  StudioShotLinksService,
} from '../../../../services/generated'
import { DisplayImageCard } from '../../assets/components/DisplayImageCard'
import { resolveAssetUrl } from '../../assets/utils'
import { makePrepDraftId, resolveCreatedEntityId, waitUntilStudioEntityReadable } from './prepDraftShared'

type CharacterEntitySummary = { id: string; name: string; project_id?: string }

type ActorLike = { id: string; name: string; description?: string | null; thumbnail?: string }

type CharacterDisplayLike = { id: string; name: string; description?: string | null; thumbnail?: string }

type Props = {
  projectId?: string
  chapterId?: string
  name: string
  description?: string
  occurrences: Array<{ occurrence: ImportDraftOccurrenceRead }>
  characterNamesByShot: Record<string, string[]>
}

/** 接口 page_size 上限为 100，需分页取全 */
async function fetchAllShotDialogLinesForDetail(shotDetailId: string): Promise<ShotDialogLineRead[]> {
  const pageSize = 100
  let page = 1
  const all: ShotDialogLineRead[] = []
  while (true) {
    const res = await StudioShotDialogLinesService.listShotDialogLinesApiV1StudioShotDialogLinesGet({
      shotDetailId,
      q: null,
      order: 'index',
      isDesc: false,
      page,
      pageSize,
    })
    const items = res.data?.items ?? []
    all.push(...items)
    const total = res.data?.pagination?.total ?? items.length
    if (page * pageSize >= total || items.length === 0) break
    page += 1
  }
  return all
}

function normalizeRoleName(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length ? t : null
}

function buildMatchNames(...candidates: (string | null | undefined)[]): string[] {
  const out = new Set<string>()
  for (const c of candidates) {
    const n = normalizeRoleName(c ?? undefined)
    if (n) out.add(n)
  }
  return [...out]
}

function roleNamesMatchAny(field: string | null | undefined, matchNames: string[]): boolean {
  const na = normalizeRoleName(field)
  return na != null && matchNames.includes(na)
}

/** 常见剧本格式「角色名：台词」；无结构化 speaker_name 时用于回填说话者 */
function implicitSpeakerFromDialogText(text: string): string | null {
  const m = text.trim().match(/^([^：:]{1,64})[：:]\s*/u)
  if (!m) return null
  return normalizeRoleName(m[1])
}

/** 「对某某：」「向某某说」等，无 target_name 时尝试推断听者 */
function implicitTargetFromDialogText(text: string): string | null {
  const t = text.trim()
  const m =
    t.match(/^对([^：:，,。!！?？\s]{1,32})(?:[：:，,]|说)/u) ||
    t.match(/^向([^：:，,。!！?？\s]{1,32})(?:[：:，,]|说)/u)
  if (!m) return null
  return normalizeRoleName(m[1])
}

function isCharacterIdUnset(id: string | null | undefined): boolean {
  return id === null || id === undefined || id === ''
}

export function PrepDraftCharactersPanel({ projectId, chapterId, name, description, occurrences, characterNamesByShot }: Props) {
  const [characterBusy, setCharacterBusy] = useState(false)
  const [characterExists, setCharacterExists] = useState<CharacterEntitySummary | null>(null)
  const [existingCharacterDisplay, setExistingCharacterDisplay] = useState<CharacterDisplayLike | null>(null)
  const [existingCharacterDisplayLoading, setExistingCharacterDisplayLoading] = useState(false)
  const [actorSearch, setActorSearch] = useState('')
  const [linkedActors, setLinkedActors] = useState<ActorLike[]>([])
  const [linkedActorsLoading, setLinkedActorsLoading] = useState(false)
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null)

  const [actorPage, setActorPage] = useState(1)
  const ACTOR_PAGE_SIZE = 3

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [roleCreating, setRoleCreating] = useState(false)
  const [roleNameDraft, setRoleNameDraft] = useState('')
  const [roleDescDraft, setRoleDescDraft] = useState('')
  const [roleActorIdDraft, setRoleActorIdDraft] = useState<string | undefined>(undefined)

  const shotIds = useMemo(() => Array.from(new Set(occurrences.map((o) => o.occurrence.shot_id))), [occurrences])

  const filteredLinkedActors = useMemo(() => {
    const q = actorSearch.trim().toLowerCase()
    if (!q) return linkedActors
    return linkedActors.filter((a) => (a.name ?? '').toLowerCase().includes(q))
  }, [actorSearch, linkedActors])

  const pagedLinkedActors = useMemo(() => {
    const start = (actorPage - 1) * ACTOR_PAGE_SIZE
    return filteredLinkedActors.slice(start, start + ACTOR_PAGE_SIZE)
  }, [actorPage, filteredLinkedActors])

  useEffect(() => {
    if (!projectId || !chapterId) return

    setActorSearch('')
    setActorPage(1)
    setSelectedActorId(null)
    setCharacterExists(null)
    setExistingCharacterDisplay(null)

    void (async () => {
      await Promise.all([refreshCharacterExists(), loadLinkedActors()])
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, chapterId, name])

  const loadLinkedActors = async () => {
    if (!projectId || !chapterId) return
    setLinkedActorsLoading(true)
    try {
      const pageSize = 100
      let page = 1
      let total = 0
      const allLinks: any[] = []

      while (true) {
        const res = await StudioShotLinksService.listProjectEntityLinksApiV1StudioShotLinksEntityTypeGet({
          entityType: 'actor',
          projectId,
          chapterId: null, // 不按 chapter_id 过滤，直接获取项目级关联演员
          shotId: null,
          assetId: null,
          order: null,
          isDesc: false,
          page,
          pageSize,
        })

        const items = res.data?.items ?? []
        allLinks.push(...items)
        total = res.data?.pagination?.total ?? items.length

        if (page * pageSize >= total) break
        page += 1
      }

      const actorIds = Array.from(new Set(allLinks.map((l) => (l as any).actor_id).filter(Boolean))) as string[]
      const fetched = await Promise.all(
        actorIds.map((id) =>
          StudioEntitiesApi.get('actor', id)
            .then((r) => (r.data ?? null) as ActorLike | null)
            .catch(() => null),
        ),
      )

      const next = fetched.filter(Boolean) as ActorLike[]
      next.sort((a, b) => a.name.localeCompare(b.name))
      setLinkedActors(next)
    } catch {
      message.error('加载项目关联演员失败')
      setLinkedActors([])
    } finally {
      setLinkedActorsLoading(false)
    }
  }

  const refreshCharacterExists = async () => {
    if (!projectId || !chapterId) return
    try {
      setCharacterExists(null)
      const res = await StudioEntitiesApi.list('character', {
        q: name,
        page: 1,
        pageSize: 100,
        order: null,
        isDesc: true,
      })
      const items = (res.data?.items ?? []) as Array<CharacterEntitySummary>
      const found =
        items.find((x) => (x.project_id ?? null) === projectId && x.name === name) ?? null
      setCharacterExists(found)
    } catch {
      setCharacterExists(null)
    }
  }

  useEffect(() => {
    if (!characterExists?.id) {
      setExistingCharacterDisplay(null)
      return
    }
    void (async () => {
      setExistingCharacterDisplayLoading(true)
      try {
        const res = await StudioEntitiesApi.get('character', characterExists.id)
        const d = res.data as CharacterDisplayLike | null | undefined
        if (d?.id) {
          setExistingCharacterDisplay({
            id: d.id,
            name: d.name ?? characterExists.name,
            description: d.description ?? null,
            thumbnail: d.thumbnail,
          })
        } else {
          setExistingCharacterDisplay({
            id: characterExists.id,
            name: characterExists.name,
            description: null,
          })
        }
      } catch {
        setExistingCharacterDisplay({
          id: characterExists.id,
          name: characterExists.name,
          description: null,
        })
      } finally {
        setExistingCharacterDisplayLoading(false)
      }
    })()
  }, [characterExists?.id, characterExists?.name])

  const patchDialogLinesForCharacter = async (params: {
    shotIds: string[]
    characterId: string
    /** 归一化后的别名列表，用于命中 speaker_name / target_name / 台词推断 */
    matchNames: string[]
    /** 写入对白行的展示名（与资产角色名一致） */
    dialogDisplayName: string
  }) => {
    const { shotIds, characterId, matchNames, dialogDisplayName: displayRaw } = params
    const matchSet = [...new Set(matchNames.map((n) => normalizeRoleName(n)).filter(Boolean) as string[])]
    if (matchSet.length === 0) return

    const dialogDisplayName = normalizeRoleName(displayRaw) ?? matchSet[0] ?? displayRaw.trim()

    await Promise.all(
      shotIds.map(async (sid) => {
        const shotDetailsRes = await StudioShotDetailsService.listShotDetailsApiV1StudioShotDetailsGet({
          shotId: sid,
          page: 1,
          pageSize: 50,
        })
        const details = shotDetailsRes.data?.items ?? []
        const detailIds = details.length > 0 ? details.map((d) => d.id) : [sid]

        await Promise.all(
          detailIds.map(async (detailId) => {
            const lines = await fetchAllShotDialogLinesForDetail(detailId)

            await Promise.all(
              lines.map(async (ln) => {
                const line = ln as ShotDialogLineRead
                const speakerName = line.speaker_name
                const targetName = line.target_name
                const text = line.text ?? ''
                const speakerUnset = isCharacterIdUnset(line.speaker_character_id)
                const targetUnset = isCharacterIdUnset(line.target_character_id)

                const implicitSp = implicitSpeakerFromDialogText(text)
                const implicitTg = implicitTargetFromDialogText(text)

                const isSpeaker =
                  speakerUnset &&
                  (roleNamesMatchAny(speakerName, matchSet) ||
                    (normalizeRoleName(speakerName) === null && implicitSp != null && matchSet.includes(implicitSp)))

                const isListener =
                  targetUnset &&
                  (roleNamesMatchAny(targetName, matchSet) ||
                    (normalizeRoleName(targetName) === null && implicitTg != null && matchSet.includes(implicitTg)))

                const payload: ShotDialogLineUpdate = {}
                let shouldPatch = false
                if (isSpeaker) {
                  payload.speaker_character_id = characterId
                  payload.speaker_name = dialogDisplayName
                  shouldPatch = true
                }
                if (isListener) {
                  payload.target_character_id = characterId
                  payload.target_name = dialogDisplayName
                  shouldPatch = true
                }

                if (!shouldPatch) return
                const lineId = Number(line.id)
                if (!Number.isFinite(lineId)) return
                return StudioShotDialogLinesService.updateShotDialogLineApiV1StudioShotDialogLinesLineIdPatch({
                  lineId,
                  requestBody: payload,
                })
              }),
            )
          }),
        )
      }),
    )
  }

  useEffect(() => {
    setActorPage(1)
  }, [actorSearch])

  return (
    <>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>关联角色与回填对白</div>
        {characterBusy ? (
          <div style={{ padding: '8px 0' }}>
            <Spin size="small" />
          </div>
        ) : characterExists ? (
          <div className="space-y-3">
            <div className="max-w-sm">
              {existingCharacterDisplayLoading ? (
                <div style={{ padding: '8px 0' }}>
                  <Spin size="small" />
                </div>
              ) : existingCharacterDisplay ? (
                <DisplayImageCard
                  title={<div className="truncate">{existingCharacterDisplay.name}</div>}
                  imageUrl={resolveAssetUrl(existingCharacterDisplay.thumbnail)}
                  imageAlt={existingCharacterDisplay.name}
                  placeholder="未生成"
                  enablePreview
                  hoverable={false}
                  extra={<Tag color="green">角色已存在</Tag>}
                  meta={<div className="text-xs text-gray-500 line-clamp-2">{existingCharacterDisplay.description || '—'}</div>}
                />
              ) : null}
            </div>
            <div>
              <Button
                type="primary"
                onClick={async () => {
                  if (!projectId || !chapterId) return
                  setCharacterBusy(true)
                  try {
                    const charId = characterExists.id as string
                    await Promise.all(
                      shotIds.map(async (sid) => {
                        const idx = characterNamesByShot[sid]?.indexOf(name) ?? 0
                        return StudioShotCharacterLinksService.upsertShotCharacterLinkApiV1StudioShotCharacterLinksPost({
                          requestBody: {
                            shot_id: sid,
                            character_id: charId,
                            index: idx,
                            note: '',
                          },
                        })
                      }),
                    )

                    try {
                      await patchDialogLinesForCharacter({
                        shotIds,
                        characterId: charId,
                        matchNames: buildMatchNames(name, existingCharacterDisplay?.name, characterExists.name),
                        dialogDisplayName: existingCharacterDisplay?.name ?? characterExists.name ?? name,
                      })
                      message.success('已配置角色到镜头并回填对白')
                    } catch {
                      message.warning('已关联镜头，对白回填未完成，可再次点击本按钮重试')
                    }

                    await refreshCharacterExists()
                  } catch {
                    message.error('关联镜头失败')
                  } finally {
                    setCharacterBusy(false)
                  }
                }}
              >
                配置到镜头并回填
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <Input placeholder="按名称过滤关联演员" value={actorSearch} onChange={(e) => setActorSearch(e.target.value)} allowClear style={{ width: 280 }} />
              <Button
                type="primary"
                disabled={!selectedActorId}
                onClick={() => {
                  if (!selectedActorId) return
                  setRoleNameDraft(name)
                  setRoleDescDraft(description || '')
                  setRoleActorIdDraft(selectedActorId ?? undefined)
                  setRoleModalOpen(true)
                }}
              >
                创建并配置
              </Button>
            </div>

            <div style={{ marginTop: 12 }}>
              {linkedActorsLoading ? (
                <div style={{ padding: '8px 0' }}>
                  <Spin size="small" />
                </div>
              ) : filteredLinkedActors.length === 0 ? (
                <Empty description="暂无可关联的演员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pagedLinkedActors.map((a) => {
                      const selected = selectedActorId === a.id
                      return (
                        <div key={a.id} className={`cursor-pointer ${selected ? 'ring-2 ring-blue-500 rounded-md' : ''}`} onClick={() => setSelectedActorId(a.id)}>
                          <DisplayImageCard
                            title={<div className="truncate">{a.name}</div>}
                            imageUrl={resolveAssetUrl(a.thumbnail)}
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
                    <Pagination current={actorPage} pageSize={ACTOR_PAGE_SIZE} total={filteredLinkedActors.length} showSizeChanger={false} onChange={(p) => setActorPage(p)} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        title="新建角色"
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={async () => {
          if (!projectId) return
          if (!roleActorIdDraft) {
            message.warning('请选择关联演员')
            return
          }
          setRoleCreating(true)
          try {
            const tmpId = makePrepDraftId('char')
            const payload: Record<string, unknown> = {
              id: tmpId,
              project_id: projectId,
              name: roleNameDraft,
              description: roleDescDraft || '',
              actor_id: roleActorIdDraft,
              costume_id: null,
            }
            const created = await StudioEntitiesApi.create('character', payload)
            const charId = resolveCreatedEntityId(created, tmpId)
            await waitUntilStudioEntityReadable('character', charId, '角色创建后无法读取，请稍后重试')

            await Promise.all(
              shotIds.map(async (sid) => {
                const idx = characterNamesByShot[sid]?.indexOf(name) ?? 0
                return StudioShotCharacterLinksService.upsertShotCharacterLinkApiV1StudioShotCharacterLinksPost({
                  requestBody: {
                    shot_id: sid,
                    character_id: charId,
                    index: idx,
                    note: '',
                  },
                })
              }),
            )

            try {
              await patchDialogLinesForCharacter({
                shotIds,
                characterId: charId,
                matchNames: buildMatchNames(name, roleNameDraft),
                dialogDisplayName: roleNameDraft.trim() || name,
              })
              message.success('已创建角色并配置到镜头并回填对白')
            } catch {
              message.warning('角色已创建并关联镜头，对白回填未完成，可点击「配置到镜头并回填」重试')
            }

            await refreshCharacterExists()
            setRoleModalOpen(false)
          } catch {
            message.error('创建角色或关联镜头失败')
          } finally {
            setRoleCreating(false)
          }
        }}
        okText="创建"
        cancelText="取消"
        confirmLoading={roleCreating}
        width={560}
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-gray-600 mb-1">角色名称</div>
            <Input value={roleNameDraft} onChange={(e) => setRoleNameDraft(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">描述（可选）</div>
            <Input.TextArea rows={3} value={roleDescDraft} onChange={(e) => setRoleDescDraft(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">关联演员（必填）</div>
            <Select
              className="w-full"
              placeholder="选择当前项目已关联的演员"
              showSearch
              value={roleActorIdDraft}
              onChange={(v) => {
                const id = typeof v === 'string' ? v : String(v)
                setRoleActorIdDraft(id)
                setSelectedActorId(id)
              }}
              options={linkedActors.map((a) => ({
                value: a.id,
                searchLabel: a.name,
                label: (
                  <div className="flex items-center gap-2 min-w-0">
                    {resolveAssetUrl(a.thumbnail) ? (
                      <img src={resolveAssetUrl(a.thumbnail)} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">—</div>
                    )}
                    <div className="min-w-0 truncate">{a.name}</div>
                  </div>
                ),
              }))}
              optionFilterProp="searchLabel"
              filterOption={(input, option) => String((option as any)?.searchLabel ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

