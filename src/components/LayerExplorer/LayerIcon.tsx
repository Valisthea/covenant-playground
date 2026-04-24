import { Shield, Eye, Sparkles, Archive } from 'lucide-react';
import { LAYER_METADATA, type LayerId } from '../../lib/layer-analysis';

interface Props {
  layer: LayerId;
  size?: number;
  /** Override the layer's strategic color (e.g. when faded/unused). */
  color?: string;
}

const ICONS = {
  shield: Shield,
  eye: Eye,
  sparkles: Sparkles,
  archive: Archive,
} as const;

export function LayerIcon({ layer, size = 16, color }: Props) {
  const meta = LAYER_METADATA[layer];
  const Icon = ICONS[meta.iconKey];
  return <Icon size={size} color={color ?? meta.color} aria-hidden="true" />;
}
