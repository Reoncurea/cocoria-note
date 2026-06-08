'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Edit3, Plus, Save, Trash2, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import ContractHistory from '@/components/customer/ContractHistory'
import { createClient } from '@/lib/supabase/client'
import type { Baby, Customer, PlanningPhoto } from '@/types/database'

type AnswerValue = string | string[] | number | null
type PlanningAnswerMap = Record<string, Record<string, AnswerValue>>
type PlanningSessionSummary = { id: string; created_at?: string; status?: string }
type PlanningPhotoWithUrl = PlanningPhoto & { signedUrl?: string }

type EditableField = {
  section: string
  keyName: string
  label: string
  multiline?: boolean
  suffix?: string
}

type EditableGroup = {
  title: string
  fields: EditableField[]
}

const PLANNING_GROUPS: EditableGroup[] = [
  {
    title: 'サポート体制・訪問頻度',
    fields: [
      { section: 'partner_support', keyName: 'desired_support', label: '依頼内容', multiline: true },
      { section: 'partner_support', keyName: 'support_start', label: '開始時期' },
      { section: 'partner_support', keyName: 'support_frequency', label: '曜日・頻度' },
      { section: 'partner_support', keyName: 'support_time', label: '訪問時間' },
      { section: 'partner_support', keyName: 'support_end', label: '終了予定' },
      { section: 'partner_support', keyName: 'discharge_supporter', label: '退院後サポーター', multiline: true },
      { section: 'partner_support', keyName: 'no_go_zones', label: '立入禁止・触れてほしくないもの', multiline: true },
    ],
  },
  {
    title: '食事・アレルギー',
    fields: [
      { section: 'family_mama', keyName: 'mama_allergy', label: 'ママのアレルギー', multiline: true },
      { section: 'family_papa', keyName: 'papa_allergy', label: 'パパのアレルギー', multiline: true },
      { section: 'housework_meal', keyName: 'seasonings', label: '使用調味料', multiline: true },
      { section: 'housework_meal', keyName: 'mama_likes', label: 'ママの好きなもの', multiline: true },
      { section: 'housework_meal', keyName: 'mama_dislikes', label: 'ママの苦手なもの', multiline: true },
      { section: 'housework_meal', keyName: 'papa_likes', label: 'パパの好きなもの', multiline: true },
      { section: 'housework_meal', keyName: 'papa_dislikes', label: 'パパの苦手なもの', multiline: true },
      { section: 'housework_meal', keyName: 'meal_notes', label: '食事メモ', multiline: true },
    ],
  },
  {
    title: '上のお子さま',
    fields: [
      { section: 'family_children', keyName: 'child_name', label: 'お名前' },
      { section: 'family_children', keyName: 'child_school', label: '保育園・学校' },
      { section: 'family_children', keyName: 'child_lessons', label: '習い事', multiline: true },
      { section: 'family_children', keyName: 'child_allergy', label: 'アレルギー', multiline: true },
    ],
  },
  {
    title: '赤ちゃんのお世話',
    fields: [
      { section: 'baby_info', keyName: 'baby_name', label: 'お名前' },
      { section: 'baby_info', keyName: 'baby_gender', label: '性別' },
      { section: 'baby_info', keyName: 'baby_birth_date', label: '生年月日' },
      { section: 'baby_info', keyName: 'baby_notes', label: '特記事項', multiline: true },
      { section: 'baby_bath', keyName: 'bath_place', label: '沐浴場所' },
      { section: 'baby_bath', keyName: 'baby_soap', label: 'ベビーソープ' },
      { section: 'baby_bath', keyName: 'bath_notes', label: '沐浴メモ', multiline: true },
      { section: 'baby_milk', keyName: 'milk_type', label: 'ミルクの種類' },
      { section: 'baby_milk', keyName: 'milk_amount', label: '1回量', suffix: 'ml' },
      { section: 'baby_milk', keyName: 'milk_frequency', label: 'ミルク頻度' },
      { section: 'baby_milk', keyName: 'milk_notes', label: 'ミルクメモ', multiline: true },
      { section: 'baby_sleep', keyName: 'sleep_place', label: '寝かしつけ場所' },
      { section: 'baby_sleep', keyName: 'sleep_light', label: '電気' },
      { section: 'baby_sleep', keyName: 'sleep_notes', label: '寝かしつけメモ', multiline: true },
    ],
  },
  {
    title: '防災',
    fields: [
      { section: 'evacuation', keyName: 'evac_place', label: '避難場所' },
      { section: 'evacuation', keyName: 'evac_address', label: '住所' },
      { section: 'evacuation', keyName: 'evac_transport', label: '移動手段' },
    ],
  },
]

function hasStoredAnswer(value: unknown): boolean {
  if (value == null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

function formatAnswer(value: AnswerValue | undefined, suffix?: string): string {
  if (!hasStoredAnswer(value)) return ''
  const text = Array.isArray(value) ? value.join('・') : String(value)
  return suffix && text ? `${text}${suffix}` : text
}

function toInputValue(value: AnswerValue | undefined): string {
  if (!hasStoredAnswer(value)) return ''
  return Array.isArray(value) ? value.join('、') : String(value)
}

function cloneAnswers(answers: PlanningAnswerMap): PlanningAnswerMap {
  return JSON.parse(JSON.stringify(answers)) as PlanningAnswerMap
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = useMemo(() => createClient(), [])

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [babies, setBabies] = useState<Baby[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [planningAnswers, setPlanningAnswers] = useState<PlanningAnswerMap>({})
  const [draftAnswers, setDraftAnswers] = useState<PlanningAnswerMap>({})
  const [planningPhotos, setPlanningPhotos] = useState<PlanningPhotoWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPlanning, setEditingPlanning] = useState(false)
  const [savingPlanning, setSavingPlanning] = useState(false)
  const [planningMessage, setPlanningMessage] = useState<string | null>(null)
  const [planningError, setPlanningError] = useState<string | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)

  const withSignedUrls = useCallback(async (photoRows: PlanningPhoto[]): Promise<PlanningPhotoWithUrl[]> => {
    return Promise.all(photoRows.map(async photo => {
      const { data } = await supabase.storage.from('planning-photos').createSignedUrl(photo.file_path, 60 * 60)
      return { ...photo, signedUrl: data?.signedUrl }
    }))
  }, [supabase])

  useEffect(() => {
    let ignore = false

    async function load() {
      const [cRes, bRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('babies').select('*').eq('customer_id', id).order('sort_order'),
      ])
      if (ignore) return
      setCustomer(cRes.data)
      setBabies(bRes.data ?? [])

      const sessRes = await fetch(`/api/planning/sessions?customer_id=${id}`)
      const sessions = await sessRes.json() as PlanningSessionSummary[]

      if (Array.isArray(sessions) && sessions.length > 0) {
        const latest = sessions[0]
        setSessionId(latest.id)

        const sessionRes = await fetch(`/api/planning/sessions/${latest.id}`)
        const sessionData = await sessionRes.json()
        const answerMap: PlanningAnswerMap = {}
        for (const row of sessionData.answers ?? []) {
          answerMap[row.section_id] = row.answers
        }

        if (ignore) return
        setPlanningAnswers(answerMap)
        setDraftAnswers(cloneAnswers(answerMap))

        const { data: photoRows } = await supabase
          .from('planning_photos')
          .select('*')
          .eq('session_id', latest.id)
          .order('sort_order')
        if (!ignore) setPlanningPhotos(await withSignedUrls((photoRows ?? []) as PlanningPhoto[]))
      }

      if (!ignore) setLoading(false)
    }

    void load()
    return () => { ignore = true }
  }, [id, supabase, withSignedUrls])

  const visibleGroups = useMemo(() => {
    return PLANNING_GROUPS.map(group => ({
      ...group,
      fields: group.fields.filter(field => hasStoredAnswer(planningAnswers[field.section]?.[field.keyName])),
    })).filter(group => group.fields.length > 0)
  }, [planningAnswers])

  function updateDraft(section: string, keyName: string, value: string) {
    setDraftAnswers(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] ?? {}),
        [keyName]: value || null,
      },
    }))
  }

  function startPlanningEdit() {
    setDraftAnswers(cloneAnswers(planningAnswers))
    setPlanningMessage(null)
    setPlanningError(null)
    setEditingPlanning(true)
  }

  async function savePlanningAnswers() {
    if (!sessionId) return
    setSavingPlanning(true)
    setPlanningMessage(null)
    setPlanningError(null)

    const sections = Object.entries(draftAnswers)
    const responses = await Promise.all(sections.map(([section_id, answers]) =>
      fetch(`/api/planning/sessions/${sessionId}/answers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id, answers }),
      })
    ))

    setSavingPlanning(false)
    if (responses.some(response => !response.ok)) {
      setPlanningError('プランニング情報の保存に失敗しました。時間をおいて再度お試しください。')
      return
    }

    setPlanningAnswers(cloneAnswers(draftAnswers))
    setEditingPlanning(false)
    setPlanningMessage('プランニング情報を保存しました。')
  }

  async function uploadPlanningPhoto(file: File | null) {
    if (!file || !sessionId) return

    setPhotoUploading(true)
    setPlanningError(null)

    const formData = new FormData()
    formData.append('file', file)
    if (photoCaption) formData.append('caption', photoCaption)

    const response = await fetch(`/api/planning/sessions/${sessionId}/photos`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null
      setPlanningError(data?.error ?? '写真のアップロードに失敗しました。')
      setPhotoUploading(false)
      return
    }

    const photo = await response.json() as PlanningPhotoWithUrl
    setPlanningPhotos(prev => [...prev, photo])
    setPhotoCaption('')
    setPhotoUploading(false)
    setPlanningMessage('写真を追加しました。')
  }

  async function updatePhotoCaption(photoId: string, caption: string) {
    setPlanningPhotos(prev => prev.map(photo => photo.id === photoId ? { ...photo, caption } : photo))
    await supabase.from('planning_photos').update({ caption: caption || null }).eq('id', photoId)
  }

  async function deletePhoto(photo: PlanningPhotoWithUrl) {
    const ok = window.confirm('この写真を削除しますか？')
    if (!ok) return
    await supabase.from('planning_photos').delete().eq('id', photo.id)
    await supabase.storage.from('planning-photos').remove([photo.file_path])
    setPlanningPhotos(prev => prev.filter(item => item.id !== photo.id))
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: '50vh' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  if (!customer) {
    return <div className="text-center py-20" style={{ color: 'var(--color-text-muted)' }}>顧客が見つかりません</div>
  }

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
      <div className="card space-y-3">
        <p className="section-label">カルテ情報</p>
        <InfoRow label="電話番号" value={customer.phone} />
        <InfoRow label="メールアドレス" value={customer.email} />
        <InfoRow label="LINE ID" value={customer.line_id} />
        <InfoRow label="住所" value={customer.address} />
        <InfoRow label="訪問手段" value={customer.transport} />
        <InfoRow label="問い合わせ日" value={customer.inquiry_date
          ? format(new Date(customer.inquiry_date), 'yyyy年M月d日', { locale: ja })
          : undefined} />
        {customer.notes && (
          <div>
            <p className="form-label">備考</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{customer.notes}</p>
          </div>
        )}
      </div>

      {babies.length > 0 && (
        <div className="card space-y-3">
          <p className="section-label">赤ちゃん情報</p>
          {babies.map((baby, index) => (
            <div key={baby.id} className="p-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text)' }}>
                {baby.name ?? `赤ちゃん ${index + 1}`}
              </p>
              {baby.birth_date && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  出生日: {format(new Date(baby.birth_date), 'yyyy年M月d日', { locale: ja })}
                </p>
              )}
              {baby.due_date && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  出産予定日: {format(new Date(baby.due_date), 'yyyy年M月d日', { locale: ja })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {sessionId && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-label mb-1">プランニング情報</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                この画面から直接修正、メモ追加、写真追加ができます。
              </p>
            </div>
            {editingPlanning ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingPlanning(false)} className="btn-secondary text-xs px-3 py-2">
                  <X size={14} className="inline mr-1" />
                  取消
                </button>
                <button type="button" onClick={savePlanningAnswers} disabled={savingPlanning} className="btn-primary text-xs px-3 py-2 disabled:opacity-60">
                  <Save size={14} className="inline mr-1" />
                  {savingPlanning ? '保存中' : '保存'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={startPlanningEdit} className="btn-secondary text-xs px-3 py-2">
                <Edit3 size={14} className="inline mr-1" />
                直接修正
              </button>
            )}
          </div>

          {planningError && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ background: '#fef2f2', color: '#dc2626' }}>
              {planningError}
            </div>
          )}
          {planningMessage && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ background: '#ecfdf5', color: '#047857' }}>
              {planningMessage}
            </div>
          )}

          {editingPlanning ? (
            <PlanningEditForm answers={draftAnswers} onChange={updateDraft} />
          ) : visibleGroups.length > 0 ? (
            <PlanningReadOnlyGroups groups={visibleGroups} answers={planningAnswers} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>表示できるプランニング情報はまだありません。</p>
          )}

          <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>担当者メモ</p>
            <textarea
              className="input text-sm"
              rows={4}
              placeholder="訪問時の注意点、引き継ぎ、気づいたことなど"
              value={toInputValue(draftAnswers.other?.memo ?? planningAnswers.other?.memo)}
              onChange={event => updateDraft('other', 'memo', event.target.value)}
              onBlur={() => {
                if (!editingPlanning) void savePlanningAnswers()
              }}
            />
            {!editingPlanning && (
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                メモ欄は入力後にフォーカスを外すと自動保存されます。
              </p>
            )}
          </div>

          <PlanningPhotos
            photos={planningPhotos}
            caption={photoCaption}
            uploading={photoUploading}
            onCaptionChange={setPhotoCaption}
            onUpload={uploadPlanningPhoto}
            onUpdateCaption={updatePhotoCaption}
            onDelete={deletePhoto}
          />
        </div>
      )}

      <ContractHistory customerId={id} />

      <div className="bottom-nav-spacer" />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--color-text-muted)', minWidth: '80px' }}>{label}</span>
      <span className="text-sm text-right" style={{ color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}

function PlanningReadOnlyGroups({ groups, answers }: { groups: EditableGroup[]; answers: PlanningAnswerMap }) {
  return (
    <div className="space-y-5">
      {groups.map(group => (
        <div key={group.title}>
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary-dark)' }}>{group.title}</p>
          <div className="space-y-1">
            {group.fields.map(field => (
              <InfoRow
                key={`${field.section}.${field.keyName}`}
                label={field.label}
                value={formatAnswer(answers[field.section]?.[field.keyName], field.suffix)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PlanningEditForm({
  answers,
  onChange,
}: {
  answers: PlanningAnswerMap
  onChange: (section: string, keyName: string, value: string) => void
}) {
  return (
    <div className="space-y-5">
      {PLANNING_GROUPS.map(group => (
        <div key={group.title} className="space-y-3">
          <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>{group.title}</p>
          {group.fields.map(field => {
            const value = toInputValue(answers[field.section]?.[field.keyName])
            return (
              <label key={`${field.section}.${field.keyName}`} className="block space-y-1.5">
                <span className="form-label">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    className="input text-sm"
                    rows={3}
                    value={value}
                    onChange={event => onChange(field.section, field.keyName, event.target.value)}
                  />
                ) : (
                  <input
                    className="input text-sm"
                    value={value}
                    onChange={event => onChange(field.section, field.keyName, event.target.value)}
                  />
                )}
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function PlanningPhotos({
  photos,
  caption,
  uploading,
  onCaptionChange,
  onUpload,
  onUpdateCaption,
  onDelete,
}: {
  photos: PlanningPhotoWithUrl[]
  caption: string
  uploading: boolean
  onCaptionChange: (caption: string) => void
  onUpload: (file: File | null) => void
  onUpdateCaption: (photoId: string, caption: string) => void
  onDelete: (photo: PlanningPhotoWithUrl) => void
}) {
  return (
    <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>写真</p>
        <label className="btn-secondary text-xs px-3 py-2 cursor-pointer">
          <Camera size={14} className="inline mr-1" />
          {uploading ? '追加中' : '写真追加'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={event => {
              onUpload(event.target.files?.[0] ?? null)
              event.currentTarget.value = ''
            }}
          />
        </label>
      </div>

      <textarea
        className="input text-sm"
        rows={2}
        placeholder="写真に添えるメモ（任意）"
        value={caption}
        onChange={event => onCaptionChange(event.target.value)}
      />

      {photos.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>写真はまだありません。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {photos.map(photo => (
            <div key={photo.id} className="space-y-2 rounded-xl p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              {photo.signedUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.signedUrl}
                  alt={photo.caption ?? 'プランニング写真'}
                  className="w-full rounded-lg object-cover"
                  style={{ aspectRatio: '4 / 3' }}
                />
              )}
              <textarea
                className="input text-sm"
                rows={2}
                defaultValue={photo.caption ?? ''}
                placeholder="写真メモ"
                onBlur={event => onUpdateCaption(photo.id, event.target.value)}
              />
              <button type="button" onClick={() => onDelete(photo)} className="btn-secondary w-full text-sm py-2">
                <Trash2 size={14} className="inline mr-1" />
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
        <Plus size={12} />
        JPEG / PNG / WebP、5MBまで追加できます。
      </div>
    </div>
  )
}
