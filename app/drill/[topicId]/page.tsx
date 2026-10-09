import DrillSession from '@/components/DrillSession';

export default async function TopicDrillPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-header">
        <div className="page-title">Flashcard Drill</div>
        <div className="page-sub">Topic drill · FSRS spaced repetition</div>
      </div>
      <DrillSession topicId={topicId} />
    </div>
  );
}
