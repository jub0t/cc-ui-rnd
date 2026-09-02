// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Jareer and Concat contributors

import { useState } from 'react'
import {
  AlignBottomIcon,
  AlignCenterXIcon,
  AlignCenterYIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  DistributeIcon,
  FitIcon,
  IconButton,
  Select,
} from '../primitives'
import styles from './panels.module.css'

const ZOOM_LEVELS = [
  { value: 25, label: '25%' },
  { value: 50, label: '50%' },
  { value: 72, label: '72%' },
  { value: 100, label: '100%' },
  { value: 200, label: '200%' },
  { value: 400, label: '400%' },
]

const ALIGNMENTS = [
  { id: 'left', label: 'Align left', Icon: AlignLeftIcon },
  { id: 'center-x', label: 'Align centers horizontally', Icon: AlignCenterXIcon },
  { id: 'right', label: 'Align right', Icon: AlignRightIcon },
  { id: 'top', label: 'Align top', Icon: AlignTopIcon },
  { id: 'center-y', label: 'Align centers vertically', Icon: AlignCenterYIcon },
  { id: 'bottom', label: 'Align bottom', Icon: AlignBottomIcon },
  { id: 'distribute', label: 'Distribute evenly', Icon: DistributeIcon },
  { id: 'fit', label: 'Fit to selection', Icon: FitIcon },
]

/** Panel header with the zoom dropdown, shared by the editor screens. */
export function EditorHeader() {
  const [zoom, setZoom] = useState(72)
  return (
    <header className={styles.editorHeader}>
      <h2 className={styles.editorTitle}>Editor</h2>
      <Select
        className={styles.zoomSelect}
        options={ZOOM_LEVELS}
        value={zoom}
        onChange={setZoom}
        aria-label="Zoom level"
      />
    </header>
  )
}

export function AlignToolbar() {
  const [last, setLast] = useState<string | null>(null)
  return (
    <div className={styles.alignToolbar}>
      {ALIGNMENTS.map(({ id, label, Icon }) => (
        <IconButton key={id} label={label} active={last === id} onClick={() => setLast(id)}>
          <Icon />
        </IconButton>
      ))}
    </div>
  )
}
