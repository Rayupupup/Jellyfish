import { Form, Select } from 'antd'

export type ProjectVisualStyleChoice = '现实' | '动漫'

export const PROJECT_STYLE_OPTIONS_BY_VISUAL: Record<ProjectVisualStyleChoice, Array<{ value: string; label: string }>> = {
  现实: [
    { value: '真人都市', label: '真人都市' },
    { value: '真人科幻', label: '真人科幻' },
    { value: '真人古装', label: '真人古装' },
  ],
  动漫: [
    { value: '动漫科幻', label: '动漫科幻' },
    { value: '动漫古装', label: '动漫古装' },
    { value: '动漫3D', label: '动漫3D' },
    { value: '国漫', label: '国漫' },
    { value: '水墨画', label: '水墨画' },
  ],
}

type FormModeProps = {
  form: any
  disabled?: boolean
}

type ControlledModeProps = {
  visual_style: ProjectVisualStyleChoice
  style: string
  onChange: (next: { visual_style: ProjectVisualStyleChoice; style: string }) => void
  disabled?: boolean
  visualStyleLabel?: string
  styleLabel?: string
}

function getDefaultStyle(visual: ProjectVisualStyleChoice): string {
  return PROJECT_STYLE_OPTIONS_BY_VISUAL[visual]?.[0]?.value ?? ''
}

export function ProjectVisualStyleAndStyleFields(props: FormModeProps | ControlledModeProps) {
  const disabled = props.disabled

  if ('form' in props) {
    const { form } = props

    return (
      <>
        <Form.Item name="visual_style" label="视觉风格" rules={[{ required: true }]}>
          <Select
            disabled={disabled}
            onChange={(v: ProjectVisualStyleChoice) => {
              const nextStyle = getDefaultStyle(v)
              form.setFieldValue('style', nextStyle)
            }}
            options={[
              { value: '现实', label: '现实' },
              { value: '动漫', label: '动漫' },
            ]}
          />
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(prev, next) => prev.visual_style !== next.visual_style}>
          {({ getFieldValue }) => {
            const visual = (getFieldValue('visual_style') as ProjectVisualStyleChoice | undefined) ?? '现实'
            return (
              <Form.Item name="style" label="视频风格" rules={[{ required: true }]}>
                <Select disabled={disabled} options={PROJECT_STYLE_OPTIONS_BY_VISUAL[visual]} />
              </Form.Item>
            )
          }}
        </Form.Item>
      </>
    )
  }

  const { visual_style, style, onChange, visualStyleLabel, styleLabel } = props

  return (
    <div className="space-y-3">
      <div>
        <span className="text-gray-600 text-sm">{visualStyleLabel ?? '视觉风格'}</span>
        <Select
          className="mt-1 w-full"
          disabled={disabled}
          value={visual_style}
          onChange={(v) => {
            const nextVisual = v as ProjectVisualStyleChoice
            onChange({ visual_style: nextVisual, style: getDefaultStyle(nextVisual) })
          }}
          options={[
            { value: '现实', label: '现实' },
            { value: '动漫', label: '动漫' },
          ]}
        />
      </div>
      <div>
        <span className="text-gray-600 text-sm">{styleLabel ?? '视频风格'}</span>
        <Select
          className="mt-1 w-full"
          disabled={disabled}
          value={style}
          onChange={(v) => onChange({ visual_style, style: String(v) })}
          options={PROJECT_STYLE_OPTIONS_BY_VISUAL[visual_style]}
        />
      </div>
    </div>
  )
}

