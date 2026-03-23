import type { ImportDraftOccurrenceRead } from '../../../../services/generated'
import { PrepDraftChapterAssetLinkPanel } from './PrepDraftChapterAssetLinkPanel'

type PanelProps = {
  projectId?: string
  chapterId?: string
  name: string
  description?: string
  occurrences?: Array<{ occurrence: ImportDraftOccurrenceRead }>
}

export function PrepDraftPropsPanel(props: PanelProps) {
  return <PrepDraftChapterAssetLinkPanel kind="prop" {...props} />
}
