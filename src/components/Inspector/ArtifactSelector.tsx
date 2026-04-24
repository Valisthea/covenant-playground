import { Code, Binary, Zap, FileJson } from 'lucide-react';

export type ArtifactKind = 'ir' | 'evm' | 'wasm' | 'abi';

interface Props {
  selected: ArtifactKind;
  available: ArtifactKind[];
  onChange: (k: ArtifactKind) => void;
}

const ITEMS: { kind: ArtifactKind; label: string; icon: typeof Code; tooltip: string }[] = [
  { kind: 'ir', label: 'IR', icon: Code, tooltip: 'Intermediate representation with source-mapped opcodes' },
  { kind: 'evm', label: 'EVM', icon: Binary, tooltip: 'EVM bytecode hex dump' },
  { kind: 'wasm', label: 'WASM', icon: Zap, tooltip: 'WebAssembly module hex dump' },
  { kind: 'abi', label: 'ABI', icon: FileJson, tooltip: 'Contract ABI JSON' },
];

export function ArtifactSelector({ selected, available, onChange }: Props) {
  return (
    <div className="ai-selector" role="tablist" aria-label="Artifact kind">
      {ITEMS.map(({ kind, label, icon: Icon, tooltip }) => {
        const enabled = available.includes(kind);
        const active = selected === kind;
        return (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={!enabled}
            className={`ai-selector-btn ${active ? 'is-active' : ''}`}
            onClick={() => enabled && onChange(kind)}
            title={tooltip}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
