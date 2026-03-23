import type { ImportDraftOccurrenceRead } from '../../../../services/generated'
import { PrepDraftChapterAssetLinkPanel } from './PrepDraftChapterAssetLinkPanel'

type Props = {
  projectId?: string
  chapterId?: string
  name: string
  description?: string
  occurrences?: Array<{ occurrence: ImportDraftOccurrenceRead }>
}

export function PrepDraftScenesPanel(props: Props) {
  return <PrepDraftChapterAssetLinkPanel kind="scene" {...props} />
}
