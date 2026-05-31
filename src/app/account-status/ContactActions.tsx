'use client'

import { useState } from 'react'

type ContactActionsProps = {
  body: string
  email: string
  label: string
  subject: string
}

function buildGmailLink({
  body,
  email,
  subject,
}: {
  body: string
  email: string
  subject: string
}) {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: email,
    su: subject,
    body,
  })

  return `https://mail.google.com/mail/?${params.toString()}`
}

export function ContactActions({ body, email, label, subject }: ContactActionsProps) {
  const gmailLink = buildGmailLink({ body, email, subject })
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiedLabel(label)
    window.setTimeout(() => setCopiedLabel(null), 2000)
  }

  return (
    <div className="space-y-3 text-left">
      <a href={gmailLink} target="_blank" rel="noreferrer" className="btn-primary block w-full text-center">
        {label}
      </a>

      <p className="text-xs leading-relaxed text-center" style={{ color: 'var(--color-text-muted)' }}>
        Gmailを使っていない場合や、メール画面が開かない場合は、下の送信先・件名・本文をコピーして、ご利用のメールや連絡ツールに貼り付けてください。
      </p>

      {copiedLabel && (
        <div className="px-3 py-2 rounded-lg text-xs text-center" style={{ background: '#ecfdf5', color: '#047857' }}>
          {copiedLabel}をコピーしました
        </div>
      )}

      <div className="rounded-xl p-3 text-xs space-y-2" style={{ background: 'var(--color-surface)' }}>
        <div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>送信先</p>
          <div className="flex items-center gap-2">
            <p className="break-all flex-1" style={{ color: 'var(--color-text-muted)' }}>{email}</p>
            <button
              type="button"
              onClick={() => copyText('送信先', email)}
              className="px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: '#fff', color: 'var(--color-primary-dark)' }}
            >
              コピー
            </button>
          </div>
        </div>

        <div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>件名</p>
          <div className="flex items-center gap-2">
            <p className="break-all flex-1" style={{ color: 'var(--color-text-muted)' }}>{subject}</p>
            <button
              type="button"
              onClick={() => copyText('件名', subject)}
              className="px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: '#fff', color: 'var(--color-primary-dark)' }}
            >
              コピー
            </button>
          </div>
        </div>

        <div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>本文</p>
          <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {body}
          </p>
          <button
            type="button"
            onClick={() => copyText('本文', body)}
            className="mt-2 px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ background: '#fff', color: 'var(--color-primary-dark)' }}
          >
            本文をコピー
          </button>
        </div>
      </div>
    </div>
  )
}
