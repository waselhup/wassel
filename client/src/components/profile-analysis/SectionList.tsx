import SectionListItem from './SectionListItem';
import type { SectionView } from './types';

interface Props {
  sections: SectionView[];
  activeIndex: number | null;
  isRTL: boolean;
  onSelect: (index: number) => void;
}

export default function SectionList({ sections, activeIndex, isRTL, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sections.map((s, i) => (
        <SectionListItem
          key={`${s.key}-${i}`}
          section={s}
          active={activeIndex === i}
          isRTL={isRTL}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
