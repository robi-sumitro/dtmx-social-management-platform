import { useMemo, useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Wand2,
  Type,
  Hash,
  MessagesSquare,
  Lightbulb,
  PenLine,
} from 'lucide-react';
import { useFetch } from '@/lib/useApi';
import { api } from '@/lib/api';
import type { AiStatus } from '@/lib/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea, Select } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { PageLoader } from '@/components/ui/Loading';
import { ProgressBar } from '@/components/ui/Progress';

const TEMPLATES = [
  {
    icon: Type,
    label: 'Caption Umum',
    prompt: 'Tulis 3 variasi caption postingan media sosial yang engaging tentang: "{topic}"',
  },
  {
    icon: Hash,
    label: 'Hashtag Generator',
    prompt: 'Buat 15 hashtag yang relevan dan populer untuk topik: "{topic}"',
  },
  {
    icon: MessagesSquare,
    label: 'Balasan Komentar',
    prompt: 'Buat 3 balasan ramah dan profesional untuk komentar ini: "{topic}"',
  },
  {
    icon: Lightbulb,
    label: 'Ide Konten',
    prompt: 'Buat 10 ide konten kreatif untuk niche: "{topic}"',
  },
  {
    icon: PenLine,
    label: 'Thread / Story',
    prompt: 'Tulis thread/story yang menarik tentang: "{topic}" dalam 5 bagian pendek',
  },
  {
    icon: Wand2,
    label: 'Email Marketing',
    prompt: 'Tulis draft email marketing persuasif untuk produk: "{topic}"',
  },
];

export function AIStudio() {
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [topic, setTopic] = useState('');
  const [feature, setFeature] = useState('content_writer');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const status = useFetch<AiStatus>(() => api.get('/ai/status'));

  const generate = async (customPrompt?: string) => {
    const finalPrompt = customPrompt?.replaceAll('{topic}', topic.trim() || 'topik kamu');
    if (!finalPrompt?.trim()) {
      toast.warning('Prompt kosong', 'Tulis ide atau pilih template.');
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const res = await api.post<{ content: string }>('/ai/generate', {
        prompt: finalPrompt,
        feature,
      });
      setResult(res.content ?? '');
      status.refetch();
    } catch (err) {
      toast.error('Gagal generate', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Disalin ke clipboard');
    } catch {
      /* noop */
    }
  };

  const percent = useMemo(() => {
    const s = status.data;
    if (!s || s.quota === 0) return 0;
    return Math.min(100, Math.round((s.used / s.quota) * 100));
  }, [status.data]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="AI Studio"
        description="Tulis konten, hashtag, dan balasan lebih cepat dengan bantuan AI."
      />

      {status.loading ? (
        <PageLoader label="Memuat kuota AI..." />
      ) : (
        <Card className="mb-6">
          <CardHeader icon={<Sparkles className="h-4 w-4" />} title="Kuota AI Bulan Ini" />
          <CardBody>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                {status.data?.used ?? 0} dari {status.data?.quota ?? 0} generate terpakai
              </span>
              <span className="font-semibold text-brand-600">{percent}%</span>
            </div>
            <ProgressBar value={status.data?.used ?? 0} max={status.data?.quota ?? 0} color={percent >= 100 ? 'rose' : 'brand'} />
            <p className="mt-3 text-xs text-slate-400">
              {status.data?.limitReached
                ? 'Kuota habis. Upgrade paket di halaman Billing.'
                : `Provider aktif: ${status.data?.provider ?? '-'}`}
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader icon={<Wand2 className="h-4 w-4" />} title="Generator Konten" description="Satu prompt, hasil siap pakai." />
            <CardBody className="space-y-4">
              <Textarea
                rows={5}
                placeholder="Contoh: Tulis caption promosi untuk produk skincare baru..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="resize-none"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField label="Konteks / Topik (opsional)" value={topic} onChange={setTopic} placeholder="mis. skincare lokal" />
                <Select label="Fitur" value={feature} onChange={(e) => setFeature(e.target.value)}>
                  <option value="content_writer">Content Writer</option>
                  <option value="caption_help">Caption Help</option>
                  <option value="auto_reply">Auto Reply</option>
                </Select>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <Button
                  variant="secondary"
                  onClick={() => void generate()}
                  loading={loading}
                  icon={!loading ? <RefreshCw className="h-4 w-4" /> : undefined}
                >
                  Generate Ulang
                </Button>
                <Button onClick={() => void generate()} loading={loading} icon={!loading ? <Sparkles className="h-4 w-4" /> : undefined}>
                  Generate Konten
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Sparkles className="h-4 w-4" />} title="Hasil" />
            <CardBody>
              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                </div>
              ) : result ? (
                <div className="relative">
                  <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-5 font-sans text-sm leading-relaxed text-slate-700">
                    {result}
                  </pre>
                  <Button size="sm" variant="secondary" className="absolute right-3 top-3" onClick={copyResult} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
                    {copied ? 'Tersalin' : 'Salin'}
                  </Button>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-slate-400">
                  Hasil generate akan muncul di sini. ✨
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader icon={<Lightbulb className="h-4 w-4" />} title="Template Cepat" description="Klik untuk mengisi prompt secara otomatis" />
            <CardBody className="space-y-2.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setPrompt(t.prompt)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3.5 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <t.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{t.label}</span>
                    <span className="block text-xs text-slate-400">{t.prompt.slice(0, 60)}...</span>
                  </span>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
    </div>
  );
}
