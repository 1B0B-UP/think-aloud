import DrillSession from '@/components/DrillSession';

export default function DrillPage() {
  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-header">
        <div className="page-title">Flashcard Drill</div>
        <div className="page-sub">All due cards · FSRS spaced repetition</div>
      </div>
      <DrillSession />
    </div>
  );
}
