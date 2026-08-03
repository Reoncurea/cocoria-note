'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Camera, Edit3, MapPin, Navigation, Plus, Save, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import ContractHistory from '@/components/customer/ContractHistory'
import StageCard from '@/components/customer/StageCard'
import HoldCard from '@/components/customer/HoldCard'
import { isOnHold } from '@/lib/constants/pipeline'
import { createClient } from '@/lib/supabase/client'
import { mapDirectionsUrl, mapSearchUrl } from '@/lib/maps'
import type { Baby, Customer, CustomerContract, PlanningPhoto } from '@/types/database'

type AnswerValue = string | string[] | number | null
export type PlanningAnswerMap = Record<string, Record<string, AnswerValue>>
export type PlanningPhotoWithUrl = PlanningPhoto & { signedUrl?: string }
type PhotoUsage = { enabled: boolean; count: number; limit: number; remaining: number }

export type LastVisitSummary = {
  id: string
  visit_date: string
  start_time: string | null
  end_time: string | null
  staff_message: string | null
  next_visit_notes: string | null
  customer_notes: string | null
  report_sent: boolean
}

type NextVisit = { id: string; visit_date: string; start_time: string | null; end_time: string | null }
type BillingSummary = { contracted: boolean; invoiced: boolean; paid: boolean; amount: number | null }

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

export default function CustomerDetailClient({
  customer,
  babies,
  sessionId,
  initialAnswers,
  initialPhotos,
  photoUsage: initialPhotoUsage,
  contracts,
  billing,
  lastVisit,
  nextVisit,
}: {
  customer: Customer
  babies: Baby[]
  sessionId: string | null
  initialAnswers: PlanningAnswerMap
  initialPhotos: PlanningPhotoWithUrl[]
  photoUsage: PhotoUsage
  contracts: CustomerContract[]
  billing: BillingSummary | null
  lastVisit: (LastVisitSummary & { records: { time_label: string; content: string | null }[] }) | null
  nextVisit: NextVisit | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const id = customer.id

  const [planningAnswers, setPlanningAnswers] = useState<PlanningAnswerMap>(initialAnswers)
  const [draftAnswers, setDraftAnswers] = useState<PlanningAnswerMap>(() => cloneAnswers(initialAnswers))
  const [planningPhotos, setPlanningPhotos] = useState<PlanningPhotoWithUrl[]>(initialPhotos)
  const [photoUsage, setPhotoUsage] = useState<PhotoUsage>(initialPhotoUsage)
  const [editingPlanning, setEditingPlanning] = useState(false)
  const [savingPlanning, setSavingPlanning] = useState(false)
  const [planningMessage, setPlanningMessage] = useState<string | null>(null)
  const [planningError, setPlanningError] = useState<string | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)

  const visibleGroups = useMemo(() => {
    return PLANNING_GROUPS.map(group => ({
      ...group,
      fields: group.fields.filter(field => hasStoredAnswer(planningAnswers[field.section]?.[field.keyName])),
    })).filter(group => group.fields.length > 0)
  }, [planningAnswers])

  const updateDraft = useCallback((section: string, keyName: string, value: string) => {
    setDraftAnswers(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] ?? {}),
        [keyName]: value || null,
      },
    }))
  }, [])

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

    if (!photoUsage.enabled) {
      setPlanningError('写真アップロードはオプション機能です。')
      setPhotoUploading(false)
      return
    }

    if (photoUsage.remaining <= 0) {
      setPlanningError(`写真は1顧客につき${photoUsage.limit}枚まで保存できます。`)
      setPhotoUploading(false)
      return
    }

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
    setPhotoUsage(prev => ({ ...prev, count: prev.count + 1, remaining: Math.max(prev.remaining - 1, 0) }))
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
    setPhotoUsage(prev => ({
      ...prev,
      count: Math.max(prev.count - 1, 0),
      remaining: Math.min(prev.remaining + 1, prev.limit),
    }))
  }

  return (
    <div className="px-4 pt-5 space-y-4 pb-8">
      <StageCard
        customerId={id}
        stage={customer.pipeline_stage}
        stageUpdatedAt={customer.stage_updated_at}
        stageNote={customer.stage_note}
        isRecurring={customer.is_recurring}
        onHold={isOnHold(customer)}
      />

      <HoldCard
        customerId={id}
        holdState={customer.hold_state}
        holdReason={customer.hold_reason}
        holdUntil={customer.hold_until}
      />

      {nextVisit && <NextVisitCard customerId={id} visit={nextVisit} />}

      <div className="card space-y-3">
        <p className="section-label">カルテ情報</p>
        <InfoRow label="電話番号" value={customer.phone} href={customer.phone ? `tel:${customer.phone}` : undefined} />
        <InfoRow label="メールアドレス" value={customer.email} />
        <InfoRow label="LINE ID" value={customer.line_id} />
        <InfoRow label="住所" value={customer.address} />
        <InfoRow label="最寄駅" value={customer.nearest_station} />
        <InfoRow label="訪問手段" value={customer.transport} />
        <InfoRow label="交通経路" value={customer.route_note} />
        <InfoRow
          label="交通費"
          value={customer.transport_fee != null ? `${customer.transport_fee.toLocaleString()}円` : undefined}
        />
        <InfoRow label="問い合わせ日" value={customer.inquiry_date
          ? format(new Date(customer.inquiry_date), 'yyyy年M月d日', { locale: ja })
          : undefined} />
        {customer.is_recurring && (
          <InfoRow label="定期利用" value={customer.recurring_note ?? '定期利用中'} />
        )}
        {customer.notes && (
          <div>
            <p className="form-label">備考</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{customer.notes}</p>
          </div>
        )}

        <MapButtons address={customer.address} />
      </div>

      {lastVisit && <LastVisitCard customerId={id} visit={lastVisit} />}

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

      {billing && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <p className="section-label mb-0">請求・入金</p>
            <Link href={`/customers/${id}/billing`} className="btn-secondary text-xs px-3 py-1.5">請求画面へ</Link>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatusPill label="契約" done={billing.contracted} />
            <StatusPill label="請求" done={billing.invoiced} />
            <StatusPill label="入金" done={billing.paid} />
            {billing.amount != null && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                {billing.amount.toLocaleString()}円
              </span>
            )}
          </div>
        </div>
      )}

      {sessionId ? (
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

          <Link
            href={`/customers/${id}/planning/${sessionId}/form`}
            className="btn-secondary w-full text-sm py-2.5 block text-center"
          >
            全項目をフォームで入力する
          </Link>

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
            photoUsage={photoUsage}
            onCaptionChange={setPhotoCaption}
            onUpload={uploadPlanningPhoto}
            onUpdateCaption={updatePhotoCaption}
            onDelete={deletePhoto}
          />
        </div>
      ) : (
        <div className="card space-y-2 text-center py-6">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            プランニング情報がまだありません
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            契約履歴を登録してから、プランニングタブで開始してください。
          </p>
          <Link href={`/customers/${id}/planning`} className="btn-secondary text-sm px-4 py-2 inline-block">
            プランニングへ
          </Link>
        </div>
      )}

      <ContractHistory customerId={id} initialContracts={contracts} />

      <div className="bottom-nav-spacer" />
    </div>
  )
}

function StatusPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-full font-medium"
      style={done
        ? { background: '#dcfce7', color: '#166534' }
        : { background: '#fee2e2', color: '#991b1b' }}
    >
      {label}{done ? '済み' : '未'}
    </span>
  )
}

function MapButtons({ address }: { address: string | null }) {
  const searchUrl = mapSearchUrl(address)
  const directionsUrl = mapDirectionsUrl(address, { mode: 'transit' })
  if (!searchUrl || !directionsUrl) return null

  return (
    <div className="grid grid-cols-2 gap-2 pt-1">
      <a href={searchUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm py-2.5 text-center">
        <MapPin size={14} className="inline mr-1" />
        地図を開く
      </a>
      <a href={directionsUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm py-2.5 text-center">
        <Navigation size={14} className="inline mr-1" />
        経路を調べる
      </a>
    </div>
  )
}

function NextVisitCard({ customerId, visit }: { customerId: string; visit: NextVisit }) {
  return (
    <Link href={`/customers/${customerId}/visits/${visit.id}`}>
      <div className="card flex items-center justify-between gap-3 active:opacity-80"
        style={{ borderColor: 'var(--color-primary)' }}>
        <div>
          <p className="section-label mb-1">次回の訪問予定</p>
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
            {format(new Date(visit.visit_date), 'M月d日（E）', { locale: ja })}
            {visit.start_time && ` ${visit.start_time.slice(0, 5)}`}
            {visit.end_time && ` 〜 ${visit.end_time.slice(0, 5)}`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            訪問チェックリストを開く
          </p>
        </div>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  )
}

function LastVisitCard({
  customerId,
  visit,
}: {
  customerId: string
  visit: LastVisitSummary & { records: { time_label: string; content: string | null }[] }
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label mb-0">前回の訪問</p>
        <Link href={`/customers/${customerId}/visits/${visit.id}`} className="btn-secondary text-xs px-3 py-1.5">
          詳細
        </Link>
      </div>

      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        {format(new Date(visit.visit_date), 'yyyy年M月d日（E）', { locale: ja })}
        {visit.start_time && ` ${visit.start_time.slice(0, 5)}`}
        {visit.end_time && ` 〜 ${visit.end_time.slice(0, 5)}`}
      </p>

      {visit.records.length > 0 && (
        <div className="space-y-1">
          {visit.records.slice(0, 6).map((record, index) => (
            <div key={index} className="flex gap-2 text-xs">
              <span className="font-semibold flex-shrink-0" style={{ color: 'var(--color-primary-dark)', minWidth: '3rem' }}>
                {record.time_label}
              </span>
              <span style={{ color: 'var(--color-text)' }}>{record.content}</span>
            </div>
          ))}
        </div>
      )}

      {visit.next_visit_notes && (
        <div>
          <p className="form-label">次回への申し送り</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.next_visit_notes}</p>
        </div>
      )}

      {visit.customer_notes && (
        <div>
          <p className="form-label">顧客の様子</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.customer_notes}</p>
        </div>
      )}

      {!visit.report_sent && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#fff7ed', color: '#9a3412' }}>
          報告書がまだ送られていません
        </p>
      )}
    </div>
  )
}

function InfoRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--color-text-muted)', minWidth: '80px' }}>{label}</span>
      {href ? (
        <a href={href} className="text-sm text-right underline" style={{ color: 'var(--color-primary-dark)' }}>{value}</a>
      ) : (
        <span className="text-sm text-right" style={{ color: 'var(--color-text)' }}>{value}</span>
      )}
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
  photoUsage,
  onCaptionChange,
  onUpload,
  onUpdateCaption,
  onDelete,
}: {
  photos: PlanningPhotoWithUrl[]
  caption: string
  uploading: boolean
  photoUsage: PhotoUsage
  onCaptionChange: (caption: string) => void
  onUpload: (file: File | null) => void
  onUpdateCaption: (photoId: string, caption: string) => void
  onDelete: (photo: PlanningPhotoWithUrl) => void
}) {
  const uploadDisabled = uploading || !photoUsage.enabled || photoUsage.remaining <= 0
  const photoNotice = photoUsage.enabled
    ? `1顧客につき、訪問写真と支援計画写真を合計${photoUsage.limit}枚まで保存できます。現在は${photoUsage.count}枚保存済みです。`
    : '写真アップロードはオプション機能です。'

  return (
    <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold" style={{ color: 'var(--color-primary-dark)' }}>写真</p>
        <label className={`btn-secondary text-xs px-3 py-2 ${uploadDisabled ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
          <Camera size={14} className="inline mr-1" />
          {uploading ? '追加中' : '写真追加'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploadDisabled}
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
        <div className="space-y-1">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>写真はまだありません。</p>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {photoNotice}
          </p>
        </div>
      ) : (
        <>
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
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {photoNotice}
          </p>
        </>
      )}

      <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
        <Plus size={12} />
        JPEG / PNG / WebP、5MBまで追加できます。
      </div>
    </div>
  )
}
