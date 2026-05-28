import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface TaskRow {
  id: string;
  agent_id: string;
  task_type: string;
  title: string;
  preview?: { caption_snippet?: string } | null;
  expected_impact?: string | null;
  created_at: string;
}

interface Props {
  isAr: boolean;
}

export default function FatimaSuggestionsLane({ isAr }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await trpc.faris.getApprovalQueue({
          filter: 'pending',
          agentId: 'fatima',
          limit: 20,
        });
        if (!cancelled) setTasks((data?.rows as TaskRow[]) || []);
      } catch {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const CARD: React.CSSProperties = {
    background: '#FDF2F8',
    border: '1px solid #FBCFE8',
    borderRadius: 14,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  return (
    <section style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Lightbulb size={18} color="#EC4899" />
        <h2 style={{
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          fontWeight: 900, fontSize: 18, color: '#831843', margin: 0,
        }}>
          {isAr ? 'اقتراحات فاطمة' : "Fatima's Suggestions"}
        </h2>
      </div>
      <p style={{ fontSize: 12, color: '#9D174D', margin: '0 0 14px 0' }}>
        {isAr
          ? 'فاطمة لا تنشر — فقط تقترح أنماط احتكاك وفرص تحسين. اقرأ، قرّر، اعتمد بنفسك.'
          : 'Fatima never publishes — she only suggests friction patterns and improvement opportunities. Read, decide, act yourself.'}
      </p>

      {loading && (
        <div style={{ padding: 18, color: '#9D174D', fontSize: 13 }}>
          {isAr ? 'جاري التحميل…' : 'Loading…'}
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#BE185D', fontSize: 13 }}>
          {isAr ? 'لا توجد اقتراحات حالياً' : 'No suggestions right now'}
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((task) => (
            <div key={task.id} style={{
              background: '#fff',
              border: '1px solid #FBCFE8',
              borderRadius: 10,
              padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#EC4899',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}>
                  <Lightbulb size={12} />
                </div>
                <div style={{
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 800, fontSize: 13, color: '#0F172A',
                  flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {task.title}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 999,
                  background: '#FBCFE8', color: '#831843',
                }}>
                  {isAr ? 'اقتراح فقط' : 'Suggest only'}
                </span>
              </div>
              {task.preview?.caption_snippet && (
                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginInlineStart: 32 }}>
                  {String(task.preview.caption_snippet).slice(0, 200)}
                </div>
              )}
              {task.expected_impact && (
                <div style={{ marginTop: 6, marginInlineStart: 32, fontSize: 11, color: '#EC4899', fontWeight: 700 }}>
                  {task.expected_impact}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
