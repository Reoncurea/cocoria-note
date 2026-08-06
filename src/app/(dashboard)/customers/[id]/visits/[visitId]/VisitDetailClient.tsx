'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Navigation } from 'lucide-react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { mapDirectionsUrl, mapSearchUrl } from '@/lib/maps'
import VisitChecklist from '@/components/visit/VisitChecklist'
import BreathCheckTable from '@/components/visit/BreathCheckTable'
import ServiceRecordQuickAdd from '@/components/visit/ServiceRecordQuickAdd'
import SleepLogPanel from '@/components/visit/SleepLogPanel'
import BabyObservationPanel from '@/components/visit/BabyObservationPanel'
import type { ChecklistState } from '@/lib/constants/visit-checklist'
import type { ChecklistContext } from '@/lib/visits/checklist-context'
import type {
  BabyObservation,
  BreathCheck,
  BreathCheckCell,
  ServiceRecord,
  SleepLog,
  Visit,
  VisitPhoto,
} from '@/types/database'

export type VisitPhotoWithUrl = VisitPhoto & { signedUrl?: string }

type LastVisit = {
  id: string
  visit_date: string
  start_time: string | null
  end_time: string | null
  next_visit_notes: string | null
  staff_message: string | null
  customer_notes: string | null
  records: ServiceRecord[]
}

export default function VisitDetailClient({
  customerId,
  visit,
  checklistState,
  checklistContext,
  serviceRecords,
  breathCheck,
  initialBreathCells,
  tags,
  photos,
  sleepLogs,
  observations,
  customerAddress,
  lastVisit,
}: {
  customerId: string
  visit: Visit
  checklistState: ChecklistState
  checklistContext: Record<string, ChecklistContext>
  serviceRecords: ServiceRecord[]
  breathCheck: BreathCheck | null
  initialBreathCells: BreathCheckCell[]
  tags: string[]
  photos: VisitPhotoWithUrl[]
  sleepLogs: SleepLog[]
  observations: BabyObservation[]
  customerAddress: string | null
  lastVisit: LastVisit | null
}) {
  const router = useRouter()

  const searchUrl = mapSearchUrl(customerAddress)
  const directionsUrl = mapDirectionsUrl(customerAddress, { mode: 'transit' })

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: 'var(--color-text)' }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="page-title">
            {format(new Date(visit.visit_date), 'M月d日（E）', { locale: ja })}
          </h1>
          {visit.start_time && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {visit.start_time.slice(0, 5)}{visit.end_time ? ` ～ ${visit.end_time.slice(0, 5)}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/customers/${customerId}/visits/${visit.id}/edit`} className="btn-secondary text-sm py-2.5 text-center">
          対応履歴の入力
        </Link>
        <Link href={`/customers/${customerId}/visits/${visit.id}/report`} className="btn-primary text-sm py-2.5 text-center">
          報告書
        </Link>
      </div>

      {/* 前回の訪問（訪問前に見ておきたいので上に置く） */}
      {lastVisit && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="section-label mb-0">前回の訪問</p>
            <Link href={`/customers/${customerId}/visits/${lastVisit.id}`} className="btn-secondary text-xs px-3 py-1.5">
              詳細
            </Link>
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {format(new Date(lastVisit.visit_date), 'yyyy年M月d日（E）', { locale: ja })}
            {lastVisit.start_time && ` ${lastVisit.start_time.slice(0, 5)}`}
            {lastVisit.end_time && ` 〜 ${lastVisit.end_time.slice(0, 5)}`}
          </p>

          {lastVisit.records.length > 0 && (
            <div className="space-y-1">
              {lastVisit.records.slice(0, 8).map(record => (
                <div key={record.id} className="flex gap-2 text-xs">
                  <span className="font-semibold flex-shrink-0" style={{ color: 'var(--color-primary-dark)', minWidth: '3rem' }}>
                    {record.time_label}
                  </span>
                  <span style={{ color: 'var(--color-text)' }}>{record.content}</span>
                </div>
              ))}
            </div>
          )}

          {lastVisit.next_visit_notes && (
            <div>
              <p className="form-label">次回への申し送り</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
                {lastVisit.next_visit_notes}
              </p>
            </div>
          )}

          {lastVisit.customer_notes && (
            <div>
              <p className="form-label">顧客の様子</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
                {lastVisit.customer_notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 地図 */}
      {searchUrl && directionsUrl && (
        <div className="grid grid-cols-2 gap-2">
          <a href={searchUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm py-2.5 text-center">
            <MapPin size={14} className="inline mr-1" />
            地図を開く
          </a>
          <a href={directionsUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm py-2.5 text-center">
            <Navigation size={14} className="inline mr-1" />
            経路を調べる
          </a>
        </div>
      )}

      {/* サポート内容 */}
      {tags.length > 0 && (
        <div className="card space-y-2">
          <p className="section-label">サポート内容</p>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => <span key={tag} className="tag-chip">{tag}</span>)}
          </div>
        </div>
      )}

      {/*
        訪問の流れどおりに並べる。
        呼吸チェックと作業記録は「訪問中の記録」の中に差し込み、
        作業しながらその場で残せるようにしている。
      */}
      <VisitChecklist
        visitId={visit.id}
        initialState={checklistState}
        context={checklistContext}
        phaseExtras={{
          during: (
            <div className="space-y-5 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <BreathCheckTable
                visitId={visit.id}
                initialBreathCheck={breathCheck}
                initialCells={initialBreathCells}
              />
              <SleepLogPanel
                visitId={visit.id}
                initialLogs={sleepLogs}
              />
              <BabyObservationPanel
                visitId={visit.id}
                initialObservations={observations}
              />
              <ServiceRecordQuickAdd
                visitId={visit.id}
                initialRecords={serviceRecords}
              />
            </div>
          ),
        }}
        footer={
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              チェックが終わったら、詳細な対応履歴を入力して報告書を作ります。
            </p>
            <Link
              href={`/customers/${customerId}/visits/${visit.id}/edit`}
              className="btn-primary w-full text-sm py-3 block text-center"
            >
              詳細な対応履歴を入力 →
            </Link>
          </div>
        }
      />

      {/* 写真共有 */}
      {photos.length > 0 && (
        <div className="card space-y-3">
          <p className="section-label">写真共有</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map(photo => (
              <div key={photo.id} className="space-y-2 rounded-xl p-3"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                {photo.signedUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.signedUrl}
                    alt={photo.caption ?? '訪問写真'}
                    className="w-full rounded-lg object-cover"
                    style={{ aspectRatio: '4 / 3' }}
                  />
                )}
                {photo.caption && (
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{photo.caption}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* メッセージ */}
      {(visit.staff_message || visit.customer_message) && (
        <div className="card space-y-3">
          <p className="section-label">メッセージ</p>
          {visit.staff_message && (
            <div>
              <p className="form-label">担当者から</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.staff_message}</p>
            </div>
          )}
          {visit.customer_message && (
            <div>
              <p className="form-label">ご依頼主から</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.customer_message}</p>
            </div>
          )}
        </div>
      )}

      {/* 非公開メモ */}
      {(visit.customer_notes || visit.next_visit_notes || visit.drive_link) && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <p className="section-label mb-0">非公開メモ</p>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>非公開</span>
          </div>
          {visit.customer_notes && (
            <div>
              <p className="form-label">顧客の様子</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.customer_notes}</p>
            </div>
          )}
          {visit.next_visit_notes && (
            <div>
              <p className="form-label">次回の予定・申し引き事項</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{visit.next_visit_notes}</p>
            </div>
          )}
          {visit.drive_link && (
            <div>
              <p className="form-label">Googleドライブ等の共有リンク</p>
              <a
                href={visit.drive_link}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline break-all"
                style={{ color: 'var(--color-primary-dark)' }}
              >
                {visit.drive_link}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="bottom-nav-spacer" />
    </div>
  )
}
