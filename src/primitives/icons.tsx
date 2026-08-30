import type { ComponentType, SVGAttributes } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  Diamond,
  Eye,
  FlipHorizontal,
  FlipVertical,
  Frame,
  Lock,
  Minus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  AlignBottomIcon as RadixAlignBottom,
  AlignCenterHorizontallyIcon as RadixAlignCenterX,
  AlignCenterVerticallyIcon as RadixAlignCenterY,
  AlignLeftIcon as RadixAlignLeft,
  AlignRightIcon as RadixAlignRight,
  AlignTopIcon as RadixAlignTop,
  AngleIcon as RadixAngle,
  AspectRatioIcon as RadixAspectRatio,
  SpaceEvenlyHorizontallyIcon as RadixSpaceEvenly,
} from '@radix-ui/react-icons'

/**
 * Single adapter between the icon libraries and the primitives.
 *
 * Two sets, each with a clear domain:
 *   - lucide-react       general UI chrome (24px grid, stroked)
 *   - @radix-ui/react-icons  alignment and transform glyphs, drawn on a 15px
 *     grid for dense inspectors — the rail-and-block shapes this UI wants
 *
 * Everything else imports semantic names from here, so replacing a library is
 * a change to this file alone.
 */

/**
 * Based on SVGAttributes<SVGElement> — the same element type Radix uses — so
 * these props flow into Radix directly and widen safely into Lucide's
 * SVGSVGElement props. `children` is dropped because Radix forbids it.
 */
export interface IconProps extends Omit<SVGAttributes<SVGElement>, 'children'> {
  size?: number
}

type RadixGlyph = ComponentType<Omit<IconProps, 'size'> & { children?: never }>

/** Lucide's 24px grid is heavier than Radix's 15px one; this evens them out. */
const LUCIDE_STROKE = 1.9

const fromLucide = (Glyph: LucideIcon): ComponentType<IconProps> =>
  function LucideAdapter({ size = 14, ...rest }: IconProps) {
    return <Glyph size={size} strokeWidth={LUCIDE_STROKE} aria-hidden focusable="false" {...rest} />
  }

const fromRadix = (Glyph: RadixGlyph): ComponentType<IconProps> =>
  function RadixAdapter({ size = 14, ...rest }: IconProps) {
    return <Glyph width={size} height={size} aria-hidden focusable="false" {...rest} />
  }

/* --- general chrome (lucide) -------------------------------------------- */

export const PlusIcon = fromLucide(Plus)
export const MinusIcon = fromLucide(Minus)
export const CloseIcon = fromLucide(X)
export const CheckIcon = fromLucide(Check)
export const ChevronDownIcon = fromLucide(ChevronDown)
export const SparkleIcon = fromLucide(Sparkles)
export const EyeIcon = fromLucide(Eye)
export const LockIcon = fromLucide(Lock)
export const FrameIcon = fromLucide(Frame)
export const CopyIcon = fromLucide(Copy)
export const FlipHIcon = fromLucide(FlipHorizontal)
export const FlipVIcon = fromLucide(FlipVertical)

/**
 * Keyframe marker. Lucide sets `fill="none"` on the svg root and leaves the
 * paths unfilled, so overriding the root fill is what solidifies it.
 */
export function KeyframeIcon({ filled = false, size = 14, ...rest }: IconProps & { filled?: boolean }) {
  return (
    <Diamond
      size={size}
      strokeWidth={LUCIDE_STROKE}
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden
      focusable="false"
      {...rest}
    />
  )
}

/* --- editor / alignment glyphs (radix) ---------------------------------- */

export const AngleIcon = fromRadix(RadixAngle)
export const AlignLeftIcon = fromRadix(RadixAlignLeft)
export const AlignCenterXIcon = fromRadix(RadixAlignCenterX)
export const AlignRightIcon = fromRadix(RadixAlignRight)
export const AlignTopIcon = fromRadix(RadixAlignTop)
export const AlignCenterYIcon = fromRadix(RadixAlignCenterY)
export const AlignBottomIcon = fromRadix(RadixAlignBottom)
export const DistributeIcon = fromRadix(RadixSpaceEvenly)
export const FitIcon = fromRadix(RadixAspectRatio)
